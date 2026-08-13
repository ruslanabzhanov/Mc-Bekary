import React, { useState } from 'react';
import { CoffeeShop, Product, ShopOrder } from '../types';
import { Search, AlertTriangle, Filter, CheckCircle2, Clock } from 'lucide-react';

interface MatrixTableProps {
  shops: CoffeeShop[];
  products: Product[];
  orders: Record<number, ShopOrder>;
}

export const MatrixTable: React.FC<MatrixTableProps> = ({ shops, products, orders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate totals per product across all shops
  const productTotals: Record<string, number> = {};
  products.forEach((p) => {
    productTotals[p.id] = shops.reduce((sum, shop) => {
      const order = orders[shop.id];
      if (order && (order.status === 'submitted' || order.status === 'accepted')) {
        return sum + (order.items[p.id] || 0);
      }
      return sum;
    }, 0);
  });

  // Calculate totals per shop across all products
  const shopTotals: Record<number, number> = {};
  shops.forEach((shop) => {
    const order = orders[shop.id];
    if (order && (order.status === 'submitted' || order.status === 'accepted')) {
      shopTotals[shop.id] = products.reduce((sum, p) => sum + (order.items[p.id] || 0), 0);
    } else {
      shopTotals[shop.id] = 0;
    }
  });

  const grandTotal = Object.values(productTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm space-y-4 p-5">
      
      {/* Search & Category Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center space-x-2">
            <span>Сводная Матрица Заказов (27 Кофеен)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Детализация по номенклатуре и филиалам с суммарным расчетом объемов
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Category Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold uppercase tracking-wider overflow-x-auto max-w-full">
            <Filter className="w-3.5 h-3.5 text-indigo-600 ml-2 flex-shrink-0" />
            <button
              id="filter-matrix-all"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1.5 rounded transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Все (58)
            </button>
            <button
              id="filter-matrix-croissants"
              onClick={() => setSelectedCategory('croissants')}
              className={`px-2.5 py-1.5 rounded transition-all whitespace-nowrap ${
                selectedCategory === 'croissants'
                  ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🥐 Круассаны
            </button>
            <button
              id="filter-matrix-sandwiches"
              onClick={() => setSelectedCategory('sandwiches')}
              className={`px-2.5 py-1.5 rounded transition-all whitespace-nowrap ${
                selectedCategory === 'sandwiches'
                  ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🥪 Сэндвичи
            </button>
            <button
              id="filter-matrix-desserts"
              onClick={() => setSelectedCategory('desserts')}
              className={`px-2.5 py-1.5 rounded transition-all whitespace-nowrap ${
                selectedCategory === 'desserts'
                  ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🍰 Десерты
            </button>
            <button
              id="filter-matrix-bar-prep"
              onClick={() => setSelectedCategory('bar_prep')}
              className={`px-2.5 py-1.5 rounded transition-all whitespace-nowrap ${
                selectedCategory === 'bar_prep'
                  ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🧃 Бара
            </button>
            <button
              id="filter-matrix-kitchen-prep"
              onClick={() => setSelectedCategory('kitchen_prep')}
              className={`px-2.5 py-1.5 rounded transition-all whitespace-nowrap ${
                selectedCategory === 'kitchen_prep'
                  ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              👨‍🍳 Кухня
            </button>
            <button
              id="filter-matrix-new-items"
              onClick={() => setSelectedCategory('new_items')}
              className={`px-2.5 py-1.5 rounded transition-all whitespace-nowrap ${
                selectedCategory === 'new_items'
                  ? 'bg-white text-indigo-900 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⚡ Новинки
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 font-medium text-xs rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* MATRIX TABLE WRAPPER WITH SCROLL */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[550px] relative">
        <table className="w-full text-xs text-left border-collapse">
          {/* Table Header: Shops 1..27 */}
          <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[10px] sticky top-0 z-20 shadow-sm border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 sticky left-0 z-30 bg-slate-50 border-r border-b border-slate-200 min-w-[200px]">
                Наименование товара
              </th>
              
              {shops.map((shop) => {
                const order = orders[shop.id];
                const isSubmitted = order && (order.status === 'submitted' || order.status === 'accepted');
                const isAccepted = order && order.status === 'accepted';

                return (
                  <th
                    key={shop.id}
                    className="py-3 px-3 text-center border-r border-b border-slate-200 min-w-[90px] whitespace-nowrap"
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-slate-800">Точка №{shop.id}</span>
                      <span className="text-[9px] text-slate-400 truncate max-w-[80px]">
                        {shop.name.replace(`Кофейня №${shop.id} — `, '')}
                      </span>
                      <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        isAccepted ? 'bg-emerald-100 text-emerald-800' :
                        isSubmitted ? 'bg-indigo-100 text-indigo-800' :
                        'bg-slate-200 text-slate-500'
                      }`}>
                        {isAccepted ? 'Принято' : isSubmitted ? 'Сдал' : 'Не сдал'}
                      </span>
                    </div>
                  </th>
                );
              })}

              <th className="py-3 px-4 text-center sticky right-0 z-30 bg-indigo-600 text-white font-bold border-b border-indigo-700 min-w-[130px] uppercase">
                Всего
              </th>
            </tr>
          </thead>

          {/* Table Body: Products & Shop Quantities */}
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredProducts.map((product) => {
              const totalForProduct = productTotals[product.id] || 0;

              return (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  {/* Sticky Product Name Column */}
                  <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 z-10 bg-white border-r border-slate-200 shadow-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">{product.imageEmoji}</span>
                      <div>
                        <div>{product.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {product.categoryLabel} • {product.unitWeight}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Quantities per Coffee Shop */}
                  {shops.map((shop) => {
                    const order = orders[shop.id];
                    const isSubmitted = order && (order.status === 'submitted' || order.status === 'accepted');
                    const qty = isSubmitted ? (order.items[product.id] || 0) : 0;
                    const hasAnomaly = order?.anomalies?.[product.id];

                    return (
                      <td
                        key={shop.id}
                        className={`py-3 px-3 text-center border-r border-slate-100 font-medium ${
                          hasAnomaly
                            ? 'bg-rose-100 text-rose-950 font-black border-2 border-rose-400'
                            : qty > 0
                            ? 'text-slate-900 font-bold'
                            : 'text-slate-400'
                        }`}
                        title={hasAnomaly ? hasAnomaly : `${product.name} — Точка №${shop.id}: ${qty} шт`}
                      >
                        {qty > 0 ? (
                          <span className="flex items-center justify-center space-x-1">
                            <span>{qty}</span>
                            {hasAnomaly && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 inline" />}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Sticky Right Total Column */}
                  <td className="py-3 px-4 text-center font-black text-indigo-700 text-sm sticky right-0 z-10 bg-indigo-50/60 border-l border-slate-200">
                    {totalForProduct > 0 ? (
                      <span>{totalForProduct} <span className="text-xs font-normal text-slate-500">{product.unit}</span></span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Table Footer: Totals per Shop */}
          <tfoot className="bg-slate-50 text-slate-900 font-bold sticky bottom-0 z-20 border-t-2 border-slate-200">
            <tr>
              <td className="py-3.5 px-4 sticky left-0 z-30 bg-slate-50 border-r border-slate-200 text-indigo-900 font-black uppercase text-[10px] tracking-widest">
                ИТОГО ПО ТОЧКЕ (шт):
              </td>

              {shops.map((shop) => (
                <td key={shop.id} className="py-3.5 px-3 text-center border-r border-slate-200 font-extrabold text-slate-800">
                  {shopTotals[shop.id] > 0 ? shopTotals[shop.id] : 0}
                </td>
              ))}

              <td className="py-3.5 px-4 text-center font-black text-base sticky right-0 z-30 bg-indigo-600 text-white shadow-md uppercase">
                {grandTotal} шт
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-2 pt-2 font-medium">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-rose-100 border border-rose-500 inline-block" />
            <span>Аномальный заказ</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
            <span>Принятая заявка</span>
          </span>
        </div>
        <div>
          Суммарная стоимость витринной продукции: <strong className="text-indigo-900 font-black">
            {products.reduce((sum, p) => sum + (productTotals[p.id] || 0) * p.price, 0).toLocaleString('ru-RU')} ₸
          </strong>
        </div>
      </div>

    </div>
  );
};
