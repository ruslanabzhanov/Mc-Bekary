import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Users, Check, X, Wallet, Printer, History, Table2 } from 'lucide-react';
import { StaffMember, Shift, AdvanceRequest } from '../types';
import { PrintTimesheetModal } from './PrintTimesheetModal';

interface TimesheetManagerProps {
  staff: StaffMember[];
  telegramInitData: string;
  actorName: string;
  onUpdateStaffMember: (staffId: string, updates: Partial<StaffMember>) => void;
  // For the «Аванс» / «К выдаче» columns of the monthly grid.
  advanceRequests?: AdvanceRequest[];
}

// Sections of the monthly grid, in the order the paper timesheet lists people.
const GRID_GROUPS: { label: string; positions: string[] }[] = [
  { label: 'Руководство цеха', positions: ['Заведующий производством'] },
  { label: 'Пекари', positions: ['Шеф-пекарь', 'Пекарь', 'Ночной пекарь'] },
  { label: 'Кондитеры', positions: ['Кондитер'] },
  {
    label: 'Заготовщики',
    positions: ['Заготовщик бара', 'Заготовщик кухни', 'Ночной заготовщик кухни', 'Заготовщик полуфабрикатов'],
  },
];

interface ShiftChangeEntry {
  id: number;
  staffId: string;
  staffName: string;
  workDate: string;
  action: 'set' | 'delete';
  rate: number | null;
  actorName: string;
  createdAt: string;
}

