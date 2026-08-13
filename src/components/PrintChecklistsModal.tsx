import React from 'react';
import { CoffeeShop, Product, ShopOrder } from '../types';
import { Printer, X, CheckSquare, Package, ChefHat, Calendar, Barcode } from 'lucide-react';

interface PrintChecklistsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentKey: 'bakery' | 'desserts' | 'sandwiches' | 'bar_prep' | 'kitchen_prep' | 'new_items' | null;
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
}

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
}) => {
  if (!isOpen || !departmentKey) return null;

  const dept = DEPARTMENT_CONFIG[departmentKey];
  const deptProducts = products.filter((p) => p.category === dept.category);

  // Filter submitted or accepted orders
  const activeShops = shops.map((shop) => {
    const order = orders[shop.id];
    const isSubmitted = order && (order.status === 'submitted' || order.status === 'accepted');
    const items = isSubmitted ? order.items : {};
    
    // Total for this department for this shop
    const deptTotal = deptProducts.reduce((sum, p) => sum + (items[p.id] || 0), 0);

    return {
      shop,
      items,
      deptTotal,
      isSubmitted,
    };
  });

  const grandDeptTotal = activeShops.reduce((sum, s) => sum + s.deptTotal, 0);

  const handlePrint = () => {
    window.print();
  };

  const todayStr = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:text-black print:static print:h-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl overflow-hidden shadow-xl flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Modal Header (Hidden on Print) */}
        <div className="p-6 border-b border-slate-100 bg-white print:hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{dept.icon}</span>
              <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">{dept.shortTitle}</h2>
            </div>

            <button
              id="btn-close-print-modal"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            id="btn-trigger-print"
            onClick={handlePrint}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3.5 rounded-lg text-sm uppercase tracking-wider shadow-sm animate-pulse-glow hover:animate-none hover:scale-[1.01] active:scale-[0.99] transition-transform"
          >
            <Printer className="w-5 h-5 text-white" />
            <span>Распечатать чек-лист</span>
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
                СЕТЬ 27 КОФЕЕН "MASTER COFFEE" • ЦЕХОВОЕ ЗАДАНИЕ НА ВЫПУСК
              </p>
            </div>

            <div className="text-right text-xs text-slate-700 print:text-black space-y-1">
              <div className="font-bold bg-slate-100 print:bg-gray-100 px-3 py-1 rounded border border-slate-200 print:border-gray-400">
                Код цеха: {dept.code}
              </div>
              <div>Дата партии: <strong>{todayStr}</strong></div>
              <div>Общий объем цеха: <strong className="text-indigo-900 print:text-black text-sm">{grandDeptTotal} шт</strong></div>
            </div>
          </div>

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

          {/* Signatures & Quality Control Block */}
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

        </div>

      </div>
    </div>
  );
};
