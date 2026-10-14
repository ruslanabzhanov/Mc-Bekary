import React, { useState } from 'react';
import { X, Paperclip, ExternalLink, Loader2, CheckCircle2, Camera, Clock } from 'lucide-react';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { compressImage } from '../utils/compressImage';
import { Task, TASK_FILE_MAX_BYTES, formatTaskDate, isTaskOverdue } from '../lib/tasks';

interface MyTasksPanelProps {
  tasks: Task[];
  telegramInitData: string;
  onClose: () => void;
  onChanged: (task: Task) => void;
}

const almatyToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' });
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const readAsDataUrl = (file: File, mime: string) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]*;/, `data:${mime};`));
    r.readAsDataURL(file);
  });

export const MyTasksPanel: React.FC<MyTasksPanelProps> = ({ tasks, telegramInitData, onClose, onChanged }) => {
  const [closing, setClosing] = useState<number | null>(null);
  useTelegramBackButton(true, () => (closing !== null ? setClosing(null) : onClose()));
  const today = almatyToday();
  const open = tasks.filter((t) => t.status === 'open').sort((a, b) => a.deadline.localeCompare(b.deadline));
  const review = tasks.filter((t) => t.status === 'review');
  const done = tasks.filter((t) => t.status === 'done').slice(0, 15);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto" id="my-tasks-panel">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Мои задачи</h2>
        <button onClick={onClose} className="w-11 h-11 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100" aria-label="Закрыть">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="max-w-2xl mx-auto p-4 space-y-4 pb-16">
        {tasks.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Задач для вас пока нет.</p>}

        {open.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">В работе ({open.length})</h3>
            {open.map((t) => {
              const overdue = isTaskOverdue(t, today);
              return (
                <div key={t.id} className={`bg-white rounded-2xl border p-4 space-y-2 ${overdue ? 'border-rose-300' : 'border-slate-200'}`} data-task-id={t.id}>
                  <p className="text-base font-black text-slate-900 break-words">{t.title}</p>
                  {t.description && <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{t.description}</p>}
                  <p className={`text-sm font-bold ${overdue ? 'text-rose-600' : 'text-slate-700'}`}>
                    📅 Срок: {formatTaskDate(t.deadline)}
                    {overdue ? ' · просрочена' : ''}
                  </p>
                  {t.returnedReason && (
                    <p className="text-sm bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-3 py-2">
                      <b>Вернули на доработку:</b> {t.returnedReason}
                    </p>
                  )}
                  {closing === t.id ? (
                    <CloseForm
                      task={t}
                      telegramInitData={telegramInitData}
                      onCancel={() => setClosing(null)}
                      onDone={(updated) => {
                        setClosing(null);
                        onChanged(updated);
                      }}
                    />
                  ) : (
                    <button
                      id={`btn-close-task-${t.id}`}
                      onClick={() => setClosing(t.id)}
                      className="w-full min-h-[50px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Закрыть задачу
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {review.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Ждут проверки ({review.length})</h3>
            {review.map((t) => (
              <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
                <p className="text-sm font-bold text-slate-900 break-words">{t.title}</p>
                <p className="text-xs text-amber-900 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Отправлено руководителю{t.submittedAt ? ` · ${when(t.submittedAt)}` : ''}. Ждите решения.
                </p>
              </div>
            ))}
          </section>
        )}

        {done.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Выполненные</h3>
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {done.map((t) => (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800 break-words min-w-0">{t.title}</p>
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">принята{t.acceptedAt ? ` ${when(t.acceptedAt)}` : ''}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const CloseForm: React.FC<{ task: Task; telegramInitData: string; onCancel: () => void; onDone: (t: Task) => void }> = ({
  task,
  telegramInitData,
  onCancel,
  onDone,
}) => {
  const [comment, setComment] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const field =
    'w-full px-3 min-h-[46px] text-base border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    try {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (f.type.startsWith('image/')) {
        setFile({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', dataUrl: await compressImage(f, 1280, 0.8) });
      } else {
        const mime = MIME_BY_EXT[ext] || f.type;
        if (!MIME_BY_EXT[ext] && !f.type) throw new Error('Такой файл не подходит. Прикрепите фото, PDF, Word или Excel, либо дайте ссылку.');
        if (f.size > TASK_FILE_MAX_BYTES) throw new Error('Файл слишком большой (до 2,5 МБ). Сожмите его или вставьте ссылку.');
        setFile({ name: f.name, dataUrl: await readAsDataUrl(f, mime) });
      }
    } catch (ex: any) {
      setFile(null);
      setErr(ex.message || 'Не удалось прочитать файл');
    }
  };

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/tasks/${task.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': telegramInitData },
        body: JSON.stringify({ comment, link, file }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Не удалось закрыть задачу. Попробуйте ещё раз.');
      onDone(data.task);
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5 pt-1" id="close-task-form">
      <p className="text-xs text-slate-500">Покажите, что задача выполнена: прикрепите фото или файл либо вставьте ссылку. Руководитель проверит.</p>
      <div>
        <label className="flex items-center justify-center gap-2 min-h-[50px] rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-800 text-sm font-bold cursor-pointer">
          <Camera className="w-5 h-5" /> {file ? 'Заменить фото или файл' : 'Прикрепить фото или файл'}
          <input
            id="task-file-input"
            type="file"
            accept="image/*,.pdf,.txt,.docx,.xlsx"
            className="hidden"
            onChange={pick}
          />
        </label>
        {file && (
          <p className="mt-1.5 text-xs text-slate-700 flex items-center gap-1 break-all">
            <Paperclip className="w-3.5 h-3.5 shrink-0" /> {file.name}
            <button onClick={() => setFile(null)} className="ml-auto text-rose-600 font-bold shrink-0">
              убрать
            </button>
          </p>
        )}
      </div>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
          <ExternalLink className="w-3 h-3" /> Или ссылка
        </label>
        <input id="task-link-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" className={field} autoComplete="off" />
      </div>
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Комментарий (необязательно)</label>
        <textarea id="task-comment-input" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000} className={`${field} py-2`} />
      </div>
      {err && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{err}</p>}
      <div className="flex gap-2">
        <button
          id="btn-submit-task"
          onClick={submit}
          disabled={busy || (!file && !link.trim())}
          className="flex-1 min-h-[50px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Отправить на проверку
        </button>
        <button onClick={onCancel} disabled={busy} className="min-h-[50px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold">
          Отмена
        </button>
      </div>
    </div>
  );
};
