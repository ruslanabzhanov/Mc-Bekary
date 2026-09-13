import React from 'react';
import { CoffeeShop, StaffRole, MAX_TERRITORIAL_SHOPS, EMPLOYEE_POSITIONS } from '../types';

// Registration is a two-step pick: first which of the two staff categories, then a more
// specific role/position within it. "Сотрудники кофейни" covers the two point-facing roles;
// "Внутренние сотрудники" is always StaffRole 'employee', further described by a job title
// (EMPLOYEE_POSITIONS) — that title is descriptive only, not a separate app permission level.
type StaffCategory = 'shop' | 'internal';
const categoryOf = (role: StaffRole): StaffCategory => (role === 'employee' ? 'internal' : 'shop');

const CATEGORY_OPTIONS: { value: StaffCategory; label: string }[] = [
  { value: 'shop', label: 'Сотрудники кофейни' },
  { value: 'internal', label: 'Внутренние сотрудники' },
];

const SHOP_ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'shop_manager', label: 'Менеджер точки' },
  { value: 'territorial_manager', label: 'Территориальный управляющий' },
];

interface RoleShopFieldsProps {
  shops: CoffeeShop[];
  role: StaffRole;
  onRoleChange: (role: StaffRole) => void;
  position: string;
  onPositionChange: (position: string) => void;
  shopId: number;
  onShopIdChange: (id: number) => void;
  shopIds: number[];
  onShopIdsChange: (ids: number[]) => void;
}

// The point's own name (set in "Точки продаж"), not the internal number — matches what's
// actually printed at the point and what managers/territorial staff recognize it by.
const shopLabel = (s: CoffeeShop) => s.district.trim() || s.address;

// Категория/должность/точка picker shared between the mandatory registration gate, the opt-in
// "+" registration modal, and the admin's pending-request editor.
export const RoleShopFields: React.FC<RoleShopFieldsProps> = ({
  shops,
  role,
  onRoleChange,
  position,
  onPositionChange,
  shopId,
  onShopIdChange,
  shopIds,
  onShopIdsChange,
}) => {
  const category = categoryOf(role);

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
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Категория</label>
        <select
          value={category}
          onChange={(e) => onRoleChange(e.target.value === 'internal' ? 'employee' : 'shop_manager')}
          className="w-full px-2.5 min-h-[48px] text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {category === 'shop' ? (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Должность</label>
          <select
            value={role}
            onChange={(e) => onRoleChange(e.target.value as StaffRole)}
            className="w-full px-2 min-h-[48px] text-[13px] border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
          >
            {SHOP_ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Должность</label>
          <select
            value={position || EMPLOYEE_POSITIONS[0]}
            onChange={(e) => onPositionChange(e.target.value)}
            className="w-full px-2.5 min-h-[48px] text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
          >
            {EMPLOYEE_POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      )}

      {role === 'territorial_manager' ? (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Точки — выбрано {shopIds.length} из {MAX_TERRITORIAL_SHOPS}
          </label>
          {/* Rendered inline at full height on purpose: a nested scroll box here is nearly
              unusable inside Telegram's WebView, where the swipe gets taken by the page (or
              by Telegram's own dismiss gesture) instead of the list. The page scrolls; the
              list doesn't need to. */}
          <div className="border border-slate-300 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {shops.map((s) => {
              const checked = shopIds.includes(s.id);
              const disabled = !checked && shopIds.length >= MAX_TERRITORIAL_SHOPS;
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 px-3 min-h-[48px] text-sm font-medium ${
                    disabled
                      ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                      : checked
                      ? 'text-indigo-900 bg-indigo-50 cursor-pointer'
                      : 'text-slate-800 cursor-pointer active:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleShop(s.id)}
                    className="w-5 h-5 accent-indigo-600 shrink-0"
                  />
                  <span className="py-2">{shopLabel(s)}</span>
                </label>
              );
            })}
          </div>
          {shopIds.length >= MAX_TERRITORIAL_SHOPS && (
            <p className="mt-1.5 text-xs text-slate-500">
              Выбрано максимум {MAX_TERRITORIAL_SHOPS} точек. Чтобы выбрать другую, снимите галочку с одной из отмеченных.
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Точка</label>
          <select
            value={shopId}
            onChange={(e) => onShopIdChange(Number(e.target.value))}
            className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium bg-white"
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
