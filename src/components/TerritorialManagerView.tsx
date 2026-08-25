import React, { useState } from 'react';
import { CoffeeShop, ShopOrder, Product, StaffMember } from '../types';
import { buildSalesHistory } from '../utils/salesHistory';
import { Store, X, MapPin, User, ShieldCheck, Clock, Compass } from 'lucide-react';

interface TerritorialManagerViewProps {
  managerName: string;
  shops: CoffeeShop[];
  orders: Record<number, ShopOrder>;
  products: Product[];
  staff: StaffMember[];
}

export const TerritorialManagerView: React.FC<TerritorialManagerViewProps> = ({
  managerName,
  shops,
  orders,
  products,
  staff
}) => {
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const selectedShop = shops.find((s) => s.id === selectedShopId) || null;

  const getShopManagers = (shop: CoffeeShop) =>
    staff.filter((s) => s.role === 'shop_manager' && s.shopId === shop.id);

  const getShopManagersLabel = (shop: CoffeeShop) => {
    const managers = getShopManagers(shop);
    if (managers.length === 0) return shop.manager;
    if (managers.length === 1) return managers[0].name;
    return `${managers[0].name} +${managers.length - 1}`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Sub-header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
          <Compass className="w-6 h-6 text-indigo-600" />
          <span>Территориальный управляющий</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {managerName} · Точки под управлением: {shops.length}
        </p>
      </div>

      {/* Shops grid (read-only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shops.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
            За вами пока не закреплено ни одной точки.
          </div>
        ) : (
          shops.map((shop) => {
            const order = orders[shop.id];
            return (
              <button
                key={shop.id}
                onClick={() => setSelectedShopId(shop.id)}
                className="text-left bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-xl p-4 shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest flex items-center gap-1">
                    <Store className="w-3.5 h-3.5" />
                    Точка №{shop.id}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      order?.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : order?.status === 'submitted'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order?.status === 'accepted' ? 'Принято' : order?.status === 'submitted' ? 'Отправлено' : 'Черновик'}
                  </span>
                </div>
                <div className="font-bold text-slate-900 text-sm truncate">{shop.district}</div>
                <div className="text-[11px] text-slate-500 truncate">{shop.address}</div>
                <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  {getShopManagersLabel(shop)}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* SHOP DETAIL MODAL (read-only) */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xl space-y-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">
                  Точка №{selectedShop.id}
                </span>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {selectedShop.district}
                </h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {selectedShop.address}
                </p>
              </div>
              <button
                onClick={() => setSelectedShopId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1">
                  <User className="w-3 h-3" />
                  Менеджеры ({getShopManagers(selectedShop).length})
                </span>
                {getShopManagers(selectedShop).length === 0 ? (
                  <span className="font-bold text-slate-900 text-sm">{selectedShop.manager}</span>
                ) : (
                  <div className="space-y-0.5">
                    {getShopManagers(selectedShop).map((m) => (
                      <div key={m.id} className="font-bold text-slate-900 text-sm">
                        {m.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1 mb-1">
                  <ShieldCheck className="w-3 h-3" />
                  Территориальный управляющий
                </span>
                <span className="font-bold text-slate-900 text-sm">{managerName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>История продаж:</span>
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Дата</th>
                      <th className="py-2 px-3">Время заказа</th>
                      <th className="py-2 px-3 text-center">Позиций</th>
                      <th className="py-2 px-3 text-right">Сумма</th>
                      <th className="py-2 px-3 text-center">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {buildSalesHistory(selectedShop, products, orders[selectedShop.id]).map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900">{entry.date}</td>
                        <td className="py-2 px-3 text-slate-600">{entry.time}</td>
                        <td className="py-2 px-3 text-center text-slate-700">{entry.itemsCount} шт</td>
                        <td className="py-2 px-3 text-right font-bold text-indigo-900">
                          {entry.totalSum.toLocaleString('ru-RU')} ₸
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
