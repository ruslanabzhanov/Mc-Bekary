import React, { useMemo, useState } from 'react';
import { X, Users, BarChart3 } from 'lucide-react';
import { CoffeeShop, StaffMember, POSITION_OPTIONS, positionValueOf } from '../types';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { AnalyticsView } from './AnalyticsView';

// Два раздела территориального управляющего: «Персонал» всех его точек и «Аналитика» по выбранным.

const shopTitle = (s: CoffeeShop) => s.district.trim() || s.address;

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00+05:00`).getTime() + n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const weekStart = (iso: string) => addDays(iso, -((new Date(`${iso}T12:00:00+05:00`).getUTCDay() + 6) % 7));
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const lastDayOfMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  return `${iso.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; id?: string }> = ({ active, onClick, children, id }) => (
  <button
    id={id}
    onClick={onClick}
    className={`shrink-0 min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
      active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
);

const Overlay: React.FC<{ title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; id: string }> = ({ title, icon, onClose, children, id }) => {
  useTelegramBackButton(true, onClose);
  return (
    <div id={id} className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </h2>
        <button onClick={onClose} className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100" aria-label="Закрыть">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="max-w-3xl mx-auto p-4 pb-16 space-y-4">{children}</div>
    </div>
  );
};

// ---------- Персонал ----------
export const TerritorialStaffPanel: React.FC<{ shops: CoffeeShop[]; staff: StaffMember[]; onClose: () => void }> = ({ shops, staff, onClose }) => {
  const [shopId, setShopId] = useState<number | null>(null); // null — все точки
  const shown = shopId == null ? shops : shops.filter((s) => s.id === shopId);
  const positionLabel = (m: StaffMember) => POSITION_OPTIONS.find((o) => o.value === positionValueOf(m.role, m.position))?.label || m.position || 'Сотрудник';
  const people = (s: CoffeeShop) => staff.filter((m) => m.shopId === s.id);
  const total = shown.reduce((n, s) => n + people(s).length, 0);

  return (
    <Overlay id="territorial-staff-panel" title="Персонал" icon={<Users className="w-5 h-5 text-indigo-600" />} onClose={onClose}>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        <Chip id="staff-chip-all" active={shopId == null} onClick={() => setShopId(null)}>Все точки</Chip>
        {shops.map((s) => (
          <Chip key={s.id} active={shopId === s.id} onClick={() => setShopId(s.id)}>{shopTitle(s)}</Chip>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {shopId == null ? 'Персонал всех ваших точек' : `Персонал точки «${shopTitle(shown[0])}»`} · человек: {total}
      </p>

      {shown.map((s) => (
        <div key={s.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900 truncate">{shopTitle(s)}</h3>
            <span className="text-[11px] font-bold text-slate-400 shrink-0">{people(s).length} чел.</span>
          </div>
          {people(s).length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400 italic">За точкой никто не закреплён.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {people(s).map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
                    <p className="text-[11px] text-slate-500">{m.phone || 'телефон не указан'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">{positionLabel(m)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </Overlay>
  );
};

// ---------- Аналитика ----------
type Preset = 'week' | 'month' | 'prevWeek' | 'prevMonth' | 'custom';

export const TerritorialAnalyticsPanel: React.FC<{ shops: CoffeeShop[]; onClose: () => void }> = ({ shops, onClose }) => {
  const today = almatyToday();
  const [selected, setSelected] = useState<number[]>([]); // пусто — все точки
  const [preset, setPreset] = useState<Preset>('week');
  const [custom, setCustom] = useState({ from: addDays(today, -6), to: today });

  const range = useMemo(() => {
    if (preset === 'week') return { from: weekStart(today), to: today };
    if (preset === 'month') return { from: monthStart(today), to: today };
    if (preset === 'prevWeek') {
      const s = addDays(weekStart(today), -7);
      return { from: s, to: addDays(s, 6) };
    }
    if (preset === 'prevMonth') {
      const last = addDays(monthStart(today), -1);
      return { from: monthStart(last), to: lastDayOfMonth(last) };
    }
    return custom;
  }, [preset, custom, today]);

  const chosen = selected.length ? shops.filter((s) => selected.includes(s.id)) : shops;
  const toggleShop = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const field = 'flex-1 min-w-0 px-2 min-h-[44px] text-sm border border-slate-300 rounded-xl bg-white font-bold text-slate-900';

  return (
    <Overlay id="territorial-analytics-panel" title="Аналитика" icon={<BarChart3 className="w-5 h-5 text-indigo-600" />} onClose={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Точки (можно выбрать несколько)</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Chip id="analytics-chip-all" active={selected.length === 0} onClick={() => setSelected([])}>Все точки</Chip>
            {shops.map((s) => (
              <Chip key={s.id} active={selected.includes(s.id)} onClick={() => toggleShop(s.id)}>{shopTitle(s)}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Период</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Chip id="period-week" active={preset === 'week'} onClick={() => setPreset('week')}>Текущая неделя</Chip>
            <Chip id="period-month" active={preset === 'month'} onClick={() => setPreset('month')}>Текущий месяц</Chip>
            <Chip id="period-prev-week" active={preset === 'prevWeek'} onClick={() => setPreset('prevWeek')}>Прошлая неделя</Chip>
            <Chip id="period-prev-month" active={preset === 'prevMonth'} onClick={() => setPreset('prevMonth')}>Прошлый месяц</Chip>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Свои даты (календарь)</p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 flex-1 min-w-0">
              с
              <input id="range-from" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && (setCustom({ from: e.target.value, to: range.to < e.target.value ? e.target.value : range.to }), setPreset('custom'))} className={field} />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 flex-1 min-w-0">
              по
              <input id="range-to" type="date" value={range.to} min={range.from} max={today} onChange={(e) => e.target.value && (setCustom({ from: range.from, to: e.target.value }), setPreset('custom'))} className={field} />
            </label>
          </div>
        </div>
      </div>

      <AnalyticsView key={chosen.map((s) => s.id).join(',')} shops={chosen} variant="area" externalRange={range} />
    </Overlay>
  );
};
