import React, { useEffect, useState } from 'react';
import { X, History, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { CoffeeShop, Product, OrderHistoryEntry } from '../types';

interface OrderHistoryDaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  shops: CoffeeShop[];
  products: Product[];
}

interface DaySummary {
  date: string;
  shops: number;
  pcs: number;
  sum: number;
  accepted: number;
  rejected: number;
}

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;

const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
};

const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00+05:00`).getDay()];

const dayLabel = (iso: string) => {
  const today = almatyToday();
  if (iso === today) return 'Сегодня';
  const y = new Date(`${today}T12:00:00+05:00`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (iso === y.toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' })) return 'Вчера';
  return null;
};

const STATUS_LOOK: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  accepted: { label: 'Принята', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  rejected: { label: 'Отклонена', cls: 'bg-rose-50 text-rose-800 border-rose-200', Icon: XCircle },
  submitted: { label: 'Без решения', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
};

export const OrderHistoryDaysModal: React.FC<OrderHistoryDaysModalProps> = ({
  isOpen,
  onClose,
  shops,
  products,
}) => {
  const [days, setDays] = useState<DaySummary[]>([]);
  const [isLoadingDays, setIsLoadingDays] = useState(false);

  const [openDate, setOpenDate] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<OrderHistoryEntry[]>([]);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [openShopId, setOpenShopId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingDays(true);
    fetch('/api/order-history/days?limit=60')
      .then((r) => r.json())
      .then((data) => setDays(data.days || []))
      .catch((e) => console.error('Failed to load order history days:', e))
      .finally(() => setIsLoadingDays(false));
  }, [isOpen]);

  useEffect(() => {
    if (!openDate) return;
    setIsLoadingDay(true);
    setOpenShopId(null);
    fetch(`/api/order-history-by-date?date=${openDate}`)
      .then((r) => r.json())
      .then((data) => setDayEntries(data.history || []))
      .catch((e) => console.error('Failed to load a day of history:', e))
      .finally(() => setIsLoadingDay(false));
  }, [openDate]);

  if (!isOpen) return null;

  const shopName = (id: number) => {
    const s = shops.find((x) => x.id === id);
    return s ? s.district.trim() || s.address : `Точка №${id}`;
  };

  const entrySummary = (entry: OrderHistoryEntry) => {
    let pcs = 0;
    let sum = 0;
    Object.entries(entry.items || {}).forEach(([pid, q]) => {
      const qty = Number(q) || 0;
      const p = products.find((x) => x.id === pid);
      if (p && qty > 0) {
        pcs += qty;
        sum += qty * p.price;
      }
    });
    return { pcs, sum };
  };

  const openEntry = dayEntries.find((e) => e.shopId === openShopId) || null;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2 min-w-0">
          <History className="w-5 h-5 text-indigo-600 shrink-0" />
          <span className="truncate">
            {openDate ? formatDay(openDate) : 'История заявок'}
          </span>
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {openDate && (
            <button
              onClick={() => (openShopId ? setOpenShopId(null) : setOpenDate(null))}
              className="min-h-[44px] px-3 rounded-lg text-xs font-bold uppercase tracking-wider text-indigo-700 hover:bg-indigo-50 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Назад
            </button>
          )}
          <button
            onClick={onClose}
            className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {/* ---- Level 1: the days ---- */}
        {!openDate && (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Каждый день закрывается в полночь и попадает сюда. Нажмите на день, чтобы увидеть,
              что заказывали точки.
            </p>

            {isLoadingDays ? (
              <p className="text-center text-sm text-slate-400 py-10">Загружаем…</p>
            ) : days.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-300 rounded-2xl">
                <History className="w-8 h-8 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-700">Заявок ещё не было</p>
                <p className="text-xs text-slate-500 mt-1">
                  Как только точки начнут подавать заявки, здесь появятся дни.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {days.map((d) => {
                  const label = dayLabel(d.date);
                  return (
                    <button
                      key={d.date}
                      onClick={() => setOpenDate(d.date)}
                      className="w-full flex items-center gap-3 px-4 py-3 min-h-[64px] text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                          {formatDay(d.date)}
                          {label && (
                            <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                              {label}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {weekdayOf(d.date)} · {d.shops} {d.shops === 1 ? 'заявка' : d.shops < 5 ? 'заявки' : 'заявок'}
                          {d.accepted > 0 && ` · принято ${d.accepted}`}
                          {d.rejected > 0 && ` · отклонено ${d.rejected}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">
                          {formatMoney(d.sum)}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">{d.pcs} шт</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ---- Level 2: the shops that ordered that day ---- */}
        {openDate && !openEntry && (
          <>
            {isLoadingDay ? (
              <p className="text-center text-sm text-slate-400 py-10">Загружаем…</p>
            ) : dayEntries.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">В этот день заявок не было</p>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                {dayEntries
                  .slice()
                  .sort((a, b) => shopName(a.shopId).localeCompare(shopName(b.shopId), 'ru'))
                  .map((entry) => {
                    const { pcs, sum } = entrySummary(entry);
                    const look = STATUS_LOOK[entry.status] || STATUS_LOOK.submitted;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setOpenShopId(entry.shopId)}
                        className="w-full flex items-center gap-3 px-4 py-3 min-h-[64px] text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 leading-tight">
                            {shopName(entry.shopId)}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {entry.managerName || 'Менеджер не указан'}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${look.cls}`}
                          >
                            <look.Icon className="w-3 h-3" />
                            {look.label}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">
                            {formatMoney(sum)}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">{pcs} шт</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                      </button>
                    );
                  })}
              </div>
            )}
          </>
        )}

        {/* ---- Level 3: what that shop actually ordered ---- */}
        {openEntry && (
          <>
            <div className="mb-3">
              <h3 className="text-base font-extrabold text-slate-900">{shopName(openEntry.shopId)}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {openEntry.managerName || 'Менеджер не указан'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
              {Object.entries(openEntry.items || {})
                .map(([pid, q]) => ({ product: products.find((p) => p.id === pid), qty: Number(q) || 0 }))
                .filter((l) => l.product && l.qty > 0)
                .sort((a, b) => (a.product!.name || '').localeCompare(b.product!.name || '', 'ru'))
                .map(({ product, qty }) => (
                  <div key={product!.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="shrink-0 text-lg">{product!.imageEmoji}</span>
                    <p className="min-w-0 flex-1 text-sm font-bold text-slate-900 leading-tight">
                      {product!.name}
                    </p>
                    <p className="shrink-0 text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {qty} {product!.unit}
                    </p>
                    <p className="shrink-0 w-24 text-right text-sm font-black text-indigo-900 tabular-nums">
                      {formatMoney(qty * product!.price)}
                    </p>
                  </div>
                ))}

              <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Итого</span>
                <span className="text-base font-black text-slate-900 tabular-nums">
                  {formatMoney(entrySummary(openEntry).sum)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
