import { randomUUID } from 'crypto';
import { getIkas } from '@/helpers/api-helpers';
import { prisma } from '@/lib/prisma';

type IkasClient = ReturnType<typeof getIkas>;

/**
 * Per-variant campaign record. A clearance campaign works by writing
 * `discountPrice` (the storefront sale price) while leaving `sellPrice` as the
 * struck-through normal price. `originalDiscountPrice` is captured before the
 * write so removing the campaign can restore the previous state.
 */
export type CampaignVariantInput = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sellPrice: number;
  buyPrice: number | null;
  originalDiscountPrice: number | null;
};

export type CampaignVariantRecord = CampaignVariantInput & {
  discountPrice: number;
};

/** Variant entries as stored in ClearanceCampaign.variants (JSON). */
export type StoredCampaignVariant = Partial<CampaignVariantRecord> & {
  variantId: string;
  productName: string;
  variantLabel: string;
};

export type CreateClearanceCampaignInput = {
  merchantId: string;
  title: string;
  discountPercent: number;
  ruleId?: string;
  variants: CampaignVariantInput[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function clearanceDiscountPrice(sellPrice: number, discountPercent: number): number {
  return round2(sellPrice * (1 - discountPercent / 100));
}

export function parseStoredVariants(raw: string | null): StoredCampaignVariant[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredCampaignVariant[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeVariantPrices(
  ikasClient: IkasClient,
  variants: Array<{
    variantId: string;
    productId: string;
    sellPrice: number;
    buyPrice: number | null;
    discountPrice: number | null;
  }>,
): Promise<void> {
  const response = await ikasClient.mutations.updateVariantPrices({
    input: {
      variantPriceInputs: variants.map((v) => ({
        productId: v.productId,
        variantId: v.variantId,
        price: {
          sellPrice: v.sellPrice,
          buyPrice: v.buyPrice,
          discountPrice: v.discountPrice,
        },
      })),
    },
  } as never);

  const errors = response.data?.updateVariantPrices?.errors ?? [];
  if (!response.isSuccess || errors.length > 0) {
    const detail = errors.map((e) => `${e.errorCode}#${e.inputArrayIndex}`).join(', ');
    throw new Error(`updateVariantPrices failed: ${detail || 'unknown error'}`);
  }
}

/** Writes the clearance discount price for each variant. */
export async function applyVariantDiscounts(ikasClient: IkasClient, variants: CampaignVariantRecord[]): Promise<void> {
  await writeVariantPrices(
    ikasClient,
    variants.map((v) => ({
      variantId: v.variantId,
      productId: v.productId,
      sellPrice: v.sellPrice,
      buyPrice: v.buyPrice,
      discountPrice: v.discountPrice,
    })),
  );
}

/** Restores the pre-campaign discount price (null clears the sale price). */
export async function restoreVariantPrices(ikasClient: IkasClient, variants: CampaignVariantInput[]): Promise<void> {
  await writeVariantPrices(
    ikasClient,
    variants.map((v) => ({
      variantId: v.variantId,
      productId: v.productId,
      sellPrice: v.sellPrice,
      buyPrice: v.buyPrice,
      discountPrice: v.originalDiscountPrice,
    })),
  );
}

/**
 * Applies a clearance discount to the given variants and records the campaign.
 *
 * The discount is realized purely through variant `discountPrice` — the
 * storefront shows the struck-through sell price plus the "%X indirim" badge.
 * If the price write fails, already-written rows are rolled back to their
 * original prices before the error propagates.
 */
export async function createClearanceCampaign(
  ikasClient: IkasClient,
  input: CreateClearanceCampaignInput,
): Promise<{ campaignId: string; title: string }> {
  const { merchantId, title, discountPercent, ruleId, variants } = input;

  const records: CampaignVariantRecord[] = variants.map((v) => ({
    ...v,
    discountPrice: clearanceDiscountPrice(v.sellPrice, discountPercent),
  }));

  try {
    await applyVariantDiscounts(ikasClient, records);
  } catch (error) {
    try {
      await restoreVariantPrices(ikasClient, variants);
    } catch (restoreError) {
      console.error('Price rollback failed after failed campaign create:', restoreError);
    }
    throw error;
  }

  const campaignId = randomUUID();
  await prisma.clearanceCampaign.create({
    data: {
      merchantId,
      campaignId,
      ruleId: ruleId || null,
      title,
      discountPercent,
      variantIds: JSON.stringify(records.map((r) => r.variantId)),
      variants: JSON.stringify(records),
      status: 'active',
    },
  });

  return { campaignId, title };
}

/**
 * Removes a campaign: restores each variant's pre-campaign price and cleans up
 * any legacy ikas cart campaign tied to older rows.
 */
export async function removeClearanceCampaign(
  ikasClient: IkasClient,
  row: { campaignId: string; variants: string | null },
): Promise<void> {
  const records = parseStoredVariants(row.variants);
  const priced = records.filter(
    (r): r is CampaignVariantRecord =>
      typeof r.originalDiscountPrice !== 'undefined' &&
      typeof r.productId === 'string' &&
      typeof r.sellPrice === 'number' &&
      typeof r.discountPrice === 'number',
  );
  if (priced.length > 0) {
    await restoreVariantPrices(ikasClient, priced);
  }

  // Rows created before the discountPrice mechanism have a real ikas cart
  // campaign that must be deleted too; newer rows have no ikas campaign and the
  // call is a harmless no-op.
  try {
    await ikasClient.mutations.deleteCampaigns({ idList: [row.campaignId] } as never);
  } catch (error) {
    console.error('Legacy ikas campaign cleanup failed:', error);
  }
}

/**
 * Re-applies the stored clearance discount and reactivates the row.
 * Used to undo an accidental "campaign ended" — the stored `discountPrice` is
 * written back exactly as it was, so the storefront looks identical again.
 */
export async function restoreClearanceCampaign(
  ikasClient: IkasClient,
  row: { id: string; variants: string | null },
): Promise<void> {
  const records = parseStoredVariants(row.variants);
  const priced = records.filter(
    (r): r is CampaignVariantRecord =>
      typeof r.productId === 'string' && typeof r.sellPrice === 'number' && typeof r.discountPrice === 'number',
  );
  if (priced.length > 0) {
    await applyVariantDiscounts(ikasClient, priced);
  }

  await prisma.clearanceCampaign.update({
    where: { id: row.id },
    data: { status: 'active' },
  });
}

/**
 * Changes a running campaign's discount rate (and/or title). Recomputes each
 * variant's `discountPrice` from its untouched `sellPrice`; `originalDiscountPrice`
 * stays as the pre-campaign snapshot so ending the campaign still restores the
 * right price. Variants without a recorded sellPrice (legacy name-only rows) are
 * left untouched.
 */
export async function updateClearanceCampaign(
  ikasClient: IkasClient,
  row: { id: string; variants: string | null; discountPercent: number },
  input: { discountPercent?: number; title?: string },
): Promise<void> {
  const records = parseStoredVariants(row.variants);
  const nextPercent = input.discountPercent ?? row.discountPercent;

  if (input.discountPercent !== undefined && input.discountPercent !== row.discountPercent) {
    const percent = input.discountPercent;
    const priced = records.filter(
      (r): r is CampaignVariantRecord =>
        typeof r.productId === 'string' && typeof r.sellPrice === 'number' && typeof r.originalDiscountPrice !== 'undefined',
    );
    const updated: CampaignVariantRecord[] = priced.map((r) => ({
      ...r,
      discountPrice: clearanceDiscountPrice(r.sellPrice, percent),
    }));
    if (updated.length > 0) {
      await applyVariantDiscounts(ikasClient, updated);
    }
    for (const r of updated) {
      const stored = records.find((s) => s.variantId === r.variantId);
      if (stored) stored.discountPrice = r.discountPrice;
    }
  }

  await prisma.clearanceCampaign.update({
    where: { id: row.id },
    data: {
      discountPercent: nextPercent,
      variants: JSON.stringify(records),
      ...(input.title !== undefined ? { title: input.title } : {}),
    },
  });
}
