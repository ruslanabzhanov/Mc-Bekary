import React from 'react';
import { TrendingUp, TrendingDown, Clock, Wallet, CalendarDays, Trophy, Layers } from 'lucide-react';

// Разбор заявок внутри «Аналитики»: кто и что заказывает, что растёт и падает, кто опаздывает.
// Всё считается из заявок точек (это спрос, а не продажи: остатков на точках в приложении нет).

export interface InsightProduct {
  id: string;
  name: string;
  qty: number;
  prevQty: number;
  sum: number;
  prevSum: number;
}
export interface InsightShop {
  shopId: number;
  name: string;
  qty: number;
  sum: number;
  prevQty: number;
  prevSum: number;
  submissions: number;
  onTimePct: number | null;
}
export interface Insights {
  products: InsightProduct[];
  shopRanking: InsightShop[];
  redDaysByShop: Record<number, number>;
  timeliness: { deadline: string; submissions: number; late: number; onTimePct: number | null; avgTime: string | null };
  dowAvg: { qty: number; sum: number; days: number }[];
  forecast: { date: string; qty: number; qtyMin: number; qtyMax: number; sum: number; samples: number } | null;
  heat: { dates: string[]; shops: { shopId: number; name: string; cells: { date: string; status: string; time: string | null }[] }[] };
  labor: { month: string; perPiece: number; payroll: number; qty: number } | null;
}

export type AnalyticsVariant = 'prod' | 'area' | 'shop';
type Metric = 'qty' | 'sum';

interface Props {
  insights: Insights;
  metric: Metric;
  variant: AnalyticsVariant;
  compareLabel: string;
}

const num = (n: number) => Math.round(n).toLocaleString('ru-RU');
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const dayMonth = (iso: string) => `${Number(iso.slice(8))}.${iso.slice(5, 7)}`;

