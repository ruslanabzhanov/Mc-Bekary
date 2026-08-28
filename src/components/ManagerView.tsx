import React, { useState, useMemo } from 'react';
import { CoffeeShop, Product, ShopOrder, Category } from '../types';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Send,
  Building2,
  Plus,
  Minus,
  Clock,
  Zap,
  TrendingUp,
  Info
} from 'lucide-react';

interface ManagerViewProps {
  coffeeShops: CoffeeShop[];
  products: Product[];
  selectedShopId: number;
  onSelectShop: (shopId: number) => void;
  currentOrder: ShopOrder;
  onUpdateOrder: (shopId: number, items: Record<string, number>, status?: 'draft' | 'submitted') => void;
  onOpenPreview: () => void;
  notifications: Array<{ id: string; sentAt: string; message: string }>;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  coffeeShops,
  products,
  selectedShopId,
  onSelectShop,
  currentOrder,
  onUpdateOrder,
  onOpenPreview,
  notifications,
}) => {
  const [activeTab, setActiveTab] = useState<Category | 'all'>('all');
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedShop = useMemo(
    () => coffeeShops.find((s) => s.id === selectedShopId) || coffeeShops[0],
    [coffeeShops, selectedShopId]
  );

  const shopOrderItems = currentOrder?.items || {};

  // Compute frequent items for this shop
  const frequentProductIds = selectedShop?.frequentItems || [];

  // Filter products by tab
  const filteredProducts = useMemo(() => {
    if (activeTab === 'all') return products;
    return products.filter((p) => p.category === activeTab);
  }, [products, activeTab]);

  // Quantity updates with validation
  const handleQuantityChange = (productId: string, val: string) => {
    setValidationError(null);
    if (val === '') {
      const updated = { ...shopOrderItems };
      delete updated[productId];
      onUpdateOrder(selectedShopId, updated, 'draft');
      return;
    }

    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) {
      setValidationError('Пожалуйста, вводите только целые положительные числа');
      return;
    }

    if (num > 500) {
      setValidationError('Максимальный заказ одной позиции — 500 шт');
      return;
    }

    const updated = { ...shopOrderItems, [productId]: num };
    onUpdateOrder(selectedShopId, updated, 'draft');
  };

  const handleIncrement = (productId: string) => {
    setValidationError(null);
    const currentQty = shopOrderItems[productId] || 0;
    handleQuantityChange(productId, String(currentQty + 1));
  };

  const handleDecrement = (productId: string) => {
    setValidationError(null);
    const currentQty = shopOrderItems[productId] || 0;
    if (currentQty <= 1) {
      const updated = { ...shopOrderItems };
      delete updated[productId];
      onUpdateOrder(selectedShopId, updated, 'draft');
    } else {
      handleQuantityChange(productId, String(currentQty - 1));
    }
  };

  // Quick auto-fill AI recommendation
  const handleApplyAiRecommendation = (productId: string) => {
    const avg = selectedShop?.historicalAvg[productId] || 12;
    handleQuantityChange(productId, String(avg));
  };

  const handleApplyAllAiRecommendations = () => {
    const newItems: Record<string, number> = { ...shopOrderItems };
    products.forEach((p) => {
      const rec = selectedShop?.historicalAvg[p.id] || 10;
      newItems[p.id] = rec;
    });
    onUpdateOrder(selectedShopId, newItems, 'draft');
  };

  // Calculate totals & anomalies
  const { totalPcs, totalSum, anomalyCount } = useMemo(() => {
    let pcs = 0;
    let sum = 0;
    let anomalies = 0;

    Object.entries(shopOrderItems).forEach(([pId, qtyVal]) => {
      const qty = Number(qtyVal) || 0;
      const p = products.find((item) => item.id === pId);
      if (p && qty > 0) {
        pcs += qty;
        sum += qty * p.price;

        const avg = selectedShop?.historicalAvg[pId] || 10;
        if (avg > 0) {
          const ratio = qty / avg;
          if ((ratio >= 2.0 && qty > 10) || (ratio <= 0.3 && qty > 0)) {
            anomalies++;
          }
        }
      }
    });

    return { totalPcs: pcs, totalSum: sum, anomalyCount: anomalies };
  }, [shopOrderItems, products, selectedShop]);

  // Submit order handler
  const handleSubmitOrder = () => {
    if (totalPcs === 0) {
      setValidationError('Заявка не может быть пустой. Пожалуйста, укажите количество хотя бы для одного товара.');
      return;
    }
    onUpdateOrder(selectedShopId, shopOrderItems, 'submitted');
  };

  // Shop notifications for this shop
  const shopNotifications = notifications.filter((n) => n.shopId === selectedShopId);

  return (
    <div className="space-y-6 pb-28">
      
      {/* Notifications Alert Banner if present */}
      {shopNotifications.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-2xl p-4 flex items-start space-x-3 shadow-sm animate-pulse">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-amber-950">Уведомление от Администрации сети:</h4>
            <p className="text-xs text-amber-900 mt-0.5">{shopNotifications[0].message}</p>
          </div>
        </div>
      )}

      {/* STEP 1: Tile Grid Dashboard (Информационные карточки плиткой) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Tile 1: Закрепленная точка */}
          <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                Точка №{selectedShop.id}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-200/80 text-indigo-900 font-bold">
                🔒
              </span>
            </div>
            <span className="font-extrabold text-slate-900 text-xs block truncate" title={selectedShop.name}>
              {selectedShop.name.replace(`Кофейня №${selectedShop.id} — `, '')}
            </span>
          </div>

          {/* Tile 2: Менеджер */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between">
            <span className="font-bold text-slate-800 text-xs truncate" title={selectedShop.manager}>
              {selectedShop.manager}
            </span>
            <span className="text-[10px] font-black uppercase text-slate-400 block mt-1">Менеджер точки</span>
          </div>

          {/* Tile 3: Статус заявки */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Статус заявки</span>
              <span className={`font-bold uppercase tracking-wider text-xs ${
                currentOrder.status === 'accepted' ? 'text-emerald-600' :
                currentOrder.status === 'submitted' ? 'text-indigo-600' : 'text-amber-600'
              }`}>
                {currentOrder.status === 'accepted' ? 'Принято' :
                 currentOrder.status === 'submitted' ? 'Отправлено' : 'Черновик'}
              </span>
            </div>
            {currentOrder.status === 'accepted' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : currentOrder.status === 'submitted' ? (
              <Clock className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-amber-500 flex-shrink-0" />
            )}
          </div>

          {/* Tile 4: Заявка в один клик */}
          <button
            id="btn-apply-ai-all"
            onClick={handleApplyAllAiRecommendations}
            className="bg-slate-50 hover:bg-indigo-50 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 flex items-center justify-between transition-all cursor-pointer group shadow-2xs text-left"
            title="Заявка в один клик: заполнить все товары на основе ИИ-норм дня"
          >
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Заявка</span>
              <span className="font-bold uppercase tracking-wider text-xs text-indigo-700 group-hover:text-indigo-900">
                В один клик
              </span>
            </div>
            <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* STEP 2: Category Navigation Tabs */}
      <div className="flex p-1.5 gap-1 bg-slate-100 border border-slate-200 rounded-xl sticky top-16 z-30 shadow-sm overflow-hidden">
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar w-full py-0.5">
          <button
            id="tab-all"
            onClick={() => setActiveTab('all')}
            className={`py-2 px-3.5 text-xs font-bold uppercase rounded-lg tracking-wider transition-all whitespace-nowrap flex items-center justify-center space-x-1.5 ${
              activeTab === 'all'
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>Все товары</span>
            <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">
              {products.length}
            </span>
          </button>

          <div className="h-6 w-px bg-slate-300 mx-1 flex-shrink-0" />

          <button
            id="tab-croissants"
            onClick={() => setActiveTab('croissants')}
            className={`py-2 px-3 text-xs font-bold uppercase rounded-lg tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'croissants'
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            🥐 Круассаны и слойки (6)
          </button>

          <button
            id="tab-sandwiches"
            onClick={() => setActiveTab('sandwiches')}
            className={`py-2 px-3 text-xs font-bold uppercase rounded-lg tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'sandwiches'
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            🥪 Сэндвичи и завтраки (14)
          </button>

          <button
            id="tab-desserts"
            onClick={() => setActiveTab('desserts')}
            className={`py-2 px-3 text-xs font-bold uppercase rounded-lg tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'desserts'
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            🍰 Десерты (15)
          </button>

          <button
            id="tab-bar-prep"
            onClick={() => setActiveTab('bar_prep')}
            className={`py-2 px-3 text-xs font-bold uppercase rounded-lg tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'bar_prep'
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            🧃 Заготовки бара (12)
          </button>

          <button
            id="tab-kitchen-prep"
            onClick={() => setActiveTab('kitchen_prep')}
            className={`py-2 px-3 text-xs font-bold uppercase rounded-lg tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'kitchen_prep'
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            👨‍🍳 Заготовки кухня (8)
          </button>

          <button
            id="tab-new-items"
            onClick={() => setActiveTab('new_items')}
            className={`py-2 px-3 text-xs font-bold uppercase rounded-lg tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'new_items'
                ? 'bg-white text-indigo-950 border border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            ⚡ Новинки (3)
          </button>
        </div>
      </div>

      {/* Validation Error Message Alert */}
      {validationError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-600 p-4 rounded-xl flex items-center space-x-3 text-sm animate-shake">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* PRODUCTS WORKSPACE GRID - COMPACT MOBILE TILE GRID (4 items fit on mobile screen) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
        {filteredProducts.map((product) => {
          const isFrequent = frequentProductIds.includes(product.id);
          const currentQty = shopOrderItems[product.id] || 0;
          const avgQty = selectedShop?.historicalAvg[product.id] || 10;

          // Anomaly calculation
          let anomalyType: 'high' | 'low' | null = null;
          let anomalyText = '';

          if (currentQty > 0 && avgQty > 0) {
            const ratio = currentQty / avgQty;
            if (ratio >= 2.0 && currentQty > 10) {
              anomalyType = 'high';
              const pct = Math.round((ratio - 1) * 100);
              anomalyText = `⚠️ Завышение +${pct}% (${avgQty} шт)`;
            } else if (ratio <= 0.3 && avgQty >= 10) {
              anomalyType = 'low';
              const pct = Math.round((1 - ratio) * 100);
              anomalyText = `⚠️ Занижение -${pct}% (${avgQty} шт)`;
            }
          }

          return (
            <div
              key={product.id}
              className={`rounded-xl flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow relative overflow-hidden group border ${
                anomalyType
                  ? 'border-2 border-rose-500 bg-rose-50/80 ring-1 ring-rose-400'
                  : isFrequent
                  ? 'border-indigo-200 bg-indigo-50/20'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                {/* CLEAN SQUARE PHOTO */}
                <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />

                  {isFrequent && (
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white shadow z-10">
                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                    </span>
                  )}
                  {anomalyType && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] animate-pulse z-10">
                      !
                    </span>
                  )}
                </div>

                {/* Content Details */}
                <div className="px-2 pt-1.5 pb-0.5 text-center">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight line-clamp-1 group-hover:text-indigo-600 transition-colors" title={product.name}>
                    {product.name}
                  </h3>

                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="font-black text-slate-900 text-xs sm:text-sm">
                      {product.price.toLocaleString('ru-RU')} ₸
                    </span>
                    <button
                      id={`btn-ai-fill-${product.id}`}
                      onClick={() => handleApplyAiRecommendation(product.id)}
                      className="text-[9px] font-bold text-slate-400 hover:text-indigo-700"
                      title="Вставить ИИ-расчетную норму"
                    >
                      · {avgQty} шт
                    </button>
                  </div>

                  {/* Red Anomaly Alert Banner */}
                  {anomalyType && (
                    <div className="mt-1 p-1.5 rounded bg-rose-100 text-rose-950 text-[10px] font-bold border border-rose-300 text-left">
                      <span>{anomalyText}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity Input Controls */}
              <div className="px-2 pb-2 pt-1">
                <div>
                  <div className="flex items-center justify-between space-x-1">
                    <button
                      id={`btn-dec-${product.id}`}
                      onClick={() => handleDecrement(product.id)}
                      disabled={currentQty === 0}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 flex items-center justify-center border border-slate-200 font-bold transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex-1 text-center">
                      <input
                        id={`input-qty-${product.id}`}
                        type="number"
                        min="0"
                        max="500"
                        value={currentQty === 0 ? '' : currentQty}
                        placeholder="0"
                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                        className="w-full text-center bg-slate-50 border border-slate-200 rounded-lg py-1 text-slate-900 font-black text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
                      />
                    </div>

                    <button
                      id={`btn-inc-${product.id}`}
                      onClick={() => handleIncrement(product.id)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FORM FOOTER STICKY BAR: only while composing a draft with at least 1 item, hides once submitted */}
      {totalPcs > 0 && currentOrder.status === 'draft' && (
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 sm:p-3 md:p-4 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-2 sm:gap-4">

          {/* Order Totals Summary */}
          <div className="flex items-center space-x-2.5 sm:space-x-6 min-w-0">
            <div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 block leading-none mb-0.5">Позиций:</span>
              <span className="text-sm sm:text-lg font-extrabold text-slate-900 whitespace-nowrap">
                {totalPcs} <span className="text-[10px] sm:text-xs text-slate-500 font-normal">шт</span>
              </span>
            </div>

            <div className="h-6 sm:h-8 w-px bg-slate-200 flex-shrink-0" />

            <div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 block leading-none mb-0.5">Сумма:</span>
              <span className="text-sm sm:text-xl font-black text-indigo-700 whitespace-nowrap">
                {totalSum.toLocaleString('ru-RU')} ₸
              </span>
            </div>

            {anomalyCount > 0 && (
              <div className="hidden lg:flex items-center space-x-1.5 bg-rose-100 border border-rose-300 text-rose-900 text-xs px-2.5 py-1 rounded-lg font-bold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                <span>{anomalyCount} аномалий</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
            <button
              id="btn-preview-order"
              onClick={onOpenPreview}
              className="flex items-center justify-center space-x-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs uppercase font-bold tracking-wider transition-all shadow-sm"
              title="Предпросмотр заявки"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Предпросмотр</span>
            </button>

            <button
              id="btn-submit-order"
              onClick={handleSubmitOrder}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-1.5 sm:px-6 sm:py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Отправить</span>
            </button>
          </div>
        </div>
      </div>
      )}

    </div>
  );
};
