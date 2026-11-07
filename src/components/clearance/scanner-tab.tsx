'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, FieldLabel } from '@/components/ui/field';
import { EmptyState } from '@/components/ikas/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ikas/segmented-control';
import { ExpandableSearch } from '@/components/ikas/expandable-search';
import { NumberStepper } from '@/components/ikas/number-stepper';
import { RecordTable, type RecordTableColumn, type RecordTableSort } from '@/components/ikas/record-table';
import { toast } from 'sonner';
import {
  TagIcon,
  PackageIcon,
  RefreshCwIcon,
  DownloadIcon,
  SlidersHorizontalIcon,
  ChevronDownIcon,
  WarehouseIcon,
  ArrowRightIcon,
} from 'lucide-react';
import type { ScannedVariant, WarehouseSummary } from '@/app/dashboard/page';
import { formatPrice, formatNumber, formatPercent } from '@/lib/format';

interface ScannerTabProps {
  variants: ScannedVariant[];
  loading: boolean;
  threshold: number;
  onThresholdChange: (value: number) => void;
  onCreateCampaign: (
    variants: Array<{
      variantId: string;
      productId: string;
      productName: string;
      variantLabel: string;
      sellPrice: number;
      buyPrice: number | null;
      originalDiscountPrice: number | null;
    }>,
    discountPercent: number,
    title: string,
  ) => Promise<void>;
  categories: string[];
  brands: string[];
  warehouses: WarehouseSummary[];
  lowStockCount: number;
  outOfStockCount: number;
  coveredVariantIds: string[];
}

type StatusFilter = 'low' | 'out' | 'all';

const PAGE_SIZE = 20;

