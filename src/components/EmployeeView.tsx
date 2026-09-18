import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Wallet, ChevronLeft, ChevronRight, BadgeCheck, HandCoins, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { StaffMember, Shift, AdvanceRequest } from '../types';

interface EmployeeViewProps {
  employee: StaffMember | null;
  // Set when the Owner is previewing someone else's cabinet rather than an employee viewing
  // their own — the screen then also offers a picker for whose timesheet to look at.
  allEmployees?: StaffMember[];
  onPickEmployee?: (staffId: string) => void;
  advanceRequests: AdvanceRequest[];
  onSubmitAdvanceRequest: (request: { staffId: string; staffName: string; amount: number; kaspiPhone: string }) => void;
}

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// Kazakhstan calendar month, same basis as every other date in the app.
const almatyToday = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });

const monthKey = (d: string) => d.slice(0, 7);

const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;

const formatDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
};

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00+05:00`).getDay()];

export const EmployeeView: React.FC<EmployeeViewProps> = ({
  employee,
  allEmployees,
  onPickEmployee,
  advanceRequests,
  onSubmitAdvanceRequest,
}) => {
  const [month, setMonth] = useState<string>(() => monthKey(almatyToday()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [kaspiPhone, setKaspiPhone] = useState('');

  const staffId = employee?.id;

  useEffect(() => {
    if (!staffId) {
      setShifts([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/timesheet?month=${month}&staffId=${encodeURIComponent(staffId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setShifts(data.shifts || []);
      })
      .catch((e) => console.error('Failed to load own timesheet:', e))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId, month]);

  const { shiftCount, earned } = useMemo(
    () => ({
      shiftCount: shifts.length,
      earned: shifts.reduce((sum, s) => sum + (Number(s.rate) || 0), 0),
    }),
    [shifts]
  );

  // Kaspi number defaults to whatever's on file, but stays editable — a payout number isn't
  // always the same as the contact number registration captured.
  useEffect(() => {
    setKaspiPhone((prev) => prev || employee?.phone || '');
  }, [employee?.id]);

  const myAdvanceRequests = useMemo(
    () =>
      advanceRequests
        .filter((r) => r.staffId === employee?.id)
        .sort((a, b) => b.id.localeCompare(a.id)),
    [advanceRequests, employee?.id]
  );
  const pendingAdvance = myAdvanceRequests.find((r) => r.status === 'pending');
  const lastDecidedAdvance = myAdvanceRequests.find((r) => r.status !== 'pending');

  const handleAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(advanceAmount);
    if (!employee || !Number.isFinite(amount) || amount <= 0 || !kaspiPhone.trim()) return;
    onSubmitAdvanceRequest({ staffId: employee.id, staffName: employee.name, amount, kaspiPhone: kaspiPhone.trim() });
    setAdvanceAmount('');
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const [yearNum, monthNum] = month.split('-').map(Number);
  const isCurrentMonth = month === monthKey(almatyToday());

  if (!employee) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <h3 className="text-lg font-extrabold text-slate-900">Сотрудник не найден</h3>
        <p className="text-sm text-slate-500 mt-2">
          Эта учётная запись больше не числится в персонале. Обратитесь к управляющему.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Who this is */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center">
            <BadgeCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 leading-tight">{employee.name}</h2>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
              {employee.position || 'Сотрудник цеха'}
            </p>
          </div>
        </div>

        {allEmployees && onPickEmployee && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Чей кабинет смотрим
            </label>
            <select
              value={employee.id}
              onChange={(e) => onPickEmployee(e.target.value)}
              className="w-full px-2.5 min-h-[48px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allEmployees.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.position ? ` — ${s.position}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Month picker */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex items-center justify-between gap-2">
        <button
          onClick={() => shiftMonth(-1)}
          className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-sm font-extrabold text-slate-900 truncate">
            {MONTHS[monthNum - 1]} {yearNum}
          </p>
          {isCurrentMonth && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mt-0.5">
              текущий месяц
            </p>
          )}
        </div>
        <button
          onClick={() => shiftMonth(1)}
          disabled={isCurrentMonth}
          className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 border border-slate-200 text-slate-700 flex items-center justify-center transition-colors"
          aria-label="Следующий месяц"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* The two numbers this screen exists for */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Отработано</span>
          </div>
          <p className="text-3xl font-black text-slate-900 tabular-nums leading-none">
            {shiftCount}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            {shiftCount === 1 ? 'смена' : shiftCount >= 2 && shiftCount <= 4 ? 'смены' : 'смен'}
          </p>
        </div>

        <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-emerald-700/70 mb-1.5">
            <Wallet className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-wider">Заработано</span>
          </div>
          <p className="text-2xl font-black text-emerald-900 tabular-nums leading-none break-all">
            {formatMoney(earned)}
          </p>
          <p className="text-xs text-emerald-700/80 mt-1.5">за месяц</p>
        </div>
      </div>

      {/* Day by day */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Смены по дням
          </h3>
        </div>

        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Загружаем…</p>
        ) : shifts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            В этом месяце смен пока нет
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {shifts.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatDay(s.workDate)}
                    <span className="ml-2 text-xs font-medium text-slate-400">
                      {weekdayOf(s.workDate)}
                    </span>
                  </p>
                  {s.note && <p className="text-xs text-slate-500 mt-0.5">{s.note}</p>}
                </div>
                <p className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">
                  {formatMoney(s.rate)}
                </p>
              </div>
            ))}
          </div>
        )}

        {shifts.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Итого</span>
            <span className="text-base font-black text-slate-900 tabular-nums">
              {formatMoney(earned)}
            </span>
          </div>
        )}
      </div>

      {/* Advance request — only for a real employee looking at their own cabinet, not the
          Owner previewing someone else's (see allEmployees on the props). */}
      {!allEmployees && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-slate-700 mb-3">
            <HandCoins className="w-4 h-4" />
            <h3 className="text-xs font-black uppercase tracking-wider">Аванс</h3>
          </div>

          {pendingAdvance ? (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">Заявка на рассмотрении</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {formatMoney(pendingAdvance.amount)} на Kaspi {pendingAdvance.kaspiPhone}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdvanceSubmit} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Сумма
                </label>
                <input
                  type="number"
                  min="1"
                  step="500"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="Например, 20000"
                  className="w-full px-3 min-h-[44px] text-base border border-slate-300 rounded-xl bg-white font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Уже заработано в этом месяце: {formatMoney(earned)}
                </p>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Номер Kaspi
                </label>
                <input
                  type="tel"
                  value={kaspiPhone}
                  onChange={(e) => setKaspiPhone(e.target.value)}
                  placeholder="+7 707 000 00 00"
                  className="w-full px-3 min-h-[44px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl transition-all shadow-sm"
              >
                Запросить аванс
              </button>
            </form>
          )}

          {!pendingAdvance && lastDecidedAdvance && (
            <div
              className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                lastDecidedAdvance.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-rose-50 text-rose-800'
              }`}
            >
              {lastDecidedAdvance.status === 'approved' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                Последняя заявка ({formatMoney(lastDecidedAdvance.amount)}) —{' '}
                {lastDecidedAdvance.status === 'approved' ? 'одобрена' : 'отклонена'}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center px-4">
        Табель ведёт управляющий. Если в нём чего-то не хватает — скажите ему.
      </p>
    </div>
  );
};
