import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { DishPoll } from '../types';

interface DishRanking {
  index: number;
  name: string;
  score: number;
}

interface PrintDishPollReportProps {
  poll: DishPoll;
  averages: Record<string, number>[];
  globalCriteriaAverages: Record<string, number>;
  ranking: DishRanking[]; // sorted best-first
  voteCount: number;
  onClose: () => void;
}

// Same createPortal-past-#root trick as PrintTimesheetModal — printing hides the app root via
// the global @media print rule in index.css, so this has to live outside it.
export const PrintDishPollReport: React.FC<PrintDishPollReportProps> = ({
  poll,
  averages,
  globalCriteriaAverages,
  ranking,
  voteCount,
  onClose,
}) => {
  const worst = [...ranking].reverse();

  return createPortal(
    <div className="fixed inset-0 z-50 bg-white overflow-auto print:static print:overflow-visible">
      <div className="p-4 print:hidden flex items-center justify-between border-b border-slate-200 sticky top-0 bg-white z-10 shadow-sm">
        <h2 className="text-sm font-bold uppercase text-slate-900">Печать анализа — {poll.name}</h2>
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

      <div className="p-4 max-w-3xl mx-auto text-sm">
        <h1 className="text-lg font-black mb-1">{poll.name}</h1>
        <p className="text-xs text-slate-500 mb-4">
          {voteCount} {voteCount === 1 ? 'оценка' : 'оценок'} · дата печати {new Date().toLocaleDateString('ru-RU')}
        </p>

        <table className="w-full border-collapse text-xs mb-6">
          <thead>
            <tr>
              <th className="border border-slate-400 px-2 py-1.5 text-left">Блюдо</th>
              {poll.criteria.map((c) => (
                <th key={c} className="border border-slate-400 px-2 py-1.5 text-center">{c}</th>
              ))}
              <th className="border border-slate-400 px-2 py-1.5 text-center">Итог</th>
            </tr>
          </thead>
          <tbody>
            {poll.dishNames.map((name, i) => (
              <tr key={i}>
                <td className="border border-slate-300 px-2 py-1 font-bold">{name}</td>
                {poll.criteria.map((c) => (
                  <td key={c} className="border border-slate-300 px-2 py-1 text-center tabular-nums">
                    {(averages[i]?.[c] || 0).toFixed(1)}
                  </td>
                ))}
                <td className="border border-slate-300 px-2 py-1 text-center font-black tabular-nums">
                  {(ranking.find((r) => r.index === i)?.score || 0).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="font-black uppercase text-xs mb-2">Критерии в среднем по всем блюдам</h3>
        <table className="w-full border-collapse text-xs mb-6">
          <tbody>
            {Object.entries(globalCriteriaAverages).map(([c, avg]: [string, number]) => (
              <tr key={c}>
                <td className="border border-slate-300 px-2 py-1">{c}</td>
                <td className="border border-slate-300 px-2 py-1 text-right font-black tabular-nums w-20">
                  {avg.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-black uppercase text-xs mb-2">Топ блюд</h3>
            <ol className="list-decimal list-inside space-y-0.5">
              {ranking.slice(0, 10).map((d) => (
                <li key={d.index}>
                  {d.name} — <b className="tabular-nums">{d.score.toFixed(1)}</b>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="font-black uppercase text-xs mb-2">Антитоп блюд</h3>
            <ol className="list-decimal list-inside space-y-0.5">
              {worst.slice(0, 10).map((d) => (
                <li key={d.index}>
                  {d.name} — <b className="tabular-nums">{d.score.toFixed(1)}</b>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="hidden print:flex justify-between mt-10 text-xs">
          <div>Составил: ____________________</div>
          <div>Дата печати: {new Date().toLocaleDateString('ru-RU')}</div>
        </div>
      </div>
    </div>,
    document.body
  );
};
