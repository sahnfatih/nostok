'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { EmptyState } from '@/components/ikas/empty-state';
import { Banner } from '@/components/ikas/banner';
import { RecordTable, type RecordTableColumn } from '@/components/ikas/record-table';
import { ConfirmButton } from '@/components/ikas/confirm-button';
import { NumberStepper } from '@/components/ikas/number-stepper';
import { toast } from 'sonner';
import { TagIcon, PencilIcon, SquareIcon, PackageIcon, SearchIcon } from 'lucide-react';
import { formatDateShort, formatPercent, formatPrice } from '@/lib/format';
import type { CampaignSummary } from '@/app/dashboard/page';

interface CampaignsTabProps {
  campaigns: CampaignSummary[];
  onDelete: (id: string) => Promise<void>;
  onUpdate: (id: string, data: { discountPercent?: number; title?: string }) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onNavigate?: (tab: string) => void;
}

const PAGE_SIZE = 10;

/** Client-side preview math; the server recomputes and writes the real price. */
function previewDiscountPrice(sellPrice: number, percent: number): number {
  return Math.round(sellPrice * (1 - percent / 100) * 100) / 100;
}

export default function CampaignsTab({ campaigns, onDelete, onUpdate, onRestore, onNavigate }: CampaignsTabProps) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CampaignSummary | null>(null);
  const [editPercent, setEditPercent] = useState(20);
  const [savingEdit, setSavingEdit] = useState(false);

  const pageCount = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = campaigns.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = campaigns.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, campaigns.length);

  const openEdit = useCallback((campaign: CampaignSummary) => {
    setEditing(campaign);
    setEditPercent(campaign.discountPercent);
  }, []);

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await onUpdate(editing.id, { discountPercent: editPercent });
      toast.success(`İndirim oranı ${formatPercent(editPercent)} olarak güncellendi`);
      setEditing(null);
    } catch {
      toast.error('İndirim oranı güncellenirken bir hata oluştu');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEnd = useCallback(
    async (campaign: CampaignSummary) => {
      try {
        await onDelete(campaign.id);
        toast.success('Kampanya bitirildi — fiyatlar eski haline döndü', {
          duration: 10000,
          action: {
            label: 'Geri al',
            onClick: () => {
              void onRestore(campaign.id)
                .then(() => toast.success('Kampanya geri alındı'))
                .catch(() => toast.error('Kampanya geri alınamadı'));
            },
          },
        });
      } catch {
        toast.error('Kampanya bitirilirken bir hata oluştu');
      }
    },
    [onDelete, onRestore],
  );

  const editSample = useMemo(
    () => editing?.variantDetails.find((v) => typeof v.sellPrice === 'number') ?? null,
    [editing],
  );

  const columns: RecordTableColumn<CampaignSummary>[] = useMemo(
    () => [
      {
        id: 'title',
        header: 'Kampanya',
        cell: (campaign) => (
          <div>
            <div className="font-medium">{campaign.title}</div>
            <div className="text-xs text-muted-foreground">{campaign.variantIds.length} varyant</div>
          </div>
        ),
      },
      {
        id: 'discountPercent',
        header: 'İndirim',
        cell: (campaign) => <Badge status="warning">{formatPercent(campaign.discountPercent)}</Badge>,
      },
      {
        id: 'variants',
        header: 'Kampanyadaki ürünler',
        hideOnMobile: true,
        cell: (campaign) =>
          campaign.variantDetails.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {campaign.variantDetails.map((v) => (
                <div key={v.variantId} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                  <span className="font-medium">{v.productName}</span>
                  {v.variantLabel && v.variantLabel !== 'Varsayılan' && (
                    <span className="text-muted-foreground">· {v.variantLabel}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PackageIcon className="size-3.5" />
              {campaign.variantIds.length} varyant kapsanıyor
            </span>
          ),
      },
      {
        id: 'createdAt',
        header: 'Tarih',
        hideOnMobile: true,
        cell: (campaign) => <span className="text-sm text-muted-foreground">{formatDateShort(campaign.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        align: 'end',
        cell: (campaign) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              color="neutral"
              size="sm"
              onClick={() => openEdit(campaign)}
              aria-label={`${campaign.title} indirim oranını düzenle`}
            >
              <PencilIcon className="size-4" />
            </Button>
            <ConfirmButton
              variant="ghost"
              color="neutral"
              size="sm"
              confirmLabel="Bitirilsin mi?"
              onConfirm={() => handleEnd(campaign)}
              aria-label={`${campaign.title} kampanyasını bitir`}
            >
              <SquareIcon className="size-4" />
            </ConfirmButton>
          </div>
        ),
      },
    ],
    [openEdit, handleEnd],
  );

  return (
    <div className="space-y-4">
      <Banner status="info" title="Kampanyalar nasıl çalışır?">
        <p>
          Normal satış fiyatı korunur, indirimli fiyat mağazada üstü çizili olarak gösterilir. Kampanyayı bitirdiğinizde
          tüm varyant fiyatları eski haline döner.
        </p>
      </Banner>

      <RecordTable
        label="Kampanyalar"
        columns={columns}
        rows={pageRows}
        getRowId={(c) => c.id}
        emptyState={
          <EmptyState
            media={<TagIcon />}
            title="Henüz kampanya yok"
            description="Düşük stoklu varyantları tarayarak ve seçerek ilk indirim kampanyanızı oluşturun."
            actions={
              onNavigate ? (
                <Button size="sm" onClick={() => onNavigate('scanner')}>
                  <SearchIcon className="size-4" />
                  Taramaya git
                </Button>
              ) : undefined
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
                      {rangeStart}–{rangeEnd} / {campaigns.length} kampanya
                    </span>
                    <span className="sm:hidden">
                      {safePage} / {pageCount}
                    </span>
                  </>
                ),
              }
            : undefined
        }
      />

      {/* Discount edit dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>İndirim oranını düzenle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>{editing.title}</strong> kampanyasındaki {editing.variantIds.length} varyantın indirimli fiyatı yeni
                orana göre güncellenir. Normal satış fiyatı değişmez.
              </p>
              <Field>
                <FieldLabel>İndirim oranı (%)</FieldLabel>
                <FieldDescription>Yeni indirim yüzdesi.</FieldDescription>
                <NumberStepper label="İndirim oranı" value={editPercent} onValueChange={setEditPercent} min={1} max={90} />
              </Field>
              {editSample && typeof editSample.sellPrice === 'number' && (
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                  <p className="text-muted-foreground">Örnek fiyat ({editSample.productName}):</p>
                  <p className="mt-1">
                    {formatPrice(editSample.sellPrice)} →{' '}
                    <strong className="text-success">{formatPrice(previewDiscountPrice(editSample.sellPrice, editPercent))}</strong>{' '}
                    ({formatPercent(editPercent)} indirim)
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
                İptal
              </Button>
              <Button onClick={handleSaveEdit} loading={savingEdit}>
                Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
