import React from 'react';
import { CoffeeShop, StaffRole, MAX_TERRITORIAL_SHOPS } from '../types';

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'shop_manager', label: 'Менеджер точки' },
  { value: 'territorial_manager', label: 'Территориальный управляющий' },
  { value: 'employee', label: 'Внутренний сотрудник' },
];

interface RoleShopFieldsProps {
  shops: CoffeeShop[];
  role: StaffRole;
  onRoleChange: (role: StaffRole) => void;
  shopId: number;
  onShopIdChange: (id: number) => void;
  shopIds: number[];
  onShopIdsChange: (ids: number[]) => void;
}

const shopLabel = (s: CoffeeShop) => `№${s.id} — ${s.name.replace(`Кофейня №${s.id} — `, '')}`;

// Должность/точка picker shared between the mandatory registration gate, the opt-in
// "+" registration modal, and the admin's pending-request editor — a shop manager or
// employee picks exactly one point; a territorial manager picks up to MAX_TERRITORIAL_SHOPS.
export const RoleShopFields: React.FC<RoleShopFieldsProps> = ({
  shops,
  role,
  onRoleChange,
  shopId,
  onShopIdChange,
  shopIds,
  onShopIdsChange,
}) => {
  const toggleShop = (id: number) => {
    if (shopIds.includes(id)) {
      onShopIdsChange(shopIds.filter((s) => s !== id));
    } else if (shopIds.length < MAX_TERRITORIAL_SHOPS) {
      onShopIdsChange([...shopIds, id]);
    }
  };

  return (
    <>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Должность</label>
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as StaffRole)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {role === 'territorial_manager' ? (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Точки (до {MAX_TERRITORIAL_SHOPS}) — выбрано {shopIds.length}/{MAX_TERRITORIAL_SHOPS}
          </label>
          <div className="max-h-40 overflow-y-auto border border-slate-300 rounded-lg divide-y divide-slate-100">
            {shops.map((s) => {
              const checked = shopIds.includes(s.id);
              const disabled = !checked && shopIds.length >= MAX_TERRITORIAL_SHOPS;
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${
                    disabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-800 cursor-pointer hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleShop(s.id)}
                    className="accent-indigo-600"
                  />
                  <span>{shopLabel(s)}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Точка</label>
          <select
            value={shopId}
            onChange={(e) => onShopIdChange(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{shopLabel(s)}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
};