type Mode = 'grid' | 'day' | 'person' | 'log';

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
  actorName,
  onUpdateStaffMember,
  advanceRequests = [],
}) => {
  const [mode, setMode] = useState<Mode>('grid');
  const [month, setMonth] = useState(() => monthKey(almatyToday()));
  const [selectedDay, setSelectedDay] = useState(() => almatyToday());
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [logEntries, setLogEntries] = useState<ShiftChangeEntry[]>([]);
  const [isLogLoading, setIsLogLoading] = useState(false);

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

  // Only fetched when the log tab is actually opened — nobody reads it most of the time.
  useEffect(() => {
    if (mode !== 'log') return;
    setIsLogLoading(true);
    fetch(`/api/timesheet/log?month=${month}`)
      .then((r) => r.json())
      .then((data) => setLogEntries(data.entries || []))
      .catch((e) => console.error('Failed to load shift change log:', e))
      .finally(() => setIsLogLoading(false));
  }, [mode, month]);

  const shiftAt = (staffId: string, day: string) =>
    shifts.find((s) => s.staffId === staffId && s.workDate === day);

  const write = async (path: string, method: string, body: Record<string, unknown>, key: string) => {
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, initData: telegramInitData, actorName }),
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

  // One tariff for the person: saved on their card (their cabinet shows it as «Ставка/день» and
  // new shifts start from it) and applied to every shift they already have in the month on
  // screen, so «days × tariff» holds. Other months keep the rate frozen on their shifts.
  const saveMonthRate = async (member: StaffMember, rate: number) => {
    if (!Number.isFinite(rate) || rate < 0 || rate === (Number(member.shiftRate) || 0)) return;
    onUpdateStaffMember(member.id, { shiftRate: rate });
    const ok = await write('/api/timesheet/month-rate', 'POST', { staffId: member.id, month, rate }, `${member.id}:month-rate`);
    if (ok) {
      setShifts((prev) =>
        prev.map((s) => (s.staffId === member.id && monthKey(s.workDate) === month ? { ...s, rate } : s))
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

  // ---- Monthly grid (the paper-timesheet view) ----
  const monthDays = daysInMonth(month);
  const gridRows = useMemo(() => {
    const byStaff = new Map<string, Map<string, Shift>>();
    shifts.forEach((s) => {
      if (!byStaff.has(s.staffId)) byStaff.set(s.staffId, new Map());
      byStaff.get(s.staffId)!.set(s.workDate, s);
    });
    // Approved advances count against the month they were requested in — same rule the
    // employee's own cabinet uses for «К выдаче».
    const advanceBy = new Map<string, number>();
    advanceRequests
      .filter((r) => r.status === 'approved' && r.createdAt && monthKey(r.createdAt) === month)
      .forEach((r) => advanceBy.set(r.staffId, (advanceBy.get(r.staffId) || 0) + r.amount));

    const row = (m: StaffMember) => {
      const mine = byStaff.get(m.id) || new Map<string, Shift>();
      const earned = Array.from(mine.values()).reduce((n, s) => n + (Number(s.rate) || 0), 0);
      const advance = advanceBy.get(m.id) || 0;
      return { member: m, byDay: mine, days: mine.size, earned, advance, payout: earned - advance };
    };

    const used = new Set<string>();
    const groups = GRID_GROUPS.map((g) => {
      const people = employees.filter((m) => m.position && g.positions.includes(m.position));
      people.forEach((m) => used.add(m.id));
      return { label: g.label, rows: people.map(row) };
    });
    const rest = employees.filter((m) => !used.has(m.id));
    if (rest.length > 0) groups.push({ label: 'Прочие', rows: rest.map(row) });
    return groups
      .filter((g) => g.rows.length > 0)
      .map((g) => ({
        ...g,
        earned: g.rows.reduce((n, r) => n + r.earned, 0),
        advance: g.rows.reduce((n, r) => n + r.advance, 0),
        payout: g.rows.reduce((n, r) => n + r.payout, 0),
      }));
  }, [shifts, employees, advanceRequests, month]);
  const gridTotals = gridRows.reduce(
    (t, g) => ({ earned: t.earned + g.earned, advance: t.advance + g.advance, payout: t.payout + g.payout }),
    { earned: 0, advance: 0, payout: 0 }
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
    // Everything stays phone-width except the monthly grid, which needs the whole screen.
    <div className="space-y-4 [&>*:not(.ts-wide)]:max-w-3xl [&>*:not(.ts-wide)]:mx-auto">
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
          onClick={() => setIsPrintOpen(true)}
          className="w-11 h-11 shrink-0 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center"
          aria-label="Печать табеля"
          title="Печать табеля за месяц"
        >
          <Printer className="w-5 h-5" />
        </button>
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
          { key: 'grid' as Mode, label: 'Табель', icon: Table2 },
          { key: 'day' as Mode, label: 'По дню', icon: CalendarDays },
          { key: 'person' as Mode, label: 'По сотруднику', icon: Users },
          { key: 'log' as Mode, label: 'Журнал', icon: History },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 min-h-[44px] px-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
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

      {/* ---- Grid mode: the whole month for everyone, laid out like the paper timesheet ---- */}
      {mode === 'grid' && (() => {
        const num = (n: number) => (n ? Math.round(n).toLocaleString('ru-RU') : '');
        const isWeekendDay = (d: string) => ['сб', 'вс'].includes(weekdayOf(d));
        const stickyNo = 'sticky left-0 z-[1] w-8 min-w-8';
        const stickyName = 'sticky left-8 z-[1] min-w-[150px] max-w-[190px]';
        const cellBorder = 'border border-slate-300';
        let rowNo = 0;
        return (
          <div id="timesheet-grid" className="ts-wide bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3 py-2.5 text-center text-sm font-black text-slate-900 border-b border-slate-300">
              Табель учёта рабочего времени за {MONTHS[monthNum - 1]} {yearNum} года
            </div>
            <div className="overflow-x-auto">
              <table className="border-collapse text-[11px] tabular-nums min-w-full">
                <thead>
                  <tr className="bg-emerald-600 text-white">
                    <th className={`${cellBorder} ${stickyNo} bg-emerald-600 px-1 py-1.5`}>№</th>
                    <th className={`${cellBorder} ${stickyName} bg-emerald-600 px-2 py-1.5 text-left`}>ФИО</th>
                    <th className={`${cellBorder} px-2 py-1.5 text-left min-w-[100px]`}>Должность</th>
                    {monthDays.map((d) => (
                      <th
                        key={d}
                        className={`${cellBorder} w-6 min-w-6 px-0 py-1 text-center leading-tight ${isWeekendDay(d) ? 'bg-emerald-800' : ''}`}
                      >
                        <span className="block font-black">{Number(d.slice(8))}</span>
                        <span className="block text-[8px] font-medium opacity-80">{weekdayOf(d)}</span>
                      </th>
                    ))}
                    <th className={`${cellBorder} px-1.5 py-1 min-w-[64px] leading-tight`}>Кол-во отработ. дней</th>
                    <th className={`${cellBorder} px-1.5 py-1 min-w-[70px] leading-tight`}>Тарифная ставка</th>
                    <th className={`${cellBorder} px-1.5 py-1 min-w-[84px] leading-tight`}>Общая сумма оплаты</th>
                    <th className={`${cellBorder} px-1.5 py-1 min-w-[72px]`}>Аванс</th>
                    <th className={`${cellBorder} px-1.5 py-1 min-w-[84px]`}>К выдаче</th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((g) => (
                    <React.Fragment key={g.label}>
                      <tr className="bg-sky-100">
                        <td className={`${cellBorder} ${stickyNo} bg-sky-100`} />
                        <td className={`${cellBorder} ${stickyName} bg-sky-100 px-2 py-1 font-black text-slate-800`}>
                          {g.label}
                        </td>
                        <td className={cellBorder} colSpan={monthDays.length + 6} />
                      </tr>
                      {g.rows.map((r) => {
                        rowNo += 1;
                        const hasMoney = r.earned > 0 || r.advance > 0;
                        return (
                          <tr key={r.member.id} className="hover:bg-amber-50/40">
                            <td className={`${cellBorder} ${stickyNo} bg-white px-1 py-1 text-center text-slate-500`}>{rowNo}</td>
                            <td className={`${cellBorder} ${stickyName} bg-white px-2 py-1 font-semibold text-slate-900 truncate`}>
                              {r.member.name}
                            </td>
                            <td className={`${cellBorder} px-2 py-1 text-slate-600 whitespace-nowrap`}>
                              {(r.member.position || 'Внутренний сотрудник')
                                .replace('Заведующий производством', 'Зав. производства')
                                .replace('Ночной заготовщик кухни', 'Заготовщик ночной')
                                .replace('Заготовщик полуфабрикатов', 'Заготовщик п/ф')}
                            </td>
                            {monthDays.map((d) => {
                              const s = r.byDay.get(d);
                              const key = `${r.member.id}:${d}`;
                              return (
                                <td key={d} className={`${cellBorder} p-0 ${isWeekendDay(d) ? 'bg-slate-50' : ''}`}>
                                  <button
                                    onClick={() => toggleShift(r.member, d)}
                                    disabled={busyKey === key}
                                    title={`${r.member.name}, ${Number(d.slice(8))} — ${s ? `смена ${formatMoney(s.rate)}, нажмите чтобы снять` : 'нажмите, чтобы поставить смену'}`}
                                    className={`w-6 h-7 flex items-center justify-center font-bold transition-colors ${
                                      s ? 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200' : 'text-transparent hover:bg-indigo-50'
                                    } ${busyKey === key ? 'opacity-40' : ''}`}
                                  >
                                    1
                                  </button>
                                </td>
                              );
                            })}
                            <td className={`${cellBorder} px-1.5 py-1 text-center font-bold text-slate-900`}>{r.days || ''}</td>
                            <td className={`${cellBorder} p-0`}>
                              <input
                                key={`${r.member.id}-${r.member.shiftRate || 0}`}
                                type="number"
                                min="0"
                                step="500"
                                inputMode="numeric"
                                defaultValue={r.member.shiftRate || ''}
                                placeholder="0"
                                disabled={busyKey === `${r.member.id}:month-rate`}
                                onBlur={(e) => saveMonthRate(r.member, Number(e.target.value) || 0)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                title="Тарифная ставка за смену — нажмите, введите сумму и Enter"
                                className="w-full min-w-[72px] h-7 px-1.5 text-right bg-amber-50/60 hover:bg-amber-100 focus:bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className={`${cellBorder} px-1.5 py-1 text-right font-bold text-slate-900`}>{num(r.earned)}</td>
                            <td className={`${cellBorder} px-1.5 py-1 text-right text-slate-700`}>{num(r.advance)}</td>
                            <td
                              className={`${cellBorder} px-1.5 py-1 text-right font-black ${
                                !hasMoney ? '' : r.payout > 0 ? 'bg-emerald-400/80 text-emerald-950' : 'bg-rose-500 text-white'
                              }`}
                            >
                              {hasMoney ? Math.round(r.payout).toLocaleString('ru-RU') : ''}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-sky-200/70 font-black text-slate-900">
                        <td className={`${cellBorder} ${stickyNo} bg-sky-200`} />
                        <td className={`${cellBorder} ${stickyName} bg-sky-200 px-2 py-1`}>Итого: {g.label.toLowerCase()}</td>
                        <td className={cellBorder} colSpan={monthDays.length + 3} />
                        <td className={`${cellBorder} px-1.5 py-1 text-right`}>{num(g.earned)}</td>
                        <td className={`${cellBorder} px-1.5 py-1 text-right`}>{num(g.advance)}</td>
                        <td className={`${cellBorder} px-1.5 py-1 text-right`}>{num(g.payout)}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white font-black">
                    <td className={`${cellBorder} ${stickyNo} bg-slate-800`} />
                    <td className={`${cellBorder} ${stickyName} bg-slate-800 px-2 py-1.5`}>ИТОГО ПО ЦЕХУ</td>
                    <td className={cellBorder} colSpan={monthDays.length + 3} />
                    <td className={`${cellBorder} px-1.5 py-1.5 text-right`}>{num(gridTotals.earned)}</td>
                    <td className={`${cellBorder} px-1.5 py-1.5 text-right`}>{num(gridTotals.advance)}</td>
                    <td className={`${cellBorder} px-1.5 py-1.5 text-right`}>{num(gridTotals.payout)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-200">
              Нажмите на клетку дня, чтобы поставить или снять смену. Тарифную ставку меняйте прямо в таблице — она пересчитает смены этого месяца и сразу видна сотруднику в кабинете
              . Аванс — одобренные заявки за этот месяц.
            </p>
          </div>
        );
      })()}

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
                      {member.position || 'Внутренний сотрудник'}
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
                key={`${selectedMember.id}-${selectedMember.shiftRate || 0}`}
                type="number"
                min="0"
                step="500"
                inputMode="numeric"
                defaultValue={selectedMember.shiftRate || ''}
                placeholder="0"
                onBlur={(e) => saveMonthRate(selectedMember, Number(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl bg-white font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Видна сотруднику в кабинете. Пересчитывает отмеченные смены за {MONTHS[monthNum - 1].toLowerCase()} и
                подставляется в новые; прошлые месяцы не меняются.
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

      {/* ---- Log mode: who touched whose pay, and when ---- */}
      {mode === 'log' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {isLogLoading ? (
            <p className="text-center text-sm text-slate-400 py-6">Загружаем журнал…</p>
          ) : logEntries.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-6">
              В этом месяце изменений табеля ещё не было.
            </p>
          ) : (
            logEntries.map((entry) => (
              <div key={entry.id} className="px-3 py-3 flex items-start gap-3">
                <span
                  className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                    entry.action === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {entry.action === 'delete' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{entry.staffName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {entry.action === 'set'
                      ? `Смена проставлена — ${formatMoney(entry.rate || 0)}`
                      : 'Смена снята'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                    {weekdayOf(entry.workDate)} {entry.workDate.slice(8)}.{entry.workDate.slice(5, 7)}
                    {' · '}
                    {entry.actorName}
                    {' · '}
                    {new Date(entry.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isPrintOpen && (
        <PrintTimesheetModal
          month={month}
          monthLabel={`${MONTHS[monthNum - 1]} ${yearNum}`}
          employees={employees}
          shifts={shifts}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </div>
  );
};
