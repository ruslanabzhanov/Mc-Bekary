import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  User,
  ChevronRight,
  AlertCircle,
  FileCheck2,
  ArrowLeft,
  PackageSearch,
  Trash2,
  Calendar,
  Loader2,
  RotateCcw,
  Pencil,
  Plus,
  Minus,
  Save
} from 'lucide-react';
import { CoffeeShop, Product, ShopOrder, OrderStatus, UserRole, RolePermissions } from '../types';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

// 'YYYY-MM-DD' for the given instant, as an Asia/Almaty calendar date (en-CA locale formats
// dates in that exact order) — matches how the server buckets order_history by date.
const almatyDateStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });

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
  // Only the production manager and Owner may edit a submitted order's contents (see canManage
  // below) — everyone else, including the point itself once it's no longer a draft, is locked
  // out (ManagerView enforces that half).
  onUpdateOrder: (shopId: number, items: Record<string, number>, status?: 'draft' | 'submitted') => void;
}

type StatusFilter = 'all' | 'submitted' | 'accepted' | 'rejected' | 'draft';

const STATUS_BADGE: Record<'accepted' | 'submitted' | 'rejected' | 'draft', { label: string; className: string }> = {
  accepted: { label: 'Принята', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' },
  submitted: { label: 'Поданная', className: 'bg-amber-100 text-amber-800 border border-amber-200' },
  rejected: { label: 'Отклонена', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  draft: { label: 'Не подана', className: 'bg-slate-100 text-slate-600 border border-slate-200' }
};

// Плитка точки в реестре — цвет самой плитки, не только бейджа, чтобы поданные заявки было
// видно с одного взгляда на сетку, без клика в каждую (тот же приём, что и у территориального
// управляющего). Принятая — зелёная, ожидает подтверждения — жёлтая, отклонённая — красная,
// не подана вовсе — нейтральная.
const TILE_LOOK: Record<'accepted' | 'submitted' | 'rejected' | 'draft', { label: string; Icon: typeof CheckCircle2; tile: string; badge: string }> = {
  accepted: {
    label: 'Принята',
    Icon: CheckCircle2,
    tile: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  submitted: {
    label: 'Ожидает подтверждения',
    Icon: Send,
    tile: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-800',
  },
  rejected: {
    label: 'Отклонена',
    Icon: XCircle,
    tile: 'bg-rose-50 border-rose-200 hover:border-rose-400',
    badge: 'bg-rose-100 text-rose-800',
  },
  draft: {
    label: 'Не подана',
    Icon: Clock,
    tile: 'bg-white border-slate-200 hover:border-slate-400',
    badge: 'bg-slate-100 text-slate-600',
  },
};

// A point can edit and resend an order that's already been accepted — the status correctly
// drops back to "submitted" so nobody trusts a stale approval on now-different contents, but
// on its own that looks identical to an order that was simply never reviewed yet. Both
// timestamps are plain "HH:MM" for today, so a later submittedAt than acceptedAt is exactly
// this case — flagged here so it stands out in the registry instead of quietly blending in.
const wasReopenedAfterAcceptance = (order?: ShopOrder): boolean =>
  !!order &&
  order.status === 'submitted' &&
  !!order.acceptedAt &&
  !!order.submittedAt &&
  order.submittedAt > order.acceptedAt;

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
  onUpdateOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [detailShopId, setDetailShopId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<Record<string, number> | null>(null);
  const [editSearch, setEditSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => almatyDateStr(new Date()));
  const [historyOrders, setHistoryOrders] = useState<Record<number, ShopOrder>>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const todayStr = almatyDateStr(new Date());
  const isToday = selectedDate === todayStr;

  // Owner always may act; admin only if the Owner has granted this permission. Never on a past
  // date — those decisions already happened, this view is read-only history for anything else.
  const canManage = isToday && (currentRole === 'owner' || (currentRole === 'admin' && permissions.admin.accept_reject_orders));

  useEffect(() => {
    if (isToday || !isOpen) return;
    let cancelled = false;
    setIsHistoryLoading(true);
    fetch(`/api/order-history-by-date?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map: Record<number, ShopOrder> = {};
        (data.history || []).forEach((entry: any) => {
          map[entry.shopId] = {
            shopId: entry.shopId,
            items: entry.items,
            status: entry.status,
            submittedAt: new Date(entry.submittedAt).toLocaleTimeString('ru-RU', {
              timeZone: 'Asia/Almaty',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }),
            managerName: entry.managerName,
          };
        });
        setHistoryOrders(map);
      })
      .catch((e) => console.error('Failed to load order history by date:', e))
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, isToday, isOpen]);

  // Leaving edit mode whenever the shop being looked at changes (including closing the detail
  // view) — an in-progress edit for one point must never carry over and get saved onto another.
  useEffect(() => {
    setEditItems(null);
    setEditSearch('');
  }, [detailShopId]);

  // What the list/detail actually render from — live data for today (actionable), a read-only
  // snapshot built from order_history for any other date.
  const displayOrders = isToday ? orders : historyOrders;

  useTelegramBackButton(isOpen, () => {
    if (editItems !== null) setEditItems(null);
    else if (detailShopId != null) setDetailShopId(null);
    else onClose();
  });

  if (!isOpen) return null;

  const handleDeleteOrder = (shopId: number, shopLabel: string) => {
    if (!window.confirm(`Удалить заявку точки «${shopLabel}»? Точка вернётся в состояние «не подана». Действие нельзя отменить.`)) return;
    onDeleteOrder(shopId);
    if (detailShopId === shopId) setDetailShopId(null);
  };

  const startEditing = (order: ShopOrder) => {
    setEditItems({ ...(order.items || {}) });
    setEditSearch('');
  };
  const setEditQty = (productId: string, qty: number) => {
    setEditItems((prev) => {
      const next = { ...(prev || {}) };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };
  const saveEdits = (shopId: number) => {
    if (!editItems) return;
    onUpdateOrder(shopId, editItems, 'submitted');
    setEditItems(null);
    setEditSearch('');
  };

  // Calculate stats
  let totalSubmitted = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let totalDraft = 0;

  shops.forEach((shop) => {
    const order = displayOrders[shop.id];
    const status = order?.status || 'draft';
    if (status === 'accepted') totalAccepted++;
    else if (status === 'submitted') totalSubmitted++;
    else if (status === 'rejected') totalRejected++;
    else totalDraft++;
  });

  const totalSubmittedOrDecided = totalSubmitted + totalAccepted + totalRejected;

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `Поданные заявки (${totalSubmittedOrDecided})` },
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

  // Filtered shops list. "all" here means "все поданные" — a shop that hasn't submitted
  // anything only shows up under the dedicated "Не поданы" tab, not by default.
  const filteredShops = shops.filter((shop) => {
    const order = displayOrders[shop.id];
    const status = order?.status || 'draft';

    if (statusFilter === 'all') {
      if (status === 'draft') return false;
    } else if (status !== statusFilter) {
      return false;
    }

    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const matchName = shop.name.toLowerCase().includes(term);
    const matchManager = shop.manager.toLowerCase().includes(term);
    const matchId = `точка ${shop.id}`.includes(term) || `${shop.id}` === term;

    return matchName || matchManager || matchId;
  });

  const detailShop = detailShopId != null ? shops.find((s) => s.id === detailShopId) || null : null;
  const detailOrder = detailShop ? displayOrders[detailShop.id] : undefined;
  const detailLines = detailOrder?.items
    ? Object.entries(detailOrder.items)
        .map(([pId, qtyVal]) => {
          const qty = Number(qtyVal) || 0;
          const p = products.find((prod) => prod.id === pId);
          return p && qty > 0 ? { name: p.name, qty, unit: p.unit, sum: qty * p.price } : null;
        })
        .filter((l): l is { name: string; qty: number; unit: string; sum: number } => Boolean(l))
    : [];

  // Same shape as detailLines, but from the in-progress edit and carrying the product id (a
  // stepper needs it to change one line without touching the others).
  const editLines = editItems
    ? (Object.entries(editItems) as [string, number][])
        .map(([pId, qty]) => {
          const p = products.find((prod) => prod.id === pId);
          return p && qty > 0 ? { id: pId, name: p.name, qty, unit: p.unit, sum: qty * p.price } : null;
        })
        .filter((l): l is { id: string; name: string; qty: number; unit: string; sum: number } => Boolean(l))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    : [];
  const editSearchLower = editSearch.trim().toLowerCase();
  const editSearchResults = editSearchLower
    ? products
        .filter((p) => !editItems?.[p.id] && p.name.toLowerCase().includes(editSearchLower))
        .slice(0, 8)
    : [];
  const editTotals = editLines.reduce(
    (acc, l) => ({ pcs: acc.pcs + l.qty, sum: acc.sum + l.sum }),
    { pcs: 0, sum: 0 }
  );

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
                {detailShop ? `№${detailShop.id} · ${detailShop.district.trim() || detailShop.address}` : 'Реестр заявок'}
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
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                />
                {!isToday && (
                  <button
                    onClick={() => setSelectedDate(todayStr)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 pl-1"
                  >
                    Сегодня
                  </button>
                )}
              </div>
              {!isToday && (
                <span className="flex items-center gap-1.5 text-[11px] text-slate-400 italic">
                  {isHistoryLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Загрузка истории…</span>
                    </>
                  ) : (
                    <span>Просмотр истории — приём/отклонение недоступны для прошедших дат</span>
                  )}
                </span>
              )}
            </div>

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

              {wasReopenedAfterAcceptance(detailOrder) && (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-2.5 py-1.5 text-xs font-bold">
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>Точка изменила заявку после принятия — нужна повторная проверка</span>
                </div>
              )}

              {editItems !== null ? (
                <>
                  {editLines.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400 italic">Позиций не осталось</p>
                  ) : (
                    <div className="space-y-1.5">
                      {editLines.map((line) => (
                        <div
                          key={line.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <span className="font-semibold text-slate-800 truncate pr-2">{line.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setEditQty(line.id, line.qty - 1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-bold text-slate-900 tabular-nums">{line.qty}</span>
                            <button
                              onClick={() => setEditQty(line.id, line.qty + 1)}
                              className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold">
                    <span>Итого: {editTotals.pcs} шт</span>
                    <span>{editTotals.sum.toLocaleString('ru-RU')} ₸</span>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={editSearch}
                      onChange={(e) => setEditSearch(e.target.value)}
                      placeholder="Добавить блюдо…"
                      className="w-full pl-8 pr-2 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {editSearchResults.length > 0 && (
                      <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-sm divide-y divide-slate-100 overflow-hidden">
                        {editSearchResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setEditQty(p.id, 1);
                              setEditSearch('');
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-indigo-50 text-left"
                          >
                            <span className="font-semibold text-slate-800 truncate pr-2">{p.name}</span>
                            <Plus className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setEditItems(null)}
                      className="py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      Отменить
                    </button>
                    <button
                      onClick={() => saveEdits(detailShop.id)}
                      className="py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      <span>Сохранить</span>
                    </button>
                  </div>
                </>
              ) : detailLines.length === 0 ? (
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

              {canManage && detailOrder && editItems === null && detailOrder.status !== 'draft' && (
                <button
                  onClick={() => startEditing(detailOrder)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Редактировать заявку</span>
                </button>
              )}

              {canManage && detailOrder && editItems === null && (
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

              {canManage && detailOrder && editItems === null && (
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
            // Плитки точек, как у территориального управляющего: цвет плитки — статус заявки,
            // так что поданные (и особенно принятые — горят зелёным) видно сразу на сетке, без
            // клика в каждую. Клик по плитке открывает состав заявки и действия — то же, что
            // раньше было построчно в таблице/карточках, теперь только в детальном экране.
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredShops.map((shop) => {
                const order = displayOrders[shop.id];
                const status = order?.status || 'draft';
                const look = TILE_LOOK[status];
                const reopened = wasReopenedAfterAcceptance(order);
                const { pcs, sum } = getOrderSummary(order);
                const cleanShopName = shop.district.trim() || shop.address;

                return (
                  <button
                    key={shop.id}
                    onClick={() => setDetailShopId(shop.id)}
                    className={`text-left rounded-xl p-3.5 shadow-sm border transition-all ${
                      reopened
                        ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300 hover:border-emerald-500'
                        : look.tile
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${look.badge}`}>
                        <look.Icon className="w-3 h-3" />
                        {look.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>

                    <div className="font-bold text-slate-900 text-sm truncate">
                      №{shop.id} · {cleanShopName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{shop.address}</div>

                    {reopened && (
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] font-bold text-emerald-800">
                        <RotateCcw className="w-3 h-3 shrink-0" />
                        <span>Изменена после принятия — нужна проверка</span>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-600 truncate">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      {order?.managerName || shop.manager}
                    </div>

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 shrink-0">
                        {status !== 'draft' ? order?.submittedAt || '—' : 'Не подана'}
                      </span>
                      {pcs > 0 ? (
                        <span className="font-bold text-slate-900 truncate">
                          {pcs} шт · <span className="text-indigo-700">{sum.toLocaleString('ru-RU')} ₸</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Заказ пуст</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
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
