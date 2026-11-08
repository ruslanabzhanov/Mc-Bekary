import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { StaffMember, Shift, isCourierPosition } from '../types';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

// Строка и подразделение — ровно то, что рассчитал экранный табель, чтобы печать и экран никогда
// не расходились: те же ставки, премии, авансы и «к выдаче».
export interface PrintRow {
  member: StaffMember;
  rate: number;
  byDay: Map<string, Shift>;
  days: number;
  earned: number;
  bonus: number;
  advance: number;
  payout: number;
}
export interface PrintGroup {
  id: string;
  label: string;
  rows: PrintRow[];
  earned: number;
  bonus: number;
  advance: number;
  payout: number;
}

interface PrintTimesheetModalProps {
  month: string; // YYYY-MM
  monthLabel: string; // "Сентябрь 2026"
  groups: PrintGroup[];
  totals: { earned: number; bonus: number; advance: number; payout: number };
  monthDays: string[]; // YYYY-MM-DD всех дней месяца
  onClose: () => void;
}

const money = (n: number) => (n ? Math.round(n).toLocaleString('ru-RU') : '');
const units = (s?: Shift) => Number(s?.units ?? 1) || 1;

// Печатная форма табеля — отдельная от рабочего экрана, тем же способом, что и чек-листы
// (createPortal мимо #root, который на печати скрывается глобальным правилом в index.css).
export const PrintTimesheetModal: React.FC<PrintTimesheetModalProps> = ({ monthLabel, groups, totals, monthDays, onClose }) => {
  useTelegramBackButton(true, onClose);

  const cell = 'border border-slate-400';
  const colsAfterDays = 6; // смен, ставка, начислено, премия, аванс, к выдаче
  let rowNo = 0;

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

        {groups.length === 0 ? (
          <p className="text-sm text-slate-400 italic p-4">Внутренних сотрудников пока нет.</p>
        ) : (
          <table className="w-full border-collapse text-[9px] leading-tight">
            <thead>
              <tr className="bg-slate-100">
                <th className={`${cell} px-1 py-1.5 text-center`}>№</th>
                <th className={`${cell} px-1.5 py-1.5 text-left whitespace-nowrap`}>Сотрудник</th>
                <th className={`${cell} px-1.5 py-1.5 text-left whitespace-nowrap`}>Должность</th>
                {monthDays.map((d) => (
                  <th key={d} className={`${cell} px-0.5 py-1.5 w-5 text-center`}>
                    {Number(d.slice(8))}
                  </th>
                ))}
                <th className={`${cell} px-1 py-1.5 text-center`}>Дней</th>
                <th className={`${cell} px-1 py-1.5 text-right`}>Ставка</th>
                <th className={`${cell} px-1 py-1.5 text-right`}>Начислено</th>
                <th className={`${cell} px-1 py-1.5 text-right`}>Премия</th>
                <th className={`${cell} px-1 py-1.5 text-right`}>Аванс</th>
                <th className={`${cell} px-1 py-1.5 text-right`}>К выдаче</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.id}>
                  <tr className="bg-sky-100 break-inside-avoid">
                    <td className={cell} />
                    <td className={`${cell} px-1.5 py-1 font-black`} colSpan={2 + monthDays.length + colsAfterDays}>
                      {g.label}
                    </td>
                  </tr>
                  {g.rows.map((r) => {
                    rowNo += 1;
                    const courier = isCourierPosition(r.member.position);
                    const hasMoney = r.earned > 0 || r.bonus > 0 || r.advance > 0;
                    return (
                      <tr key={r.member.id} className="break-inside-avoid">
                        <td className={`${cell} px-1 text-center text-slate-500`}>{rowNo}</td>
                        <td className={`${cell} px-1.5 py-1 font-bold whitespace-nowrap`}>{r.member.name}</td>
                        <td className={`${cell} px-1.5 py-1 text-slate-600 whitespace-nowrap`}>{r.member.position || '—'}</td>
                        {monthDays.map((d) => {
                          const s = r.byDay.get(d);
                          return (
                            <td key={d} className={`${cell} text-center tabular-nums`}>
                              {s ? (courier ? String(units(s)) : units(s) === 1 ? '✓' : '0,5') : ''}
                            </td>
                          );
                        })}
                        <td className={`${cell} text-center font-bold tabular-nums`}>{r.days ? String(r.days).replace('.', ',') : ''}</td>
                        <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(r.rate)}</td>
                        <td className={`${cell} px-1 text-right font-bold tabular-nums whitespace-nowrap`}>{money(r.earned)}</td>
                        <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(r.bonus)}</td>
                        <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(r.advance)}</td>
                        <td className={`${cell} px-1 text-right font-black tabular-nums whitespace-nowrap`}>
                          {hasMoney ? Math.round(r.payout).toLocaleString('ru-RU') : ''}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-sky-50 font-black break-inside-avoid">
                    <td className={cell} />
                    <td className={`${cell} px-1.5 py-1`} colSpan={2 + monthDays.length + 3}>
                      Итого: {g.label.toLowerCase()}
                    </td>
                    <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(g.earned)}</td>
                    <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(g.bonus)}</td>
                    <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(g.advance)}</td>
                    <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{Math.round(g.payout).toLocaleString('ru-RU')}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-black">
                <td className={`${cell} px-1.5 py-2 text-right uppercase`} colSpan={3 + monthDays.length + 3}>
                  Итого по цеху:
                </td>
                <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(totals.earned)}</td>
                <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(totals.bonus)}</td>
                <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{money(totals.advance)}</td>
                <td className={`${cell} px-1 text-right tabular-nums whitespace-nowrap`}>{Math.round(totals.payout).toLocaleString('ru-RU')}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <p className="mt-2 text-[9px] text-slate-500">К выдаче = начислено + премия − аванс.</p>

        <div className="hidden print:flex justify-between mt-10 text-xs">
          <div>Составил: ____________________</div>
          <div>Дата печати: {new Date().toLocaleDateString('ru-RU')}</div>
        </div>
      </div>
    </div>,
    document.body
  );
};
