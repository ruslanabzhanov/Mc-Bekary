import type { AdvanceRequest } from '../types.js';

// Один человек мог подать за месяц несколько заявок на аванс. В списке «Одобренные», в Excel и в
// истории кабинета они показываются одной строкой с общей суммой. Сами заявки в базе остаются
// как есть (у каждой своя дата и решение) — объединяется только то, что видит человек.
const monthOf = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' }).slice(0, 7);

export function mergeApprovedAdvances<T extends AdvanceRequest>(list: T[]): Array<T & { mergedCount: number }> {
  const groups = new Map<string, T[]>();
  const order: Array<string | T> = [];
  for (const r of list) {
    if (r.status !== 'approved' || !r.createdAt) {
      order.push(r);
      continue;
    }
    const key = `${r.staffId}|${monthOf(r.createdAt)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(r);
  }
  return order.map((item) => {
    if (typeof item !== 'string') return { ...item, mergedCount: 1 };
    const rows = groups.get(item)!;
    const latest = rows.reduce((a, b) => (String(b.createdAt) > String(a.createdAt) ? b : a));
    const withKaspi = [latest, ...rows].find((r) => r.kaspiPhone) || latest;
    return {
      ...latest,
      amount: rows.reduce((n, r) => n + (Number(r.amount) || 0), 0),
      kaspiPhone: withKaspi.kaspiPhone,
      kaspiName: withKaspi.kaspiName,
      mergedCount: rows.length,
    };
  });
}
