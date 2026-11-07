import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import {
  scanAllVariants,
  summarizeWarehouses,
  type ScannedVariantBase,
  type WarehouseStock,
  type WarehouseSummary,
} from '@/lib/clearance/scan';
import { recordInventorySnapshot } from '@/lib/clearance/snapshots';

export type { WarehouseStock, WarehouseSummary };

export type ScannedVariant = ScannedVariantBase & {
  stockStatus: 'low' | 'out' | 'ok';
};

export type ScanLowStockResponse = {
  variants: ScannedVariant[];
  lowStockCount: number;
  outOfStockCount: number;
  totalProductsScanned: number;
  totalVariantsScanned: number;
  threshold: number;
  categories: string[];
  brands: string[];
  warehouses: WarehouseSummary[];
};

/**
 * GET /api/ikas/scan-low-stock
 *
 * Stock status logic:
 *   - stockStatus "out":  stock = 0                → needs restocking
 *   - stockStatus "low":  stock 1..threshold       → discount campaign candidates
 *   - stockStatus "ok":   stock > threshold        → healthy
 *
 * Query params:
 *   - threshold:   number (default 5)
 *   - include:     "low" | "out" | "all" (default "low")
 *   - warehouse:   string (optional) – filter by warehouse ID
 *   - category:    string (optional)
 *   - brand:       string (optional)
 *   - search:      string (optional)
 *   - sort:        "stockAsc" | "stockDesc" | "priceAsc" | "priceDesc" | "nameAsc"
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
    const threshold = parseInt(searchParams.get('threshold') || '5', 10);
    const include = (searchParams.get('include') || 'low') as 'low' | 'out' | 'all';
    const warehouseFilter = searchParams.get('warehouse') || '';
    const categoryFilter = searchParams.get('category') || '';
    const brandFilter = searchParams.get('brand') || '';
    const searchQuery = (searchParams.get('search') || '').toLowerCase();
    const sort = searchParams.get('sort') || 'stockAsc';

    const ikasClient = getIkas(authToken);
    const { variants: scanned, totalProductsScanned, totalVariantsScanned, warehouseNames } =
      await scanAllVariants(ikasClient);

    const allVariants: ScannedVariant[] = scanned.map((v) => ({
      ...v,
      stockStatus: v.stockCount === 0 ? 'out' : v.stockCount <= threshold ? 'low' : 'ok',
    }));

    const warehouses = summarizeWarehouses(scanned, warehouseNames, threshold);

    // Count before filtering
    const lowStockCount = allVariants.filter((v) => v.stockStatus === 'low').length;
    const outOfStockCount = allVariants.filter((v) => v.stockStatus === 'out').length;

    // Record today's snapshot so the trend accrues from dashboard scans too.
    // Dead-stock fields are omitted here (no aging data in this scan) and the
    // helper merges the previous values instead of zeroing them. Best-effort:
    // the scan result must survive snapshot failures (stale Prisma client in
    // dev after a schema change, missing table, ...).
    try {
      await recordInventorySnapshot(user.merchantId, {
        totalVariants: totalVariantsScanned,
        totalStockUnits: allVariants.reduce((sum, v) => sum + v.stockCount, 0),
        totalInventoryValue: Math.round(allVariants.reduce((sum, v) => sum + v.stockValue, 0)),
        lowStockCount,
        outOfStockCount,
      });
    } catch (snapshotError) {
      console.error('Inventory snapshot recording failed (scan continues):', snapshotError);
    }

    // Apply include filter
    let filtered =
      include === 'all'
        ? allVariants.filter((v) => v.stockStatus !== 'ok')
        : include === 'out'
          ? allVariants.filter((v) => v.stockStatus === 'out')
          : allVariants.filter((v) => v.stockStatus === 'low');

    // Apply warehouse filter
    if (warehouseFilter) {
      filtered = filtered.filter((v) =>
        v.warehouseStocks.some((ws) => ws.warehouseId === warehouseFilter && ws.stockCount <= threshold),
      );
    }

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter((v) => v.categoryName === categoryFilter);
    }

    // Apply brand filter
    if (brandFilter) {
      filtered = filtered.filter((v) => v.brandName === brandFilter);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (v) =>
          v.productName.toLowerCase().includes(searchQuery) ||
          v.variantLabel.toLowerCase().includes(searchQuery) ||
          (v.sku && v.sku.toLowerCase().includes(searchQuery)),
      );
    }

    // Sort
    switch (sort) {
      case 'stockAsc':
        filtered.sort((a, b) => a.stockCount - b.stockCount);
        break;
      case 'stockDesc':
        filtered.sort((a, b) => b.stockCount - a.stockCount);
        break;
      case 'priceAsc':
        filtered.sort((a, b) => a.sellPrice - b.sellPrice);
        break;
      case 'priceDesc':
        filtered.sort((a, b) => b.sellPrice - a.sellPrice);
        break;
      case 'nameAsc':
        filtered.sort((a, b) => a.productName.localeCompare(b.productName, 'tr'));
        break;
    }

    const categories = [...new Set(allVariants.map((v) => v.categoryName).filter(Boolean))] as string[];
    const brands = [...new Set(allVariants.map((v) => v.brandName).filter(Boolean))] as string[];

    return NextResponse.json({
      data: {
        variants: filtered,
        lowStockCount,
        outOfStockCount,
        totalProductsScanned,
        totalVariantsScanned,
        threshold,
        categories,
        brands,
        warehouses,
      },
    });
  } catch (error) {
    console.error('Error scanning low stock:', error);
    return NextResponse.json(
      { error: { statusCode: 500, message: 'Stok taraması başarısız oldu' } },
      { status: 500 },
    );
  }
}
