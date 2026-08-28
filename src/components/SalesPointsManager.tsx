import React, { useState } from 'react';
import { CoffeeShop, ShopOrder, Product, StaffMember } from '../types';
import { buildSalesHistory } from '../utils/salesHistory';
import { Store, Plus, X, MapPin, User, ShieldCheck, Clock, ChevronDown, Trash2 } from 'lucide-react';

interface SalesPointsManagerProps {
  shops: CoffeeShop[];
  orders: Record<number, ShopOrder>;
  products: Product[];
  staff: StaffMember[];
  onAddShop: (data: { address: string; manager: string; district: string }) => void;
  onUpdateShop: (shopId: number, updates: Partial<Pick<CoffeeShop, 'district' | 'address'>>) => void;
  onAddStaffMember: (member: Omit<StaffMember, 'id'>) => void;
  onDeleteStaffMember: (staffId: string) => void;
  onAssignTerritorialManager: (shopId: number, staffId: string) => void;
}

export const SalesPointsManager: React.FC<SalesPointsManagerProps> = ({
  shops,
  orders,
  products,
  staff,
  onAddShop,
  onUpdateShop,
  onAddStaffMember,
  onDeleteStaffMember,
  onAssignTerritorialManager
}) => {
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newShop, setNewShop] = useState({ address: '', manager: '', district: '' });
  const [isManagersExpanded, setIsManagersExpanded] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');
  const [isTerritorialPickerOpen, setIsTerritorialPickerOpen] = useState(false);

  const selectedShop = shops.find((s) => s.id === selectedShopId) || null;
  const territorialManagers = staff.filter((s) => s.role === 'territorial_manager');

  const getShopManagers = (shop: CoffeeShop) =>
    staff.filter((s) => s.role === 'shop_manager' && s.shopId === shop.id);

  const getShopManagersLabel = (shop: CoffeeShop) => {
    const managers = getShopManagers(shop);
    if (managers.length === 0) return shop.manager;
    if (managers.length === 1) return managers[0].name;
    return `${managers[0].name} +${managers.length - 1}`;
  };

  const getTerritorialManager = (shop: CoffeeShop) =>
    staff.find((s) => s.role === 'territorial_manager' && s.assignedShopIds?.includes(shop.id)) || null;

  const closeShopDetail = () => {
    setSelectedShopId(null);
    setIsManagersExpanded(false);
    setNewManagerName('');
    setIsTerritorialPickerOpen(false);
  };

  const handleAddManager = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManagerName.trim() || !selectedShop) return;
    onAddStaffMember({ name: newManagerName.trim(), role: 'shop_manager', shopId: selectedShop.id });
    setNewManagerName('');
  };

  const handleSubmitNewShop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShop.address.trim() || !newShop.manager.trim()) return;
    onAddShop(newShop);
    setNewShop({ address: '', manager: '', district: '' });
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Store className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
              Точки продаж ({shops.length})
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Нажмите на точку, чтобы увидеть историю продаж, менеджера и территориального управляющего
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить точку</span>
        </button>
      </div>

      {/* Shops grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shops.map((shop) => {
          const order = orders[shop.id];
          return (
            <button
              key={shop.id}
              onClick={() => setSelectedShopId(shop.id)}
              className="text-left bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-xl p-4 shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">
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
        })}
      </div>

      {/* SHOP DETAIL MODAL */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xl space-y-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">
                  Точка №{selectedShop.id}
                </span>
                <input
                  type="text"
                  value={selectedShop.district}
                  onChange={(e) => onUpdateShop(selectedShop.id, { district: e.target.value })}
                  className="block w-full text-xl font-black text-slate-900 uppercase tracking-tight bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors"
                  title="Нажмите, чтобы изменить название"
                />
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={selectedShop.address}
                    onChange={(e) => onUpdateShop(selectedShop.id, { address: e.target.value })}
                    className="block w-full text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors"
                    title="Нажмите, чтобы изменить адрес"
                  />
                </div>
              </div>
              <button
                onClick={closeShopDetail}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Managers tile - expandable, add/remove */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <button
                  type="button"
                  onClick={() => setIsManagersExpanded((v) => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Менеджеры ({getShopManagers(selectedShop).length})
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isManagersExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {!isManagersExpanded && (
                  <span className="font-bold text-slate-900 text-sm block mt-1 truncate">
                    {getShopManagersLabel(selectedShop)}
                  </span>
                )}
              </div>

              {/* Territorial manager tile - single, replaceable */}
              <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-3">
                <button
                  type="button"
                  onClick={() => setIsTerritorialPickerOpen((v) => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Терр. управляющий
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isTerritorialPickerOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <span className="font-bold text-slate-900 text-sm block mt-1 truncate">
                  {getTerritorialManager(selectedShop)?.name || 'Не назначен'}
                </span>

                {isTerritorialPickerOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 max-h-56 overflow-y-auto">
                    {territorialManagers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic text-center py-2 px-3">
                        Нет территориальных управляющих
                      </p>
                    ) : (
                      territorialManagers.map((tm) => (
                        <button
                          key={tm.id}
                          type="button"
                          onClick={() => {
                            onAssignTerritorialManager(selectedShop.id, tm.id);
                            setIsTerritorialPickerOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 ${
                            tm.id === getTerritorialManager(selectedShop)?.id
                              ? 'font-bold text-indigo-900 bg-indigo-50/60'
                              : 'text-slate-700'
                          }`}
                        >
                          {tm.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded managers list: add/remove */}
            {isManagersExpanded && (
              <div className="border border-slate-200 rounded-lg p-3 space-y-2 -mt-2">
                {getShopManagers(selectedShop).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Менеджеры не назначены.</p>
                ) : (
                  getShopManagers(selectedShop).map((manager) => (
                    <div
                      key={manager.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{manager.name}</div>
                        {manager.phone && <div className="text-[11px] text-slate-500">{manager.phone}</div>}
                      </div>
                      <button
                        onClick={() => onDeleteStaffMember(manager.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Удалить менеджера"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}

                <form onSubmit={handleAddManager} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newManagerName}
                    onChange={(e) => setNewManagerName(e.target.value)}
                    placeholder="Имя нового менеджера"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                  <button
                    type="submit"
                    className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded-lg text-xs uppercase tracking-wider transition-all shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить</span>
                  </button>
                </form>
              </div>
            )}

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

      {/* ADD SHOP MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Новая точка продаж</h3>

              <form onSubmit={handleSubmitNewShop} className="w-full mt-5 space-y-3 text-left">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Адрес
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: г. Алматы, ул. Абая, 200"
                    value={newShop.address}
                    onChange={(e) => setNewShop({ ...newShop, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Район / Город
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Бостандыкский р-н"
                    value={newShop.district}
                    onChange={(e) => setNewShop({ ...newShop, district: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Менеджер точки
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ФИО менеджера"
                    value={newShop.manager}
                    onChange={(e) => setNewShop({ ...newShop, manager: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2.5 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
                >
                  Добавить точку
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
