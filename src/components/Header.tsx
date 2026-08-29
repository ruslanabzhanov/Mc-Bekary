import React, { useState } from 'react';
import { ShieldCheck, UserCheck, Clock, Lock, LogOut, KeyRound, X, UserPlus, Compass, Crown } from 'lucide-react';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';
import { CoffeeShop, RegistrationRequest, StaffMember, UserRole } from '../types';
import { RegistrationRequestModal } from './RegistrationRequestModal';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  submittedCount: number;
  totalShops: number;
  selectedShopName?: string;
  onOpenSubmittedOrdersModal?: () => void;
  shops: CoffeeShop[];
  staff: StaffMember[];
  onSubmitRegistrationRequest: (request: Omit<RegistrationRequest, 'id' | 'submittedAt'>) => void;
  onLoginTerritorial: (staffId: string) => void;
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
  staff,
  onSubmitRegistrationRequest,
  onLoginTerritorial,
  currentTerritorialManagerName,
  isOwnerVerified,
}) => {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isTerritorialModalOpen, setIsTerritorialModalOpen] = useState(false);
  const [selectedTerritorialStaffId, setSelectedTerritorialStaffId] = useState('');

  const percentage = Math.round((submittedCount / totalShops) * 100);
  const territorialManagers = staff.filter((s) => s.role === 'territorial_manager');

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode === '1234' || pinCode === '7777' || pinCode.trim() === '') {
      onRoleChange('admin');
      setIsPinModalOpen(false);
      setPinCode('');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleTerritorialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTerritorialStaffId) return;
    onLoginTerritorial(selectedTerritorialStaffId);
    setIsTerritorialModalOpen(false);
    setSelectedTerritorialStaffId('');
  };

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
              {currentRole === 'manager' && (
                <>
                  {isOwnerVerified && (
                    <button
                      id="btn-owner-login"
                      onClick={() => onRoleChange('owner')}
                      className="p-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-900 transition-all shadow-2xs cursor-pointer"
                      title="Вход для Владельца"
                    >
                      <Crown className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    id="btn-admin-login"
                    onClick={() => setIsPinModalOpen(true)}
                    className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-indigo-600 hover:text-indigo-900 transition-all shadow-2xs cursor-pointer"
                    title="Вход для Управляющего Производством"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                  <button
                    id="btn-territorial-login"
                    onClick={() => setIsTerritorialModalOpen(true)}
                    className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-indigo-600 hover:text-indigo-900 transition-all shadow-2xs cursor-pointer"
                    title="Вход для Территориального управляющего"
                  >
                    <Compass className="w-4 h-4" />
                  </button>
                </>
              )}

              {currentRole === 'admin' && (
                <div className="flex items-center space-x-1.5 bg-indigo-50 border border-indigo-200 p-1 rounded-xl shadow-2xs">
                  <div className="p-1 text-indigo-700 flex items-center justify-center" title="Управляющий Производством">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <button
                    onClick={() => onRoleChange('manager')}
                    className="p-1 text-rose-700 hover:text-rose-800 bg-white border border-rose-200 rounded-lg shadow-2xs hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Выйти из режима Управляющего"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                  <button
                    onClick={() => onRoleChange('manager')}
                    className="p-1 text-rose-700 hover:text-rose-800 bg-white border border-rose-200 rounded-lg shadow-2xs hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Выйти из режима Территориального управляющего"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Admin Login PIN Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => {
                setIsPinModalOpen(false);
                setPinError(false);
                setPinCode('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Вход для Управляющего</h3>
              <p className="text-xs text-slate-500 mt-1">
                Доступ к сводной матрице 27 точек, цеховым чек-листам и калькуляции
              </p>

              <form onSubmit={handleAdminLogin} className="w-full mt-5 space-y-4">
                <div>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="ПИН-код (например, 1234)"
                    value={pinCode}
                    onChange={(e) => {
                      setPinCode(e.target.value);
                      setPinError(false);
                    }}
                    className={`w-full text-center text-lg tracking-widest font-bold py-2.5 px-4 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 ${
                      pinError
                        ? 'border-rose-400 focus:ring-rose-400 text-rose-900'
                        : 'border-slate-300 focus:ring-indigo-500 text-slate-900'
                    }`}
                    autoFocus
                  />
                  {pinError && (
                    <p className="text-xs text-rose-600 font-bold mt-1">
                      Неверный ПИН-код. Попробуйте 1234
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    💡 Для быстрого входа используйте код <span className="font-bold text-slate-600">1234</span> или просто нажмите «Войти»
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPinModalOpen(false);
                      setPinError(false);
                      setPinCode('');
                    }}
                    className="w-1/2 py-2.5 text-xs font-bold uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
                  >
                    Войти
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Territorial Manager Login Modal */}
      {isTerritorialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => {
                setIsTerritorialModalOpen(false);
                setSelectedTerritorialStaffId('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">Вход для Территориального управляющего</h3>
              <p className="text-xs text-slate-500 mt-1">
                Выберите, кем вы входите — увидите только свои точки
              </p>

              <form onSubmit={handleTerritorialLogin} className="w-full mt-5 space-y-4">
                <select
                  value={selectedTerritorialStaffId}
                  onChange={(e) => setSelectedTerritorialStaffId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                  autoFocus
                >
                  <option value="">Выберите управляющего...</option>
                  {territorialManagers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name}
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTerritorialModalOpen(false);
                      setSelectedTerritorialStaffId('');
                    }}
                    className="w-1/2 py-2.5 text-xs font-bold uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedTerritorialStaffId}
                    className="w-1/2 py-2.5 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                  >
                    Войти
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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

