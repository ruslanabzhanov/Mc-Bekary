import React, { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';

interface DeadlineModalProps {
  isOpen: boolean;
  currentDeadline: string; // "HH:MM"
  onClose: () => void;
  // null — сохранилось; строка — текст ошибки, который показываем как есть.
  onSave: (deadline: string) => Promise<string | null>;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (total: number) => {
  // Не заворачиваем через полночь: «10:30 − 11 часов» должно упереться в 00:00, а не стать 23:30.
  const clamped = Math.min(23 * 60 + 59, Math.max(0, total));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

const NUDGES = [-30, -15, 15, 30];

export const DeadlineModal: React.FC<DeadlineModalProps> = ({ isOpen, currentDeadline, onClose, onSave }) => {
  const [value, setValue] = useState(currentDeadline);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValue(currentDeadline);
    setError(null);
  }, [isOpen, currentDeadline]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      setError('Укажите время в формате ЧЧ:ММ, например 10:30');
      return;
    }
    setIsSaving(true);
    setError(null);
    const err = await onSave(value);
    setIsSaving(false);
    if (err) setError(err);
    else onClose();
  };

  const changed = value !== currentDeadline;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-900">Время приёма заявок</h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Точки должны подать заявку до этого времени. Как только оно наступит, тем, кто не успел,
          придёт напоминание в Telegram.
        </p>

        <input
          type="time"
          step={300}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full text-center text-4xl font-black tabular-nums text-slate-900 border border-slate-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="grid grid-cols-4 gap-2">
          {NUDGES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setValue((v) => fromMinutes(toMinutes(/^\d\d:\d\d$/.test(v) ? v : currentDeadline) + n))}
              className="min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-sm font-bold text-slate-700 tabular-nums"
            >
              {n > 0 ? `+${n}` : `−${-n}`} мин
            </button>
          ))}
        </div>

        {changed && (
          <p className="text-xs text-slate-500 text-center">
            Было <b className="tabular-nums">{currentDeadline}</b> → станет <b className="tabular-nums text-indigo-700">{value}</b>
          </p>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-3 py-2 text-sm font-medium">{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving || !changed}
          className="w-full min-h-[50px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-md transition-all"
        >
          {isSaving ? 'Сохраняем…' : 'Сохранить время'}
        </button>
      </div>
    </div>
  );
};
