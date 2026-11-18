import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import masterCoffeeCroissant from '../assets/images/master_coffee_croissant.png';
import { DishPoll } from '../types';
import { DishVotePanel } from './DishVotePanel';
import type { VoteDraft } from './DishVotePanel';

interface DishPollVoteScreenProps {
  pollId: string;
}

// Элемент оценки живёт в DishVotePanel; экспорт оставлен, чтобы не ломать прежние импорты.
export { ScoreInput } from './DishVotePanel';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg,#f3f8f5 0%,#eef4f0 100%)' }}>
    <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-[0_10px_40px_rgba(15,60,40,.10)] border border-emerald-900/5">
      <div className="flex flex-col items-center text-center mb-4">
        <span className="w-16 h-16 rounded-full bg-[#0f7a4f] flex items-center justify-center mb-2">
          <img src={masterCoffeeCroissant} alt="Master Bakery" className="w-10 h-10 object-contain" />
        </span>
      </div>
      {children}
    </div>
  </div>
);

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
          className="w-full min-h-[52px] mt-4 bg-[#0f7a4f] hover:bg-[#0a6d3e] text-white font-black text-sm rounded-full transition-all"
        >
          Изменить мои оценки
        </button>
      </Shell>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#f3f8f5 0%,#eef4f0 100%)' }}>
      <DishVotePanel
        title={poll.name}
        subtitle="Дегустация · Master Bakery"
        logo={<img src={masterCoffeeCroissant} alt="" className="w-8 h-8 object-contain" />}
        dishNames={poll.dishNames}
        criteria={poll.criteria}
        allowComments={poll.allowComments}
        entries={entries}
        onScore={updateScore}
        onComment={updateComment}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        missing={missing}
        error={error}
      />
    </div>
  );
};
