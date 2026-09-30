// Dates for the employee cabinet and the "Персонал" card — Kazakhstan calendar, same as
// everywhere else in the app.
const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });

export const formatDateRu = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);

export const ageOf = (birthIso?: string): number | null => {
  if (!birthIso) return null;
  const today = almatyToday();
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
};

// Санкнижка: просрочена / истекает в ближайшие 30 дней / в порядке / не указана.
export type SanbookState = 'missing' | 'expired' | 'soon' | 'ok';
export const sanbookState = (expiresIso?: string): { state: SanbookState; daysLeft: number | null } => {
  if (!expiresIso) return { state: 'missing', daysLeft: null };
  const daysLeft = daysBetween(almatyToday(), expiresIso);
  if (daysLeft < 0) return { state: 'expired', daysLeft };
  if (daysLeft <= 30) return { state: 'soon', daysLeft };
  return { state: 'ok', daysLeft };
};

export const SANBOOK_STYLE: Record<SanbookState, { tile: string; text: string; label: string }> = {
  missing: { tile: 'bg-slate-50 border-slate-200', text: 'text-slate-400', label: 'не указана' },
  expired: { tile: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'просрочена' },
  soon: { tile: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'скоро истекает' },
  ok: { tile: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'действует' },
};
