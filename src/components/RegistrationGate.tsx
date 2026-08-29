import React, { useEffect, useState } from 'react';
import { UserPlus, Clock, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { CoffeeShop, StaffRole, RegistrationRequest } from '../types';
import { RoleShopFields } from './RoleShopFields';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';

const PENDING_ID_KEY = 'mc-bekary-pending-registration-id';

interface RegistrationGateProps {
  shops: CoffeeShop[];
  registrationRequests: RegistrationRequest[];
  onSubmit: (request: Omit<RegistrationRequest, 'id' | 'submittedAt' | 'status'>) => string;
  onApproved: (shopIdIfManager?: number) => void;
  onRefresh: () => void;
}

const ROLE_LABELS: Record<StaffRole, string> = {
  shop_manager: 'Менеджер точки',
  territorial_manager: 'Территориальный управляющий',
  employee: 'Внутренний сотрудник',
};

export const RegistrationGate: React.FC<RegistrationGateProps> = ({
  shops,
  registrationRequests,
  onSubmit,
  onApproved,
  onRefresh,
}) => {
  const [pendingId, setPendingId] = useState<string | null>(() =>
    window.localStorage.getItem(PENDING_ID_KEY)
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopId, setShopId] = useState<number>(shops[0]?.id || 1);
  const [shopIds, setShopIds] = useState<number[]>([]);
  const [role, setRole] = useState<StaffRole>('shop_manager');

  const myRequest = pendingId ? registrationRequests.find((r) => r.id === pendingId) : null;

  useEffect(() => {
    if (myRequest?.status === 'approved') {
      window.localStorage.removeItem(PENDING_ID_KEY);
      onApproved(myRequest.requestedRole === 'shop_manager' ? myRequest.requestedShopId : undefined);
    }
  }, [myRequest?.status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (role === 'territorial_manager' && shopIds.length === 0) return;
    const newId = onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      requestedShopId: shopId,
      requestedShopIds: role === 'territorial_manager' ? shopIds : undefined,
      requestedRole: role,
    });
    window.localStorage.setItem(PENDING_ID_KEY, newId);
    setPendingId(newId);
  };

  const handleRetry = () => {
    window.localStorage.removeItem(PENDING_ID_KEY);
    setPendingId(null);
  };

  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-sm border border-slate-200 relative">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 flex items-center justify-center mb-3">
            <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-full h-full object-contain" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  // Rejected — offer to submit again
  if (myRequest?.status === 'rejected') {
    return (
      <Shell>
        <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mb-3 border border-rose-200">
          <XCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Заявка отклонена</h3>
        <p className="text-xs text-slate-500 mt-1">
          Управляющий отклонил вашу заявку. Уточните детали и подайте заявку заново, либо обратитесь к управляющему.
        </p>
        <button
          onClick={handleRetry}
          className="mt-5 w-full flex items-center justify-center space-x-1.5 py-2.5 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Подать заявку заново</span>
        </button>
      </Shell>
    );
  }

  // Pending (or freshly submitted, waiting for the data to load) — blocking waiting screen
  if (pendingId) {
    return (
      <Shell>
        <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-3 border border-amber-200">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Заявка на рассмотрении</h3>
        <p className="text-xs text-slate-500 mt-1">
          Управляющий ещё не подтвердил вашу заявку. Как только это произойдёт, приложение откроется само.
        </p>
        {myRequest && (
          <div className="w-full mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs space-y-1">
            <div><span className="text-slate-400">ФИО:</span> <span className="font-bold text-slate-800">{myRequest.name}</span></div>
            <div><span className="text-slate-400">Должность:</span> <span className="font-bold text-slate-800">{ROLE_LABELS[myRequest.requestedRole]}</span></div>
            <div>
              <span className="text-slate-400">{myRequest.requestedShopIds ? 'Точки:' : 'Точка:'}</span>{' '}
              <span className="font-bold text-slate-800">
                {myRequest.requestedShopIds ? myRequest.requestedShopIds.map((id) => `№${id}`).join(', ') : `№${myRequest.requestedShopId}`}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={onRefresh}
          className="mt-5 w-full py-2.5 text-xs font-bold uppercase text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
        >
          Проверить статус
        </button>
      </Shell>
    );
  }

  // No request yet — mandatory registration form
  return (
    <Shell>
      <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
        <UserPlus className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-extrabold text-slate-900">Регистрация</h3>
      <p className="text-xs text-slate-500 mt-1">
        Это устройство ещё не зарегистрировано. Заполните заявку — управляющий подтвердит точку и должность.
      </p>

      <form onSubmit={handleSubmit} className="w-full mt-5 space-y-3 text-left">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">ФИО</label>
          <input
            type="text"
            required
            placeholder="Например: Асель Ким"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Телефон (необязательно)</label>
          <input
            type="tel"
            placeholder="+7 707 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
          />
        </div>

        <RoleShopFields
          shops={shops}
          role={role}
          onRoleChange={setRole}
          shopId={shopId}
          onShopIdChange={setShopId}
          shopIds={shopIds}
          onShopIdsChange={setShopIds}
        />

        <button
          type="submit"
          className="w-full mt-2 py-2.5 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
        >
          Отправить заявку
        </button>
      </form>
    </Shell>
  );
};
