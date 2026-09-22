import React, { useState } from 'react';
import { CoffeeShop, Product, ShopOrder, SemiFinishedProduct, DishCosting, StaffMember, RegistrationRequest, AdvanceRequest, RawMaterial, ChecklistAssignments, RolePermissions } from '../types';
import { PrintChecklistsModal } from './PrintChecklistsModal';
import { PRODUCTS as DEMO_PRODUCTS } from '../data/mockData';
import { CostingsManager } from './CostingsManager';
import { PersonnelManager } from './PersonnelManager';
import { SalesPointsManager } from './SalesPointsManager';
import { RolePermissionsModal } from './RolePermissionsModal';
import { TimesheetManager } from './TimesheetManager';
import { DishPollsManager } from './DishPollsManager';
import { OrderHistoryDaysModal } from './OrderHistoryDaysModal';
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
  CalendarCheck,
  History,
  X,
  Crown,
  HandCoins,
  Vote,
  Clock
} from 'lucide-react';

// Все цеха, у которых есть чек-лист. Раньше в меню было вписано вручную только четыре из шести,
// и «Сэндвичи и завтраки» с «Новинками» распечатать было нельзя вовсе.
type ChecklistDeptKey = 'bakery' | 'sandwiches' | 'desserts' | 'bar_prep' | 'kitchen_prep' | 'new_items';
const CHECKLIST_DEPTS: { key: ChecklistDeptKey; icon: string; label: string }[] = [
  { key: 'bakery', icon: '🥐', label: 'Круассаны и слойки' },
  { key: 'sandwiches', icon: '🥪', label: 'Сэндвичи и завтраки' },
  { key: 'desserts', icon: '🍰', label: 'Кондитерка (Десерты)' },
  { key: 'bar_prep', icon: '🧃', label: 'Заготовки Бара' },
  { key: 'kitchen_prep', icon: '👨‍🍳', label: 'Заготовки Кухни' },
  { key: 'new_items', icon: '⚡', label: 'Новинки (колд-брю)' },
];

