import React, { useState } from 'react';
import { Clock, LogOut, UserPlus, Compass, Crown } from 'lucide-react';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';
import { CoffeeShop, RegistrationRequest, UserRole } from '../types';
import { RegistrationRequestModal } from './RegistrationRequestModal';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  submittedCount: number;
  totalShops: number;
  selectedShopName?: string;
  onOpenSubmittedOrdersModal?: () => void;
  shops: CoffeeShop[];
  onSubmitRegistrationRequest: (request: Omit<RegistrationRequest, 'id' | 'submittedAt' | 'status'>) => void;
  currentTerritorialManagerName?: string;
  isOwnerVerified?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  submittedCount,
  totalShops,
  selectedShopName,
  onOpenSubmittedOrdersModal,
  shops,
  onSubmitRegistrationRequest,
  currentTerritorialManagerName,
  isOwnerVerified,
}) => {
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);

  const percentage = Math.round((submittedCount / totalShops) * 100);

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-row items-center py-2.5 gap-3">

          {/* Croissant Logo Icon */}
          <div className="w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0 flex items-center justify-center">
            <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-full h-full object-contain" />
          </div>

          {/* Brand Title: centered between the icon and the right-side controls */}
          <div className="flex-1 flex items-center justify-center">
            <h1 className="font-brand text-lg sm:text-xl tracking-[0.1em] text-center text-indigo-950">
              Master Bakery
            </h1>
          </div>

          {/* Right side: Live Time & Discipline Bar + Executive Access */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Center Info: Live Time & Discipline Bar */}
            <div className="hidden md:flex items-center space-x-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Дедлайн: <strong className="text-slate-900">10:30</strong></span>
              </div>
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

            {/* Registration Request Entry Point */}
            <button
              id="btn-open-registration-request"
              onClick={() => setIsRegistrationModalOpen(true)}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-indigo-600 hover:text-indigo-900 transition-all shadow-2xs cursor-pointer"
              title="Подать заявку на регистрацию"
            >
              <UserPlus className="w-4 h-4" />
            </button>

            {/* Executive Access Button / Executive Active State */}
            <div className="flex items-center space-x-2">
              {/* Owner access is the one real, Telegram-verified identity — safe to always
                  offer it. Admin (shared PIN) and Territorial (pick-any-name) login were
                  removed: a registered manager/territorial device stays locked to the role
                  it was approved for, with no way to switch into another one. */}
              {currentRole === 'manager' && isOwnerVerified && (
                <button
                  id="btn-owner-login"
                  onClick={() => onRoleChange('owner')}
                  className="p-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-all shadow-2xs cursor-pointer"
                  title="Вход для Владельца"
                >
                  <Crown className="w-4 h-4" />
                </button>
              )}

              {currentRole === 'owner' && (
                <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 p-1 rounded-xl shadow-2xs">
                  <div className="px-1.5 text-amber-700 flex items-center gap-1" title="Владелец">
                    <Crown className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-bold hidden sm:inline whitespace-nowrap">Владелец</span>
                  </div>
                  <button
                    onClick={() => onRoleChange('manager')}
                    className="p-1 text-rose-700 hover:text-rose-800 bg-white border border-rose-200 rounded-lg shadow-2xs hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Выйти из режима Владельца"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
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

      {/* Registration Request Modal */}
      <RegistrationRequestModal
        isOpen={isRegistrationModalOpen}
        onClose={() => setIsRegistrationModalOpen(false)}
        shops={shops}
        onSubmit={onSubmitRegistrationRequest}
      />
    </header>
  );
};

