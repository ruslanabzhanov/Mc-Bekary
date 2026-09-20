import React, { useEffect, useState } from 'react';
import {
  Plus, Copy, Check, X, Trash2, RotateCcw, ChevronLeft, Vote, MessageSquare, Settings, Minus,
} from 'lucide-react';
import { DishPoll, DishPollVote, SUGGESTED_DISH_POLL_CRITERIA } from '../types';

interface DishPollsManagerProps {
  telegramInitData: string;
}

const BOT_USERNAME = 'Master_Bekarybot';

const linkFor = (pollId: string) => `https://t.me/${BOT_USERNAME}?startapp=vote_${pollId}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const makeDishNames = (count: number) => Array.from({ length: count }, (_, i) => `Блюдо ${i + 1}`);

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
  const [openPollId, setOpenPollId] = useState<string | null>(null);
  const [settingsPollId, setSettingsPollId] = useState<string | null>(null);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDishNames, setSettingsDishNames] = useState<string[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [results, setResults] = useState<{ votes: DishPollVote[]; averages: Record<string, number>[] } | null>(null);
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolls = () => {
    setIsLoading(true);
    fetch('/api/dish-polls')
      .then((r) => r.json())
      .then((data) => setPolls(data.polls || []))
      .catch((e) => console.error('Failed to load dish polls:', e))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadPolls, []);

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
    if (!name.trim() || selectedCriteria.length === 0 || dishCount < 1) {
      setError('Нужно название голосования и хотя бы один критерий.');
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

  const handleCopyLink = (poll: DishPoll) => {
    navigator.clipboard?.writeText(linkFor(poll.id)).then(() => {
      setCopiedId(poll.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const openResults = (poll: DishPoll) => {
    setOpenPollId(poll.id);
    setIsResultsLoading(true);
    fetch(`/api/dish-polls/${encodeURIComponent(poll.id)}/results`)
      .then((r) => r.json())
      .then((data) => setResults({ votes: data.votes || [], averages: data.averages || [] }))
      .catch((e) => console.error('Failed to load dish poll results:', e))
      .finally(() => setIsResultsLoading(false));
  };

  const openSettings = (poll: DishPoll) => {
    setSettingsPollId(poll.id);
    setSettingsName(poll.name);
    setSettingsDishNames([...poll.dishNames]);
  };

  const handleSaveSettings = async () => {
    const cleanNames = settingsDishNames.map((n) => n.trim()).filter(Boolean);
    if (!settingsName.trim() || cleanNames.length === 0) return;
    setIsSavingSettings(true);
    try {
      await fetch(`/api/dish-polls/${encodeURIComponent(settingsPollId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: telegramInitData,
          updates: { name: settingsName.trim(), dishNames: cleanNames },
        }),
      });
      setSettingsPollId(null);
      loadPolls();
    } catch (e) {
      console.error('Failed to save dish poll settings:', e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openPoll = polls.find((p) => p.id === openPollId);
  const settingsPoll = polls.find((p) => p.id === settingsPollId);

  // ---- Settings view (rename the poll + its dishes) ----
  if (settingsPoll) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSettingsPollId(null)}
          className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:text-indigo-900"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Отмена</span>
        </button>

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
              Названия блюд
            </label>
            <div className="space-y-2">
              {settingsDishNames.map((n, i) => (
                <input
                  key={i}
                  type="text"
                  value={n}
                  onChange={(e) =>
                    setSettingsDishNames((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                  className="w-full px-3 min-h-[44px] text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Критерии оценки ({settingsPoll.criteria.join(', ')}) заданы при создании и не меняются — новую подборку
            критериев можно взять кнопкой «Копировать» из списка голосований.
          </p>

          <button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="w-full min-h-[52px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
          >
            {isSavingSettings ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    );
  }

  // ---- Results view ----
  if (openPoll) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setOpenPollId(null); setResults(null); }}
          className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:text-indigo-900"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Ко всем голосованиям</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-lg font-extrabold text-slate-900">{openPoll.name}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {results ? results.votes.length : 0} {results?.votes.length === 1 ? 'оценка' : 'оценок'}
          </p>
        </div>

        {isResultsLoading ? (
          <p className="text-center text-sm text-slate-400 py-6">Загружаем…</p>
        ) : results && results.votes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 italic text-sm">
            Пока никто не проголосовал.
          </div>
        ) : results ? (
          <>
            {openPoll.dishNames.map((dishName, dishIndex) => (
              <div key={dishIndex} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-700">{dishName}</h4>
                {openPoll.criteria.map((c) => (
                  <div key={c} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">{c}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${((results.averages[dishIndex]?.[c] || 0) / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-slate-900 tabular-nums w-9 text-right">
                        {(results.averages[dishIndex]?.[c] || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {results.votes.map((v) => (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {v.telegramName}
                      {v.telegramUsername && <span className="text-slate-400 font-normal"> · @{v.telegramUsername}</span>}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">{formatDate(v.createdAt)}</span>
                  </div>
                  <div className="space-y-1.5 mt-1.5">
                    {v.entries.map((entry, dishIndex) => (
                      <div key={dishIndex}>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span className="text-xs font-bold text-slate-500">{openPoll.dishNames[dishIndex]}:</span>
                          {Object.entries(entry.scores).map(([criterion, score]) => (
                            <span key={criterion} className="text-xs text-slate-600">
                              {criterion}: <b className="text-slate-900">{score}</b>
                            </span>
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
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // ---- Create form (constructor) ----
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
              className={`w-12 h-7 shrink-0 rounded-full relative transition-colors ${
                allowComments ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  allowComments ? 'translate-x-5' : 'translate-x-0.5'
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

  // ---- List ----
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
                    {poll.dishNames.join(', ')} · {poll.criteria.join(', ')} · {poll.voteCount || 0}{' '}
                    {poll.voteCount === 1 ? 'оценка' : 'оценок'}
                  </p>
                </div>
                <button
                  onClick={() => openSettings(poll)}
                  className="w-9 h-9 shrink-0 flex items-center justify-center text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => openResults(poll)}
                className="w-full flex items-center justify-center gap-1.5 min-h-[40px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 transition-all"
              >
                <Vote className="w-3.5 h-3.5" />
                <span>Смотреть результаты</span>
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

              {/* QR — сторонний сервис рисует картинку по публичной ссылке голосования, ничего
                  приватного в запрос не уходит. */}
              <div className="flex items-center gap-3 pt-1">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(linkFor(poll.id))}`}
                  alt="QR-код голосования"
                  className="w-20 h-20 rounded-lg border border-slate-200"
                />
                <p className="text-[11px] text-slate-400 flex-1">
                  Распечатайте QR или отправьте ссылку — она сразу откроет форму оценки внутри
                  Telegram, без регистрации.
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
    </div>
  );
};
