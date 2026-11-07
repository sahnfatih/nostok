import type { AnnouncementPopup } from '@/generated/prisma/client';

export type PopupTemplate = 'modal' | 'banner' | 'corner';
export type PopupSurface = 'light' | 'dark' | 'glass';
export type PopupFrequency = 'always' | 'once_per_day' | 'once_per_session' | 'once_ever';
export type PopupTargetDevices = 'all' | 'mobile' | 'desktop';
export type PopupStatus = 'draft' | 'published' | 'paused';

export const POPUP_TEMPLATES: PopupTemplate[] = ['modal', 'banner', 'corner'];
export const POPUP_SURFACES: PopupSurface[] = ['light', 'dark', 'glass'];
export const POPUP_FREQUENCIES: PopupFrequency[] = ['always', 'once_per_day', 'once_per_session', 'once_ever'];
export const POPUP_TARGET_DEVICES: PopupTargetDevices[] = ['all', 'mobile', 'desktop'];

export const POPUP_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const POPUP_IMAGE_MAX_BYTES = 2_500_000;

/** Editable popup fields shared by the API and the designer UI. */
export type PopupConfigInput = {
  template: PopupTemplate;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  accentColor: string;
  surface: PopupSurface;
  startAt: string | null;
  endAt: string | null;
  targetDevices: PopupTargetDevices;
  targetPaths: string[];
  frequency: PopupFrequency;
};

/** Popup as the app UI sees it (no image bytes). */
export type PopupSummary = PopupConfigInput & {
  id: string;
  status: PopupStatus;
  hasImage: boolean;
  imageUrl: string | null;
  updatedAt: string;
};

/** Popup as the storefront script sees it. */
export type PublicPopupConfig = PopupConfigInput & {
  active: boolean;
  id: string;
  imageUrl: string | null;
};

export function parseTargetPaths(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function parseScriptIds(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'string'));
  } catch {
    return {};
  }
}

export function isWithinSchedule(row: Pick<AnnouncementPopup, 'startAt' | 'endAt'>, now: Date = new Date()): boolean {
  if (row.startAt && now < row.startAt) return false;
  if (row.endAt && now > row.endAt) return false;
  return true;
}

export function toPopupConfig(row: AnnouncementPopup): PopupConfigInput & { id: string } {
  return {
    id: row.id,
    template: row.template as PopupTemplate,
    title: row.title,
    body: row.body,
    ctaLabel: row.ctaLabel,
    ctaUrl: row.ctaUrl,
    accentColor: row.accentColor,
    surface: row.surface as PopupSurface,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    endAt: row.endAt ? row.endAt.toISOString() : null,
    targetDevices: row.targetDevices as PopupTargetDevices,
    targetPaths: parseTargetPaths(row.targetPaths),
    frequency: row.frequency as PopupFrequency,
  };
}

export function toPopupSummary(row: AnnouncementPopup, imageUrl: string | null): PopupSummary {
  return {
    ...toPopupConfig(row),
    status: row.status as PopupStatus,
    hasImage: Boolean(row.image),
    imageUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicPopupConfig(row: AnnouncementPopup, imageUrl: string | null): PublicPopupConfig {
  return {
    ...toPopupConfig(row),
    active: row.status === 'published' && isWithinSchedule(row),
    imageUrl,
  };
}

/** Empty designer state used before the first save. */
export function emptyPopupConfig(): PopupConfigInput {
  return {
    template: 'modal',
    title: 'Avantajlı fiyatlarla son kalan ürünler',
    body: 'Stoklarla sınırlı indirimli ürünlerimizi kaçırmayın. İndirimli fiyatlar mağazada sizi bekliyor.',
    ctaLabel: 'Ürünleri incele',
    ctaUrl: '/collections/all',
    accentColor: '#6c47ff',
    surface: 'light',
    startAt: null,
    endAt: null,
    targetDevices: 'all',
    targetPaths: [],
    frequency: 'once_per_day',
  };
}
