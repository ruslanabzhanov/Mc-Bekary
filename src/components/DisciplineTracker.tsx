import React, { useState } from 'react';
import { CoffeeShop, ShopOrder, DisciplineNotification } from '../types';
import { Bell, CheckCircle2, Clock, AlertCircle, Send, Search } from 'lucide-react';

interface DisciplineTrackerProps {
  shops: CoffeeShop[];
  orders: Record<number, ShopOrder>;
  notifications: DisciplineNotification[];
  onSendRemindersAll: () => void;
  onSendReminderSingle: (shopId: number) => void;
}

export const DisciplineTracker: React.FC<DisciplineTrackerProps> = ({
  shops,
  orders,
  notifications,
  onSendRemindersAll,
  onSendReminderSingle,
}) => {
  const [filter, setFilter] = useState<'all' | 'submitted' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const submittedShops = shops.filter(
    (s) => orders[s.id] && (orders[s.id].status === 'submitted' || orders[s.id].status === 'accepted')
  );
  const pendingShops = shops.filter(
    (s) => !orders[s.id] || orders[s.id].status === 'draft'
  );

  const filteredShops = shops.filter((s) => {
    const isSubmitted = orders[s.id] && (orders[s.id].status === 'submitted' || orders[s.id].status === 'accepted');
    if (filter === 'submitted' && !isSubmitted) return false;
    if (filter === 'pending' && isSubmitted) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.manager.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      
      {/* Discipline Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Мониторинг дисциплины подачи заявок</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Отслеживание заполнения в реальном времени по 27 точкам сети и авто-уведомления
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="btn-send-reminders-all"
            onClick={onSendRemindersAll}
            disabled={pendingShops.length === 0}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded text-xs uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Напомнить отстающим ({pendingShops.length})</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilter('all')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filter === 'all'
              ? 'bg-slate-100 border-indigo-400 shadow-sm'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Всего точек сети</span>
            <span className="text-xs font-bold text-slate-600">100%</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">27 точек</div>
        </div>

        <div
          onClick={() => setFilter('submitted')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filter === 'submitted'
              ? 'bg-emerald-50 border-emerald-400 shadow-sm'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Подали заявку</span>
            <span className="text-xs font-bold text-emerald-800">
              {Math.round((submittedShops.length / 27) * 100)}%
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {submittedShops.length} точек
          </div>
        </div>

        <div
          onClick={() => setFilter('pending')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            filter === 'pending'
              ? 'bg-amber-50 border-amber-400 shadow-sm'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Отстающие (Ожидают)</span>
            <span className="text-xs font-bold text-amber-800">
              {Math.round((pendingShops.length / 27) * 100)}%
            </span>
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">
            {pendingShops.length} точек
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-wider w-full sm:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded transition-all ${filter === 'all' ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm' : 'text-slate-500'}`}
          >
            Все (27)
          </button>
          <button
            onClick={() => setFilter('submitted')}
            className={`px-3 py-1.5 rounded transition-all ${filter === 'submitted' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
          >
            Сдали ({submittedShops.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded transition-all ${filter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-500'}`}
          >
            Не сдали ({pendingShops.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск кофейни, адреса, менеджера..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-medium text-xs rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Grid of Stores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShops.map((shop) => {
          const order = orders[shop.id];
          const isSubmitted = order && (order.status === 'submitted' || order.status === 'accepted');
          const isAccepted = order && order.status === 'accepted';
          const totalItems = isSubmitted
            ? (Object.values(order.items || {}) as number[]).reduce((a: number, b: number) => a + Number(b), 0)
            : 0;

          return (
            <div
              key={shop.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                isAccepted
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : isSubmitted
                  ? 'bg-indigo-50/40 border-indigo-200'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">Точка №{shop.id}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5 truncate max-w-[210px]" title={shop.address}>
                    📍 {shop.address}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Менеджер точки: <strong className="text-slate-800">{shop.manager}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                      isAccepted
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : isSubmitted
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {isAccepted ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Принято</span>
                      </>
                    ) : isSubmitted ? (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>Сдал ({order.submittedAt})</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        <span>Не сдал</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Status footer for store */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <div>
                  {isSubmitted ? (
                    <span className="text-slate-700 font-medium">
                      Заказано: <strong>{totalItems} шт</strong>
                    </span>
                  ) : (
                    <span className="text-slate-400">Заявка не сформирована</span>
                  )}
                </div>

                {!isSubmitted && (
                  <button
                    id={`btn-remind-single-${shop.id}`}
                    onClick={() => onSendReminderSingle(shop.id)}
                    className="text-[10px] font-bold uppercase text-amber-900 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded transition-colors flex items-center space-x-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Напомнить</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
