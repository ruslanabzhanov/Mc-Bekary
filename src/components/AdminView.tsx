import React, { useState } from 'react';
import { CoffeeShop, Product, ShopOrder, SemiFinishedProduct, DishCosting, StaffMember, RegistrationRequest, RawMaterial, ChecklistAssignments, RolePermissions } from '../types';
import { AiProcurementModal } from './AiProcurementModal';
import { PrintChecklistsModal } from './PrintChecklistsModal';
import { CostingsManager } from './CostingsManager';
import { PersonnelManager } from './PersonnelManager';
import { SalesPointsManager } from './SalesPointsManager';
import { RolePermissionsModal } from './RolePermissionsModal';
import {
  ShieldCheck,
  Send,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Zap,
  PackageCheck,
  ChefHat,
  Utensils,
  BookOpen,
  ChevronDown,
  Wrench,
  Users,
  Printer,
  Store,
  X,
  Crown
} from 'lucide-react';

interface AdminViewProps {
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
  semiFinishedList: SemiFinishedProduct[];
  dishCostings: Record<string, DishCosting>;
  onUpdateSemiFinished: (list: SemiFinishedProduct[]) => void;
  onUpdateDishCostings: (costings: Record<string, DishCosting>) => void;
  onUpdateProduct: (productId: string, updates: Partial<Product>) => void;
  rawMaterials: RawMaterial[];
  setRawMaterials: React.Dispatch<React.SetStateAction<RawMaterial[]>>;
  rawCategoryDefs: { key: string; label: string }[];
  setRawCategoryDefs: React.Dispatch<React.SetStateAction<{ key: string; label: string }[]>>;
  semiCategoryDefs: { key: string; label: string }[];
  setSemiCategoryDefs: React.Dispatch<React.SetStateAction<{ key: string; label: string }[]>>;
  checklistAssignments: ChecklistAssignments;
  onUpdateChecklistAssignments: (next: ChecklistAssignments) => void;
  staff: StaffMember[];
  registrationRequests: RegistrationRequest[];
  onUpdateStaffMember: (staffId: string, updates: Partial<StaffMember>) => void;
  onUpdateRegistrationRequest: (requestId: string, updates: Partial<RegistrationRequest>) => void;
  onApproveRegistrationRequest: (requestId: string) => void;
  onRejectRegistrationRequest: (requestId: string) => void;
  onAddShop: (data: { address: string; manager: string; district: string }) => void;
  onUpdateShop: (shopId: number, updates: Partial<Pick<CoffeeShop, 'district' | 'address'>>) => void;
  onAddStaffMember: (member: Omit<StaffMember, 'id'>) => void;
  onDeleteStaffMember: (staffId: string) => void;
  onAssignTerritorialManager: (shopId: number, staffId: string) => void;
  onAcceptAllOrders: () => void;
  onSendRemindersAll: () => void;
  onSimulateAll: () => void;
  onOpenSubmittedOrdersModal?: () => void;
  isOwner?: boolean;
  permissions: RolePermissions;
  onUpdateRolePermissions: (permissions: RolePermissions) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  shops,
  products,
  orders,
  semiFinishedList,
  dishCostings,
  onUpdateSemiFinished,
  onUpdateDishCostings,
  onUpdateProduct,
  rawMaterials,
  setRawMaterials,
  rawCategoryDefs,
  setRawCategoryDefs,
  semiCategoryDefs,
  setSemiCategoryDefs,
  checklistAssignments,
  onUpdateChecklistAssignments,
  staff,
  registrationRequests,
  onUpdateStaffMember,
  onUpdateRegistrationRequest,
  onApproveRegistrationRequest,
  onRejectRegistrationRequest,
  onAddShop,
  onUpdateShop,
  onAddStaffMember,
  onDeleteStaffMember,
  onAssignTerritorialManager,
  onAcceptAllOrders,
  onSendRemindersAll,
  onSimulateAll,
  onOpenSubmittedOrdersModal,
  isOwner,
  permissions,
  onUpdateRolePermissions,
}) => {
  const [selectedPrintDept, setSelectedPrintDept] = useState<'bakery' | 'desserts' | 'bar_prep' | 'kitchen_prep' | null>(null);
  const [isChecklistsMenuOpen, setIsChecklistsMenuOpen] = useState(false);
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [isSalesPointsModalOpen, setIsSalesPointsModalOpen] = useState(false);
  const [isCostingsModalOpen, setIsCostingsModalOpen] = useState(false);
  const [isAiProcurementOpen, setIsAiProcurementOpen] = useState(false);
  const [isRolePermissionsOpen, setIsRolePermissionsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Owner always has every capability; admin is gated by the permission matrix
  // the Owner configures (defaults to "everything on", matching pre-existing behavior).
  const canDo = (key: keyof RolePermissions['admin']) => !!isOwner || permissions.admin[key];
  const pendingRequestsCount = registrationRequests.filter((r) => r.status === 'pending').length;

  // Compute stats
  const allOrdersList = Object.values(orders) as ShopOrder[];
  const submittedCount = allOrdersList.filter(
    (o) => o.status === 'submitted' || o.status === 'accepted'
  ).length;
  const acceptedCount = allOrdersList.filter((o) => o.status === 'accepted').length;
  const pendingCount = 27 - submittedCount;

  // Total pcs & cost
  let grandTotalPcs = 0;
  let grandTotalSum = 0;
  let networkAnomalies = 0;

  allOrdersList.forEach((order) => {
    if (order.status === 'submitted' || order.status === 'accepted') {
      if (order.anomalies) {
        networkAnomalies += Object.keys(order.anomalies).length;
      }
      Object.entries(order.items || {}).forEach(([pId, qtyVal]) => {
        const qty = Number(qtyVal) || 0;
        const p = products.find((prod) => prod.id === pId);
        if (p && qty > 0) {
          grandTotalPcs += qty;
          grandTotalSum += qty * p.price;
        }
      });
    }
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAcceptAll = () => {
    onAcceptAllOrders();
    showToast('✅ Все поданные заявки (27 кофеен) успешно подтверждены!');
  };

  const handleSendReminders = () => {
    onSendRemindersAll();
    showToast(`🔔 Уведомления-напоминания отправлены ${pendingCount} не сдавшим кофейням!`);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-xl flex items-center space-x-2 animate-bounce border border-indigo-500">
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-xs uppercase tracking-wide">{toastMessage}</span>
        </div>
      )}

      {/* TOP DASHBOARD METRIC CARDS & ACTIONS */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-center gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-2 whitespace-nowrap">
            <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0" />
            <h2 className="text-xl font-bold tracking-tight uppercase text-indigo-900">Управляющий производством</h2>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* TILE 1: ЗАЯВОК ПОДАНО */}
          <div 
            onClick={onOpenSubmittedOrdersModal}
            className="bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center"
            title="Нажмите, чтобы открыть список: какая точка, кто подал, во сколько и статус"
          >
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
              Заявок подано
            </span>
            <div className="flex items-baseline space-x-2 mt-1 justify-center">
              <span className="text-2xl font-black text-slate-900">{submittedCount}</span>
              <span className="text-2xl font-black text-slate-900">из 27</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded mt-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-500"
                style={{ width: `${(submittedCount / 27) * 100}%` }}
              />
            </div>
          </div>

          {/* TILE 2: СТАТУС ПРИЕМА УПРАВЛЯЮЩИМ */}
          <div 
            onClick={onOpenSubmittedOrdersModal}
            className="bg-slate-50 hover:bg-emerald-50/60 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center"
            title="Нажмите, чтобы открыть реестр и принять или отклонить заявки"
          >
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest group-hover:text-emerald-900 transition-colors block">
              Статус приема
            </span>
            <div className="flex items-baseline space-x-2 mt-1 justify-center">
              <span className="text-2xl font-black text-emerald-600">{acceptedCount}</span>
              <span className="text-2xl font-black text-emerald-600">из 27</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium block mt-1">
              Ожидают подтверждения: {submittedCount - acceptedCount}
            </span>
          </div>

          {/* TILE 3: ОБЩЕЕ КОЛИЧЕСТВО ПОЗИЦИЙ */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center flex flex-col items-center justify-center">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">
              Общее количество позиций
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {grandTotalPcs} <span className="text-xs text-slate-500 font-normal">шт</span>
            </div>
            <span className="text-[11px] text-indigo-700 font-bold block mt-1">
              Сумма: {grandTotalSum.toLocaleString('ru-RU')} ₸
            </span>
          </div>

          {/* TILE 4: АНОМАЛИЯ В ЗАЯВКЕ */}
          <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 shadow-sm text-center flex flex-col items-center justify-center">
            <span className="text-[10px] font-black uppercase text-rose-700 block tracking-widest">
              Аномалия в заявке
            </span>
            <div className="text-2xl font-black text-rose-900 mt-1">
              {networkAnomalies} <span className="text-xs text-rose-700 font-normal">сигналов</span>
            </div>
            <span className="text-[11px] text-rose-800 font-medium block mt-1">
              Авто-детекция ИИ по нормативам
            </span>
          </div>

        </div>

        {/* PRIMARY ACTION BUTTONS BAR */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
            <button
              id="btn-send-reminders"
              onClick={handleSendReminders}
              disabled={pendingCount === 0 || !canDo('send_reminders')}
              title={!canDo('send_reminders') ? 'Отключено Владельцем' : undefined}
              className="flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs tracking-wider shadow-sm transition-all disabled:opacity-50 text-center cursor-pointer"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>Напомнить отстающим ({pendingCount})</span>
            </button>

            <button
              id="btn-accept-all-orders"
              onClick={handleAcceptAll}
              disabled={submittedCount === 0 || !canDo('accept_reject_orders')}
              title={!canDo('accept_reject_orders') ? 'Отключено Владельцем' : undefined}
              className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs tracking-wider shadow-sm transition-all disabled:opacity-50 text-center cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Принять все заявки</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 text-right hidden lg:block font-medium">
            Автоматический учет заказов и разделение по цехам
          </div>
        </div>

      </div>

      {/* УПРАВЛЕНИЕ ЦЕХОМ */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
          <Wrench className="w-5 h-5 text-indigo-600" />
          <span>Управление цехом</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            id="btn-toggle-checklists"
            onClick={() => setIsChecklistsMenuOpen((open) => !open)}
            disabled={!canDo('manage_checklists')}
            title={!canDo('manage_checklists') ? 'Отключено Владельцем' : undefined}
            className="bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
              Чек-листы
            </span>
            <div className="flex items-center justify-center mt-1.5 space-x-1">
              <Printer className="w-6 h-6 text-slate-900" />
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isChecklistsMenuOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          <button
            id="btn-open-costings-modal"
            onClick={() => setIsCostingsModalOpen(true)}
            disabled={!canDo('manage_costings')}
            title={!canDo('manage_costings') ? 'Отключено Владельцем' : undefined}
            className="bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
              Блюда и ТКК
            </span>
            <ChefHat className="w-6 h-6 text-slate-900 mt-1.5" />
          </button>

          <button
            id="btn-open-personnel-modal"
            onClick={() => setIsPersonnelModalOpen(true)}
            disabled={!canDo('manage_personnel')}
            title={!canDo('manage_personnel') ? 'Отключено Владельцем' : undefined}
            className="relative bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
              Сотрудники
            </span>
            <Users className="w-6 h-6 text-slate-900 mt-1.5" />
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button
            id="btn-open-sales-points-modal"
            onClick={() => setIsSalesPointsModalOpen(true)}
            disabled={!canDo('manage_sales_points')}
            title={!canDo('manage_sales_points') ? 'Отключено Владельцем' : undefined}
            className="bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
              Точки ({shops.length})
            </span>
            <Store className="w-6 h-6 text-slate-900 mt-1.5" />
          </button>

          {isOwner && (
            <button
              id="btn-open-role-permissions"
              onClick={() => setIsRolePermissionsOpen(true)}
              className="bg-amber-50 hover:bg-amber-100 p-4 rounded-xl border border-amber-200 hover:border-amber-400 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center"
            >
              <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest group-hover:text-amber-900 transition-colors block">
                Роли и права
              </span>
              <Crown className="w-6 h-6 text-amber-700 mt-1.5" />
            </button>
          )}
        </div>

        {isChecklistsMenuOpen && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Print 1: Bakery */}
          <button
            id="btn-print-bakery"
            onClick={() => { setSelectedPrintDept('bakery'); setIsChecklistsMenuOpen(false); }}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-left transition-all duration-150 group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl">🥐</span>
              <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                6 поз
              </span>
            </div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs">
              Круассаны и слойки
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              Миндальный, Фисташковый...
            </p>
          </button>

          {/* Print 3: Desserts */}
          <button
            id="btn-print-desserts"
            onClick={() => { setSelectedPrintDept('desserts'); setIsChecklistsMenuOpen(false); }}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-left transition-all duration-150 group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl">🍰</span>
              <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                15 поз
              </span>
            </div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs">
              Кондитерка (Десерты)
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              Чизкейки, Медовик...
            </p>
          </button>

          {/* Print 4: Bar Prep */}
          <button
            id="btn-print-bar-prep"
            onClick={() => { setSelectedPrintDept('bar_prep'); setIsChecklistsMenuOpen(false); }}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-left transition-all duration-150 group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl">🧃</span>
              <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                12 поз
              </span>
            </div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs">
              Заготовки Бара
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              Сиропы, Сырная пена...
            </p>
          </button>

          {/* Print 5: Kitchen Prep */}
          <button
            id="btn-print-kitchen-prep"
            onClick={() => { setSelectedPrintDept('kitchen_prep'); setIsChecklistsMenuOpen(false); }}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-left transition-all duration-150 group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl">👨‍🍳</span>
              <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                8 поз
              </span>
            </div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs">
              Заготовки Кухни
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              Полуфабрикат котлет...
            </p>
          </button>
        </div>
        )}
      </div>

      {/* CALCULATIONS FULLSCREEN WINDOW */}
      {isCostingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <ChefHat className="w-5 h-5 text-indigo-600" />
              <span>Блюда и ТКК</span>
            </h2>
            <button
              onClick={() => setIsCostingsModalOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <CostingsManager
              products={products}
              semiFinishedList={semiFinishedList}
              dishCostings={dishCostings}
              onUpdateSemiFinished={onUpdateSemiFinished}
              onUpdateDishCostings={onUpdateDishCostings}
              onUpdateProduct={onUpdateProduct}
              rawMaterials={rawMaterials}
              setRawMaterials={setRawMaterials}
              rawCategoryDefs={rawCategoryDefs}
              setRawCategoryDefs={setRawCategoryDefs}
              semiCategoryDefs={semiCategoryDefs}
              setSemiCategoryDefs={setSemiCategoryDefs}
            />
          </div>
        </div>
      )}

      {/* PERSONNEL FULLSCREEN WINDOW */}
      {isPersonnelModalOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Персонал</span>
            </h2>
            <button
              onClick={() => setIsPersonnelModalOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <PersonnelManager
              shops={shops}
              staff={staff}
              registrationRequests={registrationRequests}
              onUpdateStaffMember={onUpdateStaffMember}
              onUpdateRegistrationRequest={onUpdateRegistrationRequest}
              onApproveRegistrationRequest={onApproveRegistrationRequest}
              onRejectRegistrationRequest={onRejectRegistrationRequest}
            />
          </div>
        </div>
      )}

      {/* SALES POINTS FULLSCREEN WINDOW */}
      {isSalesPointsModalOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <Store className="w-5 h-5 text-indigo-600" />
              <span>Точки продаж</span>
            </h2>
            <button
              onClick={() => setIsSalesPointsModalOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <SalesPointsManager
              shops={shops}
              orders={orders}
              products={products}
              staff={staff}
              onAddShop={onAddShop}
              onUpdateShop={onUpdateShop}
              onAddStaffMember={onAddStaffMember}
              onDeleteStaffMember={onDeleteStaffMember}
              onAssignTerritorialManager={onAssignTerritorialManager}
            />
          </div>
        </div>
      )}

      {/* MODALS */}
      <PrintChecklistsModal
        isOpen={selectedPrintDept !== null}
        onClose={() => setSelectedPrintDept(null)}
        departmentKey={selectedPrintDept}
        shops={shops}
        products={products}
        orders={orders}
        checklistAssignments={checklistAssignments}
        onUpdateChecklistAssignments={onUpdateChecklistAssignments}
        dishCostings={dishCostings}
        semiFinishedList={semiFinishedList}
        rawMaterials={rawMaterials}
      />

      <AiProcurementModal
        isOpen={isAiProcurementOpen}
        onClose={() => setIsAiProcurementOpen(false)}
      />

      {isOwner && (
        <RolePermissionsModal
          isOpen={isRolePermissionsOpen}
          onClose={() => setIsRolePermissionsOpen(false)}
          permissions={permissions}
          onSave={onUpdateRolePermissions}
        />
      )}

    </div>
  );
};
