import React from 'react';
import {
  CoffeeShop,
  StaffRole,
  MAX_TERRITORIAL_SHOPS,
  EMPLOYEE_POSITIONS,
  SHOP_STAFF_POSITIONS,
  PRODUCTION_SHOP_ID,
} from '../types';

// При регистрации выбирают дважды: сначала категорию, потом должность внутри неё.
// «Сотрудники кофейни» — те, кто связан с точкой; «Внутренние сотрудники» — всегда роль
// employee, а их должность (EMPLOYEE_POSITIONS) — просто подпись, не уровень прав.
type StaffCategory = 'shop' | 'internal';
const categoryOf = (role: StaffRole): StaffCategory => (role === 'employee' ? 'internal' : 'shop');

const CATEGORY_OPTIONS: { value: StaffCategory; label: string }[] = [
  { value: 'shop', label: 'Сотрудники кофейни' },
  { value: 'internal', label: 'Внутренние сотрудники' },
];

// Должности категории «Сотрудники кофейни». Менеджер точки и бариста делят одну роль
// shop_manager — значит и права у них одни, без отдельной ветки в коде, — и различаются
// только должностью. Территориальный управляющий это другая роль: другой экран и участок.
const SHOP_ROLE_OPTIONS: { value: string; role: StaffRole; position?: string; label: string }[] = [
  ...SHOP_STAFF_POSITIONS.map((p) => ({ value: p, role: 'shop_manager' as StaffRole, position: p, label: p })),
  { value: 'territorial_manager', role: 'territorial_manager', label: 'Территориальный управляющий' },
];

// Какой пункт списка соответствует текущей паре роль+должность.
const shopOptionValue = (role: StaffRole, position: string) => {
  if (role === 'territorial_manager') return 'territorial_manager';
  return SHOP_STAFF_POSITIONS.includes(position as any) ? position : SHOP_STAFF_POSITIONS[0];
};

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
          onChange={(e) => {
            const internal = e.target.value === 'internal';
            onRoleChange(internal ? 'employee' : 'shop_manager');
            // Должность сбрасываем на первую из новой категории, иначе за сменой категории
            // тянулась бы чужая — например «Пекарь» у менеджера точки.
            onPositionChange(internal ? EMPLOYEE_POSITIONS[0] : SHOP_STAFF_POSITIONS[0]);
            // Внутренние сотрудники работают в цеху, а не на конкретной точке — выбирать
            // точку им незачем; предыдущий выбор (если переключались туда-обратно) сбрасываем.
            if (internal) onShopIdChange(PRODUCTION_SHOP_ID);
            else if (shopId === PRODUCTION_SHOP_ID) onShopIdChange(shops[0]?.id || 1);
          }}
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
            value={shopOptionValue(role, position)}
            onChange={(e) => {
              const picked = SHOP_ROLE_OPTIONS.find((o) => o.value === e.target.value);
              if (!picked) return;
              onRoleChange(picked.role);
              onPositionChange(picked.position || '');
            }}
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
      ) : role === 'employee' ? (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Точка</label>
          {/* Внутренние сотрудники — цех, не конкретная точка продаж; выбирать здесь нечего. */}
          <div className="w-full px-3 min-h-[48px] flex items-center text-base border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium">
            Производство
          </div>
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
