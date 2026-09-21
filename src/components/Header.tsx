import React, { useState } from 'react';
import { Clock, Compass, Crown, ChevronDown, ShieldCheck, Store, Map, HardHat } from 'lucide-react';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';
import { UserRole } from '../types';

// Экраны, между которыми переключается Владелец. Он — единственная по-настоящему
// подтверждённая личность в приложении, поэтому ему можно смотреть любой кабинет; у
// остальных ролей переключения нет вовсе: устройство закреплено за той ролью, которую
// одобрили при регистрации.
const OWNER_VIEWS: { role: UserRole; short: string; label: string; hint: string; Icon: typeof Crown }[] = [
  {
    role: 'owner',
    short: 'Цех',
    label: 'Управляющий производством',
    hint: 'Заявки сети, чек-листы, персонал, точки',
    Icon: ShieldCheck,
  },
  {
    role: 'manager',
    short: 'Точка',
    label: 'Менеджер точки',
    hint: 'Экран заказа: выбор товаров для одной точки',
    Icon: Store,
  },
  {
    role: 'territorial',
    short: 'Терр.',
    label: 'Территориальный управляющий',
    hint: 'Его точки — до 5 — и заявки по ним',
    Icon: Map,
  },
  {
    role: 'employee',
    short: 'Сотрудник',
    label: 'Сотрудник цеха',
    hint: 'Свой табель: смены и заработок',
    Icon: HardHat,
  },
];

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  submittedCount: number;
  totalShops: number;
  selectedShopName?: string;
  onOpenSubmittedOrdersModal?: () => void;
  currentTerritorialManagerName?: string;
  isOwnerVerified?: boolean;
  orderDeadline: string;
  // Есть только у владельца и заведующего производством — им дедлайн можно двигать.
  onEditDeadline?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  submittedCount,
  totalShops,
  selectedShopName,
  onOpenSubmittedOrdersModal,
  currentTerritorialManagerName,
  isOwnerVerified,
  orderDeadline,
  onEditDeadline,
}) => {
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

  const percentage = Math.round((submittedCount / totalShops) * 100);

  const hasOwnerSwitch = isOwnerVerified && OWNER_VIEWS.some((v) => v.role === currentRole);

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row items-center py-2.5 gap-3">

          {/* Croissant Logo Icon */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center">
            <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-full h-full object-contain" />
          </div>

          {/* Brand title. The Owner's view switch takes real width, and with both on a 360px
              phone the wordmark wrapped to two lines and pushed the controls off the edge —
              so for the Owner it gives way on small screens. Everyone else keeps it. */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <h1
              className={`font-brand text-lg sm:text-xl tracking-[0.1em] text-center text-indigo-950 truncate ${
                hasOwnerSwitch ? 'hidden sm:block' : ''
              }`}
            >
              Master Bakery
            </h1>
          </div>

          {/* Right side: Live Time & Discipline Bar + Executive Access */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Center Info: Live Time & Discipline Bar */}
            <div className="hidden md:flex items-center space-x-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              {onEditDeadline ? (
                <button
                  onClick={onEditDeadline}
                  title="Изменить время приёма заявок"
                  className="flex items-center space-x-1.5 text-slate-600 font-medium hover:bg-slate-200/60 px-1.5 py-0.5 rounded transition-all"
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Дедлайн: <strong className="text-slate-900 underline decoration-dotted underline-offset-2">{orderDeadline}</strong></span>
                </button>
              ) : (
                <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Дедлайн: <strong className="text-slate-900">{orderDeadline}</strong></span>
                </div>
              )}
              <div className="h-4 w-px bg-slate-200" />
              <button
                onClick={onOpenSubmittedOrdersModal}
                className="flex items-center space-x-2 hover:bg-slate-200/60 px-2 py-0.5 rounded transition-all cursor-pointer group"
                title="Открыть список подавших заявку кофеен"
              >
                <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-indigo-900">Подано:</span>
                <span className="font-bold text-emerald-600">{submittedCount}/{totalShops}</span>
                <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </button>
            </div>

            {/* Executive Access Button / Executive Active State */}
            <div className="flex items-center space-x-2">
              {/* Переключатель экранов Владельца. Он заменил отдельную кнопку «вход для
                  Владельца»: раз личность подтверждена Telegram, любой кабинет ему открыт, и
                  отдельного «входа» не требуется. У остальных ролей переключения нет —
                  устройство закреплено за тем, что одобрили при регистрации. */}
              {hasOwnerSwitch && (
                <div className="relative">
                  <button
                    onClick={() => setIsViewMenuOpen((open) => !open)}
                    className="flex items-center gap-1.5 min-h-[44px] pl-2 pr-2.5 bg-amber-50 border border-amber-200 rounded-xl shadow-2xs text-amber-800 hover:bg-amber-100 active:bg-amber-200 transition-colors cursor-pointer"
                    title="Переключить экран"
                  >
                    <Crown className="w-4 h-4 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap">
                      {OWNER_VIEWS.find((v) => v.role === currentRole)?.short || 'Экран'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${isViewMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isViewMenuOpen && (
                    <>
                      {/* Ловим нажатие мимо меню, чтобы оно закрывалось. */}
                      <div className="fixed inset-0 z-40" onClick={() => setIsViewMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                        <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Смотреть как
                        </p>
                        {OWNER_VIEWS.map((v) => (
                          <button
                            key={v.role}
                            onClick={() => {
                              onRoleChange(v.role);
                              setIsViewMenuOpen(false);
                            }}
                            className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                              currentRole === v.role ? 'bg-amber-50' : 'hover:bg-slate-50 active:bg-slate-100'
                            }`}
                          >
                            <v.Icon
                              className={`w-4 h-4 mt-0.5 shrink-0 ${
                                currentRole === v.role ? 'text-amber-700' : 'text-slate-400'
                              }`}
                            />
                            <span className="min-w-0">
                              <span
                                className={`block text-sm font-bold leading-tight ${
                                  currentRole === v.role ? 'text-amber-900' : 'text-slate-900'
                                }`}
                              >
                                {v.label}
                              </span>
                              <span className="block text-[11px] text-slate-500 mt-0.5">{v.hint}</span>
                            </span>
                          </button>
                        ))}

                      </div>
                    </>
                  )}
                </div>
              )}

              {currentRole === 'territorial' && (
                <div className="flex items-center space-x-1.5 bg-indigo-50 border border-indigo-200 p-1 rounded-xl shadow-2xs">
                  <div className="px-1.5 text-indigo-700 flex items-center gap-1" title="Территориальный управляющий">
                    <Compass className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-bold hidden sm:inline whitespace-nowrap">
                      {currentTerritorialManagerName}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};

