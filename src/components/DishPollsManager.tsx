import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Copy, Check, X, Trash2, RotateCcw, ChevronLeft, Vote, MessageSquare, Settings, Minus,
  BarChart3, Printer, CheckCircle2, Download,
} from 'lucide-react';
import { DishPoll, DishPollVote, SUGGESTED_DISH_POLL_CRITERIA } from '../types';
import { ScoreInput } from './DishPollVoteScreen';
import { PrintDishPollReport } from './PrintDishPollReport';

interface DishPollsManagerProps {
  telegramInitData: string;
}

type WorkspaceMode = 'vote' | 'analytics' | 'settings';

const BOT_USERNAME = 'Master_Bekarybot';

const linkFor = (pollId: string) => `https://t.me/${BOT_USERNAME}?startapp=vote_${pollId}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const makeDishNames = (count: number) => Array.from({ length: count }, (_, i) => `Блюдо ${i + 1}`);

// 1 блюдо / 2 блюда / 5 блюд — иначе на карточке голосования висит «5 оценка».
const plural = (n: number, one: string, few: string, many: string) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

// Deterministic id for a typed name, so the same physical taster re-entering the same name on
// the Owner's own device corrects their earlier entry instead of creating a duplicate — same
// "re-voting corrects the row" behaviour the anonymous customer link already relies on.
const slugifyName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9-]/gi, '') || 'voter';

interface VoteDraft {
  scores: Record<string, number>;
  comment?: string;
}

// Дегустацию проводят долго и с одного телефона по кругу. Если приложение свернётся и
// выгрузится, незаконченные оценки текущего дегустатора пропадут — поэтому держим их копию
// на устройстве вместе с именем, чтобы было видно, чей это черновик.
const ownerDraftKey = (pollId: string) => `mc-bekary-owner-vote-draft-${pollId}`;
const pollSignature = (poll: DishPoll) => `${poll.dishNames.length}|${poll.criteria.join('~')}`;

const readOwnerDraft = (poll: DishPoll): { voterName: string; entries: Record<number, VoteDraft> } | null => {
  try {
    const raw = window.localStorage.getItem(ownerDraftKey(poll.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Блюда или критерии поменялись — старые оценки встали бы не туда.
    if (parsed?.signature !== pollSignature(poll)) return null;
    return { voterName: parsed.voterName || '', entries: parsed.entries || {} };
  } catch {
    return null;
  }
};

const writeOwnerDraft = (poll: DishPoll, voterName: string, entries: Record<number, VoteDraft>) => {
  try {
    window.localStorage.setItem(
      ownerDraftKey(poll.id),
      JSON.stringify({ signature: pollSignature(poll), voterName, entries })
    );
  } catch {
    // Приватный режим или переполненное хранилище — работаем как раньше.
  }
};

const clearOwnerDraft = (pollId: string) => {
  try {
    window.localStorage.removeItem(ownerDraftKey(pollId));
  } catch {
    // см. writeOwnerDraft
  }
};

export const DishPollsManager: React.FC<DishPollsManagerProps> = ({ telegramInitData }) => {
  const [polls, setPolls] = useState<DishPoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [customCriterion, setCustomCriterion] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [dishCount, setDishCount] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrPollId, setQrPollId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Poll workspace (vote / analytics / settings for one open poll) ----
  const [workspacePollId, setWorkspacePollId] = useState<string | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>('vote');

  const [voterName, setVoterName] = useState('');
  const [voteEntries, setVoteEntries] = useState<Record<number, VoteDraft>>({});
  const [activeDishIndex, setActiveDishIndex] = useState<number | null>(null);
  const [voteMissing, setVoteMissing] = useState<string[] | null>(null);
  const [isSavingVote, setIsSavingVote] = useState(false);
  const [voteSaved, setVoteSaved] = useState(false);

  const [analyticsResults, setAnalyticsResults] = useState<{ votes: DishPollVote[]; averages: Record<string, number>[] } | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [filterDishIndex, setFilterDishIndex] = useState<number | ''>('');
  const [filterPersonKey, setFilterPersonKey] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const filtersCardRef = useRef<HTMLDivElement>(null);

  const [settingsName, setSettingsName] = useState('');
  const [settingsDishNames, setSettingsDishNames] = useState<string[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newCriterion, setNewCriterion] = useState('');

  const loadPolls = () => {
    setIsLoading(true);
    fetch('/api/dish-polls')
      .then((r) => r.json())
      .then((data) => setPolls(data.polls || []))
      .catch((e) => console.error('Failed to load dish polls:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadPolls, []);

  const workspacePoll = polls.find((p) => p.id === workspacePollId);
  const qrPoll = polls.find((p) => p.id === qrPollId);

  useEffect(() => {
    if (mode !== 'analytics' || !workspacePollId) return;
    setIsAnalyticsLoading(true);
    fetch(`/api/dish-polls/${encodeURIComponent(workspacePollId)}/results`)
      .then((r) => r.json())
      .then((data) => setAnalyticsResults({ votes: data.votes || [], averages: data.averages || [] }))
      .catch((e) => console.error('Failed to load dish poll results:', e))
      .finally(() => setIsAnalyticsLoading(false));
  }, [mode, workspacePollId]);

  const openCreateForm = (copyFrom?: DishPoll) => {
    setName('');
    setSelectedCriteria(copyFrom ? [...copyFrom.criteria] : []);
    setCustomCriterion('');
    setAllowComments(copyFrom ? copyFrom.allowComments : true);
    setDishCount(copyFrom ? copyFrom.dishNames.length : 1);
    setIsCreating(true);
    setError(null);
  };

  const toggleCriterion = (c: string) => {
    setSelectedCriteria((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };
  const addCustomCriterion = () => {
    const c = customCriterion.trim();
    if (!c || selectedCriteria.includes(c)) return;
    setSelectedCriteria((prev) => [...prev, c]);
    setCustomCriterion('');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Заполните название голосования.');
      return;
    }
    if (selectedCriteria.length === 0) {
      setError('Выберите хотя бы один критерий оценки.');
      return;
    }
    if (dishCount < 1) {
      setError('Укажите количество блюд.');
      return;
    }
    setError(null);
    const poll = {
      id: `poll-${Date.now()}`,
      name: name.trim(),
      criteria: selectedCriteria,
      allowComments,
      dishNames: makeDishNames(dishCount),
    };
    const res = await fetch('/api/dish-polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegramInitData, poll }),
    });
    if (!res.ok) {
      setError('Не удалось создать голосование. Попробуйте ещё раз.');
      return;
    }
    setIsCreating(false);
    loadPolls();
  };

  const handleToggleStatus = async (poll: DishPoll) => {
    const status = poll.status === 'active' ? 'closed' : 'active';
    setPolls((prev) => prev.map((p) => (p.id === poll.id ? { ...p, status } : p)));
    await fetch(`/api/dish-polls/${encodeURIComponent(poll.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegramInitData, updates: { status } }),
    }).catch((e) => console.error('Failed to update dish poll:', e));
  };

  const handleDelete = async (poll: DishPoll) => {
    if (!window.confirm(`Удалить голосование «${poll.name}» вместе со всеми оценками?`)) return;
    setPolls((prev) => prev.filter((p) => p.id !== poll.id));
    await fetch(`/api/dish-polls/${encodeURIComponent(poll.id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegramInitData }),
    }).catch((e) => console.error('Failed to delete dish poll:', e));
  };

  // В Telegram есть свой способ сохранить файл (Bot API 8.0), в обычном браузере — обычная
  // ссылка со скачиванием. Работает и то, и другое, потому что картинка отдаётся с нашего же
  // адреса, а не со стороннего сервиса.
  const handleDownloadQr = (poll: DishPoll) => {
    const url = `${window.location.origin}/api/dish-polls/${encodeURIComponent(poll.id)}/qr?size=800&download=1`;
    const tg = (window as any).Telegram?.WebApp;
    if (typeof tg?.downloadFile === 'function') {
      tg.downloadFile({ url, file_name: `qr-${poll.name}.png` });
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${poll.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCopyLink = (poll: DishPoll) => {
    navigator.clipboard?.writeText(linkFor(poll.id)).then(() => {
      setCopiedId(poll.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const openWorkspace = (poll: DishPoll) => {
    setWorkspacePollId(poll.id);
    setMode('vote');
    const tg = (window as any).Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    // Незаконченная дегустация с прошлого захода важнее пустой формы — возвращаем её
    // вместе с именем того, кто не дооценил.
    const draft = readOwnerDraft(poll);
    setVoterName(draft ? draft.voterName : user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '');
    setVoteEntries(draft ? draft.entries : {});
    setActiveDishIndex(null);
    setVoteMissing(null);
    setVoteSaved(false);
    setSettingsName(poll.name);
    setSettingsDishNames([...poll.dishNames]);
    setNewCriterion('');
    setAnalyticsResults(null);
    setFilterDishIndex('');
    setFilterPersonKey('');
  };

  const closeWorkspace = () => {
    setWorkspacePollId(null);
    loadPolls();
  };

  // ---- Vote mode ----
  // Ноль = ползунок не трогали, значит блюдо ещё не оценено.
  const isDishDone = (dishIndex: number) =>
    !!workspacePoll && workspacePoll.criteria.every((c) => (voteEntries[dishIndex]?.scores[c] ?? 0) > 0);

  const updateVoteScore = (dishIndex: number, criterion: string, value: number) => {
    setVoteEntries((prev) => ({
      ...prev,
      [dishIndex]: { ...prev[dishIndex], scores: { ...(prev[dishIndex]?.scores || {}), [criterion]: value } },
    }));
  };
  const updateVoteComment = (dishIndex: number, comment: string) => {
    setVoteEntries((prev) => ({ ...prev, [dishIndex]: { scores: prev[dishIndex]?.scores || {}, comment } }));
  };

  useEffect(() => {
    if (!workspacePoll || mode !== 'vote') return;
    if (Object.keys(voteEntries).length === 0) return;
    writeOwnerDraft(workspacePoll, voterName, voteEntries);
  }, [voteEntries, voterName, workspacePoll, mode]);

  const handleSaveVote = async () => {
    if (!workspacePoll) return;
    const missing = workspacePoll.dishNames.filter((_, i) => !isDishDone(i));
    if (missing.length > 0) {
      setVoteMissing(missing);
      return;
    }
    if (!voterName.trim()) {
      setVoteMissing(['Укажите имя дегустатора вверху экрана']);
      return;
    }
    setVoteMissing(null);
    setIsSavingVote(true);
    try {
      const res = await fetch(`/api/dish-polls/${encodeURIComponent(workspacePoll.id)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: `internal-${slugifyName(voterName)}`,
          telegramName: voterName.trim(),
          entries: workspacePoll.dishNames.map((_, i) => ({
            scores: voteEntries[i].scores,
            comment: voteEntries[i].comment?.trim() || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as any);
        setVoteMissing([data.error || 'Не удалось сохранить оценки.']);
        return;
      }
      clearOwnerDraft(workspacePoll.id);
      setVoteEntries({});
      setActiveDishIndex(null);
      setVoteSaved(true);
      setTimeout(() => setVoteSaved(false), 2500);
      loadPolls();
    } finally {
      setIsSavingVote(false);
    }
  };

  // ---- Settings mode ----
  const handleAddDishLocally = () => {
    setSettingsDishNames((prev) => [...prev, `Блюдо ${prev.length + 1}`]);
  };

  const handleDeleteDish = async (i: number) => {
    if (!workspacePoll || settingsDishNames.length <= 1) return;
    if (!window.confirm(`Удалить «${settingsDishNames[i]}» вместе со всеми оценками по этому блюду?`)) return;
    await fetch(`/api/dish-polls/${encodeURIComponent(workspacePoll.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegramInitData, updates: { deleteDishIndex: i } }),
    }).catch((e) => console.error('Failed to delete dish:', e));
    setSettingsDishNames((prev) => prev.filter((_, idx) => idx !== i));
    loadPolls();
  };

  const handleSaveSettingsNames = async () => {
    if (!workspacePoll) return;
    const cleanNames = settingsDishNames.map((n) => n.trim()).filter(Boolean);
    if (!settingsName.trim() || cleanNames.length === 0) return;
    setIsSavingSettings(true);
    try {
      await fetch(`/api/dish-polls/${encodeURIComponent(workspacePoll.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData, updates: { name: settingsName.trim(), dishNames: cleanNames } }),
      });
      loadPolls();
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddCriterion = async () => {
    const c = newCriterion.trim();
    if (!c || !workspacePoll) return;
    await fetch(`/api/dish-polls/${encodeURIComponent(workspacePoll.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegramInitData, updates: { addCriterion: c } }),
    }).catch((e) => console.error('Failed to add criterion:', e));
    setNewCriterion('');
    loadPolls();
  };

  // ---- Analytics mode ----
  const overallDishScore = (dishIndex: number): number => {
    if (!workspacePoll) return 0;
    const perCriterion = analyticsResults?.averages[dishIndex] || {};
    const vals = workspacePoll.criteria.map((c) => perCriterion[c]).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const globalCriteriaAverages = (): Record<string, number> => {
    if (!analyticsResults) return {};
    const totals: Record<string, { sum: number; count: number }> = {};
    analyticsResults.votes.forEach((v) =>
      v.entries.forEach((entry) => {
        Object.entries(entry.scores).forEach(([c, score]) => {
          if (!totals[c]) totals[c] = { sum: 0, count: 0 };
          totals[c].sum += Number(score) || 0;
          totals[c].count += 1;
        });
      })
    );
    const out: Record<string, number> = {};
    Object.entries(totals).forEach(([c, { sum, count }]) => {
      out[c] = count > 0 ? sum / count : 0;
    });
    return out;
  };

  const dishRanking = workspacePoll
    ? workspacePoll.dishNames.map((name, i) => ({ index: i, name, score: overallDishScore(i) }))
    : [];
  // Топ и антитоп не должны пересекаться: при 10 блюдах «первая десятка» и «последняя
  // десятка» — это один и тот же список дважды, только задом наперёд. Поэтому при небольшом
  // числе блюд делим пополам, а полноценные топ-10/антитоп-10 включаются от 20 блюд.
  const topCount = Math.min(10, Math.ceil(dishRanking.length / 2));
  const bottomCount = Math.min(10, Math.floor(dishRanking.length / 2));
  const topDishes = [...dishRanking].sort((a, b) => b.score - a.score).slice(0, topCount);
  const bottomDishes = [...dishRanking].sort((a, b) => a.score - b.score).slice(0, bottomCount);

  const people: DishPollVote[] = [];
  if (analyticsResults) {
    const seenVoterIds = new Set<string>();
    for (const v of analyticsResults.votes) {
      if (!seenVoterIds.has(v.telegramUserId)) {
        seenVoterIds.add(v.telegramUserId);
        people.push(v);
      }
    }
  }
  const dishFilterRows =
    filterDishIndex === '' || !analyticsResults
      ? []
      : analyticsResults.votes
          .filter((v) => v.entries[filterDishIndex as number])
          .map((v) => ({ vote: v, entry: v.entries[filterDishIndex as number] }));
  const personFilterVote = filterPersonKey
    ? analyticsResults?.votes.find((v) => v.telegramUserId === filterPersonKey)
    : undefined;

  const viewDishVotes = (dishIndex: number) => {
    setFilterDishIndex(dishIndex);
    filtersCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ==================== Workspace ====================
  if (workspacePoll) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={closeWorkspace}
            className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:text-indigo-900"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Ко всем голосованиям</span>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMode(mode === 'analytics' ? 'vote' : 'analytics')}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                mode === 'analytics' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
              title="Аналитика"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode(mode === 'settings' ? 'vote' : 'settings')}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                mode === 'settings' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
              title="Настройки"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-2">
          <h3 className="text-lg font-extrabold text-slate-900 flex-1 truncate">{workspacePoll.name}</h3>
          <span
            className={`shrink-0 text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
              workspacePoll.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {workspacePoll.status === 'active' ? 'Идёт' : 'Завершено'}
          </span>
        </div>

        {/* ---- Settings mode ---- */}
        {mode === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Название голосования
                </label>
                <input
                  type="text"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Блюда
                </label>
                <div className="space-y-2">
                  {settingsDishNames.map((n, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={n}
                        onChange={(e) =>
                          setSettingsDishNames((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                        }
                        className="flex-1 px-3 min-h-[44px] text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                      />
                      {settingsDishNames.length > 1 && (
                        <button
                          onClick={() => handleDeleteDish(i)}
                          className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddDishLocally}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 uppercase tracking-wider"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить блюдо</span>
                </button>
              </div>

              <button
                onClick={handleSaveSettingsNames}
                disabled={isSavingSettings}
                className="w-full min-h-[48px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
              >
                {isSavingSettings ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Критерии оценки
              </label>
              <div className="flex flex-wrap gap-1.5">
                {workspacePoll.criteria.map((c) => (
                  <span key={c} className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1.5 rounded-lg">
                    {c}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCriterion())}
                  placeholder="Новый критерий…"
                  className="flex-1 px-3 min-h-[40px] text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
                <button
                  onClick={handleAddCriterion}
                  className="min-h-[40px] px-3 flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 uppercase tracking-wider"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Существующие критерии нельзя удалить — иначе прошлые оценки станут некорректными. Можно только
                добавлять новые.
              </p>
            </div>
          </div>
        )}

        {/* ---- Analytics mode ---- */}
        {mode === 'analytics' && (
          <div className="space-y-4">
            {/* Оба фильтра сразу под названием голосования, в один ряд — по ним чаще всего и
                хотят посмотреть, кто как оценил конкретное блюдо или конкретный человек. */}
            <div ref={filtersCardRef} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Блюдо
                  </label>
                  <select
                    value={filterDishIndex}
                    onChange={(e) => setFilterDishIndex(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-2 min-h-[44px] text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  >
                    <option value="">Все</option>
                    {workspacePoll.dishNames.map((n, i) => (
                      <option key={i} value={i}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Человек
                  </label>
                  <select
                    value={filterPersonKey}
                    onChange={(e) => setFilterPersonKey(e.target.value)}
                    className="w-full px-2 min-h-[44px] text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                  >
                    <option value="">Все</option>
                    {people.map((p) => (
                      <option key={p.telegramUserId} value={p.telegramUserId}>
                        {p.telegramName}{p.telegramUsername ? ` (@${p.telegramUsername})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filterDishIndex !== '' && (
                <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                  <p className="text-[11px] font-black uppercase text-indigo-700 pb-1">
                    {workspacePoll.dishNames[filterDishIndex]} — кто как оценил
                  </p>
                  {dishFilterRows.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Пока никто не оценил это блюдо.</p>
                  ) : (
                    dishFilterRows.map(({ vote, entry }) => (
                      <div key={vote.id} className="py-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">{vote.telegramName}</span>
                          <span className="text-[11px] text-slate-400">{formatDate(vote.createdAt)}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          {Object.entries(entry.scores).map(([c, s]) => (
                            <span key={c} className="text-xs text-slate-600">{c}: <b className="text-slate-900">{s}</b></span>
                          ))}
                        </div>
                        {entry.comment && (
                          <div className="flex items-start gap-1.5 mt-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" />
                            <span>{entry.comment}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {personFilterVote && (
                <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                  <p className="text-[11px] font-black uppercase text-indigo-700 pb-1">
                    {personFilterVote.telegramName} — все его оценки
                  </p>
                  {personFilterVote.entries.map((entry, i) => (
                    <div key={i} className="py-2">
                      <span className="font-bold text-sm text-slate-900">{workspacePoll.dishNames[i]}</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        {Object.entries(entry.scores).map(([c, s]) => (
                          <span key={c} className="text-xs text-slate-600">{c}: <b className="text-slate-900">{s}</b></span>
                        ))}
                      </div>
                      {entry.comment && (
                        <div className="flex items-start gap-1.5 mt-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" />
                          <span>{entry.comment}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleStatus(workspacePoll)}
                className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{workspacePoll.status === 'active' ? 'Завершить голосование' : 'Возобновить голосование'}</span>
              </button>
              <button
                onClick={() => setIsPrintOpen(true)}
                className="flex items-center justify-center gap-1.5 min-h-[44px] px-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold uppercase tracking-wider text-indigo-700 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Распечатать</span>
              </button>
            </div>

            {isAnalyticsLoading ? (
              <p className="text-center text-sm text-slate-400 py-6">Загружаем…</p>
            ) : !analyticsResults || analyticsResults.votes.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
                Пока никто не проголосовал.
              </div>
            ) : (
              <>
                {/* Ключевые цифры — сразу видно с телефона, не листая вниз. */}
                <div className="bg-indigo-600 rounded-2xl p-4 flex items-center justify-between text-white shadow-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Проголосовало</p>
                    <p className="text-3xl font-black tabular-nums leading-tight">{analyticsResults.votes.length}</p>
                  </div>
                  <Vote className="w-9 h-9 text-indigo-300" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl border border-emerald-200 p-4">
                    <h4 className="text-xs font-black uppercase text-emerald-700 mb-2">Топ блюд</h4>
                    {topDishes.map((d, rank) => (
                      <button
                        key={d.index}
                        onClick={() => viewDishVotes(d.index)}
                        className="w-full flex items-center justify-between text-sm py-1 hover:bg-emerald-50 rounded-lg px-1 -mx-1 transition-all"
                      >
                        <span className="text-slate-700 truncate">{rank + 1}. {d.name}</span>
                        <span className="font-black text-slate-900 tabular-nums shrink-0">{d.score.toFixed(1)}</span>
                      </button>
                    ))}
                  </div>
                  <div className={`bg-white rounded-2xl border border-rose-200 p-4 ${bottomDishes.length === 0 ? 'hidden' : ''}`}>
                    <h4 className="text-xs font-black uppercase text-rose-700 mb-2">Антитоп блюд</h4>
                    {bottomDishes.map((d, rank) => (
                      <button
                        key={d.index}
                        onClick={() => viewDishVotes(d.index)}
                        className="w-full flex items-center justify-between text-sm py-1 hover:bg-rose-50 rounded-lg px-1 -mx-1 transition-all"
                      >
                        <span className="text-slate-700 truncate">{rank + 1}. {d.name}</span>
                        <span className="font-black text-slate-900 tabular-nums shrink-0">{d.score.toFixed(1)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1 pt-1">
                  Подробно по каждому блюду — нажмите, чтобы увидеть кто как проголосовал
                </h4>

                {workspacePoll.dishNames.map((dishName, dishIndex) => (
                  <button
                    key={dishIndex}
                    onClick={() => viewDishVotes(dishIndex)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 p-4 space-y-3 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700">{dishName}</h4>
                      <span className="text-sm font-black text-slate-900 tabular-nums">
                        {overallDishScore(dishIndex).toFixed(1)}
                      </span>
                    </div>
                    {workspacePoll.criteria.map((c) => {
                      // Критерий могли добавить уже после того, как люди проголосовали — по нему
                      // данных нет вовсе, и «0.0» читалось бы как «всем поставили ноль».
                      const avg = analyticsResults.averages[dishIndex]?.[c];
                      const hasData = typeof avg === 'number';
                      return (
                        <div key={c} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-700">{c}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full"
                                style={{ width: `${((avg || 0) / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-black text-slate-900 tabular-nums w-9 text-right">
                              {hasData ? avg.toFixed(1) : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </button>
                ))}

                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Критерии в среднем по всем блюдам
                  </h4>
                  {Object.entries(globalCriteriaAverages()).map(([c, avg]) => (
                    <div key={c} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-700">{c}</span>
                      <span className="text-sm font-black text-slate-900 tabular-nums">{avg.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ---- Vote mode ---- */}
        {mode === 'vote' && (
          activeDishIndex === null ? (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Ваше имя
                </label>
                <input
                  type="text"
                  value={voterName}
                  onChange={(e) => setVoterName(e.target.value)}
                  placeholder="Имя дегустатора"
                  className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                />
              </div>

              {voteSaved && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-bold">
                  Оценки сохранены!
                </div>
              )}
              {voteMissing && (
                <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 text-sm font-medium">
                  Не проголосовали за: {voteMissing.join(', ')}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {workspacePoll.dishNames.map((dishName, i) => {
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

              <button
                onClick={handleSaveVote}
                disabled={isSavingVote}
                className="w-full min-h-[52px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
              >
                {isSavingVote ? 'Сохраняем…' : 'Сохранить оценки'}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-6">
              <button
                onClick={() => setActiveDishIndex(null)}
                className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:text-indigo-900"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Назад к блюдам</span>
              </button>
              <h4 className="text-sm font-black uppercase tracking-wider text-indigo-700">
                {workspacePoll.dishNames[activeDishIndex]}
              </h4>
              {workspacePoll.criteria.map((c) => (
                <ScoreInput
                  key={c}
                  label={c}
                  value={voteEntries[activeDishIndex]?.scores[c]}
                  onChange={(v) => updateVoteScore(activeDishIndex, c, v)}
                />
              ))}
              {workspacePoll.allowComments && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Комментарий (необязательно)
                  </label>
                  <textarea
                    value={voteEntries[activeDishIndex]?.comment || ''}
                    onChange={(e) => updateVoteComment(activeDishIndex, e.target.value)}
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
          )
        )}

        {isPrintOpen && analyticsResults && (
          <PrintDishPollReport
            poll={workspacePoll}
            averages={analyticsResults.averages}
            globalCriteriaAverages={globalCriteriaAverages()}
            ranking={[...dishRanking].sort((a, b) => b.score - a.score)}
            votes={analyticsResults.votes}
            voteCount={analyticsResults.votes.length}
            onClose={() => setIsPrintOpen(false)}
          />
        )}
      </div>
    );
  }

  // ==================== Create form (constructor) ====================
  if (isCreating) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setIsCreating(false)}
          className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:text-indigo-900"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Отмена</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Название голосования
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Дегустация 20.09"
              autoFocus
              className="w-full px-3 min-h-[48px] text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Критерии оценки — общая плитка для всех блюд
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {SUGGESTED_DISH_POLL_CRITERIA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCriterion(c)}
                  className={`min-h-[40px] px-3 rounded-lg text-xs font-bold transition-all ${
                    selectedCriteria.includes(c)
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {selectedCriteria.some((c) => !(SUGGESTED_DISH_POLL_CRITERIA as readonly string[]).includes(c)) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedCriteria
                  .filter((c) => !(SUGGESTED_DISH_POLL_CRITERIA as readonly string[]).includes(c))
                  .map((c) => (
                    <span
                      key={c}
                      className="flex items-center gap-1 bg-indigo-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg"
                    >
                      {c}
                      <button onClick={() => toggleCriterion(c)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={customCriterion}
                onChange={(e) => setCustomCriterion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCriterion())}
                placeholder="Свой критерий…"
                className="flex-1 px-3 min-h-[40px] text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
              <button
                onClick={addCustomCriterion}
                className="min-h-[40px] px-3 flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Количество блюд
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDishCount((n) => Math.max(1, n - 1))}
                className="w-11 h-11 shrink-0 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-lg font-black text-slate-900 tabular-nums w-8 text-center">{dishCount}</span>
              <button
                type="button"
                onClick={() => setDishCount((n) => Math.min(20, n + 1))}
                className="w-11 h-11 shrink-0 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700"
              >
                <Plus className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400">
                Блюда получат имена «Блюдо 1», «Блюдо 2»… — переименовать можно позже в настройках голосования.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Комментарии</p>
              <p className="text-[11px] text-slate-500">Дать голосующим поле для отзыва по каждому блюду</p>
            </div>
            <button
              type="button"
              onClick={() => setAllowComments((v) => !v)}
              className={`w-11 h-6 shrink-0 rounded-full relative transition-colors ${
                allowComments ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  allowComments ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            className="w-full min-h-[52px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
          >
            Создать голосование
          </button>
        </div>
      </div>
    );
  }

  // ==================== List ====================
  return (
    <div className="space-y-4">
      <button
        onClick={() => openCreateForm()}
        className="w-full min-h-[52px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
      >
        <Plus className="w-4 h-4" />
        <span>Новое голосование</span>
      </button>

      {isLoading ? (
        <p className="text-center text-sm text-slate-400 py-6">Загружаем…</p>
      ) : polls.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
          Голосований пока не было.
        </div>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => (
            <div key={poll.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{poll.name}</h4>
                    <span
                      className={`shrink-0 text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        poll.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {poll.status === 'active' ? 'Идёт' : 'Завершено'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {poll.dishNames.length} {plural(poll.dishNames.length, 'блюдо', 'блюда', 'блюд')} ·{' '}
                    {poll.criteria.length} {plural(poll.criteria.length, 'критерий', 'критерия', 'критериев')} ·{' '}
                    {poll.voteCount || 0} {plural(poll.voteCount || 0, 'оценка', 'оценки', 'оценок')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openWorkspace(poll)}
                className="w-full flex items-center justify-center gap-1.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-all"
              >
                <Vote className="w-3.5 h-3.5" />
                <span>Открыть голосование</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCopyLink(poll)}
                  className="flex items-center justify-center gap-1.5 min-h-[40px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold uppercase tracking-wider text-indigo-700 transition-all"
                >
                  {copiedId === poll.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === poll.id ? 'Скопировано' : 'Ссылка'}</span>
                </button>
                <button
                  onClick={() => openCreateForm(poll)}
                  className="flex items-center justify-center gap-1.5 min-h-[40px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </button>
              </div>

              {/* QR отдаётся нашим сервером (см. /api/dish-polls/:id/qr), нажатие открывает
                  его крупно — так его можно показать гостям с экрана или сохранить. */}
              <div className="flex items-center gap-3 pt-1">
                <button onClick={() => setQrPollId(poll.id)} className="shrink-0">
                  <img
                    src={`/api/dish-polls/${encodeURIComponent(poll.id)}/qr?size=240`}
                    alt="QR-код голосования"
                    className="w-20 h-20 rounded-lg border border-slate-200"
                  />
                </button>
                <p className="text-[11px] text-slate-400 flex-1">
                  Нажмите на QR, чтобы открыть крупно и скачать. Его можно распечатать или
                  показать с экрана — он сразу откроет форму оценки в Telegram, без регистрации.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => handleToggleStatus(poll)}
                  className="flex-1 flex items-center justify-center gap-1.5 min-h-[36px] text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{poll.status === 'active' ? 'Завершить' : 'Возобновить'}</span>
                </button>
                <button
                  onClick={() => handleDelete(poll)}
                  className="flex items-center justify-center gap-1.5 min-h-[36px] px-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-rose-600 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrPoll && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 truncate">{qrPoll.name}</h4>
              <button
                onClick={() => setQrPollId(null)}
                className="w-9 h-9 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={`/api/dish-polls/${encodeURIComponent(qrPoll.id)}/qr?size=800`}
              alt="QR-код голосования"
              className="w-full rounded-xl border border-slate-200"
            />
            <p className="text-[11px] text-slate-400 text-center break-all">{linkFor(qrPoll.id)}</p>
            <button
              onClick={() => handleDownloadQr(qrPoll)}
              className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Скачать QR</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Картинку также можно сохранить долгим нажатием по ней.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
