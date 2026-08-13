import React, { useState } from 'react';
import { CoffeeShop, Product, ShopOrder, DisciplineNotification, SemiFinishedProduct, DishCosting } from '../types';
import { MatrixTable } from './MatrixTable';
import { DisciplineTracker } from './DisciplineTracker';
import { AiProcurementModal } from './AiProcurementModal';
import { PrintChecklistsModal } from './PrintChecklistsModal';
import { PrintPrepChecklistModal } from './PrintPrepChecklistModal';
import { CostingsManager } from './CostingsManager';
import {
  ShieldCheck,
  Send,
  CheckCircle2,
  Printer,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Zap,
  BarChart3,
  Bell,
  PackageCheck,
  ChefHat,
  Utensils,
  BookOpen
} from 'lucide-react';

interface AdminViewProps {
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
  notifications: DisciplineNotification[];
  semiFinishedList: SemiFinishedProduct[];
  dishCostings: Record<string, DishCosting>;
  onUpdateSemiFinished: (list: SemiFinishedProduct[]) => void;
  onUpdateDishCostings: (costings: Record<string, DishCosting>) => void;
  onAcceptAllOrders: () => void;
  onSendRemindersAll: () => void;
  onSendReminderSingle: (shopId: number) => void;
  onSimulateAll: () => void;
  onOpenSubmittedOrdersModal?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  shops,
  products,
  orders,
  notifications,
  semiFinishedList,
  dishCostings,
  onUpdateSemiFinished,
  onUpdateDishCostings,
  onAcceptAllOrders,
  onSendRemindersAll,
  onSendReminderSingle,
  onSimulateAll,
  onOpenSubmittedOrdersModal,
}) => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'costings' | 'discipline'>('matrix');
  const [selectedPrintDept, setSelectedPrintDept] = useState<'bakery' | 'desserts' | 'sandwiches' | 'bar_prep' | 'kitchen_prep' | 'new_items' | null>(null);
  const [isPrepPrintOpen, setIsPrepPrintOpen] = useState(false);
  const [isAiProcurementOpen, setIsAiProcurementOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold tracking-tight uppercase text-indigo-900">Управляющий производством</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Контроль заказов 27 точек, дисциплины и автоматическая печать цеховых чек-листов
            </p>
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
              <span className="text-xs text-slate-500">из 27 точек ({Math.round((submittedCount/27)*100)}%)</span>
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
              <span className="text-xs text-slate-500">принято</span>
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
              disabled={pendingCount === 0}
              className="flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs tracking-wider shadow-sm transition-all disabled:opacity-50 text-center cursor-pointer"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>Напомнить отстающим ({pendingCount})</span>
            </button>

            <button
              id="btn-accept-all-orders"
              onClick={handleAcceptAll}
              disabled={submittedCount === 0}
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

      {/* 4 DEPARTMENT PRINT CHECKLISTS QUICK ACTION PANEL */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
              <Printer className="w-5 h-5 text-indigo-600" />
              <span>Генерация и печать цеховых чек-листов и заготовок</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Расфасовка готовой продукции по 27 точкам и ведомость заготовки полуфабрикатов на сегодня
            </p>
          </div>

          <button
            id="btn-open-prep-checklist-modal"
            onClick={() => setIsPrepPrintOpen(true)}
            className="flex items-center justify-center space-x-2 bg-indigo-900 hover:bg-black text-white font-bold px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm ring-2 ring-indigo-500/20"
          >
            <ChefHat className="w-4 h-4 text-emerald-400" />
            <span>🔪 Чек-лист Заготовок (Полуфабрикаты)</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Print 1: Bakery */}
          <button
            id="btn-print-bakery"
            onClick={() => setSelectedPrintDept('bakery')}
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

          {/* Print 2: Sandwiches */}
          <button
            id="btn-print-sandwiches"
            onClick={() => setSelectedPrintDept('sandwiches')}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-left transition-all duration-150 group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl">🥪</span>
              <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                14 поз
              </span>
            </div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs">
              Сэндвичи и завтраки
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              Твист, Бейгл, Креп...
            </p>
          </button>

          {/* Print 3: Desserts */}
          <button
            id="btn-print-desserts"
            onClick={() => setSelectedPrintDept('desserts')}
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
            onClick={() => setSelectedPrintDept('bar_prep')}
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
            onClick={() => setSelectedPrintDept('kitchen_prep')}
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

          {/* Print 6: New Items */}
          <button
            id="btn-print-new-items"
            onClick={() => setSelectedPrintDept('new_items')}
            className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-indigo-300 text-left transition-all duration-150 group shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl">⚡</span>
              <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                3 поз
              </span>
            </div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-xs">
              Новинки (Колд-Брю)
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              Черри, Гранат Брю...
            </p>
          </button>
        </div>
      </div>

      {/* ADMIN SUB-TABS (Matrix View vs Costings vs Discipline Monitor) */}
      <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200 space-x-1">
        <button
          id="btn-admin-tab-matrix"
          onClick={() => setActiveTab('matrix')}
          className={`flex-1 py-2 px-4 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'matrix'
              ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Заявки 27 Точек</span>
        </button>

        <button
          id="btn-admin-tab-costings"
          onClick={() => setActiveTab('costings')}
          className={`flex-1 py-2 px-4 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'costings'
              ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Калькуляции Блюд и Полуфабрикатов</span>
        </button>

        <button
          id="btn-admin-tab-discipline"
          onClick={() => setActiveTab('discipline')}
          className={`flex-1 py-2 px-4 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
            activeTab === 'discipline'
              ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Дисциплина Подачи</span>
        </button>
      </div>

      {/* VIEW PANEL CONTENT */}
      {activeTab === 'matrix' && (
        <MatrixTable shops={shops} products={products} orders={orders} />
      )}

      {activeTab === 'costings' && (
        <CostingsManager
          products={products}
          semiFinishedList={semiFinishedList}
          dishCostings={dishCostings}
          onUpdateSemiFinished={onUpdateSemiFinished}
          onUpdateDishCostings={onUpdateDishCostings}
        />
      )}

      {activeTab === 'discipline' && (
        <DisciplineTracker
          shops={shops}
          orders={orders}
          notifications={notifications}
          onSendRemindersAll={onSendRemindersAll}
          onSendReminderSingle={onSendReminderSingle}
        />
      )}

      {/* MODALS */}
      <PrintChecklistsModal
        isOpen={selectedPrintDept !== null}
        onClose={() => setSelectedPrintDept(null)}
        departmentKey={selectedPrintDept}
        shops={shops}
        products={products}
        orders={orders}
      />

      <PrintPrepChecklistModal
        isOpen={isPrepPrintOpen}
        onClose={() => setIsPrepPrintOpen(false)}
        shops={shops}
        products={products}
        orders={orders}
        semiFinishedList={semiFinishedList}
        dishCostings={dishCostings}
      />

      <AiProcurementModal
        isOpen={isAiProcurementOpen}
        onClose={() => setIsAiProcurementOpen(false)}
      />

    </div>
  );
};
