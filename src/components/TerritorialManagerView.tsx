import React, { useState } from 'react';
import {
  CoffeeShop, ShopOrder, Product, StaffMember, POSITION_OPTIONS, positionValueOf,
} from '../types';
import { ShopOrderHistoryTable } from './ShopOrderHistoryTable';
import { ManagerView } from './ManagerView';
import { OrderPreviewModal } from './OrderPreviewModal';
import {
  X, MapPin, User, Clock, Compass, Send, Users, ClipboardList, Trash2,
  CheckCircle2, XCircle, ChevronRight, ChevronLeft,
} from 'lucide-react';

interface TerritorialManagerViewProps {
  orderDeadline?: string;
  managerName: string;
  shops: CoffeeShop[];
  orders: Record<number, ShopOrder>;
  products: Product[];
  staff: StaffMember[];
  onUpdateOrder: (shopId: number, items: Record<string, number>, status?: 'draft' | 'submitted') => void;
  // Заполняется только когда кабинет открыл Владелец: выбрать, чей участок смотреть.
  // У самого территориального управляющего выбора нет — его участок закреплён.
  allManagers?: StaffMember[];
  selectedManagerId?: string;
  onPickManager?: (staffId: string) => void;
  // Управление персоналом своих точек: сменить должность, убрать человека.
  onUpdateStaffMember?: (staffId: string, updates: Partial<StaffMember>) => void;
  onDeleteStaffMember?: (staffId: string) => void;
}

const emptyDraftOrder = (shopId: number): ShopOrder => ({ shopId, items: {}, status: 'draft' });

// Как выглядит плитка точки в зависимости от того, что с её сегодняшней заявкой. Серая —
// это «ничего не подали»: и когда заявки нет совсем, и когда она осталась черновиком.
const statusLook = (order?: ShopOrder) => {
  switch (order?.status) {
    case 'accepted':
      return {
        label: 'Принята',
        Icon: CheckCircle2,
        tile: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
        badge: 'bg-emerald-100 text-emerald-800',
      };
    case 'rejected':
      return {
        label: 'Отклонена',
        Icon: XCircle,
        tile: 'bg-rose-50 border-rose-200 hover:border-rose-400',
        badge: 'bg-rose-100 text-rose-800',
      };
    case 'submitted':
      return {
        label: 'Подана',
        Icon: Send,
        tile: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
        badge: 'bg-indigo-100 text-indigo-800',
      };
    default:
      return {
        label: 'Не подана',
        Icon: Clock,
        tile: 'bg-white border-slate-200 hover:border-slate-400',
        badge: 'bg-slate-100 text-slate-600',
      };
  }
};

