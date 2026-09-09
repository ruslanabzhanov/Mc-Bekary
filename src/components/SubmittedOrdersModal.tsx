import React, { useState } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  AlertCircle,
  FileCheck2,
  ArrowLeft,
  PackageSearch,
  Trash2
} from 'lucide-react';
import { CoffeeShop, Product, ShopOrder, OrderStatus, UserRole, RolePermissions } from '../types';

interface SubmittedOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  shops: CoffeeShop[];
  orders: Record<number, ShopOrder>;
  products: Product[];
  currentRole: UserRole;
  permissions: RolePermissions;
  onUpdateOrderStatus: (shopId: number, status: OrderStatus) => void;
  onDeleteOrder: (shopId: number) => void;
  onSendReminderSingle?: (shopId: number) => void;
}

type StatusFilter = 'all' | 'submitted' | 'accepted' | 'rejected' | 'draft';

const STATUS_BADGE: Record<'accepted' | 'submitted' | 'rejected' | 'draft', { label: string; className: string }> = {
  accepted: { label: 'Принята', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  submitted: { label: 'Поданная', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  rejected: { label: 'Отклонена', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  draft: { label: 'Не подана', className: 'bg-slate-100 text-slate-600 border border-slate-200' }
};

export const SubmittedOrdersModal: React.FC<SubmittedOrdersModalProps> = ({
  isOpen,
  onClose,
  shops,
  orders,
  products,
  currentRole,
  permissions,
  onUpdateOrderStatus,
  onDeleteOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [detailShopId, setDetailShopId] = useState<number | null>(null);

  // Owner always may act; admin only if the Owner has granted this permission.
  const canManage = currentRole === 'owner' || (currentRole === 'admin' && permissions.admin.accept_reject_orders);

  if (!isOpen) return null;

  const handleDeleteOrder = (shopId: number, shopLabel: string) => {
    if (!window.confirm(`Удалить заявку точки «${shopLabel}»? Точка вернётся в состояние «не подана». Действие нельзя отменить.`)) return;
    onDeleteOrder(shopId);
    if (detailShopId === shopId) setDetailShopId(null);
  };

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

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `Все заявки (${shops.length})` },
    { key: 'submitted', label: `Ожидают подтверждения (${totalSubmitted})` },
    { key: 'accepted', label: `Принятые (${totalAccepted})` },
    { key: 'rejected', label: `Отклонённые (${totalRejected})` },
    { key: 'draft', label: `Не поданы (${totalDraft})` }
  ];

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

    if (statusFilter !== 'all' && status !== statusFilter) return false;

    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const matchName = shop.name.toLowerCase().includes(term);
    const matchManager = shop.manager.toLowerCase().includes(term);
    const matchId = `точка ${shop.id}`.includes(term) || `${shop.id}` === term;

    return matchName || matchManager || matchId;
  });

  const detailShop = detailShopId != null ? shops.find((s) => s.id === detailShopId) || null : null;
  const detailOrder = detailShop ? orders[detailShop.id] : undefined;
  const detailLines = detailOrder?.items
    ? Object.entries(detailOrder.items)
        .map(([pId, qtyVal]) => {
          const qty = Number(qtyVal) || 0;
          const p = products.find((prod) => prod.id === pId);
          return p && qty > 0 ? { name: p.name, qty, unit: p.unit, sum: qty * p.price } : null;
        })
        .filter((l): l is { name: string; qty: number; unit: string; sum: number } => Boolean(l))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            {detailShop ? (
              <button
                onClick={() => setDetailShopId(null)}
                className="p-1.5 -ml-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg shrink-0"
                title="Назад к списку"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {detailShop ? detailShop.name.replace(`Кофейня №${detailShop.id} — `, '') : 'Реестр заявок'}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {detailShop
                  ? detailShop.address
                  : canManage
                  ? 'Вы можете принимать и отклонять заявки точек'
                  : 'Режим просмотра — принимать и отклонять может только Управляющий Производством'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!detailShop && (
          <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
            <div className="flex items-center gap-1 flex-wrap bg-slate-100 p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-2 rounded text-xs font-bold uppercase tracking-wide transition-all ${
                    statusFilter === tab.key
                      ? 'bg-white text-indigo-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Поиск по названию точки, номеру или имени менеджера..."
                className="w-full pl-8 pr-16 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600 font-bold"
                >
                  Очистить
                </button>
              )}
            </div>
          </div>
        )}

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {detailShop ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold">
                    {detailOrder?.status !== 'draft' ? detailOrder?.submittedAt || '—' : 'Не подана'}
                  </span>
                </div>
                <div className="text-slate-700">
                  <span className="font-bold">{detailOrder?.managerName || detailShop.manager}</span>
                </div>
                {detailOrder && (
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${STATUS_BADGE[detailOrder.status || 'draft'].className}`}>
                    {STATUS_BADGE[detailOrder.status || 'draft'].label}
                  </span>
                )}
              </div>

              {detailLines.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <PackageSearch className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Заказ пуст</p>
                  <p className="text-xs text-slate-400 mt-1">Эта точка ещё не сформировала заявку</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {detailLines.map((line, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <span className="font-semibold text-slate-800 truncate pr-2">{line.name}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500">{line.qty} {line.unit}</span>
                          <span className="font-bold text-slate-900 w-16 text-right">
                            {line.sum.toLocaleString('ru-RU')} ₸
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const { pcs, sum } = getOrderSummary(detailOrder);
                    return (
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold">
                        <span>Итого: {pcs} шт</span>
                        <span>{sum.toLocaleString('ru-RU')} ₸</span>
                      </div>
                    );
                  })()}
                </>
              )}

              {canManage && detailOrder && (
                <div className="pt-1">
                  {detailOrder.status === 'accepted' ? (
                    <button
                      onClick={() => onUpdateOrderStatus(detailShop.id, 'rejected')}
                      className="w-full py-2 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                    >
                      Отклонить принятую заявку
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onUpdateOrderStatus(detailShop.id, 'accepted')}
                        className="py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Принять</span>
                      </button>
                      <button
                        onClick={() => onUpdateOrderStatus(detailShop.id, 'rejected')}
                        disabled={detailOrder.status === 'rejected'}
                        className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
                          detailOrder.status === 'rejected'
                            ? 'bg-rose-50 text-rose-400 border border-rose-100 cursor-default'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{detailOrder.status === 'rejected' ? 'Отклонена' : 'Отклонить'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {canManage && detailOrder && (
                <button
                  onClick={() => handleDeleteOrder(detailShop.id, detailShop.district.trim() || detailShop.name)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-dashed border-rose-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Удалить заявку (вернуть в «не подана»)</span>
                </button>
              )}
            </div>
          ) : filteredShops.length === 0 ? (
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
              {/* MOBILE CARDS VIEW */}
              <div className="block sm:hidden space-y-2">
                {filteredShops.map((shop) => {
                  const order = orders[shop.id];
                  const status = order?.status || 'draft';
                  const badge = STATUS_BADGE[status];
                  const { pcs, sum } = getOrderSummary(order);
                  const cleanShopName = shop.name.replace(`Кофейня №${shop.id} — `, '');

                  return (
                    <div
                      key={shop.id}
                      onClick={() => setDetailShopId(shop.id)}
                      className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-indigo-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                            №{shop.id}
                          </span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate">{cleanShopName}</h4>
                            <p className="text-[11px] text-slate-500 truncate">{shop.district}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Менеджер</span>
                          <span className="font-bold text-slate-800 text-xs block truncate">
                            {order?.managerName || shop.manager}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                          <span className="text-[9px] font-bold uppercase text-slate-400 block">Время подачи</span>
                          <span className="font-bold text-slate-800 text-xs block">
                            {status !== 'draft' ? order?.submittedAt || '—' : 'Не подана'}
                          </span>
                        </div>
                        <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Объём и сумма</span>
                          {pcs > 0 ? (
                            <span className="font-bold text-slate-900 text-xs">
                              {pcs} шт · <span className="text-indigo-700">{sum.toLocaleString('ru-RU')} ₸</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Заказ пуст</span>
                          )}
                        </div>
                      </div>

                      {canManage ? (
                        status === 'accepted' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(shop.id, 'rejected'); }}
                              className="py-2 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                            >
                              Отклонить
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteOrder(shop.id, cleanShopName); }}
                              className="py-2 rounded-lg text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 border border-dashed border-rose-200 flex items-center justify-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Удалить</span>
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(shop.id, 'accepted'); }}
                              className="py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Принять</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(shop.id, 'rejected'); }}
                              disabled={status === 'rejected'}
                              className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
                                status === 'rejected'
                                  ? 'bg-rose-50 text-rose-400 border border-rose-100 cursor-default'
                                  : 'bg-rose-600 hover:bg-rose-700 text-white'
                              }`}
                            >
                              <XCircle className="w-4 h-4" />
                              <span>{status === 'rejected' ? 'Отклонена' : 'Отклонить'}</span>
                            </button>
                            {order && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteOrder(shop.id, cleanShopName); }}
                                className="col-span-2 py-2 rounded-lg text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 border border-dashed border-rose-200 flex items-center justify-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Удалить заявку</span>
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 rounded-lg text-[11px] font-semibold text-slate-500 border border-slate-200">
                          <Lock className="w-3 h-3" />
                          <span>Доступно только Управляющему</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="hidden sm:block border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Точка</th>
                      <th className="py-2.5 px-3">Менеджер</th>
                      <th className="py-2.5 px-3">Время</th>
                      <th className="py-2.5 px-3">Заказ</th>
                      <th className="py-2.5 px-3">Статус</th>
                      <th className="py-2.5 px-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredShops.map((shop) => {
                      const order = orders[shop.id];
                      const status = order?.status || 'draft';
                      const badge = STATUS_BADGE[status];
                      const { pcs, sum } = getOrderSummary(order);
                      const cleanShopName = shop.name.replace(`Кофейня №${shop.id} — `, '');

                      return (
                        <tr
                          key={shop.id}
                          onClick={() => setDetailShopId(shop.id)}
                          className="hover:bg-slate-50 cursor-pointer"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                                {shop.id}
                              </span>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900">{cleanShopName}</div>
                                <div className="text-[10px] text-slate-400">{shop.district}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{order?.managerName || shop.manager}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {status !== 'draft' ? (
                              <div className="flex items-center space-x-1 text-slate-700 font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{order?.submittedAt || '—'}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">Не подана</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {pcs > 0 ? (
                              <div>
                                <span className="font-bold text-slate-900">{pcs} шт</span>
                                <span className="text-[10px] text-indigo-700 block font-bold">
                                  {sum.toLocaleString('ru-RU')} ₸
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold ${badge.className}`}>
                                {badge.label}
                              </span>
                              {status === 'accepted' && canManage && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(shop.id, 'rejected'); }}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="Отклонить принятую заявку"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {canManage ? (
                              status === 'accepted' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="text-emerald-700 font-bold text-xs">Принята</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteOrder(shop.id, cleanShopName); }}
                                    className="text-slate-400 hover:text-rose-600 p-1"
                                    title="Удалить заявку"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(shop.id, 'accepted'); }}
                                    className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    Принять
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateOrderStatus(shop.id, 'rejected'); }}
                                    disabled={status === 'rejected'}
                                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                                      status === 'rejected'
                                        ? 'bg-rose-50 text-rose-400 cursor-default'
                                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                                    }`}
                                  >
                                    {status === 'rejected' ? 'Отклонена' : 'Отклонить'}
                                  </button>
                                  {order && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeleteOrder(shop.id, cleanShopName); }}
                                      className="text-slate-400 hover:text-rose-600 p-1"
                                      title="Удалить заявку"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded"
                                title="Изменение статусов доступно только Управляющему"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Только Управляющий</span>
                              </span>
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

        {/* FOOTER */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Показано {filteredShops.length} из {shops.length}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
