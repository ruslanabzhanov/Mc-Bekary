import React, { useEffect, useState } from 'react';
import { OrderHistoryEntry, Product } from '../types';

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

  useEffect(() => {
    setIsLoading(true);
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
            <tr key={entry.id} className="hover:bg-slate-50">
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
  );
};
