import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';
import { DishPoll, DishPollVoteEntry } from '../types';

interface DishPollVoteScreenProps {
  pollId: string;
}

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1);

// Both interactions set the same value on purpose — a slider for a quick drag, numbered
// buttons for landing on an exact score without hunting along the track. Exported so the
// Owner's internal tasting screen (DishPollsManager) reuses the exact same control.
export const ScoreInput: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <span className="text-xl font-black text-indigo-700 tabular-nums">{value}</span>
    </div>
    <input
      type="range"
      min={1}
      max={10}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-indigo-600 h-2 mb-2.5"
    />
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
      {SCORES.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`min-h-[38px] rounded-lg text-xs font-bold transition-all ${
            value === n
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  </div>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-sm border border-slate-200">
      <div className="flex flex-col items-center text-center mb-4">
        <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-14 h-14 object-contain mb-2" />
      </div>
      {children}
    </div>
  </div>
);

const makeInitialEntries = (poll: DishPoll): DishPollVoteEntry[] =>
  poll.dishNames.map(() => {
    const scores: Record<string, number> = {};
    poll.criteria.forEach((c) => {
      scores[c] = 5;
    });
    return { scores };
  });

// Reached via a Telegram deep link (t.me/<bot>?startapp=vote_<id>), entirely outside the rest
// of the app — no registration gate, no role, no header. Whoever opens it rates every dish in
// the poll in one sitting, using the same criteria "base tile" for each; Telegram's own WebApp
// user object is the only "identity" involved, read automatically.
export const DishPollVoteScreen: React.FC<DishPollVoteScreenProps> = ({ pollId }) => {
  const [poll, setPoll] = useState<DishPoll | null | undefined>(undefined);
  const [entries, setEntries] = useState<DishPollVoteEntry[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/dish-polls/${encodeURIComponent(pollId)}`)
      .then((r) => r.json())
      .then((data) => {
        setPoll(data.poll);
        if (data.poll) {
          setEntries(makeInitialEntries(data.poll));
        }
      })
      .catch(() => setPoll(null));
  }, [pollId]);

  const tg = (window as any).Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;

  const updateScore = (dishIndex: number, criterion: string, value: number) => {
    setEntries((prev) =>
      prev.map((entry, i) => (i === dishIndex ? { ...entry, scores: { ...entry.scores, [criterion]: value } } : entry))
    );
  };
  const updateComment = (dishIndex: number, comment: string) => {
    setEntries((prev) => prev.map((entry, i) => (i === dishIndex ? { ...entry, comment } : entry)));
  };

  const handleSubmit = async () => {
    if (!poll || !user?.id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dish-polls/${encodeURIComponent(poll.id)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: String(user.id),
          telegramUsername: user.username || undefined,
          telegramName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Гость',
          entries: entries.map((e) => ({
            scores: e.scores,
            comment: e.comment?.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as any);
        setError(data.error || 'Не удалось отправить оценку. Попробуйте ещё раз.');
        return;
      }
      setSubmitted(true);
    } catch (e) {
      console.error('Failed to submit dish poll vote:', e);
      setError('Нет связи с сервером.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (poll === undefined) {
    return (
      <Shell>
        <p className="text-sm text-slate-400 text-center">Загружаем…</p>
      </Shell>
    );
  }
  if (!poll) {
    return (
      <Shell>
        <h3 className="text-lg font-extrabold text-slate-900 text-center">Голосование не найдено</h3>
        <p className="text-sm text-slate-500 text-center mt-2">Возможно, ссылка устарела.</p>
      </Shell>
    );
  }
  if (poll.status !== 'active') {
    return (
      <Shell>
        <h3 className="text-lg font-extrabold text-slate-900 text-center">Голосование завершено</h3>
        <p className="text-sm text-slate-500 text-center mt-2">Спасибо за интерес — приём оценок уже закрыт.</p>
      </Shell>
    );
  }
  if (!user?.id) {
    return (
      <Shell>
        <h3 className="text-lg font-extrabold text-slate-900 text-center">Откройте через Telegram</h3>
        <p className="text-sm text-slate-500 text-center mt-2">Голосование доступно только внутри Telegram.</p>
      </Shell>
    );
  }
  if (submitted) {
    return (
      <Shell>
        <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-3 border border-emerald-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900 text-center">Спасибо!</h3>
        <p className="text-sm text-slate-500 text-center mt-2">Ваши оценки по «{poll.name}» учтены.</p>
      </Shell>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4">
      <div className="max-w-sm mx-auto space-y-4 pb-10">
        <div className="flex flex-col items-center text-center pt-4">
          <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-14 h-14 object-contain mb-2" />
          <h1 className="text-xl font-extrabold text-slate-900">{poll.name}</h1>
          <p className="text-xs text-slate-500 mt-1">Оцените каждое блюдо по каждому пункту от 1 до 10</p>
        </div>

        {poll.dishNames.map((dishName, dishIndex) => (
          <div key={dishIndex} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-6">
            <h2 className="text-sm font-black uppercase tracking-wider text-indigo-700">{dishName}</h2>
            {poll.criteria.map((criterion) => (
              <ScoreInput
                key={criterion}
                label={criterion}
                value={entries[dishIndex]?.scores[criterion] ?? 5}
                onChange={(v) => updateScore(dishIndex, criterion, v)}
              />
            ))}
            {poll.allowComments && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Комментарий (необязательно)
                </label>
                <textarea
                  value={entries[dishIndex]?.comment || ''}
                  onChange={(e) => updateComment(dishIndex, e.target.value)}
                  rows={3}
                  placeholder="Что понравилось, что можно улучшить?"
                  className="w-full px-3 py-2 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full min-h-[52px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
        >
          {isSubmitting ? 'Отправляем…' : 'Отправить оценку'}
        </button>
      </div>
    </div>
  );
};
