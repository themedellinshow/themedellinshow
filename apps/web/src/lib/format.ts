export function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  currencyDisplay: 'symbol',
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatCop(value: string | number | null | undefined): string {
  const n = toNum(value);
  if (n <= 0) return 'COP 0';
  return copFormatter.format(Math.round(n));
}

export function formatUsd(value: string | number | null | undefined): string {
  const n = toNum(value);
  if (n <= 0) return '$0';
  return usdFormatter.format(n);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function plural(n: number, singular: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? singular : pluralWord ?? `${singular}s`}`;
}

export function priceFromCop(cop: string | number): string {
  return formatCop(cop);
}

export const EXPERIENCE_CATEGORIES = [
  'tour',
  'culture',
  'food',
  'nightlife',
  'arts',
  'sports',
  'nature',
  'wellness',
] as const;

export const NEIGHBORHOODS = [
  'El Poblado',
  'Laureles',
  'Provenza',
  'Parque Lleras',
  'Envigado',
  'Sabaneta',
  'Belen',
  'Centro',
  'Comuna 13',
  'Manrique',
  'Guayabal',
];