'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { EmptyState } from '@/components/ikas/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NumberStepper } from '@/components/ikas/number-stepper';
import { ConfirmButton } from '@/components/ikas/confirm-button';
import { ToggleSection } from '@/components/ikas/toggle-section';
import { toast } from 'sonner';
import { SettingsIcon, PlusIcon, TrashIcon, ZapIcon, PlayIcon } from 'lucide-react';
import { formatPercent } from '@/lib/format';
import type { ClearanceRule } from '@/app/dashboard/page';
import type { RuleApplyResult } from '@/app/api/ikas/rules/apply/route';

const NO_CATEGORY = 'all';

interface RulesTabProps {
  rules: ClearanceRule[];
  categories: string[];
  onCreate: (rule: {
    name: string;
    stockThreshold: number;
    discountPercent: number;
    autoApply?: boolean;
    categoryFilter?: string;
  }) => Promise<void>;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onApply: (id: string) => Promise<RuleApplyResult>;
}

export default function RulesTab({ rules, categories, onCreate, onToggle, onDelete, onApply }: RulesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [stockThreshold, setStockThreshold] = useState(3);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [autoApply, setAutoApply] = useState(false);
  const [category, setCategory] = useState(NO_CATEGORY);
  const [creating, setCreating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Kural adı gerekli');
      return;
    }
    setCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        stockThreshold,
        discountPercent,
        autoApply,
        categoryFilter: category === NO_CATEGORY ? undefined : category,
      });
      toast.success('Kural başarıyla oluşturuldu');
      setDialogOpen(false);
      setName('');
      setStockThreshold(3);
      setDiscountPercent(20);
      setAutoApply(false);
      setCategory(NO_CATEGORY);
    } catch {
      toast.error('Kural oluşturulurken bir hata oluştu');
    } finally {
      setCreating(false);
    }
  };

  const handleApply = async (rule: ClearanceRule) => {
    setApplyingId(rule.id);
    try {
      const result = await onApply(rule.id);
      if (result.status === 'created') {
        toast.success(`"${rule.name}" kuralı uygulandı — ${result.variantCount} varyant için kampanya oluşturuldu`);
      } else if (result.status === 'already_covered') {
        toast.info('Kurala uyan varyantlar zaten aktif bir kampanyada');
      } else if (result.status === 'no_matches') {
        toast.info('Kuralı karşılayan düşük stoklu varyant yok');
      } else {
        toast.error(result.message || 'Kural çalıştırılırken bir hata oluştu');
      }
    } catch {
      toast.error('Kural çalıştırılırken bir hata oluştu');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Otomatik kurallar</h2>
          <p className="text-sm text-muted-foreground">Stok seviyesine göre otomatik indirim kampanyaları oluşturun.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="size-4" />
          Kural oluştur
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          media={<SettingsIcon />}
          title="Henüz kural yok"
          description="Otomatik stok erime kuralları tanımlayarak zamandan tasarruf edin. Örneğin: &quot;Stok 3 ve altına düşerse %20 indirim uygula&quot;."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {rule.name}
                    {rule.autoApply && (
                      <Badge status="info">
                        <ZapIcon className="size-3" />
                        Otomatik
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Stok ≤ {rule.stockThreshold} → {formatPercent(rule.discountPercent)} indirim
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" size="sm" onClick={() => handleApply(rule)} loading={applyingId === rule.id}>
                    <PlayIcon className="size-4" />
                    Çalıştır
                  </Button>
                  <Switch checked={rule.isActive} onCheckedChange={(checked) => onToggle(rule.id, checked)} />
                  <ConfirmButton
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    confirmLabel="Silinsin mi?"
                    onConfirm={() => onDelete(rule.id)}
                    aria-label={`${rule.name} kuralını sil`}
                  >
                    <TrashIcon className="size-4" />
                  </ConfirmButton>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {rule.isActive ? (
                    <Badge status="success" dot>
                      Aktif
                    </Badge>
                  ) : (
                    <Badge status="neutral">Pasif</Badge>
                  )}
                  {rule.categoryFilter && <Badge status="info">Kategori: {rule.categoryFilter}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create rule dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Otomatik kural oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field>
              <FieldLabel>Kural adı</FieldLabel>
              <FieldDescription>Bu kuralı tanımlamak için bir isim verin.</FieldDescription>
              <Input placeholder="Örn: Son stok indirimi" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Stok eşik değeri</FieldLabel>
              <FieldDescription>Stok bu değerin altına düştüğünde kural tetiklenir.</FieldDescription>
              <NumberStepper label="Stok eşik değeri" value={stockThreshold} onValueChange={setStockThreshold} min={0} max={1000} />
            </Field>
            <Field>
              <FieldLabel>İndirim oranı</FieldLabel>
              <FieldDescription>Uygulanacak indirim yüzdesi.</FieldDescription>
              <NumberStepper label="İndirim oranı" value={discountPercent} onValueChange={setDiscountPercent} min={1} max={90} />
            </Field>
            <Field>
              <FieldLabel>Kategori (opsiyonel)</FieldLabel>
              <FieldDescription>Seçilirse kural yalnızca bu kategorideki ürünlere uygulanır.</FieldDescription>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Tüm kategoriler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Tüm kategoriler</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <ToggleSection
              title="Otomatik uygula"
              description="Kural tetiklendiğinde kampanyayı otomatik oluşturur."
              checked={autoApply}
              onCheckedChange={setAutoApply}
            >
              <p className="text-sm text-muted-foreground">
                Bu ayar açıkken, stok eşiğine düşen varyantlar için kampanyalar kendiliğinden oluşur. Kapalıyken kural
                yalnızca &quot;Çalıştır&quot; düğmesiyle elle uygulanır.
              </p>
            </ToggleSection>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              İptal
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Kural oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
