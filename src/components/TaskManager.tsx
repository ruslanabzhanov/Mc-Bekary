import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Loader2, Paperclip, ExternalLink, CheckCircle2, Undo2, Trash2, Pencil } from 'lucide-react';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { Task, TaskEvent, formatTaskDate, isTaskOverdue } from '../lib/tasks';
import { StaffMember } from '../types';

interface TaskManagerProps {
  telegramInitData: string;
  actorName: string;
  staff: StaffMember[];
}

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });

type Tab = 'open' | 'review' | 'done';
type Api = <T = any>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

const input =
  'w-full px-3 min-h-[46px] text-base border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';

export const TaskManager: React.FC<TaskManagerProps> = ({ telegramInitData, actorName, staff }) => {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<{ text: string; noTables?: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const api = useCallback<Api>(
    (async (path: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(`/api/tasks${path}`, {
        method: init?.method || 'GET',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': telegramInitData },
        body: init?.body !== undefined ? JSON.stringify({ ...(init.body as object), actorName }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e: any = new Error(data?.error || 'Не удалось выполнить. Попробуйте ещё раз.');
        e.code = data?.code;
        throw e;
      }
      return data;
    }) as Api,
    [telegramInitData, actorName]
  );

  const load = useCallback(async () => {
    try {
      const d = await api<{ tasks: Task[] }>('');
      setTasks(d.tasks);
      setError(null);
    } catch (e: any) {
      setTasks([]);
      setError({ text: e.message, noTables: e.code === 'no_tables' });
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  useTelegramBackButton(openId !== null || formOpen, () => {
    setOpenId(null);
    setFormOpen(false);
    load();
  });

  const today = almatyToday();
  const counts = useMemo(
    () => ({
      open: tasks?.filter((t) => t.status === 'open').length || 0,
      review: tasks?.filter((t) => t.status === 'review').length || 0,
      done: tasks?.filter((t) => t.status === 'done').length || 0,
    }),
    [tasks]
  );
  const visible = useMemo(() => {
    const list = (tasks || []).filter((t) => t.status === tab);
    if (tab === 'open') return [...list].sort((a, b) => a.deadline.localeCompare(b.deadline));
    if (tab === 'review') return [...list].sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''));
    return list; // уже по убыванию номера
  }, [tasks, tab]);

  if (formOpen) {
    return (
      <TaskForm
        staff={staff}
        api={api}
        onDone={() => {
          setFormOpen(false);
          load();
        }}
        onCancel={() => setFormOpen(false)}
      />
    );
  }
  if (openId !== null) {
    const task = tasks?.find((t) => t.id === openId);
    if (task) {
      return (
        <TaskDetail
          task={task}
          api={api}
          staff={staff}
          today={today}
          onChanged={(t) => setTasks((prev) => (prev || []).map((x) => (x.id === t.id ? t : x)))}
          onGone={() => {
            setOpenId(null);
            load();
          }}
          onBack={() => {
            setOpenId(null);
            load();
          }}
        />
      );
    }
  }

  const tabBtn = (key: Tab, text: string, n: number, warn = false) => (
    <button
      key={key}
      id={`tab-tasks-${key}`}
      onClick={() => setTab(key)}
      className={`flex-1 min-h-[44px] px-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${
        tab === key ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm' : 'text-slate-600'
      }`}
    >
      {text}{' '}
      <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${warn && n > 0 ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'}`}>{n}</span>
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {error && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error.noTables ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          <p className="font-bold">{error.text}</p>
          {error.noTables && <p className="mt-1 text-xs">Таблицы для задач ещё не созданы. Нужно один раз выполнить SQL в Supabase.</p>}
        </div>
      )}

      <button
        id="btn-new-task"
        onClick={() => setFormOpen(true)}
        disabled={tasks === null || (error?.noTables ?? false)}
        className="w-full min-h-[60px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm flex items-center justify-center gap-3 transition-all"
      >
        <Plus className="w-6 h-6" />
        <span className="text-sm font-black uppercase tracking-wider">Поставить задачу</span>
      </button>

      <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {tabBtn('open', 'Активные', counts.open)}
        {tabBtn('review', 'На проверке', counts.review, true)}
        {tabBtn('done', 'Выполненные', counts.done)}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {tasks === null ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Загружаем…</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            {tab === 'open' ? 'Активных задач нет.' : tab === 'review' ? 'Ничего не ждёт проверки.' : 'Выполненных задач пока нет.'}
          </p>
        ) : (
          <div id="task-list" className="divide-y divide-slate-100">
            {visible.map((t) => {
              const overdue = isTaskOverdue(t, today);
              return (
                <button key={t.id} onClick={() => setOpenId(t.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 break-words">{t.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.assigneeName}</p>
                    <p className={`text-xs mt-0.5 font-semibold ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>
                      {t.status === 'done' && t.acceptedAt
                        ? `Принята ${when(t.acceptedAt)}`
                        : `Срок: ${formatTaskDate(t.deadline)}${overdue ? ' · просрочена' : ''}`}
                      {t.status === 'open' && t.returnedCount > 0 ? ' · возвращена' : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const TaskForm = ({ staff, api, onDone, onCancel }: { staff: StaffMember[]; api: Api; onDone: () => void; onCancel: () => void }) => {
  const workers = useMemo(() => staff.filter((s) => s.role === 'employee').sort((a, b) => a.name.localeCompare(b.name, 'ru')), [staff]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      await api('', { method: 'POST', body: { title, description, assigneeId, deadline } });
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <button onClick={onCancel} className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> К задачам
      </button>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Новая задача</h3>
        <div>
          <label className={label}>Что нужно сделать</label>
          <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="например: перебрать склад заготовок" className={input} maxLength={120} autoComplete="off" />
        </div>
        <div>
          <label className={label}>Подробности (необязательно)</label>
          <textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1500} className={`${input} py-2`} />
        </div>
        <div>
          <label className={label}>Ответственный</label>
          <select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={input}>
            <option value="">Выберите сотрудника цеха</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.position ? ` — ${w.position}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Срок</label>
          <input id="task-deadline" type="date" value={deadline} min={almatyToday()} onChange={(e) => setDeadline(e.target.value)} className={input} />
          <p className="text-[11px] text-slate-400 mt-1">Откроется календарь. Срок истекает в конце выбранного дня.</p>
        </div>
        {err && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{err}</p>}
        <button
          id="btn-create-task"
          onClick={submit}
          disabled={busy}
          className="w-full min-h-[52px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Поставить задачу
        </button>
        <p className="text-[11px] text-slate-500">Ответственному сразу придёт сообщение, и задача появится у него в кабинете в «Моих задачах».</p>
      </div>
    </div>
  );
};

const TaskDetail = ({ task, api, staff, today, onChanged, onGone, onBack }: {
  task: Task;
  api: Api;
  staff: StaffMember[];
  today: string;
  onChanged: (t: Task) => void;
  onGone: () => void;
  onBack: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<'none' | 'reject' | 'delete' | 'edit'>('none');
  const [reason, setReason] = useState('');
  const [editDeadline, setEditDeadline] = useState(task.deadline);
  const [editAssignee, setEditAssignee] = useState(task.assigneeId);
  const [events, setEvents] = useState<TaskEvent[] | null>(null);
  const [showEvents, setShowEvents] = useState(false);
  const workers = useMemo(() => staff.filter((s) => s.role === 'employee').sort((a, b) => a.name.localeCompare(b.name, 'ru')), [staff]);
  const overdue = isTaskOverdue(task, today);
  const isImage = /^data:image\//.test(task.proofFileUrl) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(task.proofFileUrl);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadEvents = () =>
    api<{ events: TaskEvent[] }>(`/${task.id}/events`)
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]));

  return (
    <div className="max-w-2xl mx-auto space-y-3 pb-16">
      <button onClick={onBack} className="min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-bold flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> К задачам
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2" id="task-detail">
        <span
          className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded ${
            task.status === 'done' ? 'bg-emerald-100 text-emerald-800' : task.status === 'review' ? 'bg-amber-100 text-amber-800' : overdue ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {task.status === 'done' ? 'выполнена' : task.status === 'review' ? 'на проверке' : overdue ? 'просрочена' : 'в работе'}
        </span>
        <h3 className="text-base font-black text-slate-900 break-words">{task.title}</h3>
        {task.description && <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{task.description}</p>}
        <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="block text-[9px] font-black uppercase text-slate-400">Ответственный</span>
            <span className="font-bold text-slate-900">{task.assigneeName}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
            <span className="block text-[9px] font-black uppercase text-slate-400">Срок</span>
            <span className={`font-bold ${overdue ? 'text-rose-600' : 'text-slate-900'}`}>{formatTaskDate(task.deadline)}</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Поставил {task.createdBy || '—'} · {when(task.createdAt)}
        </p>
        {task.status === 'open' && task.returnedReason && (
          <p className="text-sm bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-3 py-2">
            <b>Возвращена на доработку:</b> {task.returnedReason}
          </p>
        )}
      </div>

      {(task.status === 'review' || task.status === 'done') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2" id="task-proof">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Подтверждение{task.submittedAt ? ` · ${when(task.submittedAt)}` : ''}
          </h4>
          {task.proofComment && <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{task.proofComment}</p>}
          {task.proofLink && (
            <a href={task.proofLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 break-all">
              <ExternalLink className="w-4 h-4 shrink-0" /> {task.proofLink}
            </a>
          )}
          {task.proofFileUrl &&
            (isImage ? (
              <a href={task.proofFileUrl} target="_blank" rel="noopener noreferrer">
                <img src={task.proofFileUrl} alt={task.proofFileName || 'Фото'} className="max-h-72 rounded-xl border border-slate-200 object-contain" loading="lazy" />
              </a>
            ) : (
              <a href={task.proofFileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-bold text-indigo-700 break-all">
                <Paperclip className="w-4 h-4 shrink-0" /> {task.proofFileName || 'Файл'}
              </a>
            ))}
          {task.status === 'done' && (
            <p className="text-xs text-emerald-700 font-bold pt-1">
              Принята{task.acceptedBy ? `: ${task.acceptedBy}` : ''}
              {task.acceptedAt ? ` · ${when(task.acceptedAt)}` : ''}
            </p>
          )}
        </div>
      )}

      {err && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 px-4 py-2.5 text-sm font-bold">{err}</p>}

      {task.status === 'review' && mode !== 'reject' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            id="btn-accept-task"
            onClick={() =>
              run(async () => {
                const d = await api<{ task: Task }>(`/${task.id}/accept`, { method: 'POST', body: {} });
                onChanged(d.task);
              })
            }
            disabled={busy}
            className="min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-5 h-5" /> Принять
          </button>
          <button
            id="btn-reject-task"
            onClick={() => setMode('reject')}
            className="min-h-[52px] rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
          >
            <Undo2 className="w-5 h-5" /> Вернуть
          </button>
        </div>
      )}
      {task.status === 'review' && mode === 'reject' && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-2.5">
          <label className={label}>Что нужно исправить</label>
          <textarea id="task-reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={`${input} py-2`} placeholder="Сотрудник получит это сообщением" />
          <div className="flex gap-2">
            <button
              id="btn-confirm-reject"
              onClick={() =>
                run(async () => {
                  const d = await api<{ task: Task }>(`/${task.id}/reject`, { method: 'POST', body: { reason } });
                  onChanged(d.task);
                  setMode('none');
                  setReason('');
                })
              }
              disabled={busy}
              className="flex-1 min-h-[48px] rounded-xl bg-amber-600 text-white text-sm font-bold disabled:opacity-50"
            >
              Вернуть на доработку
            </button>
            <button onClick={() => setMode('none')} className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold">
              Отмена
            </button>
          </div>
        </div>
      )}

      {task.status === 'open' && mode === 'none' && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode('edit')} className="min-h-[46px] rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Pencil className="w-4 h-4" /> Изменить срок или ответственного
          </button>
          <button onClick={() => setMode('delete')} className="min-h-[46px] rounded-xl border border-rose-200 bg-white text-rose-700 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Удалить задачу
          </button>
        </div>
      )}
      {task.status === 'open' && mode === 'edit' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
          <div>
            <label className={label}>Ответственный</label>
            <select value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} className={input}>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.position ? ` — ${w.position}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Срок</label>
            <input type="date" value={editDeadline} min={almatyToday()} onChange={(e) => setEditDeadline(e.target.value)} className={input} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                run(async () => {
                  const d = await api<{ task: Task }>(`/${task.id}`, { method: 'PATCH', body: { assigneeId: editAssignee, deadline: editDeadline } });
                  onChanged(d.task);
                  setMode('none');
                })
              }
              disabled={busy}
              className="flex-1 min-h-[48px] rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
            >
              Сохранить
            </button>
            <button onClick={() => setMode('none')} className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold">
              Отмена
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Если изменить срок или ответственного, сотрудник получит сообщение.</p>
        </div>
      )}
      {task.status === 'open' && mode === 'delete' && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 space-y-2.5">
          <p className="text-sm font-bold text-rose-950">Удалить задачу «{task.title}»?</p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                run(async () => {
                  await api(`/${task.id}`, { method: 'DELETE', body: {} });
                  onGone();
                })
              }
              disabled={busy}
              className="flex-1 min-h-[48px] rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50"
            >
              Да, удалить
            </button>
            <button onClick={() => setMode('none')} className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold">
              Нет
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setShowEvents((v) => !v);
          if (events === null) loadEvents();
        }}
        className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white text-slate-500 text-xs font-bold uppercase tracking-wider"
      >
        {showEvents ? 'Скрыть журнал' : 'Журнал задачи'}
      </button>
      {showEvents && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {events === null ? (
            <p className="px-4 py-4 text-sm text-slate-400">Загружаем…</p>
          ) : events.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">Записей пока нет.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="px-4 py-2.5 text-xs">
                <p className="font-bold text-slate-800 break-words">{ev.details || ev.action}</p>
                <p className="text-slate-400 mt-0.5">
                  {ev.actor} · {when(ev.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
