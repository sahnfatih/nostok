import { getIkas } from '@/helpers/api-helpers';

type IkasClient = ReturnType<typeof getIkas>;

export type WarehouseStock = {
  warehouseId: string;
  warehouseName: string;
  stockCount: number;
};

/** A scanned variant before threshold-dependent status classification. */
export type ScannedVariantBase = {
  productId: string;
  productName: string;
  variantId: string;
  sku?: string;
  variantLabel: string;
  stockCount: number;
  sellPrice: number;
  discountPrice?: number;
  buyPrice?: number;
  stockValue: number;
  currencyCode?: string;
  currencySymbol?: string;
  categoryName?: string;
  brandName?: string;
  isActive: boolean;
  warehouseStocks: WarehouseStock[];
};

export type WarehouseSummary = {
  id: string;
  name: string;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockValue: number;
};

export type ScanAllResult = {
  variants: ScannedVariantBase[];
  totalProductsScanned: number;
  totalVariantsScanned: number;
  warehouseNames: Map<string, string>;
};

type ApiVariant = {
  id: string;
  sku?: string;
  isActive: boolean;
  prices: Array<{
    sellPrice: number;
    discountPrice?: number;
    buyPrice?: number;
    currencyCode?: string;
    currencySymbol?: string;
  }>;
  stocks?: Array<{ id: string; stockCount: number; stockLocationId: string }>;
  variantValues?: Array<{
    variantTypeName: string;
    variantValueName: string;
  }>;
};

type ApiProduct = {
  id: string;
  name: string;
  totalStock?: number;
  categories?: Array<{ id: string; name: string }>;
  brand?: { id: string; name: string };
  variants: ApiVariant[];
};

const MAX_PAGES = 20;
const PAGE_SIZE = 200;

/**
 * Fetches every product/variant from ikas and flattens them into a variant list
 * with total stock and per-warehouse breakdown. Shared by the low-stock scanner
 * and the automatic rule engine.
 */
export async function scanAllVariants(ikasClient: IkasClient): Promise<ScanAllResult> {
  const warehouseRes = await ikasClient.queries.listStockLocations();
  const warehouseNames = new Map<string, string>();
  if (warehouseRes.isSuccess && warehouseRes.data?.listStockLocation) {
    for (const w of warehouseRes.data.listStockLocation) {
      warehouseNames.set(w.id, w.name);
    }
  }

  const allProducts: ApiProduct[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && page <= MAX_PAGES) {
    const response = await ikasClient.queries.listProducts({
      pagination: { page, limit: PAGE_SIZE },
    });

    if (!response.isSuccess || !response.data?.listProduct) {
      throw new Error(response.error ? JSON.stringify(response.error) : 'ikas API ürünleri getiremedi');
    }

    const { data: products, hasNext: morePages } = response.data.listProduct;
    allProducts.push(...(products as ApiProduct[]));
    hasNext = morePages;
    page++;
  }

  const variants: ScannedVariantBase[] = [];
  let totalVariantsScanned = 0;

  for (const product of allProducts) {
    for (const variant of product.variants) {
      totalVariantsScanned++;
      const price = variant.prices[0];
      const buyPrice = price?.buyPrice ?? price?.sellPrice ?? 0;

      const warehouseStocks: WarehouseStock[] = [];
      let totalVariantStock = 0;

      for (const stock of variant.stocks || []) {
        warehouseStocks.push({
          warehouseId: stock.stockLocationId,
          warehouseName: warehouseNames.get(stock.stockLocationId) || 'Bilinmeyen depo',
          stockCount: stock.stockCount,
        });
        totalVariantStock += stock.stockCount;
      }

      const variantLabel =
        (variant.variantValues || []).map((vv) => `${vv.variantTypeName}: ${vv.variantValueName}`).join(' / ') ||
        'Varsayılan';

      variants.push({
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        sku: variant.sku,
        variantLabel,
        stockCount: totalVariantStock,
        sellPrice: price?.sellPrice || 0,
        discountPrice: price?.discountPrice,
        buyPrice,
        stockValue: totalVariantStock * buyPrice,
        currencyCode: price?.currencyCode,
        currencySymbol: price?.currencySymbol,
        categoryName: product.categories?.[0]?.name,
        brandName: product.brand?.name,
        isActive: variant.isActive,
        warehouseStocks,
      });
    }
  }

  return {
    variants,
    totalProductsScanned: allProducts.length,
    totalVariantsScanned,
    warehouseNames,
  };
}

/** Rolls per-warehouse stock totals up from a scanned variant list. */
export function summarizeWarehouses(
  variants: ScannedVariantBase[],
  warehouseNames: Map<string, string>,
  threshold: number,
): WarehouseSummary[] {
  const stats = new Map<string, { totalStock: number; lowStockCount: number; outOfStockCount: number; stockValue: number }>();

  for (const variant of variants) {
    const buyPrice = variant.buyPrice ?? 0;
    for (const ws of variant.warehouseStocks) {
      const entry = stats.get(ws.warehouseId) || { totalStock: 0, lowStockCount: 0, outOfStockCount: 0, stockValue: 0 };
      entry.totalStock += ws.stockCount;
      entry.stockValue += ws.stockCount * buyPrice;
      if (ws.stockCount === 0) entry.outOfStockCount++;
      else if (ws.stockCount <= threshold) entry.lowStockCount++;
      stats.set(ws.warehouseId, entry);
    }
  }

  const warehouses: WarehouseSummary[] = [];
  for (const [id, s] of stats) {
    warehouses.push({
      id,
      name: warehouseNames.get(id) || 'Bilinmeyen depo',
      totalStock: s.totalStock,
      lowStockCount: s.lowStockCount,
      outOfStockCount: s.outOfStockCount,
      stockValue: Math.round(s.stockValue),
    });
  }
  warehouses.sort((a, b) => b.totalStock - a.totalStock);
  return warehouses;
}
