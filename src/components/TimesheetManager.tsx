import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Check, X, Wallet } from 'lucide-react';
import { StaffMember, Shift } from '../types';

interface TimesheetManagerProps {
  staff: StaffMember[];
  telegramInitData: string;
  onUpdateStaffMember: (staffId: string, updates: Partial<StaffMember>) => void;
}

type Mode = 'day' | 'person';

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const monthKey = (d: string) => d.slice(0, 7);
const formatMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`;
const weekdayOf = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00+05:00`).getDay()];

const daysInMonth = (month: string): string[] => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
};

const shiftWord = (n: number) => (n === 1 ? 'смена' : n >= 2 && n <= 4 ? 'смены' : 'смен');

export const TimesheetManager: React.FC<TimesheetManagerProps> = ({
  staff,
  telegramInitData,
  onUpdateStaffMember,
}) => {
  const [mode, setMode] = useState<Mode>('day');
  const [month, setMonth] = useState(() => monthKey(almatyToday()));
  const [selectedDay, setSelectedDay] = useState(() => almatyToday());
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only internal employees are on the timesheet — point managers and territorial managers
  // are not paid per shift through this screen.
  const employees = useMemo(
    () => staff.filter((s) => s.role === 'employee').sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [staff]
  );

  useEffect(() => {
    if (!selectedStaffId && employees.length > 0) setSelectedStaffId(employees[0].id);
  }, [employees, selectedStaffId]);

  // Keep the chosen day inside the chosen month, so switching months doesn't leave the
  // day-mode editor pointing at a date that isn't on screen.
  useEffect(() => {
    if (monthKey(selectedDay) !== month) setSelectedDay(`${month}-01`);
  }, [month]);

  const loadMonth = () => {
    setIsLoading(true);
    fetch(`/api/timesheet?month=${month}`)
      .then((r) => r.json())
      .then((data) => setShifts(data.shifts || []))
      .catch((e) => console.error('Failed to load timesheet:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadMonth, [month]);

  const shiftAt = (staffId: string, day: string) =>
    shifts.find((s) => s.staffId === staffId && s.workDate === day);

  const write = async (path: string, method: string, body: Record<string, unknown>, key: string) => {
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, initData: telegramInitData }),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? 'Нет подтверждения доступа. Откройте приложение через Telegram.'
            : 'Не удалось сохранить. Попробуйте ещё раз.'
        );
        return false;
      }
      return true;
    } catch (e) {
      console.error('Timesheet write failed:', e);
      setError('Нет связи с сервером.');
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const toggleShift = async (member: StaffMember, day: string) => {
    const key = `${member.id}:${day}`;
    const existing = shiftAt(member.id, day);

    if (existing) {
      const ok = await write('/api/timesheet/shift', 'DELETE', { staffId: member.id, workDate: day }, key);
      if (ok) setShifts((prev) => prev.filter((s) => !(s.staffId === member.id && s.workDate === day)));
      return;
    }

    // Rate is copied from the person's card at this moment and then frozen on the shift.
    const rate = Number(member.shiftRate) || 0;
    const ok = await write('/api/timesheet/shift', 'POST', { staffId: member.id, workDate: day, rate }, key);
    if (ok) {
      setShifts((prev) => [
        ...prev,
        { id: Date.now(), staffId: member.id, workDate: day, rate },
      ]);
    }
  };

  const changeShiftRate = async (member: StaffMember, day: string, rate: number) => {
    const key = `${member.id}:${day}:rate`;
    const ok = await write('/api/timesheet/shift', 'POST', { staffId: member.id, workDate: day, rate }, key);
    if (ok) {
      setShifts((prev) =>
        prev.map((s) => (s.staffId === member.id && s.workDate === day ? { ...s, rate } : s))
      );
    }
  };

  const moveMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const monthTotals = useMemo(() => {
    const total = shifts.reduce((sum, s) => sum + (Number(s.rate) || 0), 0);
    return { count: shifts.length, total };
  }, [shifts]);

  const selectedMember = employees.find((s) => s.id === selectedStaffId) || null;
  const personShifts = useMemo(
    () => shifts.filter((s) => s.staffId === selectedStaffId).sort((a, b) => a.workDate.localeCompare(b.workDate)),
    [shifts, selectedStaffId]
  );
  const personTotals = useMemo(
    () => ({
      count: personShifts.length,
      total: personShifts.reduce((sum, s) => sum + (Number(s.rate) || 0), 0),
    }),
    [personShifts]
  );

  const [yearNum, monthNum] = month.split('-').map(Number);

  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900">Сотрудников цеха пока нет</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          Табель ведётся по внутренним сотрудникам — пекарям, кондитерам, заготовщикам. Когда
          они подадут заявку на регистрацию и вы её одобрите, они появятся здесь.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Month */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-2">
        <button
          onClick={() => moveMonth(-1)}
          className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0">
          <p className="text-sm font-extrabold text-slate-900">{MONTHS[monthNum - 1]} {yearNum}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {monthTotals.count} {shiftWord(monthTotals.count)} · {formatMoney(monthTotals.total)}
          </p>
        </div>
        <button
          onClick={() => moveMonth(1)}
          disabled={month >= monthKey(almatyToday())}
          className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 border border-slate-200 text-slate-700 flex items-center justify-center"
          aria-label="Следующий месяц"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Mode switch */}
      <div className="flex p-1.5 gap-1 bg-slate-100 border border-slate-200 rounded-xl">
        {([
          { key: 'day' as Mode, label: 'По дню', icon: CalendarDays },
          { key: 'person' as Mode, label: 'По сотруднику', icon: Users },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 min-h-[44px] px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              mode === key
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-center text-sm text-slate-400 py-2">Загружаем табель…</p>}

      {/* ---- Day mode: the daily entry pass ---- */}
      {mode === 'day' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              День
            </label>
            <input
              type="date"
              value={selectedDay}
              min={`${month}-01`}
              max={daysInMonth(month)[daysInMonth(month).length - 1]}
              onChange={(e) => e.target.value && setSelectedDay(e.target.value)}
              className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              {weekdayOf(selectedDay)} · отметьте, кто вышел на смену
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {employees.map((member) => {
              const existing = shiftAt(member.id, selectedDay);
              const key = `${member.id}:${selectedDay}`;
              const isBusy = busyKey === key;
              return (
                <button
                  key={member.id}
                  onClick={() => toggleShift(member, selectedDay)}
                  disabled={isBusy}
                  className={`w-full flex items-center gap-3 px-3 py-3 min-h-[60px] text-left transition-colors ${
                    existing ? 'bg-emerald-50/60' : 'hover:bg-slate-50 active:bg-slate-100'
                  } ${isBusy ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`w-7 h-7 shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      existing
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 text-transparent'
                    }`}
                  >
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900 leading-tight">
                      {member.name}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {member.position || 'Сотрудник цеха'}
                    </span>
                  </span>
                  <span className="text-sm font-black text-slate-900 tabular-nums whitespace-nowrap">
                    {existing ? formatMoney(existing.rate) : formatMoney(member.shiftRate || 0)}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ---- Person mode: review and correct a month ---- */}
      {mode === 'person' && selectedMember && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Сотрудник
              </label>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-2.5 min-h-[48px] text-base border border-slate-300 rounded-xl bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {employees.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.position ? ` — ${s.position}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Ставка за смену
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={selectedMember.shiftRate || 0}
                onChange={(e) => onUpdateStaffMember(selectedMember.id, { shiftRate: Number(e.target.value) || 0 })}
                className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl bg-white font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Подставляется в новые смены. Уже отмеченные смены не меняются — их ставка
                зафиксирована.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">Смен</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">
                {personTotals.count}
              </p>
            </div>
            <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-4">
              <div className="flex items-center gap-1.5 text-emerald-700/70 mb-1.5">
                <Wallet className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">Начислено</span>
              </div>
              <p className="text-xl font-black text-emerald-900 tabular-nums leading-none break-all">
                {formatMoney(personTotals.total)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {daysInMonth(month).map((day) => {
              const existing = shiftAt(selectedMember.id, day);
              const key = `${selectedMember.id}:${day}`;
              const isBusy = busyKey === key;
              const isWeekend = ['сб', 'вс'].includes(weekdayOf(day));
              return (
                <div
                  key={day}
                  className={`flex items-center gap-2 px-3 py-2 min-h-[56px] ${
                    existing ? 'bg-emerald-50/60' : isWeekend ? 'bg-slate-50/60' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleShift(selectedMember, day)}
                    disabled={isBusy}
                    className={`w-11 h-11 shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      existing
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 text-slate-300 hover:border-slate-400'
                    } ${isBusy ? 'opacity-50' : ''}`}
                    aria-label={existing ? 'Снять смену' : 'Поставить смену'}
                  >
                    {existing ? <Check className="w-5 h-5" strokeWidth={3} /> : <X className="w-4 h-4" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {day.slice(8)}
                      <span className="ml-2 text-xs font-medium text-slate-400">{weekdayOf(day)}</span>
                    </p>
                  </div>

                  {existing && (
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={existing.rate}
                      onChange={(e) =>
                        changeShiftRate(selectedMember, day, Number(e.target.value) || 0)
                      }
                      className="w-28 shrink-0 px-2 h-11 text-right text-sm border border-slate-300 rounded-lg bg-white font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
