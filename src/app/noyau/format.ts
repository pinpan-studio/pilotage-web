// Formats français, fuseau Africa/Abidjan (UTC+0).
const FUSEAU = 'Africa/Abidjan';
export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)} %`);
export function date(v: string | Date | null | undefined) {
  if (!v) return '—';
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : new Date(v);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSEAU }).format(d);
}
export function dateHeure(v: string | Date | null | undefined) {
  if (!v) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSEAU }).format(new Date(v));
}