interface AdminViewProps {
  orderDeadline: string;
  onEditDeadline: () => void;
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
  semiFinishedList: SemiFinishedProduct[];
  dishCostings: Record<string, DishCosting>;
  onUpdateSemiFinished: (list: SemiFinishedProduct[]) => void;
  onUpdateDishCostings: (costings: Record<string, DishCosting>) => void;
  onUpdateProduct: (productId: string, updates: Partial<Product>) => void;
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  rawMaterials: RawMaterial[];
  setRawMaterials: React.Dispatch<React.SetStateAction<RawMaterial[]>>;
  rawCategoryDefs: { key: string; label: string }[];
  setRawCategoryDefs: React.Dispatch<React.SetStateAction<{ key: string; label: string }[]>>;
  semiCategoryDefs: { key: string; label: string }[];
  setSemiCategoryDefs: React.Dispatch<React.SetStateAction<{ key: string; label: string }[]>>;
  dishCategoryDefs: { key: string; label: string }[];
  setDishCategoryDefs: React.Dispatch<React.SetStateAction<{ key: string; label: string }[]>>;
  checklistAssignments: ChecklistAssignments;
  onUpdateChecklistAssignments: (next: ChecklistAssignments) => void;
  staff: StaffMember[];
  registrationRequests: RegistrationRequest[];
  advanceRequests: AdvanceRequest[];
  onUpdateStaffMember: (staffId: string, updates: Partial<StaffMember>) => void;
  onUpdateRegistrationRequest: (requestId: string, updates: Partial<RegistrationRequest>) => void;
  onApproveRegistrationRequest: (requestId: string) => void;
  onRejectRegistrationRequest: (requestId: string) => void;
  onDecideAdvanceRequest: (requestId: string, status: 'approved' | 'rejected') => void;
  onAddShop: (data: { address: string; manager: string; district: string }) => void;
  onUpdateShop: (shopId: number, updates: Partial<Pick<CoffeeShop, 'district' | 'address'>>) => void;
  onAddStaffMember: (member: Omit<StaffMember, 'id'>) => void;
  onDeleteStaffMember: (staffId: string) => void;
  onAssignTerritorialManager: (shopId: number, staffId: string) => void;
  onUnassignTerritorialManager: (shopId: number) => void;
  onAcceptAllOrders: () => void;
  onSendRemindersAll: () => void;
  telegramInitData: string;
  onOpenSubmittedOrdersModal?: () => void;
  isOwner?: boolean;
  actorName: string;
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
  onAddProduct,
  onDeleteProduct,
  rawMaterials,
  setRawMaterials,
  rawCategoryDefs,
  setRawCategoryDefs,
  semiCategoryDefs,
  setSemiCategoryDefs,
  dishCategoryDefs,
  setDishCategoryDefs,
  checklistAssignments,
  onUpdateChecklistAssignments,
  staff,
  registrationRequests,
  advanceRequests,
  onUpdateStaffMember,
  onUpdateRegistrationRequest,
  onApproveRegistrationRequest,
  onRejectRegistrationRequest,
  onDecideAdvanceRequest,
  onAddShop,
  onUpdateShop,
  onAddStaffMember,
  onDeleteStaffMember,
  onAssignTerritorialManager,
  onUnassignTerritorialManager,
  onAcceptAllOrders,
  onSendRemindersAll,
  telegramInitData,
  onOpenSubmittedOrdersModal,
  isOwner,
  actorName,
  permissions,
  onUpdateRolePermissions,
  orderDeadline,
  onEditDeadline,
}) => {
  const [selectedPrintDept, setSelectedPrintDept] = useState<ChecklistDeptKey | null>(null);
  const [isChecklistsMenuOpen, setIsChecklistsMenuOpen] = useState(false);
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [isSalesPointsModalOpen, setIsSalesPointsModalOpen] = useState(false);
  const [isCostingsModalOpen, setIsCostingsModalOpen] = useState(false);
  const [isTimesheetOpen, setIsTimesheetOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isDishPollsOpen, setIsDishPollsOpen] = useState(false);
  const [isHistoryDaysOpen, setIsHistoryDaysOpen] = useState(false);
  const [isRolePermissionsOpen, setIsRolePermissionsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Owner always has every capability; admin is gated by the permission matrix
  // the Owner configures (defaults to "everything on", matching pre-existing behavior).
  const canDo = (key: keyof RolePermissions['admin']) => !!isOwner || permissions.admin[key];
  const pendingRequestsCount = registrationRequests.filter((r) => r.status === 'pending').length;
  const pendingAdvanceCount = advanceRequests.filter((r) => r.status === 'pending').length;

  // Compute stats
  const allOrdersList = Object.values(orders) as ShopOrder[];
  const submittedCount = allOrdersList.filter(
    (o) => o.status === 'submitted' || o.status === 'accepted'
  ).length;
  const acceptedCount = allOrdersList.filter((o) => o.status === 'accepted').length;

  // Сколько чего заказано сегодня — по тем же заявкам, что берёт чек-лист (отправленные и принятые).
  const orderedToday = new Map<string, number>();
  allOrdersList
    .filter((o) => o.status === 'submitted' || o.status === 'accepted')
    .forEach((o) =>
      Object.entries(o.items || {}).forEach(([pid, q]) => {
        const n = Number(q) || 0;
        if (n > 0) orderedToday.set(pid, (orderedToday.get(pid) || 0) + n);
      })
    );
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const deptsOf = (pid: string) =>
    CHECKLIST_DEPTS.filter((d) => (checklistAssignments[d.key] || []).includes(pid)).map((d) => d.label);
  // Блюдо из каталога, не привязанное ни к одному цеху, — в чек-лист не попадёт.
  const notAssignedToday = [...orderedToday]
    .filter(([pid]) => productName.has(pid) && deptsOf(pid).length === 0)
    .map(([pid, qty]) => ({ id: pid, name: productName.get(pid) as string, qty }))
    .sort((a, b) => b.qty - a.qty);
  // Позиция, которой вообще нет в каталоге, — это встроенный в приложение демо-список: у точки не
  // загрузился настоящий каталог, и она заказала из него. Показываем человеческое название из
  // демо-списка (а не служебный код) и какая точка это заказала — чтобы было кому позвонить.
  const demoName = new Map(DEMO_PRODUCTS.map((p) => [p.id, p.name]));
  const notInCatalogToday = [...orderedToday]
    .filter(([pid]) => !productName.has(pid))
    .map(([pid, qty]) => ({
      id: pid,
      name: demoName.get(pid) || pid,
      qty,
      shops: shops
        .filter((s) => {
          const o = orders[s.id];
          return o && (o.status === 'submitted' || o.status === 'accepted') && (Number(o.items?.[pid]) || 0) > 0;
        })
        .map((s) => s.district?.trim() || s.address),
    }))
    .sort((a, b) => b.qty - a.qty);
  const notInCatalogShops = [...new Set(notInCatalogToday.flatMap((m) => m.shops))];
  // Кто именно отправил такие заявки и как с ним связаться — чтобы было кому позвонить.
  const notInCatalogSenders = shops
    .filter((s) => {
      const o = orders[s.id];
      return (
        o &&
        (o.status === 'submitted' || o.status === 'accepted') &&
        Object.keys(o.items || {}).some((pid) => !productName.has(pid) && (Number(o.items[pid]) || 0) > 0)
      );
    })
    .map((s) => {
      const o = orders[s.id];
      const person = staff.find((m) => m.shopId === s.id && m.name === o.managerName);
      return {
        shopId: s.id,
        shop: s.district?.trim() || s.address,
        who: o.managerName || 'имя не указано',
        at: o.submittedAt,
        phone: person?.phone,
        accepted: o.status === 'accepted',
      };
    });
  const inSeveralChecklists = [...orderedToday.keys()]
    .filter((pid) => productName.has(pid) && deptsOf(pid).length > 1)
    .map((pid) => ({ id: pid, name: productName.get(pid), depts: deptsOf(pid) }));
  const pendingCount = 27 - submittedCount;

  let networkAnomalies = 0;
  allOrdersList.forEach((order) => {
    if ((order.status === 'submitted' || order.status === 'accepted') && order.anomalies) {
      networkAnomalies += Object.keys(order.anomalies).length;
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
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-center gap-4 border-b border-slate-100 pb-5">
          {/* No whitespace-nowrap: at text-xl this title is wider than a 360px phone and was
              spilling out past both edges of the card. */}
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0" />
            <h2 className="text-base sm:text-xl font-bold tracking-tight uppercase text-indigo-900">Управляющий производством</h2>
          </div>
        </div>

        {/* Дедлайн подачи. В шапке он виден только на широком экране, а двигают его чаще всего
            с телефона — поэтому здесь отдельной заметной кнопкой. */}
        <button
          id="btn-edit-order-deadline"
          onClick={onEditDeadline}
          className="w-full flex items-center justify-between gap-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl px-4 py-3 transition-all"
        >
          <span className="flex items-center gap-2 text-sm text-amber-900">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              Приём заявок до <b className="text-base tabular-nums">{orderDeadline}</b>
            </span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Изменить</span>
        </button>

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

          {/* TILE 3: ИСТОРИЯ ЗАЯВОК. Заменила «общее количество позиций» — те же цифры уже
              стоят в «Заявок подано» рядом, а прошедшие дни посмотреть было негде. */}
          <button
            id="btn-open-order-history-days"
            onClick={() => setIsHistoryDaysOpen(true)}
            className="bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group text-center flex flex-col items-center justify-center"
          >
            <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-indigo-700 block tracking-widest transition-colors">
              История заявок
            </span>
            <History className="w-7 h-7 text-slate-900 mt-1.5" />
            <span className="text-[11px] text-indigo-700 font-bold block mt-1.5">
              по дням
            </span>
          </button>

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
            id="btn-open-timesheet-modal"
            onClick={() => setIsTimesheetOpen(true)}
            disabled={!canDo('manage_personnel')}
            title={!canDo('manage_personnel') ? 'Отключено Владельцем' : undefined}
            className="bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
              Табель
            </span>
            <CalendarCheck className="w-6 h-6 text-slate-900 mt-1.5" />
          </button>

          <button
            id="btn-open-advance-modal"
            onClick={() => setIsAdvanceModalOpen(true)}
            disabled={!canDo('manage_personnel')}
            title={!canDo('manage_personnel') ? 'Отключено Владельцем' : undefined}
            className="relative bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
          >
            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
              Авансы
            </span>
            <HandCoins className="w-6 h-6 text-slate-900 mt-1.5" />
            {pendingAdvanceCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {pendingAdvanceCount}
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
              id="btn-open-dish-polls"
              onClick={() => setIsDishPollsOpen(true)}
              className="bg-slate-50 hover:bg-indigo-50/60 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group shadow-2xs text-center flex flex-col items-center justify-center"
            >
              <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest group-hover:text-indigo-900 transition-colors block">
                Голосования
              </span>
              <Vote className="w-6 h-6 text-slate-900 mt-1.5" />
            </button>
          )}

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
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CHECKLIST_DEPTS.map((d) => {
              const ids = checklistAssignments[d.key] || [];
              const todayQty = ids.reduce((n, id) => n + (orderedToday.get(id) || 0), 0);
              return (
                <button
                  key={d.key}
                  id={`btn-print-${d.key.replace('_', '-')}`}
                  onClick={() => { setSelectedPrintDept(d.key); setIsChecklistsMenuOpen(false); }}
                  className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-left transition-all duration-150 group shadow-sm"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xl">{d.icon}</span>
                    <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                      {ids.length} поз
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs">{d.label}</h4>
                  <p className={`text-[10px] mt-1 ${todayQty > 0 ? 'text-indigo-700 font-bold' : 'text-slate-400'}`}>
                    {todayQty > 0 ? `Сегодня: ${todayQty} шт` : 'Сегодня заказов нет'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Блюдо, которое заказали, но которого нет ни в одном чек-листе, не увидит ни один цех —
              его просто не приготовят. Раньше это ничем не было заметно. */}
          {notAssignedToday.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1.5">
              <p className="font-bold">
                ⚠️ Не привязаны ни к одному цеху: {notAssignedToday.length} поз.,{' '}
                {notAssignedToday.reduce((n, m) => n + m.qty, 0)} шт — их сегодня не увидит ни один цех
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {notAssignedToday.map((m) => (
                  <li key={m.id}>{m.name} — {m.qty} шт</li>
                ))}
              </ul>
              <p className="text-[11px] text-rose-800">
                Чтобы блюдо попало в цех: откройте чек-лист нужного цеха → шестерёнка «Настройки» → добавьте блюдо.
              </p>
            </div>
          )}
          {notInCatalogToday.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-900 space-y-1.5">
              <p className="font-bold">
                ⚠️ Заказаны позиции, которых нет в вашем каталоге: {notInCatalogToday.length} поз.,{' '}
                {notInCatalogToday.reduce((n, m) => n + m.qty, 0)} шт
                {notInCatalogShops.length > 0 && <> — заказала {notInCatalogShops.length === 1 ? 'точка' : 'точки'} {notInCatalogShops.join(', ')}</>}
              </p>
              {notInCatalogSenders.map((s) => (
                <p key={s.shopId} className="bg-white/70 border border-orange-200 rounded-lg px-2.5 py-1.5">
                  Отправил(а): <b>{s.who}</b> ({s.shop}){s.at && <> в {s.at}</>}
                  {s.phone && (
                    <>
                      {' '}· <a href={`tel:+${s.phone.replace(/\D/g, '')}`} className="underline font-bold">+{s.phone.replace(/\D/g, '')}</a>
                    </>
                  )}
                  {s.accepted && <> · <b>заявка уже принята</b></>}
                </p>
              ))}
              <p className="text-[11px] text-orange-800">
                Это позиции из старого демонстрационного списка, встроенного в приложение: у точки не загрузился
                ваш каталог, и она собрала заявку по нему. Ни в один цех они не попадут — уточните у точки, что
                она хотела заказать на самом деле.
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                {notInCatalogToday.map((m) => (
                  <li key={m.id}>
                    {m.name} — {m.qty} шт{notInCatalogShops.length > 1 && m.shops.length > 0 && <> ({m.shops.join(', ')})</>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {inSeveralChecklists.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">Попадают сразу в несколько чек-листов — их могут приготовить дважды:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {inSeveralChecklists.map((m) => (
                  <li key={m.id}>{m.name} — {m.depts.join(', ')}</li>
                ))}
              </ul>
            </div>
          )}
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
              onAddProduct={onAddProduct}
              onDeleteProduct={onDeleteProduct}
              rawMaterials={rawMaterials}
              setRawMaterials={setRawMaterials}
              rawCategoryDefs={rawCategoryDefs}
              setRawCategoryDefs={setRawCategoryDefs}
              semiCategoryDefs={semiCategoryDefs}
              setSemiCategoryDefs={setSemiCategoryDefs}
              dishCategoryDefs={dishCategoryDefs}
              setDishCategoryDefs={setDishCategoryDefs}
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
              onUnassignTerritorialManager={onUnassignTerritorialManager}
            />
          </div>
        </div>
      )}

      {isTimesheetOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <CalendarCheck className="w-5 h-5 text-indigo-600" />
              <span>Табель</span>
            </h2>
            <button
              onClick={() => setIsTimesheetOpen(false)}
              className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <TimesheetManager
              staff={staff}
              telegramInitData={telegramInitData}
              actorName={actorName}
              onUpdateStaffMember={onUpdateStaffMember}
            />
          </div>
        </div>
      )}

      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <HandCoins className="w-5 h-5 text-indigo-600" />
              <span>Авансы</span>
            </h2>
            <button
              onClick={() => setIsAdvanceModalOpen(false)}
              className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-3">
            {advanceRequests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                Заявок на аванс ещё не было.
              </div>
            ) : (
              advanceRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm">{req.staffName}</div>
                    <div className="text-[11px] text-slate-500">
                      Kaspi {req.kaspiPhone} · Подано в {req.submittedAt}
                    </div>
                  </div>

                  <div className="shrink-0 text-lg font-black text-slate-900 tabular-nums">
                    {Math.round(req.amount).toLocaleString('ru-RU')} ₸
                  </div>

                  {req.status === 'pending' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onDecideAdvanceRequest(req.id, 'approved')}
                        className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Одобрить</span>
                      </button>
                      <button
                        onClick={() => onDecideAdvanceRequest(req.id, 'rejected')}
                        className="flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                        title="Отклонить"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`shrink-0 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg ${
                        req.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {req.status === 'approved' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      {req.status === 'approved' ? 'Одобрено' : 'Отклонено'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isDishPollsOpen && isOwner && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <Vote className="w-5 h-5 text-indigo-600" />
              <span>Голосования</span>
            </h2>
            <button
              onClick={() => setIsDishPollsOpen(false)}
              className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 max-w-3xl mx-auto">
            <DishPollsManager telegramInitData={telegramInitData} />
          </div>
        </div>
      )}

      <OrderHistoryDaysModal
        isOpen={isHistoryDaysOpen}
        onClose={() => setIsHistoryDaysOpen(false)}
        shops={shops}
        products={products}
      />

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
