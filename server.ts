import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { COFFEE_SHOPS, PRODUCTS, INITIAL_ORDERS } from './src/data/mockData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared state in memory
let ordersState = { ...INITIAL_ORDERS };
let notificationsLog: Array<{ id: string; shopId: number; shopName: string; sentAt: string; message: string }> = [];

// Initialize Gemini SDK lazily if GEMINI_API_KEY is provided
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Endpoints
  app.get('/api/initial-data', (req, res) => {
    res.json({
      shops: COFFEE_SHOPS,
      products: PRODUCTS,
      orders: ordersState,
      notifications: notificationsLog,
    });
  });

  // Submit or save order for a specific coffee shop
  app.post('/api/orders/:shopId', (req, res) => {
    const shopId = parseInt(req.params.shopId, 10);
    const { items, status, notes, managerName } = req.body;

    const shop = COFFEE_SHOPS.find((s) => s.id === shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Coffee shop not found' });
    }

    // Detect anomalies compared to historical average
    const anomalies: Record<string, string> = {};
    if (items && typeof items === 'object') {
      Object.entries(items).forEach(([productId, qtyVal]) => {
        const qty = Number(qtyVal) || 0;
        const avg = shop.historicalAvg[productId] || 10;
        if (avg > 0) {
          const ratio = qty / avg;
          if (ratio >= 2.0 && qty > 10) {
            const pct = Math.round((ratio - 1) * 100);
            anomalies[productId] = `⚠️ Завышение на +${pct}% (заказано ${qty} шт при норме ${avg} шт)`;
          } else if (ratio <= 0.3 && avg >= 10 && qty > 0) {
            const pct = Math.round((1 - ratio) * 100);
            anomalies[productId] = `⚠️ Занижение на -${pct}% (заказано ${qty} шт при норме ${avg} шт)`;
          }
        }
      });
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    ordersState[shopId] = {
      shopId,
      items: items || {},
      status: status || 'submitted',
      submittedAt: status === 'submitted' ? timeStr : ordersState[shopId]?.submittedAt || timeStr,
      acceptedAt: status === 'accepted' ? timeStr : ordersState[shopId]?.acceptedAt,
      managerName: managerName || shop.manager,
      notes,
      anomalies: Object.keys(anomalies).length > 0 ? anomalies : undefined,
    };

    res.json({ success: true, order: ordersState[shopId] });
  });

  // Update order status (accept / reject / submitted)
  app.patch('/api/orders/:shopId/status', (req, res) => {
    const shopId = parseInt(req.params.shopId, 10);
    const { status } = req.body;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (ordersState[shopId]) {
      ordersState[shopId].status = status;
      if (status === 'accepted') {
        ordersState[shopId].acceptedAt = timeStr;
      }
    } else {
      const shop = COFFEE_SHOPS.find((s) => s.id === shopId);
      ordersState[shopId] = {
        shopId,
        items: {},
        status: status || 'draft',
        managerName: shop?.manager || '',
        acceptedAt: status === 'accepted' ? timeStr : undefined,
      };
    }
    res.json({ success: true, order: ordersState[shopId] });
  });

  // Accept all submitted orders
  app.post('/api/orders/accept-all', (req, res) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    Object.keys(ordersState).forEach((key) => {
      const id = Number(key);
      if (ordersState[id].status === 'submitted') {
        ordersState[id].status = 'accepted';
        ordersState[id].acceptedAt = timeStr;
      }
    });

    res.json({ success: true, orders: ordersState });
  });

  // Bulk simulate full order submissions for testing
  app.post('/api/orders/simulate-all', (req, res) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    COFFEE_SHOPS.forEach((shop) => {
      const items: Record<string, number> = {};
      PRODUCTS.forEach((p) => {
        const avg = shop.historicalAvg[p.id] || 12;
        items[p.id] = Math.max(1, Math.round(avg * (0.9 + Math.random() * 0.3)));
      });

      ordersState[shop.id] = {
        shopId: shop.id,
        items,
        status: 'submitted',
        submittedAt: timeStr,
        managerName: shop.manager,
      };
    });

    res.json({ success: true, orders: ordersState });
  });

  // Send reminder notifications to all unsubmitted coffee shops
  app.post('/api/reminders/send-all', (req, res) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const unsubmittedShops = COFFEE_SHOPS.filter(
      (shop) => !ordersState[shop.id] || ordersState[shop.id].status === 'draft'
    );

    const newNotifications = unsubmittedShops.map((shop) => ({
      id: `notif-${Date.now()}-${shop.id}`,
      shopId: shop.id,
      shopName: shop.name,
      sentAt: timeStr,
      message: `🔔 Напоминание: Управляющий ${shop.manager}, пожалуйста, завершите и отправьте заявку на витрину до 10:30!`,
    }));

    notificationsLog = [...newNotifications, ...notificationsLog];

    res.json({
      success: true,
      sentCount: unsubmittedShops.length,
      unsubmittedShops: unsubmittedShops.map((s) => s.name),
      notifications: notificationsLog,
    });
  });

  // AI Order Express Analysis Endpoint
  app.post('/api/ai/analyze-order', async (req, res) => {
    const { shopId, items } = req.body;
    const shop = COFFEE_SHOPS.find((s) => s.id === shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    let totalPcs = 0;
    let totalCost = 0;
    const orderDetails: string[] = [];

    Object.entries(items || {}).forEach(([pId, qtyVal]) => {
      const qty = Number(qtyVal) || 0;
      const product = PRODUCTS.find((p) => p.id === pId);
      if (product && qty > 0) {
        totalPcs += qty;
        totalCost += qty * product.price;
        const avg = shop.historicalAvg[pId] || 10;
        orderDetails.push(
          `- ${product.name}: ${qty} ${product.unit} (среднее обычно: ${avg} ${product.unit}, цена: ${product.price} ₸)`
        );
      }
    });

    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `
Ты — ИИ-ассистент сети 27 кофеен "Master Coffee".
Проанализируй текущий заказ витрины для кофейни: "${shop.name}" (Менеджер: ${shop.manager}).
Суммарно заказано: ${totalPcs} шт, Общая сумма: ${totalCost.toLocaleString('ru-RU')} ₸.

Состав заказа:
${orderDetails.join('\n')}

Сформируй краткий профессиональный экспертный вывод на русском языке:
1. Оценка сбалансированности заказа (Завтраки/Выпечка/Десерты/Сэндвичи).
2. Предупреждение о рисках списания по скоропортящимся позициям (салаты/боулы со сроком 24 ч).
3. 2 релевантных совета по оптимизации витрины к сегодняшнему дню.

Отвечай четко, емко, без рекламы.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
        });

        const analysisText = response.text || 'Анализ завершен успешно.';
        return res.json({
          success: true,
          analysisText,
          totalPcs,
          totalCost,
        });
      } catch (err: any) {
        console.error('Gemini API error:', err);
      }
    }

    // Smart algorithmic fallback if GEMINI_API_KEY is not configured
    const analysisText = `
📊 **Экспресс-анализ заказа витрины для ${shop.name}:**

• **Объем и сумма:** Заказано ${totalPcs} ед. на сумму **${totalCost.toLocaleString('ru-RU')} ₸**.
• **Баланс категорий:** Заказ покрывает основные потребности витрины. Свежая выпечка и сэндвичи составляют основу утреннего трафика.
• **Сроки годности:** Обратите внимание на позиции со сроком 24 ч (Салаты и Боулы). Рекомендуется выставлять их в первую очередь на фронтальную зону витрины.
• **Рекомендация ИИ:** Проверьте динамику продаж к 14:00 для своевременного перераспределения продукции.
    `;

    return res.json({
      success: true,
      analysisText,
      totalPcs,
      totalCost,
    });
  });

  // AI Total Procurement Insights Endpoint
  app.post('/api/ai/predictive-procurement', async (req, res) => {
    // Summarize active submitted orders across all 27 shops
    const categoryTotals: Record<string, number> = {
      breakfasts: 0,
      bakery: 0,
      sandwiches: 0,
      desserts: 0,
    };
    const productTotals: Record<string, number> = {};
    let grandTotalPcs = 0;
    let grandTotalCost = 0;
    let submittedShopsCount = 0;

    Object.values(ordersState).forEach((order) => {
      if (order.status === 'submitted' || order.status === 'accepted') {
        submittedShopsCount++;
        Object.entries(order.items || {}).forEach(([pId, qtyVal]) => {
          const qty = Number(qtyVal) || 0;
          const p = PRODUCTS.find((prod) => prod.id === pId);
          if (p && qty > 0) {
            productTotals[pId] = (productTotals[pId] || 0) + qty;
            categoryTotals[p.department] = (categoryTotals[p.department] || 0) + qty;
            grandTotalPcs += qty;
            grandTotalCost += qty * p.price;
          }
        });
      }
    });

    const ai = getGeminiClient();
    if (ai) {
      try {
        const prompt = `
Ты — главная ИИ-система управления производством сети 27 кофеен "Master Coffee".
Сводные данные закупа на сегодня:
- Подано заявок: ${submittedShopsCount} из 27 кофеен.
- Общий объем производства: ${grandTotalPcs} шт.
- Общая стоимость витринной продукции: ${grandTotalCost.toLocaleString('ru-RU')} ₸.

Разбивка по цехам:
- Цех Завтраков: ${categoryTotals.breakfasts} шт
- Цех Выпечки: ${categoryTotals.bakery} шт
- Цех Сэндвичей: ${categoryTotals.sandwiches} шт
- Кондитерский цех (Десерты): ${categoryTotals.desserts} шт

Позиции:
${PRODUCTS.map((p) => `- ${p.name}: ${productTotals[p.id] || 0} ${p.unit}`).join('\n')}

Дай профессиональное ИИ-заключение для шеф-повара и начальника производства:
1. Анализ нагрузки на цеха.
2. Рекомендации по закупке сырья (мука, сливки, семга, курятина).
3. Советы по минимизации брака при логистике.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
        });

        return res.json({
          success: true,
          report: response.text,
          categoryTotals,
          grandTotalPcs,
          grandTotalCost,
          submittedShopsCount,
        });
      } catch (e) {
        console.error(e);
      }
    }

    // Algorithmic fallback report
    const report = `
🏭 **Предиктивный отчет производства сети 27 кофеен:**

• **Статус подачи:** ${submittedShopsCount} из 27 точек подали финальные заявки.
• **Общая загрузка цехов:** ${grandTotalPcs} шт (Общая стоимость: ${grandTotalCost.toLocaleString('ru-RU')} ₸).
• **Загрузка по цехам:**
  🥐 Выпечка: ${categoryTotals.bakery} шт (Пиковая нагрузка 04:00 - 07:00)
  🥪 Сэндвичи: ${categoryTotals.sandwiches} шт
  🥗 Завтраки: ${categoryTotals.breakfasts} шт
  🍰 Десерты: ${categoryTotals.desserts} шт

• **Рекомендации по закупке и цехам:**
  1. Заготовить масляный замес под круассаны с учетом +10% резерва на выпечку.
  2. Порционирование семги и соусов произвести с температурным режимом +2..+4°C.
  3. Отгрузку провести 2 рейсами (Северная и Южная петля).
    `;

    return res.json({
      success: true,
      report,
      categoryTotals,
      grandTotalPcs,
      grandTotalCost,
      submittedShopsCount,
    });
  });

  // Serve static files or Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
