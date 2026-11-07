/** Shared tr-TR formatters. Turkish currency and dates, consistent across screens. */

const priceFormatters = new Map<string, Intl.NumberFormat>();

function priceFormatter(currency: string): Intl.NumberFormat {
  let formatter = priceFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    priceFormatters.set(currency, formatter);
  }
  return formatter;
}

/** "₺1.234,50" / "$12" — falls back to TRY for empty or unknown codes. */
export function formatPrice(value: number, currency?: string): string {
  return priceFormatter(currency === 'USD' ? 'USD' : 'TRY').format(value);
}

/** "%20" / "%12,5" — the percent sign leads, as in Turkish. */
export function formatPercent(value: number): string {
  return `%${value.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

const numberFormatter = new Intl.NumberFormat('tr-TR');

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** "7 Kasım 2026" — or "-" for missing input. */
export function formatDate(iso?: string | Date | null): string {
  if (!iso) return '-';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "7 Kas 2026" — compact date for dense table columns. */
export function formatDateShort(iso?: string | Date | null): string {
  if (!iso) return '-';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}
