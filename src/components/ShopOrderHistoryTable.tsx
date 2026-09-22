import React, { useEffect, useState } from 'react';
import { X, Clock, UserRound } from 'lucide-react';
import { OrderHistoryEntry, Product } from '../types';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

interface ShopOrderHistoryTableProps {
  shopId: number;
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

// Real submitted-order history for one shop (GET /api/orders/:shopId/history) — replaces the old
// buildSalesHistory() generator, which fabricated 4 "Вчера/2 дня назад/..." rows from
// shop.historicalAvg instead of showing anything a shop actually submitted.
export const ShopOrderHistoryTable: React.FC<ShopOrderHistoryTableProps> = ({ shopId, products }) => {
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<OrderHistoryEntry | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setSelectedEntry(null);
    fetch(`/api/orders/${shopId}/history`)
      .then((res) => res.json())
      .then((data) => setHistory(data.history || []))
      .catch((e) => console.error('Failed to load order history:', e))
      .finally(() => setIsLoading(false));
  }, [shopId]);

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

  useTelegramBackButton(!!selectedEntry, () => setSelectedEntry(null));

  if (isLoading) {
    return <p className="text-xs text-slate-400 italic px-3 py-4 text-center">Загрузка...</p>;
  }

  if (history.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic px-3 py-4 text-center">
        Заявок пока не было — здесь появится история после первой отправленной заявки.
      </p>
    );
  }

  return (
    <>
      <table className="w-full text-xs text-left">
        <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
          <tr>
            <th className="py-2 px-3">Дата</th>
            <th className="py-2 px-3">Время заказа</th>
            <th className="py-2 px-3">Менеджер</th>
            <th className="py-2 px-3 text-center">Позиций</th>
            <th className="py-2 px-3 text-right">Сумма</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {history.map((entry) => {
            const { date, time } = formatDateTime(entry.submittedAt);
            const { pcs, sum } = getEntrySummary(entry);
            return (
              <tr
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="hover:bg-indigo-50 cursor-pointer transition-colors"
              >
                <td className="py-2 px-3 font-bold text-slate-900">{date}</td>
                <td className="py-2 px-3 text-slate-600">{time}</td>
                <td className="py-2 px-3 text-slate-600">{entry.managerName || '—'}</td>
                <td className="py-2 px-3 text-center text-slate-700">{pcs} шт</td>
                <td className="py-2 px-3 text-right font-bold text-indigo-900">{sum.toLocaleString('ru-RU')} ₸</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedEntry && (
        <div
          className="fixed inset-0 z-[70] overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-indigo-800">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white truncate">Состав заявки</h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                title="Закрыть окно"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
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
          </div>
        </div>
      )}
    </>
  );
};
