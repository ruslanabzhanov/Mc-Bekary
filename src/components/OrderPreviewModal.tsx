import React, { useState } from 'react';
import { CoffeeShop, Product, ShopOrder } from '../types';
import { X, Sparkles, AlertTriangle, Send, ShieldAlert, Bot } from 'lucide-react';

interface OrderPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: CoffeeShop;
  products: Product[];
  order: ShopOrder;
  onSubmit: () => void;
}

export const OrderPreviewModal: React.FC<OrderPreviewModalProps> = ({
  isOpen,
  onClose,
  shop,
  products,
  order,
  onSubmit,
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  if (!isOpen) return null;

  const items = order?.items || {};
  const orderPositions = Object.entries(items)
    .map(([pId, qtyVal]) => {
      const product = products.find((p) => p.id === pId);
      const qty = Number(qtyVal) || 0;
      return { product, qty };
    })
    .filter((item) => item.product && item.qty > 0);

  const totalPcs = orderPositions.reduce((sum, item) => sum + item.qty, 0);
  const totalCost = orderPositions.reduce(
    (sum, item) => sum + item.qty * (item.product?.price || 0),
    0
  );

  // Run AI Express Analysis
  const handleRunAiAnalysis = async () => {
    setIsLoadingAi(true);
    try {
      const res = await fetch('/api/ai/analyze-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.id,
          items,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAiAnalysis(data.analysisText);
      } else {
        setAiAnalysis('Ошибка получения анализа.');
      }
    } catch (e) {
      setAiAnalysis('Не удалось подключиться к ИИ-серверу.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3 bg-white">
          <div className="min-w-0">
            {/* Badge above the title rather than beside it: side by side, the title wrapped to
                three lines on a phone and ran into the close button. */}
            <span className="inline-block text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
              Экспресс-Свод
            </span>
            <h2 className="text-base sm:text-xl font-bold text-slate-900 uppercase tracking-tight mt-1.5">
              Предпросмотр заявки витрины
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {shop.district.trim() || shop.address} · Менеджер: {shop.manager}
            </p>
          </div>

          <button
            id="btn-close-modal"
            onClick={onClose}
            className="w-11 h-11 shrink-0 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Позиций товаров</span>
              <span className="text-xl font-black text-slate-900">{orderPositions.length}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Общий объем</span>
              <span className="text-xl font-black text-slate-900">{totalPcs} шт</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Сумма заказа</span>
              <span className="text-xl font-black text-indigo-900">
                {totalCost.toLocaleString('ru-RU')} ₸
              </span>
            </div>
          </div>

          {/* AI Analysis trigger block */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">ИИ-Скоринг и Анализ списаний</span>
              </div>

              <button
                id="btn-run-ai-analysis"
                onClick={handleRunAiAnalysis}
                disabled={isLoadingAi || orderPositions.length === 0}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded text-xs uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span>{isLoadingAi ? 'Анализирую...' : 'Запустить ИИ-Анализ'}</span>
              </button>
            </div>

            {aiAnalysis && (
              <div className="mt-4 p-4 rounded-lg bg-white border border-indigo-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line animate-fade-in shadow-sm">
                {aiAnalysis}
              </div>
            )}
          </div>

          {/* Items Breakdown Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">Детальный состав заказа:</h4>
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  {/* Категория and Норма дня are dropped on a phone — five columns could not fit
                      360px and the Заказ/Сумма columns were being cut off the right edge, which
                      is exactly what the manager needs to check before submitting. */}
                  <tr>
                    <th className="py-3 px-2 sm:px-4">Товар</th>
                    <th className="hidden sm:table-cell py-3 px-4">Категория</th>
                    <th className="py-3 px-2 sm:px-4 text-center">Заказ</th>
                    <th className="hidden sm:table-cell py-3 px-4 text-center">Норма дня</th>
                    <th className="py-3 px-2 sm:px-4 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderPositions.map(({ product, qty }) => {
                    if (!product) return null;
                    const avg = shop.historicalAvg[product.id] || 10;
                    const isHigh = qty >= avg * 2 && qty > 10;
                    const isLow = qty <= avg * 0.3 && avg >= 10;

                    return (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="py-3 px-2 sm:px-4 font-bold text-slate-900">
                          <span className="flex items-start gap-2">
                            <span className="shrink-0">{product.imageEmoji}</span>
                            <span>{product.name}</span>
                          </span>
                        </td>
                        <td className="hidden sm:table-cell py-3 px-4 text-slate-500">{product.categoryLabel}</td>
                        <td className="py-3 px-2 sm:px-4 text-center font-bold text-slate-900 whitespace-nowrap">
                          {qty} {product.unit}
                          {isHigh && (
                            <span className="block mt-1 text-[9px] font-black uppercase text-rose-900 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-300">
                              Завышение
                            </span>
                          )}
                          {isLow && (
                            <span className="block mt-1 text-[9px] font-black uppercase text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-300">
                              Занижение
                            </span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell py-3 px-4 text-center text-slate-500">{avg} {product.unit}</td>
                        <td className="py-3 px-2 sm:px-4 text-right font-black text-indigo-900 whitespace-nowrap">
                          {(qty * product.price).toLocaleString('ru-RU')} ₸
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        {/* Stacked on a phone (confirm on top), side by side from sm up: laid out in a row,
            both labels are too long for 360px and the confirm button ran off the edge. */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between">
          <button
            id="btn-close-modal-footer"
            onClick={onClose}
            className="w-full sm:w-auto px-4 min-h-[48px] rounded-lg text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:bg-slate-200 active:bg-slate-300 transition-colors"
          >
            Вернуться к редактированию
          </button>

          <button
            id="btn-confirm-submit-modal"
            onClick={() => {
              onSubmit();
              onClose();
            }}
            disabled={totalPcs === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold px-6 min-h-[52px] rounded-lg text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>Подтвердить и отправить</span>
          </button>
        </div>

      </div>
    </div>
  );
};
