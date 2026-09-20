import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';
import { DishPoll } from '../types';

interface DishPollVoteScreenProps {
  pollId: string;
}

// Ноль — это «ещё не оценил», а не оценка: ползунок стоит на нуле, пока человек его не
// сдвинул, и блюдо не считается оценённым. Шаг 0,5 — чтобы можно было поставить 7,5.
// Экспортируется, потому что внутренний экран дегустации у владельца (DishPollsManager)
// использует ровно тот же элемент.
export const ScoreInput: React.FC<{ label: string; value?: number; onChange: (v: number) => void }> = ({
  label,
  value,
  onChange,
}) => {
  const rated = typeof value === 'number' && value > 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        <span className={`text-xl font-black tabular-nums ${rated ? 'text-indigo-700' : 'text-slate-300'}`}>
          {rated ? (Number.isInteger(value) ? value : value!.toFixed(1)) : '—'}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600 h-2"
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 px-0.5">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
};

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

interface VoteDraft {
  scores: Record<string, number>;
  comment?: string;
}

// Дегустация из десяти блюд идёт долго: телефон блокируется, Telegram сворачивается, окно
// приложения выгружается. Незаконченные оценки живут только в памяти экрана, поэтому
// дублируем их на само устройство и восстанавливаем при возвращении.
const draftKey = (pollId: string, userId: string | number) => `mc-bekary-vote-draft-${pollId}-${userId}`;

// Если владелец успел поменять блюда или критерии, старый черновик уже не подходит —
// он бы подставил оценки не туда. Такой черновик выбрасываем.
const pollSignature = (poll: DishPoll) => `${poll.dishNames.length}|${poll.criteria.join('~')}`;

