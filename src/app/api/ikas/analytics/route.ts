import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { getInventoryTrend, recordInventorySnapshot } from '@/lib/clearance/snapshots';
import type { InventoryTrendPoint } from '@/lib/clearance/snapshots';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';

export type StockDistribution = {
  range: string;
  count: number;
};

export type DeadStockVariant = {
  productId: string;
  productName: string;
  variantId: string;
  sku?: string;
  variantLabel: string;
  stockCount: number;
  sellPrice: number;
  buyPrice?: number;
  currencyCode?: string;
  daysInStock: number;
  categoryName?: string;
  isActive: boolean;
};

export type StockValueBreakdown = {
  name: string;
  stockValue: number;
  variantCount: number;
};

export type AnalyticsResponse = {
  totalProducts: number;
  totalVariants: number;
  totalStockUnits: number;
  totalInventoryValue: number;
  lowStockCount: number;
  deadStockCount: number;
  outOfStockCount: number;
  deadStockValue: number;
  stockDistribution: StockDistribution[];
  deadStockVariants: DeadStockVariant[];
  byCategory: StockValueBreakdown[];
  byBrand: StockValueBreakdown[];
  trend: InventoryTrendPoint[];
};

/**
 * GET /api/ikas/analytics
 * Returns inventory analytics including stock distribution, dead stock detection, and inventory value.
 * Query params:
 *   - deadStockDays: number (default 30) - days threshold for dead stock
 *   - lowStockThreshold: number (default 5) - low stock threshold
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

    const { searchParams } = new URL(request.url);
    const deadStockDays = parseInt(searchParams.get('deadStockDays') || '30', 10);
    const lowStockThreshold = parseInt(searchParams.get('lowStockThreshold') || '5', 10);

    const ikasClient = getIkas(authToken);

    // Fetch all products
    const allProducts: Array<{
      id: string;
      name: string;
      totalStock?: number;
      createdAt?: number;
      categories?: Array<{ id: string; name: string }>;
      brand?: { id: string; name: string };
      variants: Array<{
        id: string;
        sku?: string;
        isActive: boolean;
        createdAt?: number;
        prices: Array<{
          sellPrice: number;
          discountPrice?: number;
          buyPrice?: number;
          currencyCode?: string;
        }>;
        stocks?: Array<{ stockCount: number }>;
        variantValues?: Array<{
          variantTypeName: string;
          variantValueName: string;
        }>;
      }>;
    }> = [];

    let page = 1;
    let hasNext = true;
    const limit = 200;

    while (hasNext && page <= 20) {
      const response = await ikasClient.queries.listProducts({
        pagination: { page, limit },
      });

      if (!response.isSuccess || !response.data?.listProduct) {
        return NextResponse.json(
          { error: { statusCode: 500, message: 'Failed to fetch products' } },
          { status: 500 },
        );
      }

      const { data: products, hasNext: morePages } = response.data.listProduct;
      allProducts.push(...(products as typeof allProducts));
      hasNext = morePages;
      page++;
    }

    // Calculate analytics
    let totalVariants = 0;
    let totalStockUnits = 0;
    let totalInventoryValue = 0;
    let lowStockCount = 0;
    let deadStockCount = 0;
    let outOfStockCount = 0;
    let deadStockValue = 0;

    const now = Date.now();
    const deadStockVariants: DeadStockVariant[] = [];
    const categoryTotals = new Map<string, StockValueBreakdown>();
    const brandTotals = new Map<string, StockValueBreakdown>();
    const distributionMap: Record<string, number> = {
      '0': 0,
      '1-2': 0,
      '3-5': 0,
      '6-10': 0,
      '11-20': 0,
      '21-50': 0,
      '50+': 0,
    };

    for (const product of allProducts) {
      for (const variant of product.variants) {
        totalVariants++;
        const totalVariantStock = (variant.stocks || []).reduce((sum, s) => sum + s.stockCount, 0);
        totalStockUnits += totalVariantStock;

        const price = variant.prices[0];
        const sellPrice = price?.sellPrice || 0;
        const buyPrice = price?.buyPrice || sellPrice * 0.6;
        const inventoryValue = totalVariantStock * buyPrice;
        totalInventoryValue += inventoryValue;

        // Category / brand stock-value breakdown (same scan pass)
        const categoryName = product.categories?.[0]?.name?.trim() || 'Kategorisiz';
        const brandName = product.brand?.name?.trim() || 'Markasız';
        accumulateBreakdown(categoryTotals, categoryName, inventoryValue);
        accumulateBreakdown(brandTotals, brandName, inventoryValue);

        // Stock distribution
        if (totalVariantStock === 0) {
          distributionMap['0']++;
          outOfStockCount++;
        } else if (totalVariantStock <= 2) {
          distributionMap['1-2']++;
        } else if (totalVariantStock <= 5) {
          distributionMap['3-5']++;
        } else if (totalVariantStock <= 10) {
          distributionMap['6-10']++;
        } else if (totalVariantStock <= 20) {
          distributionMap['11-20']++;
        } else if (totalVariantStock <= 50) {
          distributionMap['21-50']++;
        } else {
          distributionMap['50+']++;
        }

        // Low stock check
        if (totalVariantStock > 0 && totalVariantStock <= lowStockThreshold) {
          lowStockCount++;
        }

        // Dead stock check: in inventory for > deadStockDays and still has stock
        const createdAt = variant.createdAt || product.createdAt;
        if (createdAt && totalVariantStock > 0) {
          const daysInStock = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
          if (daysInStock >= deadStockDays) {
            deadStockCount++;
            deadStockValue += inventoryValue;

            const variantLabel = (variant.variantValues || [])
              .map((vv) => `${vv.variantTypeName}: ${vv.variantValueName}`)
              .join(' / ') || 'Varsayılan';

            deadStockVariants.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              sku: variant.sku,
              variantLabel,
              stockCount: totalVariantStock,
              sellPrice,
              buyPrice,
              currencyCode: price?.currencyCode,
              daysInStock,
              categoryName: product.categories?.[0]?.name,
              isActive: variant.isActive,
            });
          }
        }
      }
    }

    // Sort dead stock by days in stock (oldest first)
    deadStockVariants.sort((a, b) => b.daysInStock - a.daysInStock);

    const stockDistribution: StockDistribution[] = Object.entries(distributionMap).map(([range, count]) => ({
      range,
      count,
    }));

    // Record today's snapshot (full metrics, dead stock included) for the
    // trend. Best-effort: trend bookkeeping must never fail the analytics
    // response (e.g. a stale Prisma client after a schema change in dev).
    let trend: InventoryTrendPoint[] = [];
    try {
      await recordInventorySnapshot(user.merchantId, {
        totalVariants,
        totalStockUnits,
        totalInventoryValue: Math.round(totalInventoryValue),
        lowStockCount,
        outOfStockCount,
        deadStockCount,
        deadStockValue: Math.round(deadStockValue),
      });
      trend = await getInventoryTrend(user.merchantId, 30);
    } catch (snapshotError) {
      console.error('Inventory snapshot recording failed (analytics continues):', snapshotError);
    }

    return NextResponse.json({
      data: {
        totalProducts: allProducts.length,
        totalVariants,
        totalStockUnits,
        totalInventoryValue: Math.round(totalInventoryValue),
        lowStockCount,
        deadStockCount,
        outOfStockCount,
        deadStockValue: Math.round(deadStockValue),
        stockDistribution,
        deadStockVariants: deadStockVariants.slice(0, 50), // Limit to top 50
        byCategory: topBreakdown(categoryTotals),
        byBrand: topBreakdown(brandTotals),
        trend,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: { statusCode: 500, message: 'Failed to fetch analytics' } },
      { status: 500 },
    );
  }
}

function accumulateBreakdown(map: Map<string, StockValueBreakdown>, name: string, stockValue: number): void {
  const entry = map.get(name) ?? { name, stockValue: 0, variantCount: 0 };
  entry.stockValue += stockValue;
  entry.variantCount++;
  map.set(name, entry);
}

function topBreakdown(map: Map<string, StockValueBreakdown>, limit = 8): StockValueBreakdown[] {
  return [...map.values()]
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, limit)
    .map((entry) => ({ ...entry, stockValue: Math.round(entry.stockValue) }));
}
