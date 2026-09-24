import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Package, Wallet,
  Flame, AlertTriangle, Users, Clock, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { CoffeeShop } from '../types';
import { ConsumptionWidget } from './ConsumptionWidget';

interface AnalyticsViewProps {
  shops: CoffeeShop[];
}

type Period = 'day' | 'week' | 'month' | 'year';
type Metric = 'qty' | 'sum';

interface SeriesBucket {
  bucket: string;
  label: string;
  qty: number;
  sum: number;
}
interface AnalyticsResponse {
  period: Period;
  range: { start: string; end: string; label: string };
  totals: { qty: number; sum: number };
  series: SeriesBucket[];
  categoryBreakdown: { category: string; label: string; qty: number }[];
  topProducts: { id: string; name: string; qty: number }[];
  peak: { label: string; bucketLabel: string; qty: number; sum: number } | null;
  notSubmittedToday: { count: number; shopNames: string[] } | null;
  comparison: { label: string; qty: number; sum: number; deltaQtyPct: number | null; deltaSumPct: number | null };
  last7Days: {
    dates: string[];
    shops: { shopId: number; shopName: string; days: Record<string, { time: string; managerName: string } | null> }[];
  };
}

const PERIOD_TABS: { key: Period; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'year', label: 'Год' },
];

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#8b5cf6', '#64748b', '#14b8a6'];

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00+05:00`);
  return new Date(d.getTime() + days * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
};
const almatyWeekStart = (iso: string) => {
  const wd = new Date(`${iso}T12:00:00+05:00`).getUTCDay();
  return addDaysIso(iso, -((wd + 6) % 7));
};

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;
const formatQty = (n: number) => `${n.toLocaleString('ru-RU')} шт`;

const formatDateShort = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}.${m}`;
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ shops }) => {
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(() => almatyToday());
  const [metric, setMetric] = useState<Metric>('qty');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showAllMissing, setShowAllMissing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ shopId: number; date: string } | null>(null);

  const shopIdsKey = useMemo(() => shops.map((s) => s.id).join(','), [shops]);

  useEffect(() => {
    if (!shopIdsKey) {
      setData(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setSelectedIdx(null);
    fetch(`/api/analytics?shopIds=${shopIdsKey}&period=${period}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => console.error('Failed to load analytics:', e))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shopIdsKey, period, date]);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    setDate(almatyToday());
  };

  const shiftDate = (dir: 1 | -1) => {
    if (period === 'day') return setDate((d) => addDaysIso(d, dir));
    if (period === 'week') return setDate((d) => addDaysIso(d, dir * 7));
    if (period === 'month') {
      return setDate((d) => {
        const [y, m] = d.split('-').map(Number);
        const nm = m - 1 + dir;
        const ny = y + Math.floor(nm / 12);
        const rm = ((nm % 12) + 12) % 12;
        return `${ny}-${String(rm + 1).padStart(2, '0')}-01`;
      });
    }
    setDate((d) => `${Number(d.slice(0, 4)) + dir}-01-01`);
  };

  const today = almatyToday();
  const isCurrentPeriod =
    period === 'day'
      ? date === today
      : period === 'week'
      ? almatyWeekStart(date) === almatyWeekStart(today)
      : period === 'month'
      ? date.slice(0, 7) === today.slice(0, 7)
      : date.slice(0, 4) === today.slice(0, 4);

  const series = data?.series || [];
  const values = series.map((s) => (metric === 'qty' ? s.qty : s.sum));
  const maxValue = Math.max(1, ...values);

  // Thin the X-axis labels so 24/31 points don't collide — every point stays clickable
  // (the hit target below), only the printed label is skipped.
  const labelEvery = period === 'day' ? 3 : period === 'month' ? 5 : 1;

  const selected = selectedIdx != null ? series[selectedIdx] : null;

  const catTotal = (data?.categoryBreakdown || []).reduce((n, c) => n + c.qty, 0);
  const circumference = 2 * Math.PI * 40;
  let cumulative = 0;

  return (
    <div className="space-y-4 pb-10">
      {/* Period + metric controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 space-y-3">
        <div className="grid grid-cols-4 gap-1.5">
          {PERIOD_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => changePeriod(t.key)}
              className={`min-h-[38px] rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                period === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="w-9 h-9 shrink-0 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600"
            aria-label="Предыдущий период"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center min-w-0">
            <p className="text-sm font-extrabold text-slate-900 truncate">{data?.range.label || '…'}</p>
            {isCurrentPeriod && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">текущий период</p>
            )}
          </div>
          <button
            onClick={() => shiftDate(1)}
            disabled={isCurrentPeriod}
            className="w-9 h-9 shrink-0 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 border border-slate-200 flex items-center justify-center text-slate-600"
            aria-label="Следующий период"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setMetric('qty')}
            className={`min-h-[36px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              metric === 'qty' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package className="w-3.5 h-3.5" /> По количеству
          </button>
          <button
            onClick={() => setMetric('sum')}
            className={`min-h-[36px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              metric === 'sum' ? 'bg-teal-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" /> По сумме
          </button>
        </div>
      </div>

      {isLoading && !data ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем аналитику…
        </div>
      ) : !data || shops.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm italic">
          Нет точек, по которым можно посчитать аналитику.
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3">
            <div className="flex items-center gap-1.5 text-slate-700 mb-2">
              <BarChart3 className="w-4 h-4" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                {metric === 'qty' ? 'Заказано, шт' : 'Сумма заказов, ₸'}
              </h3>
            </div>

            {series.length > 0 && (
              <div className="relative">
                <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="w-full h-32">
                  {(() => {
                    const n = series.length;
                    const stepX = n > 1 ? 300 / (n - 1) : 0;
                    const points = series.map((s, i) => {
                      const v = metric === 'qty' ? s.qty : s.sum;
                      const x = n > 1 ? i * stepX : 150;
                      const y = 110 - (v / maxValue) * 100;
                      return { x, y, v };
                    });
                    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} 110 L ${points[0]?.x || 0} 110 Z`;
                    return (
                      <>
                        <path d={areaPath} fill="#4f46e5" fillOpacity="0.08" stroke="none" />
                        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        {points.map((p, i) => (
                          <g key={i}>
                            {/* wide invisible hit target — the visible dot alone is too small to tap */}
                            <rect
                              x={p.x - stepX / 2}
                              y={0}
                              width={stepX || 300}
                              height={120}
                              fill="transparent"
                              onClick={() => setSelectedIdx(i)}
                            />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={selectedIdx === i ? 4 : 2.2}
                              fill={selectedIdx === i ? '#4f46e5' : '#818cf8'}
                              pointerEvents="none"
                            />
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}

            <div className="flex justify-between mt-1 px-0.5">
              {series.map((s, i) =>
                i % labelEvery === 0 || i === series.length - 1 ? (
                  <span
                    key={i}
                    className="text-[9px] text-slate-400 font-medium"
                    style={{ minWidth: `${100 / series.length}%`, textAlign: 'center' }}
                  >
                    {s.label}
                  </span>
                ) : (
                  <span key={i} style={{ minWidth: `${100 / series.length}%` }} />
                )
              )}
            </div>

            {selected && (
              <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">{selected.label}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-black text-slate-900">{formatQty(selected.qty)}</span>
                  <span className="font-black text-indigo-700">{formatMoney(selected.sum)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Totals + comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Итого за период</p>
              <p className="text-xl font-black text-slate-900 tabular-nums leading-tight">{formatQty(data.totals.qty)}</p>
              <p className="text-sm font-bold text-indigo-700 tabular-nums mt-0.5">{formatMoney(data.totals.sum)}</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Vs {data.comparison.label}
              </p>
              {(() => {
                const delta = metric === 'qty' ? data.comparison.deltaQtyPct : data.comparison.deltaSumPct;
                const refValue = metric === 'qty' ? data.totals.qty : data.totals.sum;
                const Icon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
                const cls = delta == null || delta === 0 ? 'text-slate-500' : delta > 0 ? 'text-emerald-600' : 'text-rose-600';
                return (
                  <div className={`flex items-center gap-1.5 ${cls}`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-xl font-black tabular-nums">
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                    </span>
                  </div>
                );
              })()}
              <p className="text-[11px] text-slate-400 mt-1">
                было: {metric === 'qty' ? formatQty(data.comparison.qty) : formatMoney(data.comparison.sum)}
              </p>
            </div>
          </div>

          {/* Peak + not submitted */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.peak && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">{data.peak.label}</span>
                </div>
                <p className="text-base font-black text-slate-900">{data.peak.bucketLabel}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {formatQty(data.peak.qty)} · {formatMoney(data.peak.sum)}
                </p>
              </div>
            )}

            {data.notSubmittedToday && data.notSubmittedToday.count > 0 && (
              <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4 shadow-xs">
                <div className="flex items-center gap-1.5 text-rose-700 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Не подали заявку</span>
                </div>
                <button
                  onClick={() => setShowAllMissing((v) => !v)}
                  className="flex items-center gap-1 text-base font-black text-rose-900"
                >
                  {data.notSubmittedToday.count} точ.{showAllMissing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showAllMissing && (
                  <ul className="mt-1.5 text-[11px] text-rose-800 space-y-0.5">
                    {data.notSubmittedToday.shopNames.map((n) => (
                      <li key={n}>• {n}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Category breakdown — always by quantity */}
          {data.categoryBreakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                Разбивка по категориям (шт)
              </h3>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="16" />
                  {data.categoryBreakdown.map((c, i) => {
                    const frac = catTotal > 0 ? c.qty / catTotal : 0;
                    const dash = frac * circumference;
                    const offset = -cumulative * circumference;
                    cumulative += frac;
                    return (
                      <circle
                        key={c.category}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth="16"
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={offset}
                      />
                    );
                  })}
                </svg>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {data.categoryBreakdown.map((c, i) => (
                    <div key={c.category} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 min-w-0 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="truncate text-slate-700 font-medium">{c.label}</span>
                      </span>
                      <span className="font-black text-slate-900 shrink-0">{c.qty} шт</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <ConsumptionWidget shopIdsKey={shopIdsKey} />

          {/* Top products */}
          {data.topProducts.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Топ-5 блюд (шт)</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {data.topProducts.map((p, i) => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate">{p.name}</span>
                    </span>
                    <span className="text-xs font-black text-slate-900 shrink-0">{p.qty} шт</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last 7 days: submission time + who */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Последние 7 дней — во сколько подали
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="text-[11px] text-left w-full">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px]">
                  <tr>
                    <th className="py-2 pl-4 pr-2 sticky left-0 bg-slate-50">Точка</th>
                    {data.last7Days.dates.map((d) => (
                      <th key={d} className="py-2 px-2 text-center whitespace-nowrap">
                        {formatDateShort(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.last7Days.shops.map((s) => (
                    <tr key={s.shopId}>
                      <td className="py-2 pl-4 pr-2 font-bold text-slate-900 sticky left-0 bg-white whitespace-nowrap">
                        {s.shopName}
                      </td>
                      {data.last7Days.dates.map((d) => {
                        const cell = s.days[d];
                        const isSelected = selectedCell?.shopId === s.shopId && selectedCell?.date === d;
                        return (
                          <td key={d} className="p-0.5 text-center whitespace-nowrap">
                            <button
                              disabled={!cell}
                              onClick={() => setSelectedCell(cell ? { shopId: s.shopId, date: d } : null)}
                              className={`w-full px-1.5 py-1 rounded-md font-bold ${
                                !cell
                                  ? 'text-slate-300'
                                  : isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {cell ? cell.time : '—'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedCell ? (
              (() => {
                const shop = data.last7Days.shops.find((s) => s.shopId === selectedCell.shopId);
                const cell = shop?.days[selectedCell.date];
                if (!shop || !cell) return null;
                return (
                  <p className="px-4 py-2.5 text-xs bg-indigo-50 border-t border-indigo-100 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>
                      <b>{shop.shopName}</b> · {formatDateShort(selectedCell.date)} в {cell.time} —{' '}
                      {cell.managerName || 'менеджер не указан'}
                    </span>
                  </p>
                );
              })()
            ) : (
              <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100 flex items-center gap-1">
                <Users className="w-3 h-3" /> нажмите на время — увидите, кто подал заявку
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
