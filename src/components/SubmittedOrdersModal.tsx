import React, { useState } from 'react';
import { 
  X, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building2, 
  ShieldCheck, 
  Lock, 
  AlertCircle,
  FileCheck2,
  Filter
} from 'lucide-react';
import { CoffeeShop, Product, ShopOrder, OrderStatus, UserRole } from '../types';

interface SubmittedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  shops: CoffeeShop[];
  orders: Record<number, ShopOrder>;
  products: Product[];
  currentRole: UserRole;
  onUpdateOrderStatus: (shopId: number, status: OrderStatus) => void;
  onSendReminderSingle?: (shopId: number) => void;
}

export const SubmittedOrdersModal: React.FC<SubmittedOrdersModalProps> = ({
  isOpen,
  onClose,
  shops,
  orders,
  products,
  currentRole,
  onUpdateOrderStatus,
  onSendReminderSingle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'accepted' | 'rejected' | 'draft'>('all');

  if (!isOpen) return null;

  // Calculate stats
  let totalSubmitted = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalDraft = 0;

  shops.forEach((shop) => {
    const order = orders[shop.id];
    const status = order?.status || 'draft';
    if (status === 'accepted') totalAccepted++;
    else if (status === 'submitted') totalSubmitted++;
    else if (status === 'rejected') totalRejected++;
    else totalDraft++;
  });

  const totalSubmittedOrAccepted = totalSubmitted + totalAccepted;

  // Helper to compute order volume and cost
  const getOrderSummary = (order?: ShopOrder) => {
    if (!order || !order.items) return { pcs: 0, sum: 0 };
    let pcs = 0;
    let sum = 0;
    Object.entries(order.items).forEach(([pId, qtyVal]) => {
      const qty = Number(qtyVal) || 0;
      const p = products.find((prod) => prod.id === pId);
      if (p && qty > 0) {
        pcs += qty;
        sum += qty * p.price;
      }
    });
    return { pcs, sum };
  };

  // Filtered shops list
  const filteredShops = shops.filter((shop) => {
    const order = orders[shop.id];
    const status = order?.status || 'draft';

    // Status filter
    if (statusFilter === 'submitted' && status !== 'submitted') return false;
    if (statusFilter === 'accepted' && status !== 'accepted') return false;
    if (statusFilter === 'rejected' && status !== 'rejected') return false;
    if (statusFilter === 'draft' && status !== 'draft') return false;

    // Search term filter
    const term = searchTerm.toLowerCase();
    const matchName = shop.name.toLowerCase().includes(term);
    const matchManager = shop.manager.toLowerCase().includes(term);
    const matchId = `точка ${shop.id}`.includes(term) || `${shop.id}` === term;

    return matchName || matchManager || matchId;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-indigo-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/80 rounded-xl border border-indigo-400/30 text-amber-300">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
              Реестр заявок
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Закрыть окно"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ROLE AUTHORITY NOTICE BAR */}
        <div className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
          currentRole === 'admin' 
            ? 'bg-emerald-50 text-emerald-950 border-emerald-200' 
            : 'bg-amber-50 text-amber-950 border-amber-200'
        }`}>
          <div className="flex items-center space-x-2">
            {currentRole === 'admin' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            )}
            <span>
              {currentRole === 'admin' ? (
                <><strong>Режим Управляющего Производством:</strong> Вы можете принимать и отклонять заявки кофеен.</>
              ) : (
                <><strong>Режим просмотра (Менеджер):</strong> Статусы заявок видны всем, а принимать и отклонять заявки может только <strong>Управляющий Производством</strong>.</>
              )}
            </span>
          </div>

          <span className="hidden md:inline-block text-[11px] opacity-80">
            Обновлено: сегодня
          </span>
        </div>

        {/* STATS KPIs SUMMARY & FILTERS BAR */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
          {/* Quick status tabs (2 in a row grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`w-full flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                statusFilter === 'all'
                  ? 'bg-indigo-900 text-white border-indigo-950 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <span>📋 Все заявки ({shops.length})</span>
            </button>

            <button
              onClick={() => setStatusFilter('submitted')}
              className={`w-full flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                statusFilter === 'submitted'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="truncate">🟡 Ожидающие подтверждения ({totalSubmitted})</span>
            </button>

            <button
              onClick={() => setStatusFilter('accepted')}
              className={`w-full flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                statusFilter === 'accepted'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span className="truncate">🟢 Принятые ({totalAccepted})</span>
            </button>

            <button
              onClick={() => setStatusFilter('rejected')}
              className={`w-full flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                statusFilter === 'rejected'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-rose-50 text-rose-900 hover:bg-rose-100 border-rose-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
              <span className="truncate">🔴 Отклоненные ({totalRejected})</span>
            </button>

            <button
              onClick={() => setStatusFilter('draft')}
              className={`col-span-2 sm:col-span-1 w-full flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                statusFilter === 'draft'
                  ? 'bg-slate-700 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <span className="truncate">⚪ Не поданы ({totalDraft})</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по названию кофейни, номеру точки или имени менеджера..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Очистить
              </button>
            )}
          </div>
        </div>

        {/* CONTENT CONTAINER - MOBILE CARDS & DESKTOP TABLE */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {filteredShops.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Точки с таким фильтром не найдены</p>
              <button
                onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <>
              {/* MOBILE CARDS VIEW (Visible on mobile screens < sm) */}
              <div className="block sm:hidden space-y-3">
                {filteredShops.map((shop) => {
                  const order = orders[shop.id];
                  const status = order?.status || 'draft';
                  const { pcs, sum } = getOrderSummary(order);
                  const cleanShopName = shop.name.replace(`Кофейня №${shop.id} — `, '');

                  return (
                    <div 
                      key={`mobile-${shop.id}`}
                      className={`p-3.5 rounded-xl border transition-all shadow-2xs space-y-3 ${
                        status === 'accepted' ? 'bg-emerald-50/40 border-emerald-200' :
                        status === 'submitted' ? 'bg-amber-50/50 border-amber-200' :
                        status === 'rejected' ? 'bg-rose-50/40 border-rose-200' :
                        'bg-white border-slate-200'
                      }`}
                    >
                      {/* CARD HEADER: Point ID, Name, Status Badge */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-8 h-8 rounded-xl bg-indigo-900 text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                            №{shop.id}
                          </span>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm leading-tight">
                              {cleanShopName}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {shop.district}
                            </p>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex-shrink-0 flex items-center space-x-1.5">
                          {status === 'accepted' && (
                            <>
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Принятая</span>
                              </span>
                              {currentRole === 'admin' && (
                                <button
                                  onClick={() => onUpdateOrderStatus(shop.id, 'rejected')}
                                  className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                  title="Отклонить принятую заявку"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}

                          {status === 'submitted' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-amber-100 text-amber-950 border border-amber-300 animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Поданная</span>
                            </span>
                          )}

                          {status === 'rejected' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Отклоненная</span>
                            </span>
                          )}

                          {status === 'draft' && (
                            <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              <span>Не подана</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CARD DETAILS GRID */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Manager */}
                        <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Менеджер</span>
                          <span className="font-extrabold text-slate-800 text-xs block truncate">
                            {order?.managerName || shop.manager}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {status === 'draft' ? '—' : shop.phone}
                          </span>
                        </div>

                        {/* Submission Time */}
                        <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60">
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">Время подачи</span>
                          {status !== 'draft' ? (
                            <div className="flex items-center space-x-1 font-black text-slate-900 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="text-sm">{order?.submittedAt || '09:15'}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic block mt-0.5">Не подана</span>
                          )}
                        </div>

                        {/* Order Summary */}
                        <div className="col-span-2 bg-indigo-900/5 p-2 rounded-lg border border-indigo-200/50 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-600">Объем и сумма заявки:</span>
                          {pcs > 0 ? (
                            <div className="text-right">
                              <span className="font-black text-slate-900 text-xs mr-2">{pcs} шт</span>
                              <span className="font-black text-indigo-700 text-xs">{sum.toLocaleString('ru-RU')} ₸</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Заказ пуст</span>
                          )}
                        </div>
                      </div>

                      {/* MOBILE ACTIONS (Only for non-accepted orders) */}
                      {currentRole === 'admin' && status !== 'accepted' && (
                        <div className="pt-1">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => onUpdateOrderStatus(shop.id, 'accepted')}
                              className="py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all min-h-[44px] cursor-pointer bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Принять</span>
                            </button>

                            <button
                              onClick={() => onUpdateOrderStatus(shop.id, 'rejected')}
                              disabled={status === 'rejected'}
                              className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all min-h-[44px] cursor-pointer ${
                                status === 'rejected'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 cursor-default opacity-80'
                                  : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs'
                              }`}
                            >
                              <XCircle className="w-4 h-4" />
                              <span>{status === 'rejected' ? 'Отклонена' : 'Отклонить'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {currentRole !== 'admin' && (
                        <div className="text-center py-1 bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-500 border border-slate-200">
                          🔒 Принимать / отклонять может только Управляющий
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (Visible on sm and larger screens) */}
              <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <th className="py-3 px-4">Кофейня (Какая точка)</th>
                      <th className="py-3 px-3">Кто подал (Менеджер)</th>
                      <th className="py-3 px-3">Во сколько</th>
                      <th className="py-3 px-3">Заказ (Объем / Сумма)</th>
                      <th className="py-3 px-3">Статус заявки</th>
                      <th className="py-3 px-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredShops.map((shop) => {
                      const order = orders[shop.id];
                      const status = order?.status || 'draft';
                      const { pcs, sum } = getOrderSummary(order);
                      const cleanShopName = shop.name.replace(`Кофейня №${shop.id} — `, '');

                      return (
                        <tr 
                          key={`desktop-${shop.id}`} 
                          className={`hover:bg-slate-50/80 transition-colors ${
                            status === 'accepted' ? 'bg-emerald-50/30' :
                            status === 'submitted' ? 'bg-amber-50/30' :
                            status === 'rejected' ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          {/* Point Name & Number */}
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-900 font-black text-[11px] flex items-center justify-center flex-shrink-0">
                                {shop.id}
                              </span>
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs">
                                  {cleanShopName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {shop.district}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Manager Name */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800">
                              {order?.managerName || shop.manager}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {status === 'draft' ? '—' : shop.phone}
                            </div>
                          </td>

                          {/* Submission Time */}
                          <td className="py-3 px-3">
                            {status !== 'draft' ? (
                              <div className="flex items-center space-x-1 text-slate-900 font-bold">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{order?.submittedAt || '09:15'}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Не подана</span>
                            )}
                          </td>

                          {/* Order Volume & Sum */}
                          <td className="py-3 px-3">
                            {pcs > 0 ? (
                              <div>
                                <span className="font-black text-slate-900">{pcs} шт</span>
                                <span className="text-[10px] text-indigo-700 block font-bold">
                                  {sum.toLocaleString('ru-RU')} ₸
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Status Icon & Badge */}
                          <td className="py-3 px-3">
                            {status === 'accepted' && (
                              <div className="flex items-center space-x-1.5">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Принятая</span>
                                </span>
                                {currentRole === 'admin' && (
                                  <button
                                    onClick={() => onUpdateOrderStatus(shop.id, 'rejected')}
                                    className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                    title="Отклонить принятую заявку"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}

                            {status === 'submitted' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Поданная</span>
                              </span>
                            )}

                            {status === 'rejected' && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Отклоненная</span>
                              </span>
                            )}

                            {status === 'draft' && (
                              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-2 h-2 rounded-full bg-slate-400" />
                                <span>Не подана</span>
                              </span>
                            )}
                          </td>

                          {/* Manager Actions */}
                          <td className="py-3 px-4 text-right">
                            {currentRole === 'admin' ? (
                              status === 'accepted' ? (
                                <span className="text-emerald-700 font-extrabold text-xs">✓ Принята</span>
                              ) : (
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    onClick={() => onUpdateOrderStatus(shop.id, 'accepted')}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs hover:scale-105"
                                    title="Принять заявку этой точки"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Принять</span>
                                  </button>

                                  <button
                                    onClick={() => onUpdateOrderStatus(shop.id, 'rejected')}
                                    disabled={status === 'rejected'}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                                      status === 'rejected'
                                        ? 'bg-rose-100 text-rose-800 cursor-default opacity-80'
                                        : 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs hover:scale-105'
                                    }`}
                                    title="Отклонить заявку этой точки"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>{status === 'rejected' ? 'Отклонена' : 'Отклонить'}</span>
                                  </button>
                                </div>
                              )
                            ) : (
                              <div className="flex items-center justify-end">
                                <span 
                                  className="inline-flex items-center space-x-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200"
                                  title="Изменение статусов (Принять / Отклонить) доступно только Управляющему"
                                >
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  <span>Только Управляющий</span>
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER (MINIMIZED) */}
        <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px]">
          <div className="text-slate-500 font-bold truncate">
            Показано: <span className="text-slate-900">{filteredShops.length}</span> из <span className="text-slate-900">{shops.length}</span>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-all cursor-pointer text-xs flex-shrink-0"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
