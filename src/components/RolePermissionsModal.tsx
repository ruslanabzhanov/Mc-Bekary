import React, { useEffect, useState } from 'react';
import { X, Crown, Info } from 'lucide-react';
import { Permission, RolePermissions } from '../types';

interface RolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  permissions: RolePermissions;
  onSave: (permissions: RolePermissions) => void;
}

const PERMISSION_LABELS: { key: Permission; label: string }[] = [
  { key: 'accept_reject_orders', label: 'Принимать / отклонять заявки точек' },
  { key: 'send_reminders', label: 'Отправлять напоминания точкам' },
  { key: 'manage_checklists', label: 'Печать и настройка чек-листов цехов' },
  { key: 'manage_costings', label: 'Блюда, ТКК и себестоимость' },
  { key: 'manage_personnel', label: 'Управление персоналом и заявками на регистрацию' },
  { key: 'manage_sales_points', label: 'Управление точками продаж' },
];

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({
  isOpen,
  onClose,
  permissions,
  onSave,
}) => {
  const [draft, setDraft] = useState<RolePermissions>(permissions);

  useEffect(() => {
    if (isOpen) setDraft(permissions);
  }, [isOpen, permissions]);

  if (!isOpen) return null;

  const toggle = (role: 'admin' | 'territorial', key: Permission) => {
    setDraft((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role][key] },
    }));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 text-slate-950 px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/30 rounded-xl border border-white/40">
              <Crown className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black tracking-tight">Роли и права</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-1 flex items-start gap-2 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <span>
            Столбец «Территориальный» сохраняется, но пока не влияет на его экран —
            это отдельный следующий шаг.
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-2 pr-2">Право</th>
                <th className="py-2 px-2 text-center w-24">Управляющий</th>
                <th className="py-2 pl-2 text-center w-28">Территориальный</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PERMISSION_LABELS.map(({ key, label }) => (
                <tr key={key}>
                  <td className="py-2.5 pr-2 font-semibold text-slate-800">{label}</td>
                  <td className="py-2.5 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={draft.admin[key]}
                      onChange={() => toggle('admin', key)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 pl-2 text-center">
                    <input
                      type="checkbox"
                      checked={draft.territorial[key]}
                      onChange={() => toggle('territorial', key)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-bold uppercase text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
