'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banner } from '@/components/ikas/banner';
import { SegmentedControl } from '@/components/ikas/segmented-control';
import { ConfirmButton } from '@/components/ikas/confirm-button';
import { Layout } from '@/components/ikas/layout';
import { MegaphoneIcon, ImageIcon, TrashIcon, UploadIcon } from 'lucide-react';
import { ApiRequests } from '@/lib/api-requests';
import {
  POPUP_IMAGE_MAX_BYTES,
  POPUP_IMAGE_MIMES,
  emptyPopupConfig,
  type PopupConfigInput,
  type PopupFrequency,
  type PopupStatus,
  type PopupSurface,
  type PopupTargetDevices,
  type PopupTemplate,
} from '@/lib/popup';
import PopupPreview from '@/components/clearance/popup-preview';

interface PopupTabProps {
  token: string;
}

type PreviewDevice = 'desktop' | 'mobile';

const ACCENT_PRESETS = ['#6c47ff', '#0ea5e9', '#16a34a', '#dc2626', '#f59e0b', '#111827'];

const TEMPLATE_OPTIONS: Array<{ value: PopupTemplate; label: string }> = [
  { value: 'modal', label: 'Modal' },
  { value: 'banner', label: 'Alt bant' },
  { value: 'corner', label: 'Köşe kartı' },
];

const FREQUENCY_LABELS: Record<PopupFrequency, string> = {
  always: 'Her zaman göster',
  once_per_day: 'Günde bir kez',
  once_per_session: 'Oturumda bir kez',
  once_ever: 'Yalnızca bir kez',
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Server validation messages travel in `error` of the JSON body (axios). */
function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { error?: unknown } } }).response?.data?.error;
    if (typeof data === 'string') return data;
  }
  return fallback;
}

