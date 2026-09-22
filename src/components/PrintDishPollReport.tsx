import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';
import { DishPoll, DishPollVote } from '../types';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

interface DishRanking {
  index: number;
  name: string;
  score: number;
}

const pluralVotes = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'оценка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'оценки';
  return 'оценок';
};

interface PrintDishPollReportProps {
  poll: DishPoll;
  averages: Record<string, number>[];
  globalCriteriaAverages: Record<string, number>;
  ranking: DishRanking[]; // sorted best-first
  votes: DishPollVote[];
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
  votes,
  voteCount,
  onClose,
}) => {
  // Та же логика, что на экране: при небольшом числе блюд топ и антитоп делятся пополам,
  // иначе в отчёте дважды печатался бы один и тот же список.
  useTelegramBackButton(true, onClose);

  const topCount = Math.min(10, Math.ceil(ranking.length / 2));
  const bottomCount = Math.min(10, Math.floor(ranking.length / 2));
  const best = ranking.slice(0, topCount);
  const worst = [...ranking].reverse().slice(0, bottomCount);

  // index.css задаёт A3 landscape на весь проект — это нужно плотным чек-листам цеха, но
  // отчёт о дегустации печатают на обычном A4. Переопределяем, пока открыт именно он.
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 portrait; margin: 12mm; }';
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const commentsByDish = poll.dishNames.map((_, dishIndex) =>
    votes
      .map((v) => ({ name: v.telegramName, comment: v.entries[dishIndex]?.comment }))
      .filter((c): c is { name: string; comment: string } => !!c.comment)
  );
  const hasAnyComment = commentsByDish.some((list) => list.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 bg-white overflow-auto print:static print:overflow-visible">
      <div className="p-4 print:hidden flex items-center justify-between border-b border-slate-200 sticky top-0 bg-white z-10 shadow-sm">
        <h2 className="text-sm font-bold uppercase text-slate-900 truncate mr-2">Печать анализа — {poll.name}</h2>
        <div className="flex items-center gap-2 shrink-0">
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
          {voteCount} {pluralVotes(voteCount)} · дата печати {new Date().toLocaleDateString('ru-RU')}
        </p>

        {/* Итог — вторым столбцом, а не последним: на телефоне до конца широкой таблицы
            доскроллит не каждый, а общий балл блюда смотрят в первую очередь. */}
        <div className="overflow-x-auto mb-6 print:overflow-visible">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-slate-400 px-2 py-1.5 text-left">Блюдо</th>
                <th className="border border-slate-400 px-2 py-1.5 text-center bg-slate-100">Итог</th>
                {poll.criteria.map((c) => (
                  <th key={c} className="border border-slate-400 px-2 py-1.5 text-center">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {poll.dishNames.map((name, i) => (
                <tr key={i}>
                  <td className="border border-slate-300 px-2 py-1 font-bold">{name}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-black tabular-nums bg-slate-50">
                    {(ranking.find((r) => r.index === i)?.score || 0).toFixed(1)}
                  </td>
                  {poll.criteria.map((c) => (
                    <td key={c} className="border border-slate-300 px-2 py-1 text-center tabular-nums">
                      {typeof averages[i]?.[c] === 'number' ? averages[i][c].toFixed(1) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
              {best.map((d) => (
                <li key={d.index}>
                  {d.name} — <b className="tabular-nums">{d.score.toFixed(1)}</b>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="font-black uppercase text-xs mb-2">Антитоп блюд</h3>
            <ol className="list-decimal list-inside space-y-0.5">
              {worst.map((d) => (
                <li key={d.index}>
                  {d.name} — <b className="tabular-nums">{d.score.toFixed(1)}</b>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {hasAnyComment && (
          <div className="mt-6">
            <h3 className="font-black uppercase text-xs mb-2">Комментарии гостей</h3>
            {poll.dishNames.map((dishName, i) =>
              commentsByDish[i].length === 0 ? null : (
                <div key={i} className="mb-3 break-inside-avoid">
                  <p className="text-xs font-bold border-b border-slate-300 pb-0.5 mb-1">{dishName}</p>
                  {commentsByDish[i].map((c, k) => (
                    <p key={k} className="text-xs leading-snug mb-0.5">
                      <b>{c.name}:</b> {c.comment}
                    </p>
                  ))}
                </div>
              )
            )}
          </div>
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
