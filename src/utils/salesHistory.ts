import { CoffeeShop, ShopOrder, Product } from '../types';

export interface SalesHistoryEntry {
  date: string;
  time: string;
  itemsCount: number;
  totalSum: number;
  status: string;
}

export const buildSalesHistory = (
  shop: CoffeeShop,
  products: Product[],
  currentOrder: ShopOrder | undefined
): SalesHistoryEntry[] => {
  const entries: SalesHistoryEntry[] = [];

  if (currentOrder && currentOrder.status !== 'draft') {
    let itemsCount = 0;
    let totalSum = 0;
    Object.entries(currentOrder.items).forEach(([pid, qty]) => {
      const p = products.find((pp) => pp.id === pid);
      itemsCount += qty;
      totalSum += (p?.price || 0) * qty;
    });
    entries.push({
      date: 'Сегодня',
      time: currentOrder.submittedAt || '—',
      itemsCount,
      totalSum,
      status: currentOrder.status === 'accepted' ? 'Принято' : 'Отправлено'
    });
  }

  const dayLabels = ['Вчера', '2 дня назад', '3 дня назад', '4 дня назад'];
  dayLabels.forEach((label, i) => {
    const mult = 0.75 + (((shop.id + i) * 13) % 50) / 100;
    let itemsCount = 0;
    let totalSum = 0;
    products.forEach((p) => {
      const avg = shop.historicalAvg[p.id] || 8;
      const qty = Math.max(1, Math.round(avg * mult));
      itemsCount += qty;
      totalSum += qty * p.price;
    });
    const minute = (shop.id * 7 + i * 11) % 50;
    entries.push({
      date: label,
      time: `09:${String(10 + minute).padStart(2, '0')}`,
      itemsCount,
      totalSum,
      status: 'Принято'
    });
  });

  return entries;
};
