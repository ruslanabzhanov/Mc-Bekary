import React, { useEffect, useState } from 'react';
import { X, Loader2, Clock, UserRound } from 'lucide-react';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

// «Как идут заявки»: каждая клетка это день точки. Цвет показывает, насколько заявка отличалась
// от обычной заявки этой точки (среднее за 3 недели до этого дня): зелёная — как обычно, жёлтая —
// заметно отличаются несколько позиций, красная — есть позиция с сильным отличием. Нажатие на
// клетку открывает саму заявку того дня с подсветкой позиций.

interface HeatCell {
  date: string;
  status: 'ok' | 'yellow' | 'red' | 'miss' | 'nodata';
  time: string | null;
  red: number;
  yellow: number;
}
interface HeatData {
  dates: string[];
  shops: { shopId: number; name: string; cells: HeatCell[] }[];
}
interface DayItem {
  id: string;
  name: string;
  qty: number;
  avg: number | null;
  diff: number;
  level: 'red' | 'yellow' | 'ok' | 'new' | 'none';
}
interface DayData {
  shopName: string;
  date: string;
  submitted: boolean;
  time?: string;
  managerName?: string;
  status?: string;
  red?: number;
  yellow?: number;
  enoughHistory?: boolean;
  totalQty?: number;
  usualQty?: number;
  historyDays?: number;
  items?: DayItem[];
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const longDate = (iso: string) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const pcs = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

const cellClass = (s: HeatCell['status']) =>
  s === 'ok'
    ? 'bg-emerald-500'
    : s === 'yellow'
    ? 'bg-amber-400'
    : s === 'red'
    ? 'bg-rose-500'
    : s === 'nodata'
    ? 'bg-slate-200'
    : 'border border-dashed border-slate-300';

export const DeviationHeat: React.FC<{ shopIds: number[]; from: string; to: string }> = ({ shopIds, from, to }) => {
  const [data, setData] = useState<HeatData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<{ shopId: number; date: string } | null>(null);
  const key = shopIds.join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analytics/heat?shopIds=${key}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.dates)) setData(d);
      })
      .catch((e) => console.error('Failed to load the order heat map:', e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key, from, to]);

  if (!key) return null;
  return (
    <div id="analytics-deviation-heat" className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Как идут заявки</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">цвет это отличие от обычной заявки точки; нажмите на день, увидите заявку</p>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {data && (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="inline-block min-w-full">
            <div className="flex items-center gap-[3px] mb-1">
              <span className="w-[92px] shrink-0 sticky left-0 bg-white" />
              {data.dates.map((d) => (
                <span key={d} className="w-[22px] shrink-0 text-center text-[8px] font-bold text-slate-400">
                  {Number(d.slice(8))}
                </span>
              ))}
            </div>
            {data.shops.map((s) => (
              <div key={s.shopId} className="flex items-center gap-[3px] mb-[3px]">
                <span className="w-[92px] shrink-0 sticky left-0 bg-white text-[10px] font-bold text-slate-700 truncate pr-1">{s.name}</span>
                {s.cells.map((c) => (
                  <button
                    key={c.date}
                    disabled={c.status === 'miss'}
                    onClick={() => setOpen({ shopId: s.shopId, date: c.date })}
                    title={`${longDate(c.date)}${c.time ? ` · подана в ${c.time}` : ' · не подана'}`}
                    aria-label={`${s.name}, ${longDate(c.date)}`}
                    className={`w-[22px] h-[22px] shrink-0 rounded-[5px] ${cellClass(c.status)} ${c.status === 'miss' ? '' : 'active:scale-90 transition-transform'}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] font-bold text-slate-500">
        <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-emerald-500 align-[-1px] mr-1" />как обычно</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-amber-400 align-[-1px] mr-1" />небольшое отклонение</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-rose-500 align-[-1px] mr-1" />сильное отклонение</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-slate-200 align-[-1px] mr-1" />мало истории</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-[3px] border border-dashed border-slate-300 align-[-1px] mr-1" />не подана</span>
      </div>

      {open && <DayOrderModal shopId={open.shopId} date={open.date} onClose={() => setOpen(null)} />}
    </div>
  );
};

const DayOrderModal: React.FC<{ shopId: number; date: string; onClose: () => void }> = ({ shopId, date, onClose }) => {
  const [d, setD] = useState<DayData | null>(null);
  const [error, setError] = useState('');
  useTelegramBackButton(true, onClose);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/day?shopId=${shopId}&date=${date}`)
      .then((r) => r.json())
      .then((x) => !cancelled && (x.error ? setError(x.error) : setD(x)))
      .catch(() => !cancelled && setError('Не удалось загрузить заявку.'));
    return () => {
      cancelled = true;
    };
  }, [shopId, date]);

  const statusText = d?.status === 'red' ? 'сильное отклонение' : d?.status === 'yellow' ? 'небольшое отклонение' : d?.status === 'ok' ? 'как обычно' : 'мало истории для сравнения';
  const statusTone = d?.status === 'red' ? 'bg-rose-50 text-rose-700' : d?.status === 'yellow' ? 'bg-amber-50 text-amber-700' : d?.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500';

  return (
    <div id="day-order-modal" className="fixed inset-0 z-[70] bg-slate-900/60 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900 truncate">{d?.shopName || 'Заявка'}</h3>
            <p className="text-[11px] text-slate-500">{longDate(date)}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 shrink-0 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400" aria-label="Закрыть">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {!d && !error && (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Загружаем…
            </div>
          )}
          {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
          {d && !d.submitted && <p className="text-sm text-slate-500 text-center py-6">В этот день заявка не подавалась.</p>}
          {d && d.submitted && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-600" /><b>{d.time}</b></span>
                <span className="flex items-center gap-1.5 min-w-0"><UserRound className="w-3.5 h-3.5 text-indigo-600 shrink-0" /><b className="truncate">{d.managerName || 'менеджер не указан'}</b></span>
              </div>
              <div className={`rounded-xl px-3 py-2.5 text-xs font-bold flex items-center justify-between gap-2 ${statusTone}`}>
                <span>{statusText}</span>
                {d.enoughHistory && <span className="tabular-nums">{d.red ? `${d.red} сильных` : ''}{d.red && d.yellow ? ' · ' : ''}{d.yellow ? `${d.yellow} небольших` : ''}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Заявка в этот день</p>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{d.totalQty} <span className="text-xs text-slate-400">шт</span></p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Обычная заявка</p>
                  <p className="text-lg font-black text-slate-900 tabular-nums">{d.enoughHistory ? d.usualQty : '—'} <span className="text-xs text-slate-400">шт</span></p>
                  {d.enoughHistory && d.usualQty ? (
                    <p className={`text-[11px] font-bold ${(d.totalQty || 0) >= (d.usualQty || 0) ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(d.totalQty || 0) >= (d.usualQty || 0) ? '+' : '−'}{Math.abs(Math.round((((d.totalQty || 0) - (d.usualQty || 0)) / (d.usualQty || 1)) * 100))}% к обычной
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                <div className="grid grid-cols-[1fr_46px_52px_62px] gap-1 px-3 py-1.5 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                  <span>Позиция</span><span className="text-right">Подано</span><span className="text-right">Обычно</span><span className="text-right">Разница</span>
                </div>
                {(d.items || []).map((it) => (
                  <div
                    key={it.id}
                    className={`grid grid-cols-[1fr_46px_52px_62px] gap-1 items-center px-3 py-2 text-xs ${
                      it.level === 'red' ? 'bg-rose-50' : it.level === 'yellow' ? 'bg-amber-50' : ''
                    }`}
                  >
                    <span className="font-bold text-slate-900 truncate">{it.name}</span>
                    <span className="text-right font-black tabular-nums">{it.qty}</span>
                    <span className="text-right tabular-nums text-slate-500">{it.avg != null ? pcs(it.avg) : '—'}</span>
                    <span className={`text-right font-black tabular-nums ${it.level === 'red' ? 'text-rose-700' : it.level === 'yellow' ? 'text-amber-700' : it.level === 'new' ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {it.level === 'new' ? 'новая' : it.avg == null ? '' : `${it.diff > 0 ? '+' : it.diff < 0 ? '−' : ''}${pcs(Math.abs(it.diff))}`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                «Обычно» — среднее по заявкам этой точки за 3 недели до этого дня{d.historyDays ? ` (${d.historyDays} дн.)` : ''}. Красным отмечены сильные отличия, жёлтым небольшие. Позиции, которые точка обычно берёт, но в этот день не заказала, тоже показаны.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
