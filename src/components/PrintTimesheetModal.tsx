import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { StaffMember, Shift } from '../types';

interface PrintTimesheetModalProps {
  month: string; // YYYY-MM
  monthLabel: string; // "Сентябрь 2026"
  employees: StaffMember[];
  shifts: Shift[];
  onClose: () => void;
}

const daysInMonth = (month: string): number => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const formatMoney = (n: number) => Math.round(n).toLocaleString('ru-RU');

// Печатная форма табеля — отдельная от рабочего экрана, тем же способом, что и чек-листы
// (createPortal мимо #root, который на печати скрывается глобальным правилом в index.css).
export const PrintTimesheetModal: React.FC<PrintTimesheetModalProps> = ({
  month,
  monthLabel,
  employees,
  shifts,
  onClose,
}) => {
  const dayCount = daysInMonth(month);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const rows = [...employees].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const shiftsOf = (staffId: string) => shifts.filter((s) => s.staffId === staffId);
  const shiftAt = (staffId: string, day: number) => {
    const iso = `${month}-${String(day).padStart(2, '0')}`;
    return shifts.find((s) => s.staffId === staffId && s.workDate === iso);
  };

  const grandTotal = shifts.reduce(
    (acc, s) => ({ count: acc.count + 1, sum: acc.sum + (Number(s.rate) || 0) }),
    { count: 0, sum: 0 }
  );

  return createPortal(
    <div className="fixed inset-0 z-50 bg-white overflow-auto print:static print:overflow-visible">
      <div className="p-4 print:hidden flex items-center justify-between border-b border-slate-200 sticky top-0 bg-white z-10 shadow-sm">
        <h2 className="text-sm font-bold uppercase text-slate-900">Печать табеля — {monthLabel}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Печать</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <h1 className="hidden print:block text-base font-black uppercase mb-3">
          Табель учёта рабочего времени — {monthLabel}
        </h1>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 italic p-4">Внутренних сотрудников пока нет.</p>
        ) : (
          <table className="w-full border-collapse text-[9px] leading-tight">
            <thead>
              <tr>
                <th className="border border-slate-400 px-1.5 py-1.5 text-left whitespace-nowrap">Сотрудник</th>
                <th className="border border-slate-400 px-1.5 py-1.5 text-left whitespace-nowrap">Должность</th>
                {days.map((d) => (
                  <th key={d} className="border border-slate-400 px-0.5 py-1.5 w-5 text-center">
                    {d}
                  </th>
                ))}
                <th className="border border-slate-400 px-1.5 py-1.5 text-center whitespace-nowrap">Смен</th>
                <th className="border border-slate-400 px-1.5 py-1.5 text-right whitespace-nowrap">Итого ₸</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const memberShifts = shiftsOf(m.id);
                const total = memberShifts.reduce((sum, s) => sum + (Number(s.rate) || 0), 0);
                return (
                  <tr key={m.id}>
                    <td className="border border-slate-300 px-1.5 py-1 font-bold whitespace-nowrap">{m.name}</td>
                    <td className="border border-slate-300 px-1.5 py-1 text-slate-600 whitespace-nowrap">
                      {m.position || '—'}
                    </td>
                    {days.map((d) => {
                      const s = shiftAt(m.id, d);
                      return (
                        <td key={d} className="border border-slate-300 text-center tabular-nums">
                          {s ? '✓' : ''}
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 text-center font-bold tabular-nums">
                      {memberShifts.length}
                    </td>
                    <td className="border border-slate-300 px-1 text-right font-bold tabular-nums whitespace-nowrap">
                      {formatMoney(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={2 + dayCount}
                  className="border border-slate-400 px-1.5 py-2 text-right font-black uppercase"
                >
                  Итого по цеху:
                </td>
                <td className="border border-slate-400 text-center font-black tabular-nums">{grandTotal.count}</td>
                <td className="border border-slate-400 px-1 text-right font-black tabular-nums whitespace-nowrap">
                  {formatMoney(grandTotal.sum)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="hidden print:flex justify-between mt-10 text-xs">
          <div>Составил: ____________________</div>
          <div>Дата печати: {new Date().toLocaleDateString('ru-RU')}</div>
        </div>
      </div>
    </div>,
    document.body
  );
};
