import React, { useEffect, useState } from 'react';
import { X, History, Clock, UserRound, ArrowLeft, PackageSearch, Loader2 } from 'lucide-react';
import { CoffeeShop, Product, OrderHistoryEntry } from '../types';

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: CoffeeShop;
  products: Product[];
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: iso, time: '' };
  return {
    date: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  };
};

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({ isOpen, onClose, shop, products }) => {
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<OrderHistoryEntry | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedEntry(null);
    setIsLoading(true);
    fetch(`/api/orders/${shop.id}/history`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history || []))
      .catch((e) => console.error('Failed to load order history:', e))
      .finally(() => setIsLoading(false));
  }, [isOpen, shop.id]);

  if (!isOpen) return null;

  const cleanShopName = shop.name.replace(`Кофейня №${shop.id} — `, '');

  const getEntrySummary = (entry: OrderHistoryEntry) => {
    let pcs = 0;
    let sum = 0;
    Object.entries(entry.items || {}).forEach(([pId, qtyVal]) => {
      const qty = Number(qtyVal) || 0;
      const p = products.find((prod) => prod.id === pId);
      if (p && qty > 0) {
        pcs += qty;
        sum += qty * p.price;
      }
    });
    return { pcs, sum };
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-indigo-800">
          <div className="flex items-center space-x-3 min-w-0">
            {selectedEntry ? (
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 -ml-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                title="Назад к списку"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="p-2 bg-indigo-600/80 rounded-xl border border-indigo-400/30 text-amber-300 flex-shrink-0">
                <History className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                {selectedEntry ? 'Состав заявки' : 'История заявок'}
              </h3>
              <p className="text-[11px] text-indigo-200 truncate">
                Точка №{shop.id} — {cleanShopName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer flex-shrink-0"
            title="Закрыть окно"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs font-semibold">Загрузка...</span>
            </div>
          ) : selectedEntry ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-2">
                <div className="flex items-center space-x-2 text-xs text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold">
                    {formatDateTime(selectedEntry.submittedAt).date} в {formatDateTime(selectedEntry.submittedAt).time}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-700">
                  <UserRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold truncate max-w-[120px]">{selectedEntry.managerName || '—'}</span>
                </div>
              </div>

              {Object.entries(selectedEntry.items || {})
                .filter(([, qty]) => Number(qty) > 0)
                .map(([pId, qtyVal]) => {
                  const p = products.find((prod) => prod.id === pId);
                  const qty = Number(qtyVal) || 0;
                  return (
                    <div
                      key={pId}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <span className="font-semibold text-slate-800 truncate pr-2">{p?.name || pId}</span>
                      <span className="font-black text-slate-900 flex-shrink-0">{qty} шт</span>
                    </div>
                  );
                })}

              {(() => {
                const { pcs, sum } = getEntrySummary(selectedEntry);
                return (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold mt-3">
                    <span>Итого: {pcs} шт</span>
                    <span>{sum.toLocaleString('ru-RU')} ₸</span>
                  </div>
                );
              })()}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <PackageSearch className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Заявок пока не было</p>
              <p className="text-xs text-slate-400 mt-1">Здесь появится история после первой отправленной заявки</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => {
                const { date, time } = formatDateTime(entry.submittedAt);
                const { pcs, sum } = getEntrySummary(entry);
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300 transition-all shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs">
                          {date} · {time}
                        </div>
                        <div className="flex items-center space-x-1 text-[11px] text-slate-500 truncate">
                          <UserRound className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{entry.managerName || '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-black text-slate-900 text-xs">{pcs} шт</div>
                      <div className="text-[11px] text-indigo-700 font-bold">{sum.toLocaleString('ru-RU')} ₸</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
