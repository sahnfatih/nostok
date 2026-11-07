import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import {
  createClearanceCampaign,
  parseStoredVariants,
  type CampaignVariantInput,
  type StoredCampaignVariant,
} from '@/lib/clearance/campaigns';
import { scanAllVariants } from '@/lib/clearance/scan';

export type CampaignVariantDetail = {
  variantId: string;
  productName: string;
  variantLabel: string;
  sellPrice: number | null;
  discountPrice: number | null;
};

export type CampaignSummary = {
  id: string;
  campaignId: string;
  title: string;
  discountPercent: number;
  status: string;
  ruleId?: string | null;
  variantIds: string[];
  variantDetails: CampaignVariantDetail[];
  createdAt: string;
  updatedAt: string;
};

export type ListCampaignsResponse = {
  campaigns: CampaignSummary[];
};

export type CreateCampaignResponse = {
  campaignId: string;
  title: string;
};

const createCampaignSchema = z.object({
  title: z.string().min(1, 'Kampanya başlığı gerekli'),
  discountPercent: z.number().min(1).max(90, 'İndirim %1-%90 arası olmalı'),
  ruleId: z.string().optional(),
  variants: z
    .array(
      z.object({
        variantId: z.string(),
        productId: z.string(),
        productName: z.string(),
        variantLabel: z.string(),
        sellPrice: z.number(),
        buyPrice: z.number().nullable(),
        originalDiscountPrice: z.number().nullable(),
      }),
    )
    .min(1, 'En az bir varyant seçilmeli'),
});

function toDetails(records: StoredCampaignVariant[]): CampaignVariantDetail[] {
  return records.map((r) => ({
    variantId: r.variantId,
    productName: r.productName,
    variantLabel: r.variantLabel,
    sellPrice: typeof r.sellPrice === 'number' ? r.sellPrice : null,
    discountPrice: typeof r.discountPrice === 'number' ? r.discountPrice : null,
  }));
}

/**
 * Fills in variant names for campaigns recorded before the variants column
 * existed, so older rows also show their products.
 */
async function backfillVariants(
  ikasClient: ReturnType<typeof getIkas>,
  rows: Array<{ id: string; variantIds: string; variants: string | null }>,
) {
  const missing = rows.filter((r) => !r.variants && r.variantIds);
  if (missing.length === 0) return;

  const { variants } = await scanAllVariants(ikasClient);
  const byId = new Map(variants.map((v) => [v.variantId, v]));

  for (const row of missing) {
    let ids: string[] = [];
    try {
      ids = JSON.parse(row.variantIds) as string[];
    } catch {
      continue;
    }
    const records: StoredCampaignVariant[] = [];
    for (const id of ids) {
      const v = byId.get(id);
      if (v) {
        records.push({ variantId: id, productId: v.productId, productName: v.productName, variantLabel: v.variantLabel });
      }
    }
    await prisma.clearanceCampaign.update({
      where: { id: row.id },
      data: { variants: JSON.stringify(records) },
    });
    row.variants = JSON.stringify(records);
  }
}

/**
 * GET /api/ikas/campaigns
 * Lists tracked clearance campaigns with their product/variant details.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Auth token not found' } }, { status: 404 });
    }

    const rows = await prisma.clearanceCampaign.findMany({
      where: { merchantId: user.merchantId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
    });

    try {
      await backfillVariants(getIkas(authToken), rows);
    } catch (error) {
      // Label resolution is best-effort; listing must still work without it.
      console.error('Error backfilling campaign variants:', error);
    }

    const campaigns: CampaignSummary[] = rows.map((row) => {
      const records = parseStoredVariants(row.variants);
      let variantIds: string[] = [];
      try {
        variantIds = JSON.parse(row.variantIds) as string[];
      } catch {
        variantIds = records.map((r) => r.variantId);
      }
      return {
        id: row.id,
        campaignId: row.campaignId,
        title: row.title,
        discountPercent: row.discountPercent,
        status: row.status,
        ruleId: row.ruleId,
        variantIds,
        variantDetails: toDetails(records),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ data: { campaigns } });
  } catch (error) {
    console.error('Error listing campaigns:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to list campaigns' } }, { status: 500 });
  }
}

/**
 * POST /api/ikas/campaigns
 * Applies a clearance discount to the given variants and records the campaign.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Auth token not found' } }, { status: 404 });
    }

    const body = await request.json();
    const validation = validateRequest(createCampaignSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { title, discountPercent, ruleId, variants } = validation.data;

    const ikasClient = getIkas(authToken);

    const campaign = await createClearanceCampaign(ikasClient, {
      merchantId: user.merchantId,
      title,
      discountPercent,
      ruleId,
      variants: variants as CampaignVariantInput[],
    });

    return NextResponse.json({
      data: {
        campaignId: campaign.campaignId,
        title: campaign.title,
      },
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to create campaign' } }, { status: 500 });
  }
}