const readDraft = (pollId: string, userId: string | number, poll: DishPoll): Record<number, VoteDraft> | null => {
  try {
    const raw = window.localStorage.getItem(draftKey(pollId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.signature !== pollSignature(poll)) return null;
    return parsed.entries || null;
  } catch {
    return null;
  }
};

const writeDraft = (pollId: string, userId: string | number, poll: DishPoll, entries: Record<number, VoteDraft>) => {
  try {
    window.localStorage.setItem(
      draftKey(pollId, userId),
      JSON.stringify({ signature: pollSignature(poll), entries })
    );
  } catch {
    // Приватный режим или переполненное хранилище — молча работаем как раньше.
  }
};

const clearDraft = (pollId: string, userId: string | number) => {
  try {
    window.localStorage.removeItem(draftKey(pollId, userId));
  } catch {
    // см. writeDraft
  }
};

// Reached via a Telegram deep link (t.me/<bot>?startapp=vote_<id>), entirely outside the rest
// of the app — no registration gate, no role, no header. Dishes are shown as tiles rather than
// one long scroll of every criterion for every dish at once; tapping a tile opens that dish's
// own form, and a tile lights up green once every criterion for it has been answered. Telegram's
// own WebApp user object is the only "identity" involved, read automatically.
export const DishPollVoteScreen: React.FC<DishPollVoteScreenProps> = ({ pollId }) => {
  const [poll, setPoll] = useState<DishPoll | null | undefined>(undefined);
  const [entries, setEntries] = useState<Record<number, VoteDraft>>({});
  const [activeDishIndex, setActiveDishIndex] = useState<number | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tg = (window as any).Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;

  useEffect(() => {
    const voterParam = user?.id ? `?voter=${encodeURIComponent(String(user.id))}` : '';
    fetch(`/api/dish-polls/${encodeURIComponent(pollId)}${voterParam}`)
      .then((r) => r.json())
      .then((data) => {
        setPoll(data.poll);
        if (!data.poll || !user?.id) return;
        // Уже голосовал — показываем это и подставляем его прежние оценки, чтобы он их
        // поправил, а не выставлял всё заново с нуля. Отправленный голос всегда важнее
        // черновика: черновик мог остаться от того же захода, в котором его и отправили.
        if (data.myVote?.entries?.length) {
          const prefilled: Record<number, VoteDraft> = {};
          data.myVote.entries.forEach((e: VoteDraft, i: number) => {
            prefilled[i] = { scores: { ...e.scores }, comment: e.comment };
          });
          setEntries(prefilled);
          setAlreadyVoted(true);
          clearDraft(pollId, user.id);
          return;
        }
        // Не дошёл до «Сохранить» и вышел — возвращаем то, что успел наставить.
        const draft = readDraft(pollId, user.id, data.poll);
        if (draft) setEntries(draft);
      })
      .catch(() => setPoll(null));
  }, [pollId, user?.id]);

  useEffect(() => {
    if (!poll || !user?.id || submitted || alreadyVoted) return;
    if (Object.keys(entries).length === 0) return;
    writeDraft(pollId, user.id, poll, entries);
  }, [entries, poll, pollId, user?.id, submitted, alreadyVoted]);

  // Ноль = ползунок не трогали, значит блюдо ещё не оценено.
  const isDishDone = (dishIndex: number) =>
    !!poll && poll.criteria.every((c) => (entries[dishIndex]?.scores[c] ?? 0) > 0);

  const updateScore = (dishIndex: number, criterion: string, value: number) => {
    setEntries((prev) => ({
      ...prev,
      [dishIndex]: { ...prev[dishIndex], scores: { ...(prev[dishIndex]?.scores || {}), [criterion]: value } },
    }));
  };
  const updateComment = (dishIndex: number, comment: string) => {
    setEntries((prev) => ({ ...prev, [dishIndex]: { scores: prev[dishIndex]?.scores || {}, comment } }));
  };

  const handleSubmit = async () => {
    if (!poll || !user?.id) return;
    const missingDishes = poll.dishNames.filter((_, i) => !isDishDone(i));
    if (missingDishes.length > 0) {
      setMissing(missingDishes);
      return;
    }
    setMissing(null);
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
          entries: poll.dishNames.map((_, i) => ({
            scores: entries[i].scores,
            comment: entries[i].comment?.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as any);
        setError(data.error || 'Не удалось отправить оценку. Попробуйте ещё раз.');
        return;
      }
      clearDraft(pollId, user.id);
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
  if (alreadyVoted) {
    return (
      <Shell>
        <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-3 border border-emerald-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900 text-center">Вы уже оценили «{poll.name}»</h3>
        <p className="text-sm text-slate-500 text-center mt-2">
          Ваши оценки сохранены. Если хотите что-то поправить — можно изменить их прямо сейчас.
        </p>
        <button
          onClick={() => setAlreadyVoted(false)}
          className="w-full min-h-[48px] mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm uppercase tracking-wider rounded-xl transition-all"
        >
          Изменить мои оценки
        </button>
      </Shell>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4">
      <div className="max-w-sm mx-auto space-y-4 pb-10">
        <div className="flex flex-col items-center text-center pt-4">
          <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-14 h-14 object-contain mb-2" />
          <h1 className="text-xl font-extrabold text-slate-900">{poll.name}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Нажмите на блюдо и оцените его по каждому пункту, двигая ползунок
          </p>
        </div>

        {activeDishIndex === null ? (
          <>
            {missing && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 text-sm font-medium">
                Не проголосовали за: {missing.join(', ')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {poll.dishNames.map((dishName, i) => {
                const done = isDishDone(i);
                return (
                  <button
                    key={i}
                    onClick={() => setActiveDishIndex(i)}
                    className={`min-h-[72px] rounded-xl border p-3 text-sm font-bold text-left transition-all flex flex-col justify-between ${
                      done
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-900 hover:border-indigo-300'
                    }`}
                  >
                    <span className="block truncate">{dishName}</span>
                    {done && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

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
              {isSubmitting ? 'Сохраняем…' : 'Сохранить оценки'}
            </button>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-6">
            <button
              onClick={() => setActiveDishIndex(null)}
              className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:text-indigo-900"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Назад к блюдам</span>
            </button>
            <h2 className="text-sm font-black uppercase tracking-wider text-indigo-700">
              {poll.dishNames[activeDishIndex]}
            </h2>
            {poll.criteria.map((c) => (
              <ScoreInput
                key={c}
                label={c}
                value={entries[activeDishIndex]?.scores[c]}
                onChange={(v) => updateScore(activeDishIndex, c, v)}
              />
            ))}
            {poll.allowComments && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Комментарий (необязательно)
                </label>
                <textarea
                  value={entries[activeDishIndex]?.comment || ''}
                  onChange={(e) => updateComment(activeDishIndex, e.target.value)}
                  rows={3}
                  placeholder="Что понравилось, что можно улучшить?"
                  className="w-full px-3 py-2 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
            )}
            <button
              onClick={() => setActiveDishIndex(null)}
              className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm uppercase tracking-wider rounded-xl transition-all"
            >
              Готово
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
