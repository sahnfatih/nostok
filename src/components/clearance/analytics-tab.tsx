'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, FieldLabel } from '@/components/ui/field';
import { EmptyState } from '@/components/ikas/empty-state';
import { StatCard } from '@/components/ikas/stat-card';
import { ChartCard } from '@/components/ikas/chart-card';
import { BarList, type BarListItem } from '@/components/ikas/bar-list';
import { DonutChart, type DonutDatum } from '@/components/ikas/donut-chart';
import { BarChart } from '@/components/ikas/bar-chart';
import { AreaChart } from '@/components/ikas/area-chart';
import { NumberStepper } from '@/components/ikas/number-stepper';
import { Layout } from '@/components/ikas/layout';
import { RecordTable, type RecordTableColumn } from '@/components/ikas/record-table';
import { AnimatedNumber } from '@/components/ikas/animated-number';
import { ProgressBar } from '@/components/ikas/progress-bar';
import { BarChart3Icon, ClockIcon, RefreshCwIcon, TrendingDownIcon } from 'lucide-react';
import { ApiRequests } from '@/lib/api-requests';
import { formatPrice, formatNumber, formatPercent, formatDateShort } from '@/lib/format';
import type { AnalyticsResponse, DeadStockVariant } from '@/app/api/ikas/analytics/route';

interface AnalyticsTabProps {
  token: string;
  threshold: number;
}

const PAGE_SIZE = 10;