export default function PopupTab({ token }: PopupTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<PopupStatus>('draft');
  const [config, setConfig] = useState<PopupConfigInput>(emptyPopupConfig());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pathsText, setPathsText] = useState('');
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiRequests.ikas.getPopup(token);
      if (res.status === 200) {
        const popup = res.data?.data?.popup;
        if (popup) {
          setConfig({
            template: popup.template,
            title: popup.title,
            body: popup.body,
            ctaLabel: popup.ctaLabel,
            ctaUrl: popup.ctaUrl,
            accentColor: popup.accentColor,
            surface: popup.surface,
            startAt: popup.startAt,
            endAt: popup.endAt,
            targetDevices: popup.targetDevices,
            targetPaths: popup.targetPaths,
            frequency: popup.frequency,
          });
          setStatus(popup.status);
          setImageUrl(popup.imageUrl);
          setPathsText(popup.targetPaths.join('\n'));
        }
      }
    } catch (error) {
      console.error('Error loading popup:', error);
      toast.error('Duyuru ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void load();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [load]);

  const patch = (partial: Partial<PopupConfigInput>) => setConfig((prev) => ({ ...prev, ...partial }));

  const collectPaths = (): string[] =>
    pathsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const payload: PopupConfigInput = {
        ...config,
        ctaLabel: config.ctaLabel?.trim() ? config.ctaLabel.trim() : null,
        ctaUrl: config.ctaUrl?.trim() ? config.ctaUrl.trim() : null,
        targetPaths: collectPaths(),
      };
      const res = await ApiRequests.ikas.savePopup(token, payload);
      if (res.status === 200 && res.data?.data?.popup) {
        const nextStatus = res.data.data.popup.status;
        setStatus(nextStatus);
        toast.success(
          nextStatus === 'published' ? 'Kaydedildi — değişiklik vitrinde anında güncellendi' : 'Tasarım kaydedildi',
        );
        return true;
      }
      toast.error('Duyuru kaydedilemedi');
      return false;
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Duyuru kaydedilemedi'));
      return false;
    } finally {
      setSaving(false);
    }
    // collectPaths reads pathsText, which is part of the payload deps below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, pathsText, token]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const saved = await save();
      if (!saved) return;
      const res = await ApiRequests.ikas.publishPopup(token);
      if (res.status === 200 && res.data?.data) {
        setStatus(res.data.data.popup.status);
        toast.success(`Duyuru mağazada yayında (${res.data.data.storefrontCount} vitrin)`);
      } else {
        toast.error('Duyuru yayınlanamadı');
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Duyuru yayınlanamadı. Uygulama yetkilerini kontrol edin.'));
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    try {
      const res = await ApiRequests.ikas.unpublishPopup(token);
      if (res.status === 200 && res.data?.data) {
        setStatus(res.data.data.popup.status);
        toast.success('Duyuru duraklatıldı');
      }
    } catch {
      toast.error('Duyuru durdurulamadı');
    }
  };

  const handleRemove = async () => {
    try {
      const res = await ApiRequests.ikas.deletePopup(token);
      if (res.status === 200) {
        setStatus('draft');
        toast.success('Duyuru mağazadan kaldırıldı');
      }
    } catch {
      toast.error('Duyuru kaldırılamadı');
    }
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    if (!(POPUP_IMAGE_MIMES as readonly string[]).includes(file.type)) {
      toast.error('Görsel PNG, JPEG, WEBP veya GIF olmalı');
      return;
    }
    if (file.size > POPUP_IMAGE_MAX_BYTES) {
      toast.error('Görsel 2,5 MB\'ı aşmamalı');
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Dosya okunamadı'));
        reader.readAsDataURL(file);
      });
      const res = await ApiRequests.ikas.uploadPopupImage(token, dataUrl);
      if (res.status === 200 && res.data?.data?.popup) {
        setImageUrl(res.data.data.popup.imageUrl);
        toast.success('Görsel yüklendi');
      } else {
        toast.error('Görsel yüklenemedi');
      }
    } catch {
      toast.error('Görsel yüklenemedi');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      const res = await ApiRequests.ikas.deletePopupImage(token);
      if (res.status === 200) {
        setImageUrl(null);
        toast.success('Görsel kaldırıldı');
      }
    } catch {
      toast.error('Görsel kaldırılamadı');
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-4">
      {status === 'published' ? (
        <Banner status="success" title="Duyuru mağazada yayında">
          <p>Ziyaretçiler bu duyuru popup&apos;ını görüyor. Tasarımda değişiklik yapıp kaydettiğinizde vitrinde anında güncellenir.</p>
        </Banner>
      ) : status === 'paused' ? (
        <Banner status="warning" title="Duyuru duraklatıldı">
          <p>Popup vitrinde görünmüyor. Tekrar yayınladığınızda kaldığı yerden devam eder.</p>
        </Banner>
      ) : (
        <Banner status="info" title="Tasarım yayınlanmadı" icon={<MegaphoneIcon />}>
          <p>Duyuruyu tasarlayın, önizleyin ve &quot;Yayınla&quot; ile mağaza vitrinine gönderin.</p>
        </Banner>
      )}

      <Layout columns="half">
        {/* Designer */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>İçerik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel>Görsel</FieldLabel>
                <FieldDescription>Popup&apos;ın üstünde görünecek kampanya görseli (opsiyonel).</FieldDescription>
                <div className="flex flex-wrap items-center gap-3">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="Duyuru görseli" className="h-20 w-28 rounded-lg border object-cover" />
                  ) : (
                    <div className="flex h-20 w-28 items-center justify-center rounded-lg border text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={POPUP_IMAGE_MIMES.join(',')}
                    className="hidden"
                    onChange={(e) => {
                      void handleImageFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon className="size-4" />
                    Görsel yükle
                  </Button>
                  {imageUrl && (
                    <Button variant="ghost" color="neutral" size="sm" onClick={() => void handleRemoveImage()}>
                      <TrashIcon className="size-4" />
                      Kaldır
                    </Button>
                  )}
                </div>
              </Field>

              <Field>
                <FieldLabel>Başlık</FieldLabel>
                <Input
                  value={config.title}
                  maxLength={120}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Örn: Avantajlı fiyatlarla son kalan ürünler"
                />
              </Field>

              <Field>
                <FieldLabel>Mesaj</FieldLabel>
                <Textarea
                  value={config.body}
                  maxLength={1000}
                  rows={4}
                  onChange={(e) => patch({ body: e.target.value })}
                  placeholder="Kısa bir duyuru metni yazın"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Buton etiketi</FieldLabel>
                  <Input
                    value={config.ctaLabel ?? ''}
                    maxLength={60}
                    onChange={(e) => patch({ ctaLabel: e.target.value })}
                    placeholder="Ürünleri incele"
                  />
                </Field>
                <Field>
                  <FieldLabel>Buton linki</FieldLabel>
                  <Input
                    value={config.ctaUrl ?? ''}
                    maxLength={500}
                    onChange={(e) => patch({ ctaUrl: e.target.value })}
                    placeholder="/collections/all"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Görünüm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel>Şablon</FieldLabel>
                <SegmentedControl
                  mode="radio"
                  size="sm"
                  aria-label="Popup şablonu"
                  value={config.template}
                  onValueChange={(v) => patch({ template: v as PopupTemplate })}
                  options={TEMPLATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </Field>

              <Field>
                <FieldLabel>Yüzey</FieldLabel>
                <Select value={config.surface} onValueChange={(v) => patch({ surface: v as PopupSurface })}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Açık</SelectItem>
                    <SelectItem value="dark">Koyu</SelectItem>
                    <SelectItem value="glass">Cam efektli</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Vurgu rengi</FieldLabel>
                <FieldDescription>Buton rengi.</FieldDescription>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Renk ${color}`}
                      onClick={() => patch({ accentColor: color })}
                      className={`size-8 rounded-full border-2 transition-transform ${
                        config.accentColor.toLowerCase() === color ? 'scale-110 border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Input
                    value={config.accentColor}
                    onChange={(e) => patch({ accentColor: e.target.value })}
                    className="w-[110px] font-mono"
                    aria-label="Özel renk"
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zamanlama ve hedefleme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Başlangıç</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={toLocalInputValue(config.startAt)}
                    onChange={(e) => patch({ startAt: fromLocalInputValue(e.target.value) })}
                  />
                </Field>
                <Field>
                  <FieldLabel>Bitiş</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={toLocalInputValue(config.endAt)}
                    onChange={(e) => patch({ endAt: fromLocalInputValue(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Cihaz</FieldLabel>
                  <Select
                    value={config.targetDevices}
                    onValueChange={(v) => patch({ targetDevices: v as PopupTargetDevices })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm cihazlar</SelectItem>
                      <SelectItem value="mobile">Yalnızca mobil</SelectItem>
                      <SelectItem value="desktop">Yalnızca masaüstü</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Gösterim sıklığı</FieldLabel>
                  <Select
                    value={config.frequency}
                    onValueChange={(v) => patch({ frequency: v as PopupFrequency })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FREQUENCY_LABELS) as PopupFrequency[]).map((f) => (
                        <SelectItem key={f} value={f}>
                          {FREQUENCY_LABELS[f]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel>Sayfa hedefleri</FieldLabel>
                <FieldDescription>
                  Her satıra bir yol yazın (örn. <code className="font-mono">/collections</code>). Boş bırakılırsa tüm
                  sayfalarda görünür. <code className="font-mono">*</code> ile biterse ön ek eşleşmesi yapar.
                </FieldDescription>
                <Textarea
                  value={pathsText}
                  rows={3}
                  onChange={(e) => setPathsText(e.target.value)}
                  placeholder={'/collections/all\n/products/*'}
                />
              </Field>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void save()} loading={saving}>
              Kaydet
            </Button>
            {status === 'published' ? (
              <Button variant="outline" onClick={() => void handleUnpublish()}>
                Durdur
              </Button>
            ) : (
              <Button onClick={() => void handlePublish()} loading={publishing}>
                Yayınla
              </Button>
            )}
            <ConfirmButton
              variant="ghost"
              color="neutral"
              confirmLabel="Kaldırılsın mı?"
              onConfirm={() => void handleRemove()}
            >
              <TrashIcon className="size-4" />
              Mağazadan kaldır
            </ConfirmButton>
          </div>
        </div>

        {/* Live preview */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Önizleme</CardTitle>
              <SegmentedControl
                mode="radio"
                size="sm"
                aria-label="Önizleme cihazı"
                value={device}
                onValueChange={(v) => setDevice(v as PreviewDevice)}
                options={[
                  { value: 'desktop', label: 'Masaüstü' },
                  { value: 'mobile', label: 'Mobil' },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent>
            <PopupPreview config={{ ...config, targetPaths: collectPaths(), imageUrl }} device={device} />
            <p className="mt-3 text-xs text-muted-foreground">
              Önizleme vitrindeki görünümü temsil eder; küçük piksel farkları olabilir.
            </p>
          </CardContent>
        </Card>
      </Layout>
    </div>
  );
}
