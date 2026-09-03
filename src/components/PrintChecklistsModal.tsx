import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CoffeeShop, Product, ShopOrder, ChecklistAssignments, DishCosting, SemiFinishedProduct, RawMaterial } from '../types';
import { Printer, X, Settings, Plus, Search, ClipboardList, Store } from 'lucide-react';

interface PrintChecklistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentKey: 'bakery' | 'desserts' | 'sandwiches' | 'bar_prep' | 'kitchen_prep' | 'new_items' | null;
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
  checklistAssignments: ChecklistAssignments;
  onUpdateChecklistAssignments: (next: ChecklistAssignments) => void;
  dishCostings: Record<string, DishCosting>;
  semiFinishedList: SemiFinishedProduct[];
  rawMaterials: RawMaterial[];
}

const formatQty = (n: number) => Number(n.toFixed(2)).toLocaleString('ru-RU');

// Show small quantities in grams/millilitres (easier to weigh out) and larger ones in kg/l
const formatAmount = (amount: number, unit: string): string => {
  if (unit === 'кг' && amount < 1) return `${Math.round(amount * 1000)} г`;
  if (unit === 'л' && amount < 1) return `${Math.round(amount * 1000)} мл`;
  return `${formatQty(amount)} ${unit}`;
};

const GROUP_COLORS = [
  'bg-emerald-700',
  'bg-rose-700',
  'bg-sky-700',
  'bg-amber-700',
  'bg-violet-700',
  'bg-slate-700',
];
const GROUP_ORDER = [
  'Мясо и птица',
  'Рыба и морепродукты',
  'Овощи и зелень',
  'Молочные продукты и яйцо',
  'Соусы и бакалея',
  'Крупы и мука',
  'Полуфабрикаты',
  'Упаковка и расходники',
];

const DEPARTMENT_CONFIG = {
  bakery: {
    title: 'ЦЕХ КРУАССАНОВ И ВЫПЕЧКИ',
    shortTitle: 'Чек-лист Пекарей',
    subtitle: 'Выпечка круассанов и слоеных изделий',
    icon: '🥐',
    category: 'croissants',
    code: 'DEPT-BAKERY-01',
  },
  sandwiches: {
    title: 'ЦЕХ СЭНДВИЧЕЙ И ЗАВТРАКОВ',
    shortTitle: 'Чек-лист Сэндвичей',
    subtitle: 'Сборка сэндвичей, завтраков, твистов и каш',
    icon: '🥪',
    category: 'sandwiches',
    code: 'DEPT-SANDWICH-02',
  },
  desserts: {
    title: 'КОНДИТЕРСКИЙ ЦЕХ (ДЕСЕРТЫ)',
    shortTitle: 'Чек-лист Кондитеров',
    subtitle: 'Торты, чизкейки, кукисы и кремовые десерты',
    icon: '🍰',
    category: 'desserts',
    code: 'DEPT-DESSERT-03',
  },
  bar_prep: {
    title: 'ЦЕХ ЗАГОТОВОК БАРА',
    shortTitle: 'Чек-лист Заготовок Бара',
    subtitle: 'Сиропы, пюре, заготовки смородины, манго и сырная пена',
    icon: '🧃',
    category: 'bar_prep',
    code: 'DEPT-BAR-PREP-04',
  },
  kitchen_prep: {
    title: 'ЦЕХ ЗАГОТОВОК КУХНИ',
    shortTitle: 'Чек-лист Заготовщиков',
    subtitle: 'Полуфабрикаты котлет, бриоши, сырников цеха и заготовок',
    icon: '👨‍🍳',
    category: 'kitchen_prep',
    code: 'DEPT-KITCHEN-PREP-05',
  },
  new_items: {
    title: 'ЦЕХ НОВИНОК (КОЛД-БРЮ)',
    shortTitle: 'Чек-лист Новинок',
    subtitle: 'Черри Брю, Гранат Брю и Малина Брю',
    icon: '⚡',
    category: 'new_items',
    code: 'DEPT-NEW-06',
  },
};