export default function AnalyticsTab({ token, threshold }: AnalyticsTabProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deadStockDays, setDeadStockDays] = useState(30);
  const [page, setPage] = useState(1);

  const fetchAnalytics = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await ApiRequests.ikas.getAnalytics(token, {
        deadStockDays,
        lowStockThreshold: threshold,
      });
      if (res.status === 200 && res.data?.data) {
        setData(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, deadStockDays, threshold]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) fetchAnalytics();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchAnalytics]);

  const distribution: BarListItem[] = useMemo(
    () =>
      (data?.stockDistribution ?? []).map((item) => ({
        name: getDistributionLabel(item.range),
        value: item.count,
      })),
    [data],
  );

  const byCategory: BarListItem[] = useMemo(
    () =>
      (data?.byCategory ?? []).map((item) => ({
        name: item.name,
        value: item.stockValue,
      })),
    [data],
  );

  const byBrand: BarListItem[] = useMemo(
    () =>
      (data?.byBrand ?? []).map((item) => ({
        name: item.name,
        value: item.stockValue,
      })),
    [data],
  );

  const trend = data?.trend ?? [];
  const hasTrend = trend.length >= 2;

  const health: DonutDatum[] = useMemo(() => {
    if (!data) return [];
    const ok = Math.max(data.totalVariants - data.lowStockCount - data.outOfStockCount, 0);
    return [
      { key: 'ok', label: 'Yeterli stok', value: ok },
      { key: 'low', label: 'Düşük stok', value: data.lowStockCount },
      { key: 'out', label: 'Tükenen', value: data.outOfStockCount },
    ];
  }, [data]);

  // Variants where the most money is stuck, for the dead-stock value chart.
  const topDeadStock = useMemo(() => {
    if (!data) return [];
    return [...data.deadStockVariants]
      .sort((a, b) => b.stockCount * b.sellPrice - a.stockCount * a.sellPrice)
      .slice(0, 8)
      .map((v) => ({
        name: v.productName,
        value: Math.round(v.stockCount * v.sellPrice),
      }));
  }, [data]);

  const deadStockColumns: RecordTableColumn<DeadStockVariant>[] = [
    {
      id: 'productName',
      header: 'Ürün',
      cell: (v) => (
        <div>
          <div className="font-medium">{v.productName}</div>
          {v.sku && <div className="font-mono text-xs text-muted-foreground">{v.sku}</div>}
        </div>
      ),
    },
    { id: 'variantLabel', header: 'Varyant', hideOnMobile: true },
    {
      id: 'stockCount',
      header: 'Stok',
      cell: (v) => <Badge status="warning">{v.stockCount} adet</Badge>,
    },
    {
      id: 'sellPrice',
      header: 'Satış fiyatı',
      align: 'end',
      hideOnMobile: true,
      cell: (v) => formatPrice(v.sellPrice, v.currencyCode),
    },
    {
      id: 'daysInStock',
      header: 'Stokta kalma',
      cell: (v) => (
        <span className="flex items-center gap-1 text-sm">
          <ClockIcon className="size-3 text-muted-foreground" />
          {v.daysInStock} gün
        </span>
      ),
    },
    {
      id: 'categoryName',
      header: 'Kategori',
      hideOnMobile: true,
      cell: (v) => v.categoryName || '-',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        media={<BarChart3Icon />}
        status="danger"
        title="Analiz verisi yüklenemedi"
        description="Verileri yüklemek için tekrar deneyin."
        onRetry={fetchAnalytics}
      />
    );
  }

  const deadRows = data.deadStockVariants;
  const pageCount = Math.max(1, Math.ceil(deadRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = deadRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = deadRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, deadRows.length);

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Toplam stok değeri"
          value={<AnimatedNumber value={data.totalInventoryValue} format={(v) => formatPrice(v)} />}
          footer={<p className="text-xs text-muted-foreground">{formatNumber(data.totalStockUnits)} birim stok</p>}
        />
        <StatCard
          label="Ölü stok değeri"
          value={<AnimatedNumber value={data.deadStockValue} format={(v) => formatPrice(v)} />}
          footer={
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.deadStockCount)} varyant {deadStockDays}+ gündür satılmıyor
            </p>
          }
        />
        <StatCard
          label="Düşük stok"
          value={<AnimatedNumber value={data.lowStockCount} format={formatNumber} />}
          footer={<p className="text-xs text-muted-foreground">Stok seviyesi ≤ {threshold} olan varyantlar</p>}
        />
        <StatCard
          label="Stok yok"
          value={<AnimatedNumber value={data.outOfStockCount} format={formatNumber} />}
          footer={<p className="text-xs text-muted-foreground">Tükenen varyantlar</p>}
        />
      </div>

      {/* Inventory trend */}
      <Layout columns="half">
        <ChartCard
          title="Stok değeri trendi"
          value={data.totalInventoryValue}
          valueFormat={formatPrice}
          description="Günlük toplam stok değeri ve ölü stok değeri"
        >
          {hasTrend ? (
            <AreaChart
              data={trend}
              index="date"
              series={[
                { key: 'totalInventoryValue', label: 'Toplam stok değeri' },
                { key: 'deadStockValue', label: 'Ölü stok değeri' },
              ]}
              valueFormat={formatPrice}
              xFormat={formatTrendDate}
              height={240}
              aria-label="Günlük stok değeri trendi"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Trend verisi toplandıkça burada görünecek.</p>
          )}
        </ChartCard>

        <ChartCard title="Stok riski trendi" description="Günlük düşük stok ve tükenen varyant sayıları">
          {hasTrend ? (
            <AreaChart
              data={trend}
              index="date"
              series={[
                { key: 'lowStockCount', label: 'Düşük stok' },
                { key: 'outOfStockCount', label: 'Tükenen' },
              ]}
              stacked
              valueFormat={formatNumber}
              xFormat={formatTrendDate}
              height={240}
              aria-label="Günlük stok riski trendi"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Trend verisi toplandıkça burada görünecek.</p>
          )}
        </ChartCard>
      </Layout>

      {/* Distribution charts */}
      <Layout columns="half">
        <ChartCard
          title="Stok dağılımı"
          value={data.totalVariants}
          valueFormat={formatNumber}
          description="Varyantların stok aralığına göre dağılımı"
        >
          <BarList
            data={distribution}
            header={{ name: 'Stok aralığı', value: 'Varyant' }}
            valueFormat={formatNumber}
            aria-label="Stok aralığına göre varyant dağılımı"
          />
        </ChartCard>

        <ChartCard title="Stok sağlığı" description="Düşük stok eşiğine göre varyantların durumu">
          <DonutChart
            data={health}
            valueFormat={formatNumber}
            centerLabel="Toplam varyant"
          />
        </ChartCard>
      </Layout>

      {/* Category / brand breakdown */}
      <Layout columns="half">
        <ChartCard
          title="Kategoriye göre stok değeri"
          value={data.totalInventoryValue}
          valueFormat={formatPrice}
          description="Stok değeri en yüksek 8 kategori"
        >
          <BarList
            data={byCategory}
            header={{ name: 'Kategori', value: 'Stok değeri' }}
            valueFormat={formatPrice}
            aria-label="Kategoriye göre stok değeri"
          />
        </ChartCard>

        <ChartCard
          title="Markaya göre stok değeri"
          value={data.totalInventoryValue}
          valueFormat={formatPrice}
          description="Stok değeri en yüksek 8 marka"
        >
          <BarList
            data={byBrand}
            header={{ name: 'Marka', value: 'Stok değeri' }}
            valueFormat={formatPrice}
            aria-label="Markaya göre stok değeri"
          />
        </ChartCard>
      </Layout>

      {/* Dead stock */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Ölü stok</h2>
            <p className="text-sm text-muted-foreground">
              {deadStockDays} gündür satılmayan varyantlar ve onlara bağlı stok değeri.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <Field>
              <FieldLabel className="text-xs">Gün eşiği</FieldLabel>
              <NumberStepper
                label="Ölü stok gün eşiği"
                value={deadStockDays}
                onValueChange={setDeadStockDays}
                min={7}
                max={365}
              />
            </Field>
            <Button variant="outline" onClick={fetchAnalytics} loading={refreshing}>
              <RefreshCwIcon className="size-4" />
              Yenile
            </Button>
          </div>
        </div>

        {data.totalVariants > 0 && (
          <ProgressBar
            label="Ölü stok oranı"
            value={data.deadStockCount}
            max={data.totalVariants}
            status="auto"
            valueFormat={(value, max) => formatPercent((value / max) * 100)}
            hint={`${formatNumber(data.deadStockCount)} / ${formatNumber(data.totalVariants)} varyant ${deadStockDays}+ gündür satılmıyor`}
          />
        )}

        {topDeadStock.length > 0 && (
          <ChartCard
            title="En yüksek ölü stok değeri"
            value={data.deadStockValue}
            valueFormat={(v) => formatPrice(v)}
            description="Stok değeri en yüksek 8 varyant"
          >
            <BarChart
              data={topDeadStock}
              index="name"
              series={[{ key: 'value', label: 'Stok değeri' }]}
              layout="horizontal"
              height={260}
              valueFormat={(v) => formatPrice(v)}
              aria-label="Ölü stok değeri en yüksek varyantlar"
            />
          </ChartCard>
        )}

        <RecordTable
          label="Ölü stok listesi"
          columns={deadStockColumns}
          rows={pageRows}
          getRowId={(v) => v.variantId}
          emptyState={
            <EmptyState
              media={<TrendingDownIcon />}
              title="Ölü stok yok"
              description={`${deadStockDays} gündür satılmayan varyant bulunmuyor. Bu iyi bir haber.`}
            />
          }
          pagination={
            pageCount > 1
              ? {
                  page: safePage,
                  pageCount,
                  onPageChange: setPage,
                  summary: (
                    <>
                      <span className="hidden sm:inline">
                        {formatNumber(rangeStart)}–{formatNumber(rangeEnd)} / {formatNumber(deadRows.length)}
                      </span>
                      <span className="sm:hidden">
                        {formatNumber(safePage)} / {formatNumber(pageCount)}
                      </span>
                    </>
                  ),
                }
              : undefined
          }
        />

        {data.deadStockVariants.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Toplam {formatNumber(data.totalVariants)} varyant · {formatNumber(data.totalProducts)} ürün
          </p>
        )}
      </div>
    </div>
  );
}

function getDistributionLabel(range: string): string {
  if (range === '0') return 'Stok yok';
  if (range === '1-2') return '1-2 adet';
  if (range === '3-5') return '3-5 adet';
  if (range === '6-10') return '6-10 adet';
  if (range === '11-20') return '11-20 adet';
  if (range === '21-50') return '21-50 adet';
  return '50+ adet';
}

// Parse 'yyyy-MM-dd' as a local date: new Date('2026-11-07') is UTC midnight and
// would render as the previous day in negative-offset timezones.
function formatTrendDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return formatDateShort(new Date(year, month - 1, day));
}