export default function ScannerTab({
  variants,
  loading,
  threshold,
  onThresholdChange,
  onCreateCampaign,
  categories,
  brands,
  warehouses,
  lowStockCount,
  outOfStockCount,
  coveredVariantIds,
}: ScannerTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('low');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [sort, setSort] = useState<RecordTableSort>({ id: 'stockCount', direction: 'asc' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showCampaigned, setShowCampaigned] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [detailVariant, setDetailVariant] = useState<ScannedVariant | null>(null);
  const [page, setPage] = useState(1);

  const coveredSet = useMemo(() => new Set(coveredVariantIds), [coveredVariantIds]);
  const coveredCount = useMemo(
    () => variants.filter((v) => coveredSet.has(v.variantId)).length,
    [variants, coveredSet],
  );

  const hasActiveFilters = warehouseFilter !== 'all' || categoryFilter !== 'all' || brandFilter !== 'all';

  // Filter and sort variants
  const filteredVariants = useMemo(() => {
    let result = variants;

    // Variants already under a campaign are hidden by default — they are not
    // actionable for new campaigns.
    if (!showCampaigned) {
      result = result.filter((v) => !coveredSet.has(v.variantId));
    }

    if (statusFilter === 'low') {
      result = result.filter((v) => v.stockStatus === 'low');
    } else if (statusFilter === 'out') {
      result = result.filter((v) => v.stockStatus === 'out');
    } else {
      result = result.filter((v) => v.stockStatus !== 'ok');
    }

    if (warehouseFilter !== 'all') {
      result = result.filter((v) => v.warehouseStocks.some((ws) => ws.warehouseId === warehouseFilter));
    }

    if (categoryFilter !== 'all') {
      result = result.filter((v) => v.categoryName === categoryFilter);
    }

    if (brandFilter !== 'all') {
      result = result.filter((v) => v.brandName === brandFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.productName.toLowerCase().includes(q) ||
          v.variantLabel.toLowerCase().includes(q) ||
          (v.sku && v.sku.toLowerCase().includes(q)),
      );
    }

    if (sort) {
      const dir = sort.direction === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        if (sort.id === 'productName') return dir * a.productName.localeCompare(b.productName, 'tr');
        if (sort.id === 'stockCount') return dir * (a.stockCount - b.stockCount);
        if (sort.id === 'sellPrice') return dir * (a.sellPrice - b.sellPrice);
        return 0;
      });
    }

    return result;
  }, [variants, showCampaigned, coveredSet, statusFilter, warehouseFilter, categoryFilter, brandFilter, searchQuery, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredVariants.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredVariants.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filteredVariants.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredVariants.length);

  const clearFilters = useCallback(() => {
    setWarehouseFilter('all');
    setCategoryFilter('all');
    setBrandFilter('all');
    setSearchQuery('');
  }, []);

  // CSV export
  const exportCsv = useCallback(() => {
    const headers = [
      'Ürün',
      'Varyant',
      'SKU',
      'Stok',
      'Durum',
      'Kampanya',
      'Satış Fiyatı',
      'Alış Fiyatı',
      'Stok Değeri',
      'Kategori',
      'Marka',
      'Depo Dağılımı',
    ];
    const rows = filteredVariants.map((v) => [
      v.productName,
      v.variantLabel,
      v.sku || '',
      v.stockCount.toString(),
      v.stockStatus === 'out' ? 'Tükendi' : v.stockStatus === 'low' ? 'Düşük' : 'Yeterli',
      coveredSet.has(v.variantId) ? 'Var' : 'Yok',
      v.sellPrice.toFixed(2),
      (v.buyPrice ?? 0).toFixed(2),
      v.stockValue.toFixed(2),
      v.categoryName || '',
      v.brandName || '',
      v.warehouseStocks.map((ws) => `${ws.warehouseName}: ${ws.stockCount}`).join(' | '),
    ]);

    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stok-taramasi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV dosyası indirildi');
  }, [filteredVariants, coveredSet]);

  const handleCreateCampaign = async () => {
    if (selectedIds.length === 0) return;
    setCreating(true);
    try {
      const title = campaignTitle || `Stok erime kampanyası - ${selectedIds.length} varyant`;
      const selectedSet = new Set(selectedIds);
      const campaignVariants = variants
        .filter((v) => selectedSet.has(v.variantId))
        .map((v) => ({
          variantId: v.variantId,
          productId: v.productId,
          productName: v.productName,
          variantLabel: v.variantLabel,
          sellPrice: v.sellPrice,
          buyPrice: v.buyPrice ?? null,
          originalDiscountPrice: v.discountPrice ?? null,
        }));
      await onCreateCampaign(campaignVariants, discountPercent, title);
      toast.success('Kampanya oluşturuldu — indirimli fiyatlar mağazaya yansıtıldı');
      setDialogOpen(false);
      setSelectedIds([]);
      setCampaignTitle('');
      setDiscountPercent(20);
    } catch {
      toast.error('Kampanya oluşturulurken bir hata oluştu');
    } finally {
      setCreating(false);
    }
  };

  const getStockBadge = (v: ScannedVariant) => {
    if (v.stockStatus === 'out') return <Badge status="danger">Tükendi</Badge>;
    if (v.stockCount <= 2) return <Badge status="danger">{v.stockCount} adet</Badge>;
    return <Badge status="warning">{v.stockCount} adet</Badge>;
  };

  const totalStockValue = filteredVariants.reduce((sum, v) => sum + v.stockValue, 0);

  const columns: RecordTableColumn<ScannedVariant>[] = [
    {
      id: 'productName',
      header: 'Ürün',
      sortable: true,
      cell: (v) => (
        <div>
          <div className="font-medium">{v.productName}</div>
          {v.brandName && <div className="text-xs text-muted-foreground">{v.brandName}</div>}
        </div>
      ),
    },
    { id: 'variantLabel', header: 'Varyant', hideOnMobile: true, cell: (v) => <span className="text-sm">{v.variantLabel}</span> },
    {
      id: 'sku',
      header: 'SKU',
      hideOnMobile: true,
      cell: (v) => <span className="font-mono text-xs text-muted-foreground">{v.sku || '-'}</span>,
    },
    { id: 'stockCount', header: 'Stok', sortable: true, cell: (v) => getStockBadge(v) },
    {
      id: 'warehouses',
      header: 'Depolar',
      hideOnMobile: true,
      cell: (v) => (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <WarehouseIcon className="size-3" />
          {v.warehouseStocks.length > 1 ? `${v.warehouseStocks.length} depo` : v.warehouseStocks[0]?.warehouseName || '-'}
        </span>
      ),
    },
    {
      id: 'sellPrice',
      header: 'Satış fiyatı',
      sortable: true,
      align: 'end',
      cell: (v) => <span className="text-sm">{formatPrice(v.sellPrice, v.currencyCode)}</span>,
    },
    {
      id: 'stockValue',
      header: 'Stok değeri',
      align: 'end',
      hideOnMobile: true,
      cell: (v) => <span className="text-sm">{formatPrice(v.stockValue, v.currencyCode)}</span>,
    },
    {
      id: 'status',
      header: 'Durum',
      hideOnMobile: true,
      cell: (v) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {v.isActive ? <Badge status="success">Aktif</Badge> : <Badge status="neutral">Pasif</Badge>}
          {coveredSet.has(v.variantId) && <Badge status="info">Kampanyada</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Warehouse summary cards */}
      {warehouses.length > 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((wh) => (
            <Card
              key={wh.id}
              className={`cursor-pointer transition-colors ${
                warehouseFilter === wh.id ? 'border-primary ring-1 ring-primary/20' : 'hover:bg-accent/50'
              }`}
              onClick={() => setWarehouseFilter(warehouseFilter === wh.id ? 'all' : wh.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <WarehouseIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{wh.name}</span>
                  </div>
                  <Badge status="neutral">{formatPrice(wh.stockValue)}</Badge>
                </div>
                <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-warning">{wh.lowStockCount}</strong> düşük
                  </span>
                  <span>
                    <strong className="text-danger">{wh.outOfStockCount}</strong> tükenen
                  </span>
                  <span>
                    <strong className="text-foreground">{wh.totalStock}</strong> toplam birim
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field className="min-w-[140px] flex-1 sm:flex-none">
                <FieldLabel className="text-xs">Depo</FieldLabel>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm depolar</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field className="min-w-[140px] flex-1 sm:flex-none">
                <FieldLabel className="text-xs">Kategori</FieldLabel>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field className="min-w-[140px] flex-1 sm:flex-none">
                <FieldLabel className="text-xs">Marka</FieldLabel>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {brands.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field className="min-w-[140px] flex-1 sm:flex-none">
                <FieldLabel className="text-xs">Eşik</FieldLabel>
                <NumberStepper label="Stok eşik değeri" value={threshold} onValueChange={onThresholdChange} min={0} max={1000} size="sm" />
              </Field>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Filtreleri temizle
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary line */}
      <div className="flex flex-wrap items-center gap-4 px-1 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{formatNumber(filteredVariants.length)}</strong> varyant
        </span>
        <span>
          Stok değeri: <strong className="text-foreground">{formatPrice(totalStockValue)}</strong>
        </span>
        {loading && (
          <span className="flex items-center gap-1">
            <RefreshCwIcon className="size-3 animate-spin" />
            Taranıyor...
          </span>
        )}
      </div>

      {/* Table */}
      <RecordTable
        label="Düşük stoklu varyantlar"
        columns={columns}
        rows={pageRows}
        getRowId={(v) => v.variantId}
        loading={loading}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onRowClick={(v) => setDetailVariant(v)}
        sort={sort}
        onSortChange={(next) => setSort(next ?? { id: 'stockCount', direction: 'asc' })}
        bulkActions={() => (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <TagIcon className="size-4" />
            Kampanya oluştur
          </Button>
        )}
        toolbar={
          <>
            <SegmentedControl
              size="sm"
              mode="radio"
              aria-label="Stok durumu"
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                { value: 'low', label: 'Düşük', badge: formatNumber(lowStockCount) },
                { value: 'out', label: 'Tükenen', badge: formatNumber(outOfStockCount) },
                { value: 'all', label: 'Tümü', badge: formatNumber(lowStockCount + outOfStockCount) },
              ]}
            />
            <div className="flex items-center gap-2 sm:border-l sm:pl-3">
              <Switch checked={showCampaigned} onCheckedChange={setShowCampaigned} aria-label="Kampanya yapılanları göster" />
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                <span className="hidden sm:inline">Kampanya yapılanlar</span>
                <span className="sm:hidden">Kampanyalı</span> ({formatNumber(coveredCount)})
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ExpandableSearch
                value={searchQuery}
                onValueChange={(v) => {
                  setSearchQuery(v);
                  setPage(1);
                }}
                placeholder="Ürün, varyant veya SKU ara..."
                label="Varyantlarda ara"
              />
              <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Filtreler">
                <SlidersHorizontalIcon className="size-4" />
                <span className="hidden sm:inline">Filtreler</span>
                {hasActiveFilters && (
                  <Badge status="info" className="ml-1">
                    Aktif
                  </Badge>
                )}
                <ChevronDownIcon className={`size-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredVariants.length === 0}>
                <DownloadIcon className="size-4" />
                CSV
              </Button>
            </div>
          </>
        }
        emptyState={
          <EmptyState
            media={<PackageIcon />}
            title={
              statusFilter === 'out' ? 'Tükenen varyant yok' : statusFilter === 'low' ? 'Düşük stoklu varyant yok' : 'Sonuç bulunamadı'
            }
            description={
              searchQuery || hasActiveFilters
                ? 'Filtrelerinize uygun varyant bulunamadı. Filtreleri temizlemeyi deneyin.'
                : `Stok seviyesi ${threshold} ve altında varyant yok. Eşik değerini artırabilirsiniz.`
            }
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
                      {formatNumber(rangeStart)}–{formatNumber(rangeEnd)} / {formatNumber(filteredVariants.length)}
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

      {/* Variant detail dialog (warehouse breakdown, prices) */}
      <Dialog open={Boolean(detailVariant)} onOpenChange={(open) => !open && setDetailVariant(null)}>
        {detailVariant && (
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailVariant.productName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {getStockBadge(detailVariant)}
                {detailVariant.isActive ? <Badge status="success">Aktif</Badge> : <Badge status="neutral">Pasif</Badge>}
                {coveredSet.has(detailVariant.variantId) && <Badge status="info">Kampanyada</Badge>}
                <span className="text-sm text-muted-foreground">
                  {detailVariant.variantLabel}
                  {detailVariant.sku && <span className="font-mono"> · {detailVariant.sku}</span>}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Satış fiyatı</div>
                  <div className="mt-1 font-medium">{formatPrice(detailVariant.sellPrice, detailVariant.currencyCode)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Stok değeri</div>
                  <div className="mt-1 font-medium">{formatPrice(detailVariant.stockValue, detailVariant.currencyCode)}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <WarehouseIcon className="size-3.5" />
                  Depo dağılımı
                </div>
                <div className="flex flex-wrap gap-2">
                  {detailVariant.warehouseStocks.map((ws) => (
                    <div key={ws.warehouseId} className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
                      <span>{ws.warehouseName}</span>
                      {ws.stockCount === 0 ? (
                        <Badge status="danger">Tükendi</Badge>
                      ) : ws.stockCount <= threshold ? (
                        <Badge status="warning">{ws.stockCount} adet</Badge>
                      ) : (
                        <Badge status="success">{ws.stockCount} adet</Badge>
                      )}
                      {ws.stockCount === 0 && detailVariant.warehouseStocks.some((w) => w.stockCount > 0) && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ArrowRightIcon className="size-3" />
                          Transfer öner
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailVariant(null)}>
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Campaign creation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>İndirim kampanyası oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Seçilen <strong>{selectedIds.length} varyant</strong> için indirim kampanyası oluşturulacak.
            </p>
            <Field>
              <FieldLabel>Kampanya başlığı</FieldLabel>
              <Input placeholder="Örn: Son stok indirimi" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>İndirim oranı (%)</FieldLabel>
              <NumberStepper label="İndirim oranı" value={discountPercent} onValueChange={setDiscountPercent} min={1} max={90} />
            </Field>
            {discountPercent > 0 && (
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">Örnek hesaplama:</p>
                {(() => {
                  const selectedSet = new Set(selectedIds);
                  const first = variants.find((v) => selectedSet.has(v.variantId));
                  if (!first) return null;
                  const discounted = first.sellPrice * (1 - discountPercent / 100);
                  return (
                    <p className="mt-1">
                      {first.productName}: {formatPrice(first.sellPrice, first.currencyCode)} →{' '}
                      <strong className="text-success">{formatPrice(discounted, first.currencyCode)}</strong> (
                      {formatPercent(discountPercent)} indirim)
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              İptal
            </Button>
            <Button onClick={handleCreateCampaign} loading={creating}>
              Kampanya oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