export const PrintChecklistsModal: React.FC<PrintChecklistsModalProps> = ({
  isOpen,
  onClose,
  departmentKey,
  shops,
  products,
  orders,
  checklistAssignments,
  onUpdateChecklistAssignments,
  dishCostings,
  semiFinishedList,
  rawMaterials,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'production' | 'summary'>('production');

  if (!isOpen || !departmentKey) return null;

  const dept = DEPARTMENT_CONFIG[departmentKey];

  // Products manually assigned to this checklist via the settings panel
  const assignedIds = checklistAssignments[departmentKey] || [];
  const assignedProducts = assignedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  // Orders submitted/accepted today, per shop (this app tracks only the current live order per shop)
  const shopItems = shops.map((shop) => {
    const order = orders[shop.id];
    const isSubmitted = order && (order.status === 'submitted' || order.status === 'accepted');
    return { shop, items: isSubmitted ? order.items : {}, isSubmitted };
  });

  // Only include assigned dishes that were actually submitted today by at least one shop
  const deptProducts = assignedProducts.filter((p) =>
    shopItems.some(({ items }) => (items[p.id] || 0) > 0)
  );

  const activeShops = shopItems.map(({ shop, items, isSubmitted }) => {
    const deptTotal = deptProducts.reduce((sum, p) => sum + (items[p.id] || 0), 0);
    return { shop, items, deptTotal, isSubmitted };
  });

  const grandDeptTotal = activeShops.reduce((sum, s) => sum + s.deptTotal, 0);

  // Per-dish ingredient requirements for the production (shop-floor) checklist
  const semiMap = new Map<string, SemiFinishedProduct>(semiFinishedList.map((s) => [s.id, s]));
  const rawCategoryByName = new Map<string, string>(rawMaterials.map((r) => [r.name, r.categoryLabel]));
  const productionRows = deptProducts.map((p) => {
    const orderedQty = activeShops.reduce((sum, s) => sum + (s.items[p.id] || 0), 0);
    const costing = dishCostings[p.id];
    const semiNeeds = (costing?.semiFinishedItems || []).map((item) => {
      const semi = semiMap.get(item.semiFinishedId);
      return {
        name: semi?.name || 'Неизвестный п/ф',
        perUnit: item.quantity,
        amount: item.quantity * orderedQty,
        unit: semi?.unit || item.unit,
        groupLabel: 'Полуфабрикаты',
      };
    });
    const rawNeeds = (costing?.rawIngredients || []).map((item) => ({
      name: item.name,
      perUnit: item.quantity,
      amount: item.quantity * orderedQty,
      unit: item.unit,
      groupLabel: rawCategoryByName.get(item.name) || 'Прочее сырьё',
    }));
    return { product: p, orderedQty, semiNeeds, rawNeeds, allNeeds: [...semiNeeds, ...rawNeeds] };
  });

  // Split dish list into two columns for the print layout
  const productionHalf = Math.ceil(productionRows.length / 2);
  const productionCol1 = productionRows.slice(0, productionHalf);
  const productionCol2 = productionRows.slice(productionHalf);

  // Consolidated ingredient totals across all dishes in this checklist, grouped by category
  const aggregatedNeeds = new Map<string, { name: string; unit: string; amount: number; groupLabel: string }>();
  for (const row of productionRows) {
    for (const need of row.allNeeds) {
      const key = `${need.groupLabel}|${need.name}|${need.unit}`;
      const existing = aggregatedNeeds.get(key);
      if (existing) existing.amount += need.amount;
      else aggregatedNeeds.set(key, { name: need.name, unit: need.unit, amount: need.amount, groupLabel: need.groupLabel });
    }
  }
  const aggregatedGroups = new Map<string, { name: string; unit: string; amount: number }[]>();
  for (const item of aggregatedNeeds.values()) {
    if (!aggregatedGroups.has(item.groupLabel)) aggregatedGroups.set(item.groupLabel, []);
    aggregatedGroups.get(item.groupLabel)!.push(item);
  }
  const sortedAggregatedGroups = Array.from(aggregatedGroups.entries()).sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a[0]);
    const bi = GROUP_ORDER.indexOf(b[0]);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const handlePrint = () => {
    window.print();
  };

  const handleAddProductToChecklist = (productId: string) => {
    onUpdateChecklistAssignments({
      ...checklistAssignments,
      [departmentKey]: [...assignedIds, productId],
    });
    setProductSearchQuery('');
  };

  const handleRemoveProductFromChecklist = (productId: string) => {
    onUpdateChecklistAssignments({
      ...checklistAssignments,
      [departmentKey]: assignedIds.filter((id) => id !== productId),
    });
  };

  const productSearchResults = productSearchQuery.trim()
    ? products
        .filter(
          (p) =>
            !assignedIds.includes(p.id) &&
            p.name.toLowerCase().includes(productSearchQuery.trim().toLowerCase())
        )
        .slice(0, 8)
    : [];

  const todayStr = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:text-black print:static print:h-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl overflow-hidden shadow-xl flex flex-col max-h-[92vh] print:max-w-none print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Modal Header (Hidden on Print) */}
        <div className="p-6 border-b border-slate-100 bg-white print:hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{dept.icon}</span>
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{dept.shortTitle}</h2>
            </div>

            <div className="flex items-center space-x-2">
              <button
                id="btn-toggle-checklist-settings"
                onClick={() => setIsSettingsOpen((v) => !v)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  isSettingsOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                }`}
                title="Настройки чек-листа"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
              <button
                id="btn-close-print-modal"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {isSettingsOpen && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Блюда, относящиеся к этому чек-листу
                </h3>
                <span className="text-[10px] text-slate-400 font-bold">{assignedProducts.length} назначено</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {assignedProducts.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">Нет назначенных блюд</span>
                ) : (
                  assignedProducts.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[11px] font-bold pl-2.5 pr-1.5 py-1 rounded-full"
                    >
                      {p.name}
                      <button
                        onClick={() => handleRemoveProductFromChecklist(p.id)}
                        className="w-4 h-4 rounded-full hover:bg-indigo-200 flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  placeholder="Поиск блюда для добавления в чек-лист..."
                  className="w-full pl-8 pr-2 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {productSearchQuery.trim() && (
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                  {productSearchResults.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-2.5">Ничего не найдено</p>
                  ) : (
                    productSearchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProductToChecklist(p.id)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 flex items-center justify-between gap-2"
                      >
                        <span className="font-medium text-slate-800 truncate">{p.name}</span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-400 shrink-0">
                          {p.categoryLabel}
                          <Plus className="w-3 h-3 text-indigo-600" />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-view-production"
              onClick={() => setActiveView('production')}
              className={`flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                activeView === 'production'
                  ? 'bg-indigo-900 border-indigo-900 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Для цеха (заготовки)</span>
            </button>
            <button
              id="btn-view-summary"
              onClick={() => setActiveView('summary')}
              className={`flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                activeView === 'summary'
                  ? 'bg-indigo-900 border-indigo-900 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Сводный (по точкам)</span>
            </button>
          </div>

          <button
            id="btn-trigger-print"
            onClick={handlePrint}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3.5 rounded-lg text-sm uppercase tracking-wider shadow-sm animate-pulse-glow hover:animate-none hover:scale-[1.01] active:scale-[0.99] transition-transform"
          >
            <Printer className="w-5 h-5 text-white" />
            <span>Распечатать {activeView === 'production' ? 'цеховой' : 'сводный'} чек-лист</span>
          </button>
        </div>

        {/* PRINTABLE BODY CONTENT */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1 text-slate-800 bg-white print:bg-white print:text-black print:overflow-visible">
          
          {/* Official Department Production Header */}
          <div className="border-b-2 border-slate-200 print:border-black pb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl print:text-xl">{dept.icon}</span>
                <h1 className="text-xl print:text-2xl font-black text-indigo-900 print:text-black uppercase tracking-tight">
                  {dept.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500 print:text-gray-700 mt-0.5">{dept.subtitle}</p>
              <p className="text-xs font-bold text-indigo-700 print:text-black mt-2 uppercase tracking-wider">
                СЕТЬ 27 КОФЕЕН "MASTER BAKERY" •{' '}
                {activeView === 'production' ? 'ЗАДАНИЕ НА ЗАГОТОВКУ ДЛЯ ЦЕХА' : 'СВОДНАЯ ВЕДОМОСТЬ ПО ТОЧКАМ'}
              </p>
            </div>

            <div className="text-right text-xs text-slate-700 print:text-black space-y-1">
              <div className="font-bold bg-slate-100 print:bg-gray-100 px-3 py-1 rounded border border-slate-200 print:border-gray-400">
                Код цеха: {dept.code}
              </div>
              <div>Дата: <strong>{todayStr}</strong></div>
              {activeView === 'production' && (
                <>
                  <div className="flex items-center justify-end gap-3">
                    <span>Смена:</span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 border border-slate-400 print:border-black inline-block" /> Дневная
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 border border-slate-400 print:border-black inline-block" /> Ночная
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span>Повар:</span>
                    <span className="inline-block w-32 border-b border-slate-300 print:border-black">&nbsp;</span>
                  </div>
                </>
              )}
              <div>Общий объем цеха: <strong className="text-indigo-900 print:text-black text-sm">{grandDeptTotal} шт</strong></div>
            </div>
          </div>

          {deptProducts.length === 0 ? (
            <div className="border border-dashed border-slate-300 print:border-black rounded-lg py-10 text-center text-slate-400 print:text-black">
              Сегодня по этому цеху ещё нет поданных блюд.
            </div>
          ) : activeView === 'production' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 print:grid-cols-3 gap-4 items-start">
                {/* Dish ingredient calculator, split across two columns */}
                {[productionCol1, productionCol2].map((col, colIdx) => (
                  <div key={colIdx} className="space-y-3">
                    <h3 className="text-[10px] font-bold text-slate-500 print:text-black uppercase tracking-wider">
                      Калькулятор блюд {colIdx === 0 ? '(часть 1)' : '(часть 2)'}
                    </h3>
                    {col.map(({ product, orderedQty, allNeeds }) => (
                      <div
                        key={product.id}
                        className="border border-slate-300 print:border-black rounded-lg overflow-hidden break-inside-avoid"
                      >
                        <div className="bg-indigo-900 print:bg-gray-800 text-white px-3 py-1.5 flex items-center justify-between gap-2">
                          <h4 className="font-black uppercase text-[11px] tracking-tight truncate">{product.name}</h4>
                          <span className="text-[11px] font-bold whitespace-nowrap">План: {orderedQty} {product.unit}</span>
                        </div>
                        {allNeeds.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic px-3 py-2">
                            Состав не заполнен (заполните в «Блюда и ТКК»)
                          </p>
                        ) : (
                          <table className="w-full text-[11px]">
                            <tbody className="divide-y divide-slate-100 print:divide-gray-300">
                              {allNeeds.map((n, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-1 text-slate-700 print:text-black">{n.name}</td>
                                  <td className="px-2 py-1 text-slate-400 print:text-black text-right whitespace-nowrap">
                                    {formatAmount(n.perUnit, n.unit)}
                                  </td>
                                  <td className="px-3 py-1 font-bold text-indigo-900 print:text-black text-right whitespace-nowrap">
                                    {formatAmount(n.amount, n.unit)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Consolidated ingredient totals, grouped by category */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-500 print:text-black uppercase tracking-wider">
                    Сводная ведомость заготовок
                  </h3>
                  <div className="border border-slate-300 print:border-black rounded-lg overflow-hidden break-inside-avoid">
                    {sortedAggregatedGroups.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic px-3 py-2">Нет данных для расчёта</p>
                    ) : (
                      sortedAggregatedGroups.map(([groupLabel, items], gi) => (
                        <div key={groupLabel}>
                          <div
                            className={`${GROUP_COLORS[gi % GROUP_COLORS.length]} print:bg-gray-800 text-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wide`}
                          >
                            {gi + 1}. {groupLabel}
                          </div>
                          <ul className="divide-y divide-dashed divide-slate-200 print:divide-black">
                            {items.map((it, i) => (
                              <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                                <span className="w-3 h-3 border border-slate-400 print:border-black shrink-0" />
                                <span className="flex-1 text-[11px] text-slate-800 print:text-black truncate">{it.name}</span>
                                <span className="text-[11px] font-black text-indigo-900 print:text-black whitespace-nowrap">
                                  {formatAmount(it.amount, it.unit)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Hygiene / quality control rules */}
                  <div className="border border-slate-300 print:border-black rounded-lg p-3 text-[10px] text-slate-700 print:text-black space-y-1 break-inside-avoid">
                    <h5 className="font-black uppercase text-[11px] mb-1">Контроль качества и СанПиН</h5>
                    <p>• <strong>Температура:</strong> цех до +16°C, холод +2°...+4°C</p>
                    <p>• <strong>Гигиена:</strong> перчатки обязательны, руки мыть каждые 30 мин</p>
                    <p>• <strong>Маркировка:</strong> стикер с датой, временем и ФИО повара</p>
                    <p>• <strong>Правило FIFO:</strong> старая заготовка — вперёд</p>
                  </div>
                </div>
              </div>

              {/* Shift handover footer, specific to the production checklist */}
              <div className="pt-4 border-t border-slate-200 print:border-black grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-6 text-[11px] text-slate-700 print:text-black">
                <div className="space-y-3">
                  <h5 className="font-black uppercase text-xs">Приём-сдача смены</h5>
                  <div>
                    <span className="block mb-1">Смену сдал (ФИО, подпись):</span>
                    <div className="border-b border-slate-300 print:border-black h-5" />
                  </div>
                  <div>
                    <span className="block mb-1">Смену принял (ФИО, подпись):</span>
                    <div className="border-b border-slate-300 print:border-black h-5" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="font-black uppercase text-xs">Контроль стандартов цеха</h5>
                  {[
                    'Оборудование и рабочие зоны чистые',
                    'Проведена ротация сырья по правилу FIFO',
                    'Все заготовки промаркированы стикерами',
                    'Все остатки убраны в холодильник',
                  ].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border border-slate-400 print:border-black shrink-0" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h5 className="font-black uppercase text-xs">Комментарии и замечания шефа</h5>
                  <div className="border-b border-slate-300 print:border-black h-5" />
                  <div className="border-b border-slate-300 print:border-black h-5" />
                  <div className="border-b border-slate-300 print:border-black h-5" />
                </div>
              </div>
            </div>
          ) : (
          <>
          {/* Department Product Totals Breakdown */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 print:text-black uppercase tracking-wider">
              Сводная потребность по позициям цеха:
            </h3>
            <div className="border border-slate-200 print:border-black rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 print:bg-gray-200 text-slate-700 print:text-black font-bold border-b border-slate-200 print:border-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-12 text-center">№</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-black">Наименование</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-black">Вес</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-black">Срок годности</th>
                    <th className="py-2.5 px-3 text-center font-extrabold">Количество</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-gray-400 bg-white">
                  {deptProducts.map((p, index) => {
                    const total = activeShops.reduce((sum, s) => sum + (s.items[p.id] || 0), 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                        <td className="py-2 px-3 text-center font-bold text-slate-500 print:text-black border-r border-slate-200 print:border-black">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 print:text-black border-r border-slate-200 print:border-black">
                          {p.name}
                        </td>
                        <td className="py-2 px-3 text-slate-600 print:text-black border-r border-slate-200 print:border-black">
                          {p.unitWeight}
                        </td>
                        <td className="py-2 px-3 text-slate-600 print:text-black border-r border-slate-200 print:border-black">
                          {p.shelfLife}
                        </td>
                        <td className="py-2 px-3 text-center font-black text-indigo-900 print:text-black">
                          {total} {p.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table per Coffee Shop for Dispatch / Packing */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 print:text-black uppercase tracking-wider mb-3">
              Чек-лист распределения и фасовки по 27 точкам:
            </h3>

            <div className="border border-slate-200 print:border-black rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 print:bg-gray-200 text-slate-700 print:text-black font-bold border-b border-slate-200 print:border-black uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-black w-12 text-center">№</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-black">Кофейня / Адрес</th>
                    {deptProducts.map((p) => (
                      <th key={p.id} className="py-2.5 px-3 border-r border-slate-200 print:border-black text-center">
                        {p.name}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 border-r border-slate-200 print:border-black text-center font-extrabold">Итого</th>
                    <th className="py-2.5 px-3 text-center w-24">Отметка цеха</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 print:divide-gray-400 bg-white">
                  {activeShops.map(({ shop, items, deptTotal, isSubmitted }) => (
                    <tr key={shop.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="py-2 px-3 text-center font-bold text-slate-500 print:text-black border-r border-slate-200 print:border-black">
                        #{shop.id}
                      </td>

                      <td className="py-2 px-3 border-r border-slate-200 print:border-black">
                        <div className="font-bold text-slate-900 print:text-black">
                          {shop.name.replace(`Кофейня №${shop.id} — `, '')}
                        </div>
                        <div className="text-[10px] text-slate-500 print:text-gray-600">
                          {shop.district} | Менеджер: {shop.manager}
                        </div>
                      </td>

                      {deptProducts.map((p) => {
                        const qty = items[p.id] || 0;
                        return (
                          <td
                            key={p.id}
                            className={`py-2 px-3 text-center border-r border-slate-200 print:border-black font-semibold ${
                              qty > 0 ? 'text-slate-900 print:text-black font-bold' : 'text-slate-300 print:text-gray-300'
                            }`}
                          >
                            {qty > 0 ? `${qty} шт` : '—'}
                          </td>
                        );
                      })}

                      <td className="py-2 px-3 text-center font-black text-indigo-900 print:text-black border-r border-slate-200 print:border-black">
                        {deptTotal} шт
                      </td>

                      <td className="py-2 px-3 text-center">
                        <div className="w-4 h-4 border-2 border-slate-400 print:border-black rounded mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="bg-slate-50 print:bg-gray-300 font-extrabold text-slate-900 print:text-black border-t-2 border-slate-200 print:border-black">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 border-r border-slate-200 print:border-black text-right uppercase text-[10px]">
                      ИТОГО К ВЫПУСКУ:
                    </td>
                    {deptProducts.map((p) => {
                      const total = activeShops.reduce((sum, s) => sum + (s.items[p.id] || 0), 0);
                      return (
                        <td key={p.id} className="py-3 px-3 text-center border-r border-slate-200 print:border-black text-indigo-900 print:text-black">
                          {total} шт
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-center text-indigo-900 print:text-black text-sm font-black">
                      {grandDeptTotal} шт
                    </td>
                    <td className="py-3 px-3 text-center font-normal text-[10px] text-slate-500 print:text-black">
                      Подпись
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Signatures & Dispatch Block */}
          <div className="pt-6 border-t border-slate-200 print:border-black grid grid-cols-3 gap-6 text-xs text-slate-700 print:text-black">
            <div className="space-y-4">
              <span className="block font-bold">Начальник цеха:</span>
              <div className="border-b border-slate-300 print:border-black h-6 text-[10px] text-slate-400 print:text-gray-500">
                (Подпись / ФИО)
              </div>
            </div>
            <div className="space-y-4">
              <span className="block font-bold">Экспедитор / Фасовка:</span>
              <div className="border-b border-slate-300 print:border-black h-6 text-[10px] text-slate-400 print:text-gray-500">
                (Подпись / ФИО)
              </div>
            </div>
            <div className="space-y-4 text-right">
              <span className="block font-bold">Штрихкод партии:</span>
              <div className="font-mono text-[10px] tracking-widest bg-slate-100 print:bg-gray-100 p-2 rounded border border-slate-200 print:border-gray-400 inline-block font-bold">
                *MC-2026-DEPT-{departmentKey.toUpperCase()}*
              </div>
            </div>
          </div>
          </>
          )}

        </div>

      </div>
    </div>,
    document.body
  );
};
