import React, { useState } from 'react';
import { CoffeeShop, StaffRole, RegistrationRequest } from '../types';
import { UserPlus, X, CheckCircle2 } from 'lucide-react';

interface RegistrationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  shops: CoffeeShop[];
  onSubmit: (request: Omit<RegistrationRequest, 'id' | 'submittedAt'>) => void;
}

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'employee', label: 'Внутренний сотрудник' },
  { value: 'territorial_manager', label: 'Территориальный управляющий' },
  { value: 'shop_manager', label: 'Менеджер точки' }
];

export const RegistrationRequestModal: React.FC<RegistrationRequestModalProps> = ({
  isOpen,
  onClose,
  shops,
  onSubmit
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [shopId, setShopId] = useState<number>(shops[0]?.id || 1);
  const [role, setRole] = useState<StaffRole>('employee');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setName('');
      setPhone('');
      setRole('employee');
      setIsSubmitted(false);
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), phone: phone.trim() || undefined, requestedShopId: shopId, requestedRole: role });
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {isSubmitted ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-3 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Заявка отправлена</h3>
            <p className="text-xs text-slate-500 mt-1">
              Управляющий рассмотрит вашу заявку и подтвердит точку и должность.
            </p>
            <button
              onClick={handleClose}
              className="mt-5 w-full py-2.5 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
            >
              Понятно
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mb-3 border border-indigo-200">
              <UserPlus className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Заявка на регистрацию</h3>
            <p className="text-xs text-slate-500 mt-1">
              Укажите свою точку и должность — управляющий подтвердит заявку
            </p>

            <form onSubmit={handleSubmit} className="w-full mt-5 space-y-3 text-left">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  ФИО
                </label>
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
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Телефон (необязательно)
                </label>
                <input
                  type="tel"
                  placeholder="+7 707 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Точка
                </label>
                <select
                  value={shopId}
                  onChange={(e) => setShopId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      Точка №{s.id} — {s.name.replace(`Кофейня №${s.id} — `, '')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Должность
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all"
              >
                Отправить заявку
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
