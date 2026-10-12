import React from 'react';
import { Zap, X } from 'lucide-react';

interface OneClickDialogProps {
  isOpen: boolean;
  days: number; // сколько дней заказов легло в расчёт
  positions: number; // сколько позиций будет заполнено
  totalPcs: number; // сколько штук будет в заявке
  hasDraft: boolean; // в черновике уже что-то набрано
  onCancel: () => void;
  onConfirm: () => void;
}

// Что делает «Заявка в один клик», как это считается — и чья это ответственность. Показывается
// каждый раз до заполнения: черновик меняется только после «Понятно, заполнить».
export const OneClickDialog: React.FC<OneClickDialogProps> = ({
  isOpen, days, positions, totalPcs, hasDraft, onCancel, onConfirm,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 animate-fade-in" onClick={onCancel}>
      <div
        id="one-click-dialog"
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-3.5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-base font-black text-slate-900 leading-tight">Заявка в один клик</h3>
          </div>
          <button onClick={onCancel} className="w-9 h-9 -mr-2 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400" aria-label="Закрыть">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 text-[13px] text-slate-700 leading-snug">
          <p className="font-bold text-slate-900">Как система это считает:</p>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>Берём заявки вашей точки за последние 3 недели ({days} дн.) и смотрим каждую позицию отдельно.</li>
            <li>Рассчитываем рекомендуемое количество для позиций, которые вы заказываете регулярно. Новые и редкие позиции не добавляем.</li>
            <li>Заполняем черновик этими количествами, дальше вы правите его сами.</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-50 border border-slate-200 rounded-lg py-2">
            <span className="block text-[9px] font-black uppercase text-slate-400">Позиций</span>
            <span className="text-sm font-black text-slate-900">{positions}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg py-2">
            <span className="block text-[9px] font-black uppercase text-slate-400">Всего штук</span>
            <span className="text-sm font-black text-slate-900">{totalPcs} шт</span>
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[13px] text-amber-950 leading-snug space-y-1.5">
          <p className="font-bold">Заявка остаётся на вашей ответственности.</p>
          <p>
            Это только черновик, расчёт по прошлым заказам. Он не знает про сегодняшний день: сколько будет гостей, остатки со вчера, акции,
            погоду. Проверьте количества и поправьте. Отправляете заявку вы, и за неё отвечаете вы.
          </p>
        </div>

        <p className="text-xs text-slate-500">
          Если в отправленной заявке будут сильные отличия от обычного, список этих позиций уйдёт территориальному управляющему.
        </p>
        {hasDraft && <p className="text-xs font-bold text-rose-700">В черновике уже есть позиции: рекомендованные количества заменят их.</p>}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            id="btn-oneclick-cancel"
            onClick={onCancel}
            className="min-h-[48px] rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700"
          >
            Отмена
          </button>
          <button
            id="btn-oneclick-confirm"
            onClick={onConfirm}
            className="min-h-[48px] rounded-lg text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white flex items-center justify-center gap-1.5"
          >
            <Zap className="w-4 h-4 shrink-0" />
            Понятно, заполнить
          </button>
        </div>
      </div>
    </div>
  );
};
