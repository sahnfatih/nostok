import { prisma } from '@/lib/prisma';

export type InventoryMetrics = {
  totalVariants: number;
  totalStockUnits: number;
  totalInventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  deadStockCount: number;
  deadStockValue: number;
};

/**
 * The low-stock scan has no aging data, so callers may omit the dead-stock
 * fields; recordInventorySnapshot merges them instead of zeroing them out.
 */
export type InventoryMetricsInput = Omit<InventoryMetrics, 'deadStockCount' | 'deadStockValue'> &
  Partial<Pick<InventoryMetrics, 'deadStockCount' | 'deadStockValue'>>;

export type InventoryTrendPoint = InventoryMetrics & { date: string };

/** Local calendar day as 'yyyy-MM-dd' — snapshots follow the merchant's day, not UTC. */
function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Upserts today's snapshot for a merchant, keyed by @@unique([merchantId, date]).
 *
 * Merge rule for dead-stock fields: an omitted field keeps today's recorded
 * value if the row exists, else the most recent older snapshot's value, else 0.
 * Dashboard scans record partial metrics; without the merge they would wipe the
 * dead-stock numbers written earlier the same day by the analytics route.
 */
export async function recordInventorySnapshot(merchantId: string, metrics: InventoryMetricsInput): Promise<void> {
  const date = localDateKey();

  let { deadStockCount, deadStockValue } = metrics;
  if (deadStockCount == null || deadStockValue == null) {
    const previous =
      (await prisma.inventorySnapshot.findUnique({ where: { merchantId_date: { merchantId, date } } })) ??
      (await prisma.inventorySnapshot.findFirst({
        where: { merchantId, date: { lt: date } },
        orderBy: { date: 'desc' },
      }));
    deadStockCount = deadStockCount ?? previous?.deadStockCount ?? 0;
    deadStockValue = deadStockValue ?? previous?.deadStockValue ?? 0;
  }

  const data = {
    totalVariants: metrics.totalVariants,
    totalStockUnits: metrics.totalStockUnits,
    totalInventoryValue: metrics.totalInventoryValue,
    lowStockCount: metrics.lowStockCount,
    outOfStockCount: metrics.outOfStockCount,
    deadStockCount,
    deadStockValue,
  };

  await prisma.inventorySnapshot.upsert({
    where: { merchantId_date: { merchantId, date } },
    create: { merchantId, date, ...data },
    update: data,
  });
}

/** Last `days` daily snapshots for a merchant, oldest first. */
export async function getInventoryTrend(merchantId: string, days = 30): Promise<InventoryTrendPoint[]> {
  const rows = await prisma.inventorySnapshot.findMany({
    where: { merchantId },
    orderBy: { date: 'desc' },
    take: days,
  });

  return rows.reverse().map((row) => ({
    date: row.date,
    totalVariants: row.totalVariants,
    totalStockUnits: row.totalStockUnits,
    totalInventoryValue: row.totalInventoryValue,
    lowStockCount: row.lowStockCount,
    outOfStockCount: row.outOfStockCount,
    deadStockCount: row.deadStockCount,
    deadStockValue: row.deadStockValue,
  }));
}
