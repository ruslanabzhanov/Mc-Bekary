import React, { useState, useEffect } from 'react';
import { X, Sparkles, Factory, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

interface AiProcurementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiProcurementModal: React.FC<AiProcurementModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  const fetchProcurementReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/predictive-procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
        setMetrics({
          categoryTotals: data.categoryTotals,
          grandTotalPcs: data.grandTotalPcs,
          grandTotalCost: data.grandTotalCost,
          submittedShopsCount: data.submittedShopsCount,
        });
      }
    } catch (e) {
      setReport('Ошибка получения отчета от ИИ-сервера.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProcurementReport();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
              <Factory className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                  ИИ-Аналитика
                </span>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Предиктивный расчет общего закупа</h2>
              </div>
              <p className="text-xs text-slate-500">
                ИИ-прогноз объемов производства и сырья для 4 цехов на основе свода 27 точек
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchProcurementReport}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              title="Обновить расчет"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* Quick Metrics Bar */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Подано заявок</span>
                <span className="text-lg font-black text-slate-900">{metrics.submittedShopsCount} из 27</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Общий выпуск цехов</span>
                <span className="text-lg font-black text-slate-900">{metrics.grandTotalPcs} шт</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Цех выпечки</span>
                <span className="text-lg font-black text-indigo-900">{metrics.categoryTotals?.bakery || 0} шт</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Стоимость продукции</span>
                <span className="text-lg font-black text-emerald-600">
                  {metrics.grandTotalCost?.toLocaleString('ru-RU')} ₸
                </span>
              </div>
            </div>
          )}

          {/* AI Output Report Box */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-indigo-700 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Генеративный ИИ-Отчет Gemini:</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 space-y-3">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-medium">Выполняю расчет суммарной загрузки цехов и сырьевой потребности...</p>
              </div>
            ) : (
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-sans">
                {report}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
