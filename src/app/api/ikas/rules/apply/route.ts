import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { scanAllVariants } from '@/lib/clearance/scan';
import { createClearanceCampaign } from '@/lib/clearance/campaigns';

export type RuleApplyResult = {
  ruleId: string;
  ruleName: string;
  status: 'created' | 'no_matches' | 'already_covered' | 'error';
  campaignId?: string;
  variantCount: number;
  message?: string;
};

export type ApplyRulesResponse = {
  results: RuleApplyResult[];
  campaignsCreated: number;
};

const applyRulesSchema = z.object({
  ruleId: z.string().optional(),
});

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

/**
 * POST /api/ikas/rules/apply
 *
 * Runs clearance rules against current stock levels and creates an ikas discount
 * campaign for every matching variant that is not already covered by an active
 * campaign.
 *
 * Matching (per rule):
 *   - variant is active and has stock 1..rule.stockThreshold (0-stock needs
 *     restocking, not discounting)
 *   - rule.categoryFilter is empty or matches the variant's category name
 *   - variant is not part of any active ClearanceCampaign (manual or rule-made)
 *
 * Body:
 *   - ruleId: optional. When given, that single rule is applied on demand
 *     (even if inactive — explicit user intent). When omitted, every active
 *     rule with autoApply=true runs in createdAt order (first rule wins a
 *     variant when rules overlap).
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

    const body = await request.json().catch(() => ({}));
    const validation = validateRequest(applyRulesSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { ruleId } = validation.data;

    let rules;
    if (ruleId) {
      const rule = await prisma.clearanceRule.findFirst({
        where: { id: ruleId, merchantId: user.merchantId },
      });
      if (!rule) {
        return NextResponse.json({ error: { statusCode: 404, message: 'Kural bulunamadı' } }, { status: 404 });
      }
      rules = [rule];
    } else {
      rules = await prisma.clearanceRule.findMany({
        where: { merchantId: user.merchantId, isActive: true, autoApply: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const results: RuleApplyResult[] = [];
    if (rules.length === 0) {
      return NextResponse.json({ data: { results, campaignsCreated: 0 } });
    }

    // One catalog scan serves every rule in this run.
    const ikasClient = getIkas(authToken);
    const { variants } = await scanAllVariants(ikasClient);

    // Variants already covered by any active campaign (manual or from a rule).
    const activeCampaigns = await prisma.clearanceCampaign.findMany({
      where: { merchantId: user.merchantId, status: 'active' },
      select: { variantIds: true },
    });
    const covered = new Set<string>();
    for (const campaign of activeCampaigns) {
      try {
        for (const id of JSON.parse(campaign.variantIds) as string[]) {
          covered.add(id);
        }
      } catch {
        // Skip unparsable rows; a broken row must not block the whole run.
      }
    }

    let campaignsCreated = 0;

    for (const rule of rules) {
      const matches = variants.filter(
        (v) =>
          v.isActive &&
          v.stockCount > 0 &&
          v.stockCount <= rule.stockThreshold &&
          (!rule.categoryFilter || v.categoryName === rule.categoryFilter),
      );

      const uncovered = matches.filter((v) => !covered.has(v.variantId));

      if (matches.length === 0) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'no_matches',
          variantCount: 0,
        });
        continue;
      }

      if (uncovered.length === 0) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'already_covered',
          variantCount: 0,
        });
        continue;
      }

      const title = `${rule.name} (${formatDate(new Date())})`;

      try {
        const campaign = await createClearanceCampaign(ikasClient, {
          merchantId: user.merchantId,
          title,
          discountPercent: rule.discountPercent,
          ruleId: rule.id,
          variants: uncovered.map((v) => ({
            variantId: v.variantId,
            productId: v.productId,
            productName: v.productName,
            variantLabel: v.variantLabel,
            sellPrice: v.sellPrice,
            buyPrice: v.buyPrice ?? null,
            originalDiscountPrice: v.discountPrice ?? null,
          })),
        });

        for (const v of uncovered) {
          covered.add(v.variantId);
        }
        campaignsCreated++;

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'created',
          campaignId: campaign.campaignId,
          variantCount: uncovered.length,
        });
      } catch (error) {
        console.error(`Rule apply failed for ${rule.id}:`, error);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'error',
          variantCount: 0,
          message: error instanceof Error ? error.message : 'Kampanya oluşturulamadı',
        });
      }
    }

    return NextResponse.json({ data: { results, campaignsCreated } });
  } catch (error) {
    console.error('Error applying rules:', error);
    return NextResponse.json(
      { error: { statusCode: 500, message: 'Kurallar uygulanamadı' } },
      { status: 500 },
    );
  }
}