const Card: React.FC<{ title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; id?: string }> = ({ title, sub, right, children, id }) => (
  <div id={id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</h3>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const Pill: React.FC<{ tone: 'ok' | 'warn' | 'crit' | 'gray'; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
      tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : tone === 'crit' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'
    }`}
  >
    {children}
  </span>
);

export const AnalyticsInsights: React.FC<Props> = ({ insights, metric, variant, compareLabel }) => {
  const isQty = metric === 'qty';
  const unit = isQty ? 'шт' : '₸';
  const pick = (o: { qty: number; sum: number }) => (isQty ? o.qty : o.sum);
  const pickPrev = (o: { prevQty: number; prevSum: number }) => (isQty ? o.prevQty : o.prevSum);
  const pctOf = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  const { timeliness: tl, forecast, labor } = insights;
  const showShops = variant !== 'shop' && insights.shopRanking.length > 1;

  // --- что выросло и упало: считаем только заметные позиции, чтобы мелочь не шумела ---
  const movers = insights.products
    .filter((p) => Math.max(p.qty, p.prevQty) >= 20 && p.prevQty > 0)
    .map((p) => ({ ...p, pct: pctOf(pick(p), pickPrev(p)) as number }));
  const up = movers.filter((p) => p.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 4);
  const down = movers.filter((p) => p.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 4);

  // --- точки ---
  const ranked = insights.shopRanking.filter((s) => s.submissions > 0).sort((a, b) => pick(b) - pick(a));
  const topShops = ranked.slice(0, 5);
  const bottomShops = ranked.length > 8 ? ranked.slice(-3).reverse() : [];
  const maxShop = Math.max(1, ...topShops.map((s) => pick(s)));

  // --- доля товаров ---
  const byShare = insights.products.filter((p) => pick(p) > 0).sort((a, b) => pick(b) - pick(a));
  const totalShare = byShare.reduce((n, p) => n + pick(p), 0);
  let acc = 0;
  let coreCount = 0;
  for (const p of byShare) {
    if (acc / (totalShare || 1) >= 0.9) break;
    acc += pick(p);
    coreCount += 1;
  }
  const tailCount = Math.max(0, byShare.length - coreCount);
  const top5 = byShare.slice(0, 5);

  const dowMax = Math.max(1, ...insights.dowAvg.map((d) => pick(d)));
  const dowTopIdx = insights.dowAvg.reduce((bi, d, i, arr) => (pick(d) > pick(arr[bi]) ? i : bi), 0);

  return (
    <>
      {/* Вовремя ли подают */}
      {tl.submissions > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Подают вовремя</span>
            </div>
            <p className="text-xl font-black text-slate-900 tabular-nums leading-tight">{tl.onTimePct}%</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {tl.late > 0 ? `${tl.late} из ${tl.submissions} позже ${tl.deadline}` : `все ${tl.submissions} до ${tl.deadline}`}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Среднее время подачи</span>
            </div>
            <p className="text-xl font-black text-slate-900 tabular-nums leading-tight">{tl.avgTime}</p>
            <p className="text-[11px] text-slate-400 mt-1">дедлайн {tl.deadline}</p>
          </div>
        </div>
      )}

      {/* Прогноз на завтра */}
      {forecast && variant !== 'shop' && (
        <Card
          id="analytics-forecast"
          title="Завтра ожидаем"
          sub={`по ${forecast.samples} последним таким же дням недели`}
          right={<Pill tone="gray">{dayMonth(forecast.date)}</Pill>}
        >
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ≈ {isQty ? `${num(forecast.qty)} шт` : `${num(forecast.sum)} ₸`}
          </p>
          {isQty && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              обычно от {num(forecast.qtyMin)} до {num(forecast.qtyMax)} шт
            </p>
          )}
        </Card>
      )}

      {/* Что выросло / упало */}
      {(up.length > 0 || down.length > 0) && (
        <>
          <Card title="Что выросло" sub={`позиции, которых заказывают больше (${compareLabel})`} right={<TrendingUp className="w-4 h-4 text-emerald-600" />}>
            <div className="divide-y divide-slate-100">
              {up.length === 0 && <p className="text-xs text-slate-400 py-2">Заметно выросших позиций нет.</p>}
              {up.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {num(pick(p))} {unit}, было {num(pickPrev(p))}
                    </p>
                  </div>
                  <Pill tone="ok">▲ +{p.pct}%</Pill>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Что упало" sub={`позиции, которых заказывают меньше (${compareLabel})`} right={<TrendingDown className="w-4 h-4 text-rose-600" />}>
            <div className="divide-y divide-slate-100">
              {down.length === 0 && <p className="text-xs text-slate-400 py-2">Заметно упавших позиций нет.</p>}
              {down.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {num(pick(p))} {unit}, было {num(pickPrev(p))}
                    </p>
                  </div>
                  <Pill tone="crit">▼ {Math.abs(p.pct)}%</Pill>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Это заказы точек, а не продажи: они показывают спрос, но не то, сколько осталось на полке.</p>
          </Card>
        </>
      )}

      {/* Топ точек */}
      {showShops && topShops.length > 0 && (
        <Card id="analytics-top-shops" title="Топ точек по заказам" sub="кто заказывает больше всего" right={<Trophy className="w-4 h-4 text-amber-500" />}>
          <div className="space-y-2.5 mt-1">
            {topShops.map((s) => {
              const d = pctOf(pick(s), pickPrev(s));
              return (
                <div key={s.shopId} className="grid grid-cols-[88px_1fr_96px] items-center gap-2 text-[11px] font-bold">
                  <span className="truncate text-slate-700">{s.name}</span>
                  <span className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(6, Math.round((pick(s) / maxShop) * 100))}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-slate-900">
                    {num(pick(s))}{' '}
                    {d != null && <span className={d < 0 ? 'text-rose-600' : 'text-slate-400'}>{d > 0 ? '▲' : d < 0 ? '▼' : ''}{d !== 0 ? Math.abs(d) + '%' : ''}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          {bottomShops.length > 0 && (
            <>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-4 mb-2">Меньше всех заказывают</p>
              <div className="space-y-2.5">
                {bottomShops.map((s) => {
                  const d = pctOf(pick(s), pickPrev(s));
                  return (
                    <div key={s.shopId} className="grid grid-cols-[88px_1fr_96px] items-center gap-2 text-[11px] font-bold">
                      <span className="truncate text-slate-700">{s.name}</span>
                      <span className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.max(6, Math.round((pick(s) / maxShop) * 100))}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-slate-900">
                        {num(pick(s))}{' '}
                        {d != null && <span className={d < 0 ? 'text-rose-600' : 'text-slate-400'}>{d > 0 ? '▲' : d < 0 ? '▼' : ''}{d !== 0 ? Math.abs(d) + '%' : ''}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Сравнение точек участка */}
      {variant === 'area' && ranked.length > 0 && (
        <Card id="analytics-compare" title="Сравнение точек" sub={`за период; динамика ${compareLabel}`}>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="text-slate-400 text-[10px] font-bold uppercase">
                  <th className="text-left py-1.5 px-1">Точка</th>
                  <th className="text-right px-1">{isQty ? 'Шт' : '₸'}</th>
                  <th className="text-right px-1">Вовремя</th>
                  <th className="text-right px-1">Не как обычно</th>
                  <th className="text-right px-1">Динамика</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranked.map((s) => {
                  const d = pctOf(pick(s), pickPrev(s));
                  const ot = s.onTimePct ?? 0;
                  const red = insights.redDaysByShop[s.shopId] || 0;
                  return (
                    <tr key={s.shopId}>
                      <td className="py-2 px-1 font-bold text-slate-900 whitespace-nowrap">{s.name}</td>
                      <td className="text-right px-1 font-bold">{num(pick(s))}</td>
                      <td className="text-right px-1"><Pill tone={ot >= 90 ? 'ok' : ot >= 75 ? 'warn' : 'crit'}>{ot}%</Pill></td>
                      <td className="text-right px-1">{red > 0 ? <b className="text-rose-600">{red} дн.</b> : <span className="text-slate-300">0</span>}</td>
                      <td className="text-right px-1">
                        {d == null ? <span className="text-slate-300">—</span> : <b className={d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-600' : 'text-slate-400'}>{d > 0 ? '▲' : d < 0 ? '▼' : ''} {Math.abs(d)}%</b>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">«Не как обычно»: дни из последних двух недель, когда заявка точки заметно отличалась от её обычной.</p>
        </Card>
      )}

      {/* Как шли последние две недели */}
      {variant !== 'prod' && insights.heat.shops.length > 0 && (
        <Card id="analytics-heat" title="Как идут точки" sub="последние 14 дней: каждая клетка это день">
          <div className="space-y-1 mt-1">
            <div className="grid items-center gap-[3px]" style={{ gridTemplateColumns: `84px repeat(${insights.heat.dates.length}, minmax(0,1fr))` }}>
              <span />
              {insights.heat.dates.map((d) => (
                <span key={d} className="text-[8px] text-slate-400 font-bold text-center">{Number(d.slice(8))}</span>
              ))}
            </div>
            {insights.heat.shops.map((s) => (
              <div key={s.shopId} className="grid items-center gap-[3px]" style={{ gridTemplateColumns: `84px repeat(${s.cells.length}, minmax(0,1fr))` }}>
                <span className="text-[10px] font-bold text-slate-700 truncate pr-1">{s.name}</span>
                {s.cells.map((c) => (
                  <span
                    key={c.date}
                    title={`${dayMonth(c.date)}${c.time ? ` · подана в ${c.time}` : ' · не подана'}`}
                    className={`aspect-square rounded-[4px] ${
                      c.status === 'ok' ? 'bg-emerald-500' : c.status === 'w' ? 'bg-amber-400' : c.status === 'c' ? 'bg-rose-500' : c.status === 'late' ? 'bg-indigo-300' : 'border border-dashed border-slate-300'
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] font-bold text-slate-500">
            <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-emerald-500 align-[-1px] mr-1" />вовремя</span>
            <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-amber-400 align-[-1px] mr-1" />немного не как обычно</span>
            <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-rose-500 align-[-1px] mr-1" />сильно</span>
            <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-indigo-300 align-[-1px] mr-1" />позже дедлайна</span>
            <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] border border-dashed border-slate-300 align-[-1px] mr-1" />не подана</span>
          </div>
        </Card>
      )}

      {/* Топ товаров и «хвост» */}
      {top5.length > 0 && variant !== 'shop' && (
        <Card id="analytics-product-share" title="Топ товаров" sub="доля в заказах за период" right={<Layers className="w-4 h-4 text-slate-400" />}>
          <div className="space-y-2.5 mt-1">
            {top5.map((p) => {
              const share = (pick(p) / (totalShare || 1)) * 100;
              return (
                <div key={p.id} className="grid grid-cols-[1fr_92px_44px] items-center gap-2 text-[11px] font-bold">
                  <span className="truncate text-slate-700">{p.name}</span>
                  <span className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, Math.round(share * 4))}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-slate-900">{share.toFixed(1).replace('.', ',')}%</span>
                </div>
              );
            })}
          </div>
          {tailCount > 0 && (
            <p className="text-[11px] text-slate-500 mt-3">
              Первые <b className="text-slate-800">{coreCount}</b> позиций дают 90% заказов, остальные <b className="text-slate-800">{tailCount}</b> вместе заказывают только 10%: можно проверить, нужны ли они все.
            </p>
          )}
        </Card>
      )}

      {/* По дням недели */}
      {insights.dowAvg.some((d) => d.days > 0) && variant !== 'prod' && (
        <Card title="По дням недели" sub="какая заявка обычно в этот день (последние 4 недели)" right={<CalendarDays className="w-4 h-4 text-slate-400" />}>
          <div className="flex items-end gap-2 h-24 mt-2">
            {insights.dowAvg.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                <span className="text-[9px] font-bold text-slate-500 tabular-nums">{pick(d) ? (pick(d) >= 1000 ? `${Math.round(pick(d) / 100) / 10}k`.replace('.', ',') : pick(d)) : ''}</span>
                <span
                  className={`w-full rounded-t-lg ${i === dowTopIdx ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                  style={{ height: `${Math.max(4, Math.round((pick(d) / dowMax) * 100) * 0.62)}px` }}
                />
                <span className="text-[10px] font-bold text-slate-400">{WD[i]}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Зарплата цеха на штуку */}
      {labor && labor.qty > 0 && (
        <Card id="analytics-labor" title="Зарплата цеха на штуку" sub="начислено по табелю за месяц, делённое на заказанные штуки" right={<Wallet className="w-4 h-4 text-slate-400" />}>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{num(labor.perPiece)} ₸</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {num(labor.payroll)} ₸ на {num(labor.qty)} шт, с 1 числа
          </p>
        </Card>
      )}
    </>
  );
};
