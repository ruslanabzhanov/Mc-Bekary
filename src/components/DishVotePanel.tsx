import React, { useEffect, useRef, useState } from 'react';
import { Flame, Sparkles, Wind, Layers, Leaf, Scale, Wallet, Star, CheckCircle2, ArrowUpRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

// Оценка блюд. Сначала список блюд: нажали на блюдо — открылась его оценка (параметры, комментарий
// и «светящийся» средний балл, который считается сразу). «Отправить голосование» на блюде отмечает
// его проголосованным: плитка в списке загорается зелёным. Когда проголосованы все блюда, внизу
// списка уходит общая отправка. Цвет среднего: до 3 красный, от 3 до 6 жёлтый, дальше зелёный;
// смайлик меняется вместе с ним. Одинаково у гостей (по ссылке) и у владельца в приложении.

export interface VoteDraft {
  scores: Record<string, number>;
  comment?: string;
}

const fmtScore = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ',');
const fmtAvg = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');

export type ScoreTone = 'none' | 'red' | 'yellow' | 'green';
export const scoreBand = (avg: number | null): { tone: ScoreTone; emoji: string; word: string } => {
  if (avg == null) return { tone: 'none', emoji: '😶', word: 'Оцените блюдо' };
  if (avg < 3) return { tone: 'red', emoji: avg < 1.5 ? '🤢' : '😞', word: avg < 1.5 ? 'Совсем плохо' : 'Плохо' };
  if (avg < 6) return { tone: 'yellow', emoji: avg < 4.5 ? '😕' : '😐', word: avg < 4.5 ? 'Так себе' : 'Нормально' };
  if (avg < 8) return { tone: 'green', emoji: '🙂', word: 'Хорошо' };
  if (avg < 9.5) return { tone: 'green', emoji: '😋', word: 'Очень вкусно' };
  return { tone: 'green', emoji: '🤩', word: 'Шедевр!' };
};

const TONE = {
  none: { text: 'text-slate-400', glow: '0 10px 30px rgba(15,60,40,.10)', star: '#cbd5d1' },
  red: { text: 'text-rose-600', glow: '0 0 0 2px rgba(244,63,94,.55), 0 12px 44px rgba(244,63,94,.38)', star: '#f43f5e' },
  yellow: { text: 'text-amber-500', glow: '0 0 0 2px rgba(245,158,11,.55), 0 12px 44px rgba(245,158,11,.38)', star: '#f59e0b' },
  green: { text: 'text-emerald-600', glow: '0 0 0 2px rgba(16,185,129,.5), 0 12px 44px rgba(16,185,129,.34)', star: '#10b981' },
} as const;

const CRITERION_LOOK: Record<string, { icon: React.ElementType; hint: string }> = {
  Вкус: { icon: Flame, hint: 'Баланс вкуса, текстура и послевкусие' },
  'Внешний вид': { icon: Sparkles, hint: 'Как блюдо выглядит на тарелке' },
  Аромат: { icon: Wind, hint: 'Запах до и во время еды' },
  Текстура: { icon: Layers, hint: 'Хруст, нежность, плотность' },
  'Размер порции': { icon: Scale, hint: 'Достаточно ли порции' },
  Свежесть: { icon: Leaf, hint: 'Насколько всё свежее' },
  Подача: { icon: Sparkles, hint: 'Эстетика сервировки и температура блюда' },
  'Цена/качество': { icon: Wallet, hint: 'Стоит ли блюдо своих денег' },
};

const STYLE = `
.gr-range{-webkit-appearance:none;appearance:none;width:100%;height:14px;border-radius:999px;outline:none;
  background:linear-gradient(90deg,#7fcba6 0%,#0f7a4f var(--p),#e1e9e4 var(--p),#e1e9e4 100%);touch-action:pan-y}
.gr-range.unrated{background:#e1e9e4}
.gr-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:30px;height:30px;border-radius:50%;background:#fff;border:3px solid #0f7a4f;box-shadow:0 3px 10px rgba(15,60,40,.25);cursor:pointer}
.gr-range.unrated::-webkit-slider-thumb{border-color:#aab9b1}
.gr-range::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid #0f7a4f;box-shadow:0 3px 10px rgba(15,60,40,.25);cursor:pointer}
.gr-range:focus-visible{box-shadow:0 0 0 3px rgba(15,122,79,.3)}
`;

const CARD = 'bg-white rounded-3xl border border-emerald-900/5 shadow-[0_6px_24px_rgba(15,60,40,.06)]';

