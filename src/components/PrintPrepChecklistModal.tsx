import React from 'react';
import { CoffeeShop, Product, ShopOrder, SemiFinishedProduct, DishCosting } from '../types';
import { Printer, X, ChefHat, CheckSquare, Sparkles, Package, Layers } from 'lucide-react';

interface PrintPrepChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
  semiFinishedList: SemiFinishedProduct[];
  dishCostings: Record<string, DishCosting>;
}

export const PrintPrepChecklistModal: React.FC<PrintPrepChecklistModalProps> = ({
  isOpen,
  onClose,
  shops,
  products,
  orders,
  semiFinishedList,
  dishCostings,
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Map of semi-finished items
  const semiMap = new Map<string, SemiFinishedProduct>(semiFinishedList.map((s) => [s.id, s]));

  // 1. Compute total dish ordered across submitted/accepted orders
  const dishTotals: Record<string, number> = {};
  let totalSubmittedShops = 0;
  let totalDishesCount = 0;

  (Object.values(orders) as ShopOrder[]).forEach((order) => {
    if (order.status === 'submitted' || order.status === 'accepted') {
      totalSubmittedShops += 1;
      Object.entries(order.items || {}).forEach(([pId, qty]) => {
        const amount = Number(qty) || 0;
        if (amount > 0) {
          dishTotals[pId] = (dishTotals[pId] || 0) + amount;
          totalDishesCount += amount;
        }
      });
    }
  });

  // 2. Compute total semi-finished goods needed
  const semiTotals: Record<string, { qty: number; unit: string; usedIn: Record<string, number> }> = {};
  // 3. Compute total raw materials required
  const rawRequisition: Record<string, { qty: number; unit: string }> = {};

  Object.entries(dishTotals).forEach(([pId, dishQty]) => {
    const costing = dishCostings[pId];
    if (!costing) return;

    // Semi-finished items calculation
    costing.semiFinishedItems.forEach((sItem) => {
      const neededSemiQty = sItem.quantity * dishQty;
      if (!semiTotals[sItem.semiFinishedId]) {
        semiTotals[sItem.semiFinishedId] = {
          qty: 0,
          unit: sItem.unit,
          usedIn: {}
        };
      }
      semiTotals[sItem.semiFinishedId].qty += neededSemiQty;
      semiTotals[sItem.semiFinishedId].usedIn[pId] =
        (semiTotals[sItem.semiFinishedId].usedIn[pId] || 0) + dishQty;

      // Raw ingredients needed for this semi-finished item
      const semi = semiMap.get(sItem.semiFinishedId);
      if (semi) {
        semi.ingredients.forEach((ing) => {
          const rawNeeded = ing.quantity * neededSemiQty; // e.g. 1.15 kg raw chicken * 20 kg baked chicken
          const key = ing.rawMaterialName;
          if (!rawRequisition[key]) {
            rawRequisition[key] = { qty: 0, unit: ing.unit };
          }
          rawRequisition[key].qty += rawNeeded;
        });
      }
    });

    // Direct raw ingredients from dish costing
    costing.rawIngredients.forEach((rItem) => {
      const rawNeeded = rItem.quantity * dishQty;
      const key = rItem.name;
      if (!rawRequisition[key]) {
        rawRequisition[key] = { qty: 0, unit: rItem.unit };
      }
      rawRequisition[key].qty += rawNeeded;
    });
  });

  // Categorize Semi-finished items into 4 prep stations
  const prepCategories: Record<string, { title: string; icon: string; items: string[] }> = {
    prep_veg: { title: '🔪 Цех Заготовок и Нарезки (Овощи / Зелень)', icon: '🥗', items: [] },
    prep_meat: { title: '🍗 Термический цех (Мясо / Птица / Рыба)', icon: '🍖', items: [] },
    prep_sauce: { title: '🥣 Цех Соусов и Заправок', icon: '🫙', items: [] },
    prep_grain: { title: '🌾 Крупы и Базовые заготовки', icon: '🍚', items: [] },
    prep_bakery: { title: '🥐 Цех Выпечки и Коржей', icon: '🥞', items: [] }
  };

  semiFinishedList.forEach((s) => {
    const cat = prepCategories[s.category] || prepCategories.prep_veg;
    cat.items.push(s.id);
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:text-black print:static print:h-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl overflow-hidden shadow-xl flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Modal Action Header (Hidden on Print) */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
              <ChefHat className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                  Цех Заготовок
                </span>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">
                  Чек-лист заготовок и полуфабрикатов на сегодня
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Авто-расчет объемов варки, запекания, нарезки и соусов на основе свода заявки {totalSubmittedShops} кофеен
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="btn-print-prep-sheet"
              onClick={handlePrint}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded text-xs uppercase tracking-wider transition-all shadow-sm"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Распечатать чек-лист заготовок</span>
            </button>

            <button
              id="btn-close-prep-modal"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE BODY CONTENT */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 text-slate-800 bg-white print:bg-white print:text-black print:overflow-visible">
          
          {/* Production Sheet Main Title Header */}
          <div className="border-b-2 border-slate-200 print:border-black pb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <ChefHat className="w-7 h-7 text-indigo-900 print:text-black" />
                <h1 className="text-2xl font-black text-indigo-900 print:text-black uppercase tracking-tight">
                  ПРОИЗВОДСТВЕННОЕ ЗАДАНИЕ: ЦЕХ ЗАГОТОВОК И ПОЛУФАБРИКАТОВ
                </h1>
              </div>
              <p className="text-xs font-bold text-indigo-700 print:text-black mt-1 uppercase tracking-wider">
                СЕТЬ 27 КОФЕЕН "MASTER COFFEE" • ЦЕНТРАЛЬНАЯ КУХНЯ
              </p>
            </div>

            <div className="text-right text-xs text-slate-700 print:text-black space-y-1">
              <div className="font-bold bg-slate-100 print:bg-gray-100 px-3 py-1 rounded border border-slate-200 print:border-gray-400">
                ПАРТИЯ: {todayStr}
              </div>
              <div>Подано заявок: <strong>{totalSubmittedShops} из 27 кофеен</strong></div>
              <div>Общий объем готовых блюд: <strong className="text-indigo-900 print:text-black text-sm">{totalDishesCount} шт</strong></div>
            </div>
          </div>

          {/* Quick Production Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:grid-cols-4">
            <div className="bg-slate-50 print:bg-gray-50 p-3 rounded-lg border border-slate-200 print:border-gray-300">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-black block">
                Заготовки овощей
              </span>
              <span className="text-lg font-black text-slate-900 print:text-black">
                {((semiTotals['semi-cucumber-sliced']?.qty || 0) + (semiTotals['semi-cherry-sliced']?.qty || 0)).toFixed(1)} кг
              </span>
            </div>
            <div className="bg-slate-50 print:bg-gray-50 p-3 rounded-lg border border-slate-200 print:border-gray-300">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-black block">
                Запекание курицы
              </span>
              <span className="text-lg font-black text-slate-900 print:text-black">
                {(semiTotals['semi-chicken-baked']?.qty || 0).toFixed(1)} кг
              </span>
            </div>
            <div className="bg-slate-50 print:bg-gray-50 p-3 rounded-lg border border-slate-200 print:border-gray-300">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-black block">
                Семга слабосоленая
              </span>
              <span className="text-lg font-black text-slate-900 print:text-black">
                {(semiTotals['semi-salmon-cured']?.qty || 0).toFixed(1)} кг
              </span>
            </div>
            <div className="bg-slate-50 print:bg-gray-50 p-3 rounded-lg border border-slate-200 print:border-gray-300">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 print:text-black block">
                Соусы и крем
              </span>
              <span className="text-lg font-black text-slate-900 print:text-black">
                {((semiTotals['semi-teriyaki-sauce']?.qty || 0) + (semiTotals['semi-sour-cream-fill']?.qty || 0)).toFixed(1)} л/кг
              </span>
            </div>
          </div>

          {/* SECTION A: SEMI-FINISHED PREP CHECKLIST BY STATIONS */}
          <div className="space-y-6">
            <h3 className="text-xs font-bold text-slate-900 print:text-black uppercase tracking-wider flex items-center space-x-2">
              <CheckSquare className="w-4 h-4 text-indigo-600 print:text-black" />
              <span>1. ЧЕК-ЛИСТ ОБЪЕМОВ И ЗАДАНИЙ ПО СТАНЦИЯМ ЗАГОТОВКИ:</span>
            </h3>

            {Object.entries(prepCategories).map(([catKey, cat]) => {
              if (cat.items.length === 0) return null;

              return (
                <div key={catKey} className="border border-slate-200 print:border-black rounded-lg overflow-hidden space-y-0">
                  <div className="bg-slate-100 print:bg-gray-200 px-4 py-2 border-b border-slate-200 print:border-black font-bold text-xs text-slate-900 print:text-black flex justify-between items-center uppercase">
                    <span>{cat.title}</span>
                    <span className="text-[10px] text-slate-500 print:text-black">СТАНЦИЯ #{catKey.toUpperCase()}</span>
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 print:bg-gray-100 text-slate-600 print:text-black font-bold border-b border-slate-200 print:border-black text-[10px] uppercase">
                      <tr>
                        <th className="py-2 px-3 w-10 text-center border-r border-slate-200 print:border-black">Отметка</th>
                        <th className="py-2 px-3 border-r border-slate-200 print:border-black">Наименование полуфабриката / Заготовки</th>
                        <th className="py-2 px-3 border-r border-slate-200 print:border-black">Технологическая инструкция / Стандарт</th>
                        <th className="py-2 px-3 border-r border-slate-200 print:border-black text-center w-32 font-black">Объем на сегодня</th>
                        <th className="py-2 px-3">Назначение в блюдах</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-gray-400 bg-white">
                      {cat.items.map((semiId) => {
                        const semi = semiMap.get(semiId);
                        if (!semi) return null;
                        const data = semiTotals[semiId] || { qty: 0, unit: semi.unit, usedIn: {} };

                        return (
                          <tr key={semiId} className="hover:bg-slate-50 print:hover:bg-transparent">
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 print:border-black">
                              <div className="w-4 h-4 border-2 border-slate-400 print:border-black rounded mx-auto" />
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 print:text-black border-r border-slate-200 print:border-black">
                              {semi.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 print:text-black text-[11px] leading-relaxed border-r border-slate-200 print:border-black">
                              {semi.prepInstructions}
                            </td>
                            <td className="py-2.5 px-3 text-center border-r border-slate-200 print:border-black">
                              <span className="text-sm font-black text-indigo-900 print:text-black">
                                {data.qty > 0 ? `${data.qty.toFixed(2)} ${semi.unit}` : `0 ${semi.unit}`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500 print:text-black">
                              {Object.entries(data.usedIn).length > 0 ? (
                                Object.entries(data.usedIn).map(([pId, count]) => {
                                  const prod = products.find((p) => p.id === pId);
                                  return (
                                    <span key={pId} className="inline-block mr-2 bg-slate-100 print:bg-gray-100 text-slate-800 print:text-black px-1.5 py-0.5 rounded border border-slate-200 print:border-gray-300 font-medium">
                                      {prod?.name}: {count} шт
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* SECTION B: RAW MATERIAL WAREHOUSE REQUISITION */}
          <div className="pt-4 border-t border-slate-200 print:border-black space-y-3">
            <h3 className="text-xs font-bold text-slate-900 print:text-black uppercase tracking-wider flex items-center space-x-2">
              <Package className="w-4 h-4 text-indigo-600 print:text-black" />
              <span>2. СВОДНАЯ ВЕДОМОСТЬ НА ВЫДАЧУ СЫРЬЯ СО СКЛАДА (СЫРЬЕВОЙ ЗАКУП):</span>
            </h3>

            <div className="border border-slate-200 print:border-black rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 print:bg-gray-200 text-slate-800 print:text-black font-bold border-b border-slate-200 print:border-black text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center border-r border-slate-200 print:border-black">№</th>
                    <th className="py-2 px-3 border-r border-slate-200 print:border-black">Наименование сырья со склада</th>
                    <th className="py-2 px-3 text-center border-r border-slate-200 print:border-black">Потребность заготовщика</th>
                    <th className="py-2 px-3 text-center w-28">Выдано кладовщиком</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-gray-400 bg-white">
                  {Object.entries(rawRequisition).map(([rawName, item], index) => (
                    <tr key={rawName} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="py-2 px-3 text-center font-bold text-slate-400 print:text-black border-r border-slate-200 print:border-black">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 print:text-black border-r border-slate-200 print:border-black">
                        {rawName}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-200 print:border-black font-black text-indigo-900 print:text-black text-sm">
                        {item.qty.toFixed(2)} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400 print:text-black text-[10px]">
                        ______ {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIGNATURES & QUALITY CONTROL BLOCK */}
          <div className="pt-6 border-t border-slate-200 print:border-black grid grid-cols-3 gap-6 text-xs text-slate-700 print:text-black">
            <div className="space-y-4">
              <span className="block font-bold">Старший поваром-заготовитель:</span>
              <div className="border-b border-slate-300 print:border-black h-6 text-[10px] text-slate-400 print:text-gray-500">
                (Подпись / ФИО)
              </div>
            </div>
            <div className="space-y-4">
              <span className="block font-bold">Зав. складом сырья:</span>
              <div className="border-b border-slate-300 print:border-black h-6 text-[10px] text-slate-400 print:text-gray-500">
                (Подпись / ФИО)
              </div>
            </div>
            <div className="space-y-4">
              <span className="block font-bold">Штрихкод партии заготовок:</span>
              <div className="font-mono text-[10px] tracking-widest bg-slate-100 print:bg-gray-100 p-2 rounded border border-slate-200 print:border-gray-400 inline-block font-bold">
                *MC-PREP-2026-{todayStr.replace(/\./g, '')}*
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer (Hidden on Print) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded text-xs font-bold uppercase tracking-wider bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