export const TerritorialManagerView: React.FC<TerritorialManagerViewProps> = ({
  managerName,
  shops,
  orders,
  products,
  staff,
  onUpdateOrder,
  allManagers,
  selectedManagerId,
  onPickManager,
  onUpdateStaffMember,
  onDeleteStaffMember,
  orderDeadline,
}) => {
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  // Какой раздел точки открыт: null — меню из трёх плиток.
  const [shopPanel, setShopPanel] = useState<'staff' | 'orders' | null>(null);
  const selectedShop = shops.find((s) => s.id === selectedShopId) || null;

  // Which shop's order this territorial manager is currently filling in on that shop's behalf
  const [orderingShopId, setOrderingShopId] = useState<number | null>(null);
  const [isOrderPreviewOpen, setIsOrderPreviewOpen] = useState(false);
  const orderingShop = shops.find((s) => s.id === orderingShopId) || null;
  const orderingOrder = orderingShopId != null ? orders[orderingShopId] || emptyDraftOrder(orderingShopId) : null;

  const getShopManagers = (shop: CoffeeShop) =>
    staff.filter((s) => s.role === 'shop_manager' && s.shopId === shop.id);

  // Весь персонал точки, а не только менеджеры: бариста и заготовщики тоже её люди.
  const getShopStaff = (shop: CoffeeShop) => staff.filter((s) => s.shopId === shop.id);

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

        {allManagers && onPickManager && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Чей участок смотрим
            </label>
            {allManagers.length === 0 ? (
              <p className="text-sm text-slate-400">
                Территориальных управляющих пока нет — их добавляют через «Персонал».
              </p>
            ) : (
              <select
                value={selectedManagerId || ''}
                onChange={(e) => onPickManager(e.target.value)}
                className="w-full px-2.5 min-h-[48px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {allManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — точек: {m.assignedShopIds?.length || 0}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Плитки точек. Цвет — это статус заявки за сегодня, чтобы отстающую точку было
          видно, не открывая её: серая значит, что заявки нет вовсе. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shops.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
            За вами пока не закреплено ни одной точки.
          </div>
        ) : (
          shops.map((shop) => {
            const look = statusLook(orders[shop.id]);
            return (
              <button
                key={shop.id}
                onClick={() => setSelectedShopId(shop.id)}
                className={`text-left rounded-xl p-4 shadow-sm border transition-all ${look.tile}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${look.badge}`}>
                    <look.Icon className="w-3 h-3" />
                    {look.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </div>
                <div className="font-bold text-slate-900 text-sm truncate">
                  {shop.district.trim() || shop.address}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{shop.address}</div>
                <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1 truncate">
                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                  {getShopManagersLabel(shop)}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* SHOP DETAIL MODAL (read-only info + сan submit an order on the shop's behalf) */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-sm">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">
                {selectedShop.district.trim() || selectedShop.address}
              </h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                {selectedShop.address}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {shopPanel && (
                <button
                  onClick={() => setShopPanel(null)}
                  className="min-h-[44px] px-3 rounded-lg text-xs font-bold uppercase tracking-wider text-indigo-700 hover:bg-indigo-50 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Назад
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedShopId(null);
                  setShopPanel(null);
                }}
                className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            {/* Управление точкой: три вещи, которые территориальный реально делает */}
            {!shopPanel && (
              <>
                <div className={`rounded-xl border px-4 py-3 mb-4 ${statusLook(orders[selectedShop.id]).tile}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Заявка на сегодня
                  </span>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">
                    {statusLook(orders[selectedShop.id]).label}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShopPanel('staff')}
                    className="bg-slate-50 hover:bg-indigo-50/60 active:bg-indigo-100 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all text-center flex flex-col items-center justify-center min-h-[104px]"
                  >
                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">
                      Персонал
                    </span>
                    <Users className="w-6 h-6 text-slate-900 mt-1.5" />
                    <span className="text-[11px] text-slate-500 mt-1">
                      {getShopStaff(selectedShop).length} чел.
                    </span>
                  </button>

                  <button
                    onClick={() => setShopPanel('orders')}
                    className="bg-slate-50 hover:bg-indigo-50/60 active:bg-indigo-100 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all text-center flex flex-col items-center justify-center min-h-[104px]"
                  >
                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">
                      Реестр заявок
                    </span>
                    <ClipboardList className="w-6 h-6 text-slate-900 mt-1.5" />
                    <span className="text-[11px] text-slate-500 mt-1">только просмотр</span>
                  </button>

                  <button
                    onClick={() => {
                      setOrderingShopId(selectedShop.id);
                      setSelectedShopId(null);
                    }}
                    className="col-span-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white p-4 rounded-xl transition-all text-center flex flex-col items-center justify-center min-h-[92px] shadow-sm"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {orders[selectedShop.id]?.status === 'draft' || !orders[selectedShop.id]
                        ? 'Подать заявку'
                        : 'Изменить заявку'}
                    </span>
                    <Send className="w-6 h-6 mt-1.5" />
                  </button>
                </div>
              </>
            )}

            {/* Персонал точки: видно всех, можно поменять должность или убрать человека */}
            {shopPanel === 'staff' && (
              <>
                <h4 className="text-sm font-extrabold text-slate-900 mb-1">Персонал точки</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Здесь только те, кто закреплён за этой точкой.
                </p>

                {getShopStaff(selectedShop).length === 0 ? (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-300 rounded-xl">
                    <Users className="w-7 h-7 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">За точкой никто не закреплён</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Люди появляются здесь после того, как их заявку на регистрацию одобрят.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {getShopStaff(selectedShop).map((member) => (
                      <div key={member.id} className="p-3 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 leading-tight">{member.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {member.phone || 'телефон не указан'}
                            </p>
                          </div>
                          {onDeleteStaffMember && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Убрать «${member.name}» из персонала?`)) {
                                  onDeleteStaffMember(member.id);
                                }
                              }}
                              className="w-11 h-11 shrink-0 flex items-center justify-center text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors"
                              title="Убрать из персонала"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {onUpdateStaffMember && (
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                              Должность
                            </label>
                            <select
                              value={positionValueOf(member.role, member.position)}
                              onChange={(e) => {
                                const picked = POSITION_OPTIONS.find((o) => o.value === e.target.value);
                                if (picked) {
                                  onUpdateStaffMember(member.id, { role: picked.role, position: picked.position });
                                }
                              }}
                              className="w-full px-2.5 min-h-[44px] text-sm border border-slate-300 rounded-lg bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              {POSITION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Реестр заявок точки — только смотреть, менять нельзя */}
            {shopPanel === 'orders' && (
              <>
                <h4 className="text-sm font-extrabold text-slate-900 mb-1">Реестр заявок точки</h4>
                <p className="text-xs text-slate-500 mb-4">
                  Кто и когда подал заявку. Изменить её отсюда нельзя — только посмотреть состав.
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <ShopOrderHistoryTable shopId={selectedShop.id} products={products} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ORDER-ON-BEHALF OVERLAY: reuses the same order-entry screen a shop manager sees,
          scoped to whichever point this territorial manager picked above */}
      {orderingShop && orderingOrder && (
        <div className="fixed inset-0 z-[60] bg-slate-50 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <Send className="w-4 h-4 text-indigo-600" />
              <span>Заявка за точку: {orderingShop.district}</span>
            </h2>
            <button
              onClick={() => setOrderingShopId(null)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <ManagerView
              // Только его точки: coffeeShops уже отфильтрованы по участку, поэтому
              // переключаться он может лишь между своими. Стартует с той, с которой нажал.
              coffeeShops={shops}
              products={products}
              selectedShopId={orderingShop.id}
              currentOrder={orderingOrder}
              onUpdateOrder={onUpdateOrder}
              onOpenPreview={() => setIsOrderPreviewOpen(true)}
              notifications={[]}
              onSelectShop={setOrderingShopId}
              shopPickerLabel="За какую точку подаём"
              actingAs={{ name: managerName, roleLabel: 'Территориальный управляющий' }}
              orderDeadline={orderDeadline}
            />
          </div>

          <OrderPreviewModal
            isOpen={isOrderPreviewOpen}
            onClose={() => setIsOrderPreviewOpen(false)}
            shop={orderingShop}
            products={products}
            order={orderingOrder}
            onSubmit={() => {
              onUpdateOrder(orderingShop.id, orderingOrder.items, 'submitted');
              setIsOrderPreviewOpen(false);
              setOrderingShopId(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
