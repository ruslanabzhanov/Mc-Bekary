import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Wheat } from 'lucide-react';

interface ConsumptionItem {
  name: string;
  unit: string;
  category: string;
  amount: number;
  cost: number;
  byDay: Record<string, number>;
}
interface ConsumptionResponse {
  range: { start: string; end: string; label: string };
  dates: string[];
  totalCost: number;
  items: ConsumptionItem[];
}

type Period = 'day' | 'week';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6', '#64748b', '#14b8a6', '#ec4899', '#84cc16'];
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00+05:00`);
  return new Date(d.getTime() + days * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
};
const weekStart = (iso: string) => {
  const wd = new Date(`${iso}T12:00:00+05:00`).getUTCDay();
  return addDaysIso(iso, -((wd + 6) % 7));
};

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;
// Мелкое — в граммах/миллилитрах (так его и отвешивают), крупное — в кг/л.
const formatAmount = (amount: number, unit: string) => {
  if (unit === 'кг' && amount < 1) return `${Math.round(amount * 1000)} г`;
  if (unit === 'л' && amount < 1) return `${Math.round(amount * 1000)} мл`;
  return `${Number(amount.toFixed(2)).toLocaleString('ru-RU')} ${unit}`;
};
const itemKey = (i: { name: string; unit: string }) => `${i.name}|${i.unit}`;

// Топ-10 сырья по расходу (в тенге — только так кг, литры и штуки можно сложить в один круг)
// за день или неделю, плюс фильтр на одну позицию, чтобы посмотреть её расход по дням.
export const ConsumptionWidget: React.FC<{ shopIdsKey: string }> = ({ shopIdsKey }) => {
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(() => almatyToday());
  const [selectedKey, setSelectedKey] = useState('');
  const [data, setData] = useState<ConsumptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!shopIdsKey) return;
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/analytics/consumption?shopIds=${shopIdsKey}&period=${period}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => console.error('Failed to load consumption:', e))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shopIdsKey, period, date]);

  const today = almatyToday();
  const isCurrent = period === 'day' ? date === today : weekStart(date) === weekStart(today);

  const items = data?.items || [];
  // Каждая позиция — в своей единице из техкарты; топ по количеству.
  const top = [...items].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const valueOf = (i: ConsumptionItem) => i.amount;
  const topTotal = top.reduce((n, i) => n + valueOf(i), 0);
  const selected = selectedKey ? items.find((i) => itemKey(i) === selectedKey) || null : null;

  const circumference = 2 * Math.PI * 40;
  let cumulative = 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Wheat className="w-4 h-4" />
        <h3 className="text-xs font-black uppercase tracking-wider">Топ-10 сырья по расходу</h3>
      </div>

      {/* Фильтры */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          {(['day', 'week'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                setDate(almatyToday());
              }}
              className={`min-h-[34px] rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                period === p ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p === 'day' ? 'День' : 'Неделя'}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setDate((d) => addDaysIso(d, period === 'day' ? -1 : -7))}
            className="w-8 h-8 shrink-0 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600"
            aria-label="Раньше"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="flex-1 min-w-0 text-center text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={() => setDate((d) => addDaysIso(d, period === 'day' ? 1 : 7))}
            disabled={isCurrent}
            className="w-8 h-8 shrink-0 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 flex items-center justify-center text-slate-600"
            aria-label="Позже"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {period === 'week' && data && (
          <p className="text-center text-[11px] font-bold text-slate-500">{data.range.label}</p>
        )}

        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Все продукты — топ-10</option>
          {[...items]
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
            .map((i) => (
              <option key={itemKey(i)} value={itemKey(i)}>
                {i.name} ({i.unit})
              </option>
            ))}
        </select>
      </div>

      {isLoading && !data ? (
        <div className="py-8 flex items-center justify-center text-slate-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Считаем расход…
        </div>
      ) : selectedKey ? (
        !selected ? (
          <p className="py-6 text-center text-xs text-slate-400 italic">
            За этот период этот продукт не расходовался.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Расход</p>
                <p className="text-lg font-black text-slate-900 tabular-nums">{formatAmount(selected.amount, selected.unit)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">На сумму</p>
                <p className="text-lg font-black text-indigo-700 tabular-nums">{formatMoney(selected.cost)}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">{selected.category}</p>
            {period === 'week' && data && (
              <div className="space-y-1.5">
                {(() => {
                  const max = Math.max(0, ...data.dates.map((d) => selected.byDay[d] || 0)) || 1;
                  return data.dates.map((d) => {
                    const v = selected.byDay[d] || 0;
                    return (
                      <div key={d} className="flex items-center gap-2 text-xs">
                        <span className="w-12 shrink-0 text-slate-500 font-medium">
                          {WEEKDAYS[new Date(`${d}T12:00:00+05:00`).getUTCDay()]} {Number(d.slice(8))}
                        </span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(v / max) * 100}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right font-bold text-slate-900 tabular-nums">
                          {v > 0 ? formatAmount(v, selected.unit) : '—'}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )
      ) : top.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400 italic">
          За этот период заявок с техкартами нет.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="16" />
              {top.map((it, i) => {
                const frac = topTotal > 0 ? valueOf(it) / topTotal : 0;
                const dash = frac * circumference;
                const offset = -cumulative * circumference;
                cumulative += frac;
                return (
                  <circle
                    key={itemKey(it)}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth="16"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </svg>
            <div className="flex-1 min-w-0 space-y-1.5">
              {top.map((it, i) => (
                <button
                  key={itemKey(it)}
                  onClick={() => setSelectedKey(itemKey(it))}
                  className="w-full flex items-center justify-between gap-2 text-xs text-left hover:bg-slate-50 rounded"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="truncate text-slate-700 font-medium">{it.name}</span>
                  </span>
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block font-black text-slate-900">{formatAmount(it.amount, it.unit)}</span>
                    <span className="block text-[10px] font-bold text-indigo-700">{formatMoney(it.cost)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Всего сырья за период: <b className="text-slate-600">{formatMoney(data?.totalCost || 0)}</b> · нажмите на позицию,
            чтобы посмотреть её отдельно
          </p>
        </>
      )}
    </div>
  );
};