// Один критерий: ползунок. Ноль — «ещё не оценил», шаг 0,5.
export const ScoreCard: React.FC<{ label: string; value?: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => {
  const rated = typeof value === 'number' && value > 0;
  const look = CRITERION_LOOK[label];
  const Icon = look?.icon || Star;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold text-slate-900 leading-tight truncate">{label}</p>
            {look && <p className="text-xs text-slate-500 leading-snug">{look.hint}</p>}
          </div>
        </div>
        <span className={`shrink-0 min-w-[64px] text-center px-3 py-1.5 rounded-2xl text-lg font-black tabular-nums ${rated ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-300'}`}>
          {rated ? fmtScore(value!) : '—'}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className={`gr-range ${rated ? '' : 'unrated'}`}
        style={{ ['--p' as any]: `${((value ?? 0) / 10) * 100}%` }}
      />
      <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-2 px-1">
        <span>0</span>
        <span>2,5</span>
        <span>5</span>
        <span>7,5</span>
        <span>10</span>
      </div>
    </div>
  );
};

// Совместимость: прежнее имя элемента оценки.
export const ScoreInput = ScoreCard;

interface DishVotePanelProps {
  title: string;
  subtitle?: string;
  dishNames: string[];
  criteria: string[];
  allowComments: boolean;
  entries: Record<number, VoteDraft>;
  onScore: (dishIndex: number, criterion: string, value: number) => void;
  onComment: (dishIndex: number, comment: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
  missing?: string[] | null;
  error?: string | null;
  notice?: string | null;
  header?: React.ReactNode; // например, поле «Ваше имя» у владельца
  logo?: React.ReactNode;
}

export const DishVotePanel: React.FC<DishVotePanelProps> = ({
  title, subtitle, dishNames, criteria, allowComments, entries, onScore, onComment, onSubmit, isSubmitting,
  submitLabel = 'Отправить все оценки', missing, error, notice, header, logo,
}) => {
  const [view, setView] = useState<'list' | 'dish'>('list');
  const [active, setActive] = useState(0);
  // Какие блюда человек «отправил» кнопкой на блюде. Уже готовые оценки (черновик на телефоне или
  // прежний голос) считаются отправленными с самого начала, пока он сам ничего не трогал.
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [hint, setHint] = useState<string | null>(null);
  const [localMissing, setLocalMissing] = useState<string[] | null>(null);
  const touched = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isDone = (i: number) => criteria.length > 0 && criteria.every((c) => (entries[i]?.scores[c] ?? 0) > 0);
  const avgOf = (i: number) => {
    const rated = criteria.map((c) => entries[i]?.scores[c] ?? 0).filter((v) => v > 0);
    return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;
  };
  const isConfirmed = (i: number) => confirmed.has(i) && isDone(i);

  useEffect(() => {
    if (touched.current) return;
    const ready = dishNames.map((_, i) => i).filter(isDone);
    if (ready.length > 0) setConfirmed((cur) => (ready.every((i) => cur.has(i)) ? cur : new Set([...cur, ...ready])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'start' });
  }, [view, active]);
  useTelegramBackButton(view === 'dish', () => setView('list'));

  const idx = Math.min(active, Math.max(0, dishNames.length - 1));
  const confirmedCount = dishNames.filter((_, i) => isConfirmed(i)).length;

  const handleScore = (i: number, c: string, v: number) => {
    touched.current = true;
    setHint(null);
    onScore(i, c, v);
  };

  const openDish = (i: number) => {
    setActive(i);
    setHint(null);
    setView('dish');
  };

  // Кнопка на блюде: проверить, что оценено всё, отметить блюдо и вернуться к списку.
  const sendDish = () => {
    const notRated = criteria.filter((c) => !((entries[idx]?.scores[c] ?? 0) > 0));
    if (notRated.length > 0) {
      setHint(`Оцените все параметры: ${notRated.join(', ')}`);
      return;
    }
    touched.current = true;
    setHint(null);
    setLocalMissing(null);
    if (dishNames.length === 1) {
      setConfirmed(new Set([0]));
      onSubmit();
      return;
    }
    setConfirmed((cur) => new Set([...cur, idx]));
    setView('list');
  };

  const sendAll = () => {
    const left = dishNames.filter((_, i) => !isConfirmed(i));
    if (left.length > 0) {
      setLocalMissing(left);
      return;
    }
    setLocalMissing(null);
    onSubmit();
  };

  const shownMissing = (missing && missing.length > 0 ? missing : localMissing) || null;
  const missingText = (list: string[]) => (list.length === 1 && /имя|Не удалось|ошибк/i.test(list[0]) ? list[0] : `Не проголосовали за: ${list.join(', ')}`);

  const header_ = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-12 h-12 shrink-0 rounded-full bg-[#0f7a4f] flex items-center justify-center overflow-hidden">{logo}</span>
        <div className="min-w-0">
          <h1 className="text-xl font-black leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
      </div>
      <span className="shrink-0 px-3.5 py-2 rounded-full bg-white border border-emerald-900/5 shadow-sm text-sm font-black tabular-nums" title="Проголосовано блюд">
        {confirmedCount}/{dishNames.length}
      </span>
    </div>
  );

  // ----- Список блюд -----
  if (view === 'list') {
    const allDone = confirmedCount === dishNames.length && dishNames.length > 0;
    return (
      <div ref={rootRef} className="min-h-full text-slate-900" style={{ background: 'linear-gradient(180deg,#f3f8f5 0%,#eef4f0 100%)' }}>
        <style>{STYLE}</style>
        <div className="max-w-md mx-auto px-4 pt-4 pb-6 space-y-4">
          {header_}
          {header}
          <p className="text-sm text-slate-500 px-1">Нажмите на блюдо и оцените его. Когда оцените все, отправьте оценки.</p>

          {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3 text-sm font-bold">{notice}</div>}
          {shownMissing && <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl px-4 py-3 text-sm font-medium">{missingText(shownMissing)}</div>}
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl px-4 py-3 text-sm font-medium">{error}</div>}

          <div id="dish-vote-list" className="grid grid-cols-2 gap-3">
            {dishNames.map((name, i) => {
              const ok = isConfirmed(i);
              const avg = avgOf(i);
              const partial = !ok && avg != null;
              const b = scoreBand(avg);
              return (
                <button
                  key={i}
                  id={`dish-tile-${i}`}
                  data-voted={ok ? '1' : '0'}
                  onClick={() => openDish(i)}
                  className={`min-h-[104px] rounded-3xl p-4 text-left flex flex-col justify-between gap-2 transition-all border ${
                    ok
                      ? 'bg-emerald-50 border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,.35),0_10px_30px_rgba(16,185,129,.25)]'
                      : 'bg-white border-emerald-900/5 shadow-[0_6px_24px_rgba(15,60,40,.06)] hover:border-emerald-300'
                  }`}
                >
                  <span className={`block text-[15px] font-extrabold leading-snug break-words ${ok ? 'text-emerald-900' : 'text-slate-900'}`}>{name}</span>
                  <span className="flex items-center justify-between gap-2 text-xs font-bold">
                    {ok ? (
                      <>
                        <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-4 h-4" />Проголосовано</span>
                        <span className="tabular-nums text-emerald-800">{avg != null ? `${fmtAvg(avg)} ${b.emoji}` : ''}</span>
                      </>
                    ) : partial ? (
                      <span className="text-amber-600">Оценено не всё</span>
                    ) : (
                      <span className="text-slate-400">Нажмите, чтобы оценить</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-6 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(238,244,240,0) 0%,rgba(238,244,240,.92) 40%)' }}>
          <div className="max-w-md mx-auto rounded-[28px] bg-white/90 backdrop-blur-md p-4 pointer-events-auto shadow-[0_10px_30px_rgba(15,60,40,.12)]">
            <p className="text-xs font-bold text-slate-500 mb-2 text-center">
              Проголосовано блюд: <span className="text-slate-900">{confirmedCount} из {dishNames.length}</span>
            </p>
            <button
              id="dish-vote-send-all"
              onClick={sendAll}
              disabled={isSubmitting}
              className={`w-full min-h-[52px] rounded-full text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-colors disabled:opacity-60 ${
                allDone ? 'bg-[#0f7a4f] hover:bg-[#0a6d3e]' : 'bg-[#0f7a4f]/80 hover:bg-[#0f7a4f]'
              }`}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSubmitting ? 'Сохраняем…' : submitLabel}
              {!isSubmitting && <ArrowUpRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Оценка одного блюда -----
  const avg = avgOf(idx);
  const avgShown = avg == null ? null : Math.round(avg * 10) / 10; // цвет считаем по тому числу, которое видит человек
  const band = scoreBand(avgShown);
  const tone = TONE[band.tone];

  return (
    <div ref={rootRef} className="min-h-full text-slate-900" style={{ background: 'linear-gradient(180deg,#f3f8f5 0%,#eef4f0 100%)' }}>
      <style>{STYLE}</style>
      <div className="max-w-md mx-auto px-4 pt-4 pb-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            id="dish-vote-back"
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 min-h-[44px] pr-3 pl-2 rounded-full bg-white border border-emerald-900/5 shadow-sm text-sm font-extrabold text-emerald-800"
          >
            <ChevronLeft className="w-4 h-4" />
            К блюдам
          </button>
          <span className="shrink-0 px-3.5 py-2 rounded-full bg-white border border-emerald-900/5 shadow-sm text-sm font-black tabular-nums">
            {idx + 1}/{dishNames.length}
          </span>
        </div>

        <div className={`${CARD} p-5`}>
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{title}</p>
          <h2 className="text-[26px] leading-tight font-black mt-1 break-words">{dishNames[idx]}</h2>
          <p className="text-sm text-slate-500 mt-1">Двигайте ползунки, средний балл считается сразу</p>
        </div>

        <p className="text-sm font-extrabold text-slate-900 px-1 pt-1">Параметры оценки</p>
        {criteria.map((c) => (
          <ScoreCard key={`${idx}-${c}`} label={c} value={entries[idx]?.scores[c]} onChange={(v) => handleScore(idx, c, v)} />
        ))}

        {allowComments && (
          <div className={`${CARD} p-4`}>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">Комментарий (необязательно)</label>
            <textarea
              value={entries[idx]?.comment || ''}
              onChange={(e) => {
                touched.current = true;
                onComment(idx, e.target.value);
              }}
              rows={3}
              placeholder="Что понравилось, что можно улучшить?"
              className="w-full px-3 py-2 text-base border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-900"
            />
          </div>
        )}
        {(error || (dishNames.length === 1 && shownMissing)) && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl px-4 py-3 text-sm font-medium">{error || (shownMissing ? missingText(shownMissing) : '')}</div>
        )}
      </div>

      {/* Светящийся средний балл + отправка этого блюда */}
      <div className="sticky bottom-0 z-20 px-3 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-6 pointer-events-none" style={{ background: 'linear-gradient(180deg,rgba(238,244,240,0) 0%,rgba(238,244,240,.92) 40%)' }}>
        <div
          id="dish-vote-average"
          className="max-w-md mx-auto rounded-[28px] bg-white/90 backdrop-blur-md p-4 pointer-events-auto transition-shadow duration-300"
          style={{ boxShadow: tone.glow }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Средний балл за блюдо</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span id="dish-vote-average-value" data-tone={band.tone} className={`text-[44px] leading-none font-black tabular-nums transition-colors ${tone.text}`}>
                  {avgShown == null ? '—' : avgShown.toFixed(1).replace('.', ',')}
                </span>
                <span className="text-base font-bold text-slate-400">/ 10</span>
              </div>
              <div className="flex items-center gap-0.5 mt-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((s) => {
                  const fill = avg == null ? 0 : Math.max(0, Math.min(1, avg / 2 - s));
                  return (
                    <span key={s} className="relative inline-block w-[18px] h-[18px] text-[18px] leading-[18px]" style={{ color: '#d5ddd9' }}>
                      ★
                      <span className="absolute left-0 top-0 overflow-hidden" style={{ width: `${fill * 100}%`, color: tone.star }}>★</span>
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="text-center shrink-0">
              <div id="dish-vote-emoji" className="text-[44px] leading-none transition-transform duration-300" style={{ transform: band.tone === 'none' ? 'scale(.9)' : 'scale(1.06)' }}>
                {band.emoji}
              </div>
              <p className={`text-xs font-extrabold mt-1 ${tone.text}`}>{band.word}</p>
            </div>
          </div>
          {hint && <p className="mt-3 text-xs font-bold text-rose-600">{hint}</p>}
          <button
            id="dish-vote-send-dish"
            onClick={sendDish}
            disabled={isSubmitting}
            className="mt-3 w-full min-h-[52px] rounded-full bg-[#0f7a4f] hover:bg-[#0a6d3e] active:bg-[#09603a] disabled:opacity-60 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isSubmitting ? 'Сохраняем…' : dishNames.length === 1 ? submitLabel : 'Отправить голосование'}
            {!isSubmitting && <ArrowUpRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
