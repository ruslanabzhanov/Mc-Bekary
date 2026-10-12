import React from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { Deviation, describeDeviation, isRed, fmtPcs } from '../lib/orderNorms';

interface SubmitConfirmDialogProps {
  isOpen: boolean;
  positions: number;
  totalPcs: number;
  totalCost: number;
  // Позиции, сильно отличающиеся от обычного для этой точки (жёлтые и красные).
  deviations?: Deviation[];
  onCancel: () => void;
  onConfirm: () => void;
}

// Last step before an order actually goes out — shared by the order screen's «Отправить» and
// the preview's «Подтвердить и отправить», so a stray tap on either no longer submits at once.
export const SubmitConfirmDialog: React.FC<SubmitConfirmDialogProps> = ({
  isOpen,
  positions,
  totalPcs,
  totalCost,
  deviations = [],
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 animate-fade-in"
      onClick={onCancel}
    >
      <div
        id="order-submit-confirm"
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="text-base font-black text-slate-900">
            Вы действительно хотите завершить оформление заявки?
          </h3>
          <p className="text-xs text-slate-500">
            После отправки изменить заявку сможет только управляющий производством или владелец.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 border border-slate-200 rounded-lg py-2">
            <span className="block text-[9px] font-black uppercase text-slate-400">Позиций</span>
            <span className="text-sm font-black text-slate-900">{positions}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg py-2">
            <span className="block text-[9px] font-black uppercase text-slate-400">Штук</span>
            <span className="text-sm font-black text-slate-900">{totalPcs}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg py-2">
            <span className="block text-[9px] font-black uppercase text-slate-400">Сумма</span>
            <span className="text-sm font-black text-indigo-900">{totalCost.toLocaleString('ru-RU')} ₸</span>
          </div>
        </div>

        {deviations.length > 0 && (
          <div id="submit-deviations" className="rounded-xl border border-slate-200 overflow-hidden">
            <p className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
              Отличается от обычного ({deviations.length})
            </p>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {[...deviations]
                .sort((a, b) => Number(isRed(b.level)) - Number(isRed(a.level)))
                .map((d) => {
                  const red = isRed(d.level);
                  const diff = d.qty - d.norm.avg;
                  return (
                    <div key={d.productId} className={`px-3 py-2 flex items-center justify-between gap-2 ${red ? 'bg-rose-50' : 'bg-amber-50'}`}>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold leading-tight ${red ? 'text-rose-950' : 'text-amber-950'}`}>{d.name}</p>
                        <p className={`text-[11px] ${red ? 'text-rose-800' : 'text-amber-800'}`}>
                          обычно ≈ {fmtPcs(d.norm.avg)}, сейчас {d.qty}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-black px-2 py-1 rounded-md border ${red ? 'bg-rose-100 border-rose-300 text-rose-900' : 'bg-amber-100 border-amber-300 text-amber-900'}`}>
                        {diff > 0 ? '+' : '−'}{fmtPcs(Math.abs(diff))} шт
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            id="btn-confirm-cancel"
            onClick={onCancel}
            className="min-h-[48px] rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700"
          >
            {deviations.length > 0 ? 'Вернуться и проверить' : 'Нет, вернуться'}
          </button>
          <button
            id="btn-confirm-yes"
            onClick={onConfirm}
            className="min-h-[48px] rounded-lg text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4 shrink-0" />
            Да, отправить
          </button>
        </div>
      </div>
    </div>
  );
};
