// All /api/* routes, shared between local dev (server.ts) and the Vercel
// serverless function (api/index.ts). Contains no static file serving or
// app.listen() — those differ between the two environments.
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabaseServer.js';
import {
  shopFromDb,
  shopToDb,
  productFromDb,
  productToDb,
  orderFromDb,
  orderToDb,
  orderHistoryFromDb,
  notificationFromDb,
  notificationToDb,
  rawMaterialFromDb,
  rawMaterialToDb,
  semiFinishedFromDb,
  semiFinishedToDb,
  dishCostingFromDb,
  dishCostingToDb,
  staffFromDb,
  staffToDb,
  registrationRequestFromDb,
  registrationRequestToDb,
} from '../lib/dbMappers.js';
import { verifyTelegramInitData } from '../lib/telegramAuth.js';
import { sendTelegramMessage } from '../lib/telegramNotify.js';

function timeNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// Fallback when a role has no row yet in `role_permissions` — matches the app's fixed
// behavior before this feature existed, so adding the table is not a behavior change.
const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    accept_reject_orders: true,
    send_reminders: true,
    manage_checklists: true,
    manage_costings: true,
    manage_personnel: true,
    manage_sales_points: true,
  },
  territorial: {
    accept_reject_orders: false,
    send_reminders: false,
    manage_checklists: false,
    manage_costings: false,
    manage_personnel: false,
    manage_sales_points: false,
  },
};

function buildRolePermissions(rows: any[]) {
  const result = {
    admin: { ...DEFAULT_ROLE_PERMISSIONS.admin },
    territorial: { ...DEFAULT_ROLE_PERMISSIONS.territorial },
  };
  (rows || []).forEach((row) => {
    if (row.role === 'admin' || row.role === 'territorial') {
      result[row.role] = { ...DEFAULT_ROLE_PERMISSIONS[row.role], ...(row.permissions || {}) };
    }
  });
  return result;
}

// Verifies the caller is really the Owner via a signed Telegram initData string —
// never trust a client-sent "I am the owner" flag for a sensitive write like this.
function requireOwner(initData: string): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const ownerId = process.env.OWNER_TELEGRAM_ID;
  if (!botToken || !ownerId) return false;
  const { valid, userId } = verifyTelegramInitData(initData, botToken);
  return valid && userId != null && String(userId) === String(ownerId);
}

const REGISTRATION_ROLE_LABELS: Record<string, string> = {
  shop_manager: 'Менеджер точки',
  territorial_manager: 'Территориальный управляющий',
  employee: 'Внутренний сотрудник',
};

// Pings the Owner (and, once assigned, any production managers listed in
// ADMIN_NOTIFY_TELEGRAM_IDS) the moment a new registration request comes in, so approval
// doesn't have to wait for someone to happen to open the "Персонал" tab.
async function notifyNewRegistrationRequests(requests: any[]) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const recipientIds = new Set<string>();
  if (process.env.OWNER_TELEGRAM_ID) recipientIds.add(process.env.OWNER_TELEGRAM_ID);
  (process.env.ADMIN_NOTIFY_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .forEach((id) => recipientIds.add(id));
  if (recipientIds.size === 0) return;

  const webAppUrl = 'https://mc-bekary.vercel.app';

  for (const request of requests) {
    const points = request.requestedShopIds?.length
      ? request.requestedShopIds.map((id: number) => `№${id}`).join(', ')
      : `№${request.requestedShopId}`;
    const text =
      `🆕 <b>Новая заявка на регистрацию</b>\n\n` +
      `👤 ${request.name}\n` +
      `📞 ${request.phone || '—'}\n` +
      `💼 ${REGISTRATION_ROLE_LABELS[request.requestedRole] || request.requestedRole}\n` +
      `🏪 Точки: ${points}\n\n` +
      `Одобрить или отклонить — в разделе «Персонал» → «Заявки на регистрацию».`;

    for (const chatId of recipientIds) {
      await sendTelegramMessage(botToken, chatId, text, webAppUrl);
    }
  }
}

// Upserts the given rows into `table`, then deletes any existing row whose id is no
// longer present — the equivalent of "replace the whole table with this array", but
// without ever leaving the table transiently empty if something fails partway through.
async function replaceTable(table: string, idColumn: string, rows: Record<string, any>[]) {
  const newIds = rows.map((r) => r[idColumn]);
  if (rows.length > 0) {
    const { error } = await supabase.from(table).upsert(rows);
    if (error) throw error;
  }
  const { data: existing, error: selectError } = await supabase.from(table).select(idColumn);
  if (selectError) throw selectError;
  const idsToDelete = (existing || [])
    .map((r: any) => r[idColumn])
    .filter((id: any) => !newIds.includes(id));
  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in(idColumn, idsToDelete);
    if (deleteError) throw deleteError;
  }
}

// Initialize the Claude client lazily if ANTHROPIC_API_KEY is provided — both AI
// endpoints below fall back to an algorithmic report when it isn't, so this stays
// optional rather than throwing (unlike supabaseServer.ts, which is a hard requirement).
function getClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Anthropic({ apiKey });
}

export function createApiApp() {
  const app = express();
  // Default express.json() limit is 100kb — too small for a product photo saved as a
  // base64 data URL (see handleDishPhotoSelected in CostingsManager.tsx). Raised to 8mb;
  // the client also compresses photos before upload, so this is a safety margin, not the
  // primary defense (Vercel's own serverless request limit is a hard ~4.5mb regardless).
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/initial-data', async (req, res) => {
    try {
      const [
        shops,
        products,
        orders,
        notifications,
        rawMaterials,
        rawCategoryDefs,
        semiFinished,
        semiCategoryDefs,
        dishCostings,
        checklistAssignments,
        staff,
        registrationRequests,
        rolePermissions,
      ] = await Promise.all([
        supabase.from('shops').select('*'),
        supabase.from('products').select('*'),
        supabase.from('orders').select('*'),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('raw_materials').select('*'),
        supabase.from('raw_category_defs').select('*'),
        supabase.from('semi_finished').select('*'),
        supabase.from('semi_category_defs').select('*'),
        supabase.from('dish_costings').select('*'),
        supabase.from('checklist_assignments').select('*'),
        supabase.from('staff').select('*'),
        supabase.from('registration_requests').select('*'),
        supabase.from('role_permissions').select('*'),
      ]);

      for (const r of [
        shops, products, orders, notifications, rawMaterials, rawCategoryDefs,
        semiFinished, semiCategoryDefs, dishCostings, checklistAssignments, staff, registrationRequests,
        rolePermissions,
      ]) {
        if (r.error) throw r.error;
      }

      const ordersRecord: Record<number, any> = {};
      (orders.data || []).forEach((r) => {
        const o = orderFromDb(r);
        ordersRecord[o.shopId] = o;
      });

      const dishCostingsRecord: Record<string, any> = {};
      (dishCostings.data || []).forEach((r) => {
        const c = dishCostingFromDb(r);
        dishCostingsRecord[c.productId] = c;
      });

      const checklistAssignmentsRecord: Record<string, string[]> = {};
      (checklistAssignments.data || []).forEach((r: any) => {
        checklistAssignmentsRecord[r.department_key] = r.product_ids || [];
      });

      res.json({
        shops: (shops.data || []).map(shopFromDb),
        products: (products.data || []).map(productFromDb),
        orders: ordersRecord,
        notifications: (notifications.data || []).map(notificationFromDb),
        rawMaterials: (rawMaterials.data || []).map(rawMaterialFromDb),
        rawCategoryDefs: (rawCategoryDefs.data || []).map((r: any) => ({ key: r.key, label: r.label })),
        semiFinishedList: (semiFinished.data || []).map(semiFinishedFromDb),
        semiCategoryDefs: (semiCategoryDefs.data || []).map((r: any) => ({ key: r.key, label: r.label })),
        dishCostings: dishCostingsRecord,
        checklistAssignments: checklistAssignmentsRecord,
        staff: (staff.data || []).map(staffFromDb),
        registrationRequests: (registrationRequests.data || []).map(registrationRequestFromDb),
        rolePermissions: buildRolePermissions(rolePermissions.data || []),
      });
    } catch (e) {
      console.error('Failed to load initial data:', e);
      res.status(500).json({ error: 'Failed to load initial data' });
    }
  });

  // Read the current permission matrix (defaults fill in for roles with no saved row)
  app.get('/api/role-permissions', async (req, res) => {
    try {
      const { data, error } = await supabase.from('role_permissions').select('*');
      if (error) throw error;
      res.json({ rolePermissions: buildRolePermissions(data || []) });
    } catch (e) {
      console.error('Failed to load role permissions:', e);
      res.status(500).json({ error: 'Failed to load role permissions' });
    }
  });

  // Owner-only: change what each role is allowed to do. Re-verifies the Telegram
  // identity server-side rather than trusting a client-sent "I am the owner" flag.
  app.post('/api/role-permissions', async (req, res) => {
    try {
      const { initData, permissions } = req.body;
      if (!requireOwner(initData)) {
        return res.status(403).json({ error: 'Only the Owner can change role permissions' });
      }
      const rows = (['admin', 'territorial'] as const)
        .filter((role) => permissions && permissions[role])
        .map((role) => ({ role, permissions: permissions[role] }));
      if (rows.length > 0) {
        const { error } = await supabase.from('role_permissions').upsert(rows);
        if (error) throw error;
      }
      const { data, error: readError } = await supabase.from('role_permissions').select('*');
      if (readError) throw readError;
      res.json({ success: true, rolePermissions: buildRolePermissions(data || []) });
    } catch (e) {
      console.error('Failed to update role permissions:', e);
      res.status(500).json({ error: 'Failed to update role permissions' });
    }
  });

  // Tells the client whether the Telegram user who opened the Mini App is the Owner —
  // verified server-side against a signed initData string, never the client's own claim.
  app.post('/api/auth/telegram-owner', (req, res) => {
    try {
      const { initData } = req.body;
      res.json({ isOwner: requireOwner(initData) });
    } catch (e) {
      console.error('Failed to verify Telegram owner:', e);
      res.status(500).json({ isOwner: false });
    }
  });

  // Persist the raw materials catalog (add/edit/delete raw ingredients)
  app.post('/api/raw-materials', async (req, res) => {
    try {
      if (Array.isArray(req.body?.rawMaterials)) {
        await replaceTable('raw_materials', 'id', req.body.rawMaterials.map(rawMaterialToDb));
      }
      const { data, error } = await supabase.from('raw_materials').select('*');
      if (error) throw error;
      res.json({ success: true, rawMaterials: (data || []).map(rawMaterialFromDb) });
    } catch (e) {
      console.error('Failed to save raw materials:', e);
      res.status(500).json({ error: 'Failed to save raw materials' });
    }
  });

  // Persist custom raw material categories
  app.post('/api/raw-category-defs', async (req, res) => {
    try {
      if (Array.isArray(req.body?.rawCategoryDefs)) {
        await replaceTable('raw_category_defs', 'key', req.body.rawCategoryDefs);
      }
      const { data, error } = await supabase.from('raw_category_defs').select('*');
      if (error) throw error;
      res.json({ success: true, rawCategoryDefs: data || [] });
    } catch (e) {
      console.error('Failed to save raw category defs:', e);
      res.status(500).json({ error: 'Failed to save raw category defs' });
    }
  });

  // Persist the semi-finished category registry (lets the Owner/Admin add new categories,
  // not just filter by whatever categories happen to already be in use)
  app.post('/api/semi-category-defs', async (req, res) => {
    try {
      if (Array.isArray(req.body?.semiCategoryDefs)) {
        await replaceTable('semi_category_defs', 'key', req.body.semiCategoryDefs);
      }
      const { data, error } = await supabase.from('semi_category_defs').select('*');
      if (error) throw error;
      res.json({ success: true, semiCategoryDefs: data || [] });
    } catch (e) {
      console.error('Failed to save semi category defs:', e);
      res.status(500).json({ error: 'Failed to save semi category defs' });
    }
  });

  // Persist the semi-finished products catalog
  app.post('/api/semi-finished', async (req, res) => {
    try {
      if (Array.isArray(req.body?.semiFinishedList)) {
        await replaceTable('semi_finished', 'id', req.body.semiFinishedList.map(semiFinishedToDb));
      }
      const { data, error } = await supabase.from('semi_finished').select('*');
      if (error) throw error;
      res.json({ success: true, semiFinishedList: (data || []).map(semiFinishedFromDb) });
    } catch (e) {
      console.error('Failed to save semi-finished list:', e);
      res.status(500).json({ error: 'Failed to save semi-finished list' });
    }
  });

  // Persist dish costings (semi-finished + raw ingredients used per dish)
  app.post('/api/dish-costings', async (req, res) => {
    try {
      if (req.body?.dishCostings && typeof req.body.dishCostings === 'object') {
        const rows = Object.values(req.body.dishCostings).map(dishCostingToDb);
        await replaceTable('dish_costings', 'product_id', rows);
      }
      const { data, error } = await supabase.from('dish_costings').select('*');
      if (error) throw error;
      const record: Record<string, any> = {};
      (data || []).forEach((r) => {
        const c = dishCostingFromDb(r);
        record[c.productId] = c;
      });
      res.json({ success: true, dishCostings: record });
    } catch (e) {
      console.error('Failed to save dish costings:', e);
      res.status(500).json({ error: 'Failed to save dish costings' });
    }
  });

  // Persist which products are assigned to each production checklist
  app.post('/api/checklist-assignments', async (req, res) => {
    try {
      if (req.body?.checklistAssignments && typeof req.body.checklistAssignments === 'object') {
        const rows = Object.entries(req.body.checklistAssignments).map(([key, ids]) => ({
          department_key: key,
          product_ids: ids,
        }));
        await replaceTable('checklist_assignments', 'department_key', rows);
      }
      const { data, error } = await supabase.from('checklist_assignments').select('*');
      if (error) throw error;
      const record: Record<string, string[]> = {};
      (data || []).forEach((r: any) => {
        record[r.department_key] = r.product_ids || [];
      });
      res.json({ success: true, checklistAssignments: record });
    } catch (e) {
      console.error('Failed to save checklist assignments:', e);
      res.status(500).json({ error: 'Failed to save checklist assignments' });
    }
  });

  // Persist the coffee shop list (new points, address/manager edits, territorial manager assignment)
  app.post('/api/shops', async (req, res) => {
    try {
      if (Array.isArray(req.body?.shops)) {
        await replaceTable('shops', 'id', req.body.shops.map(shopToDb));
      }
      const { data, error } = await supabase.from('shops').select('*');
      if (error) throw error;
      res.json({ success: true, shops: (data || []).map(shopFromDb) });
    } catch (e) {
      console.error('Failed to save shops:', e);
      res.status(500).json({ error: 'Failed to save shops' });
    }
  });

  // Persist the product/menu catalog (photo, category, price edits)
  app.post('/api/products', async (req, res) => {
    try {
      if (Array.isArray(req.body?.products)) {
        await replaceTable('products', 'id', req.body.products.map(productToDb));
      }
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      res.json({ success: true, products: (data || []).map(productFromDb) });
    } catch (e) {
      console.error('Failed to save products:', e);
      res.status(500).json({ error: 'Failed to save products' });
    }
  });

  // Persist the staff roster
  app.post('/api/staff', async (req, res) => {
    try {
      if (Array.isArray(req.body?.staff)) {
        await replaceTable('staff', 'id', req.body.staff.map(staffToDb));
      }
      const { data, error } = await supabase.from('staff').select('*');
      if (error) throw error;
      res.json({ success: true, staff: (data || []).map(staffFromDb) });
    } catch (e) {
      console.error('Failed to save staff:', e);
      res.status(500).json({ error: 'Failed to save staff' });
    }
  });

  // Persist pending registration requests
  app.post('/api/registration-requests', async (req, res) => {
    try {
      const incoming = Array.isArray(req.body?.registrationRequests) ? req.body.registrationRequests : null;
      if (incoming) {
        const { data: existingRows } = await supabase.from('registration_requests').select('id');
        const existingIds = new Set((existingRows || []).map((r) => r.id));
        const newlyAdded = incoming.filter((r) => !existingIds.has(r.id));

        await replaceTable('registration_requests', 'id', incoming.map(registrationRequestToDb));

        if (newlyAdded.length > 0) {
          notifyNewRegistrationRequests(newlyAdded).catch((e) =>
            console.error('Failed to send registration notifications:', e)
          );
        }
      }
      const { data, error } = await supabase.from('registration_requests').select('*');
      if (error) throw error;
      res.json({ success: true, registrationRequests: (data || []).map(registrationRequestFromDb) });
    } catch (e) {
      console.error('Failed to save registration requests:', e);
      res.status(500).json({ error: 'Failed to save registration requests' });
    }
  });

  // Accept all submitted orders
  app.post('/api/orders/accept-all', async (req, res) => {
    try {
      const timeStr = timeNow();
      const { error } = await supabase
        .from('orders')
        .update({ status: 'accepted', accepted_at: timeStr })
        .eq('status', 'submitted');
      if (error) throw error;

      const { data, error: selectError } = await supabase.from('orders').select('*');
      if (selectError) throw selectError;
      const ordersRecord: Record<number, any> = {};
      (data || []).forEach((r) => {
        const o = orderFromDb(r);
        ordersRecord[o.shopId] = o;
      });

      res.json({ success: true, orders: ordersRecord });
    } catch (e) {
      console.error('Failed to accept all orders:', e);
      res.status(500).json({ error: 'Failed to accept all orders' });
    }
  });

  // Bulk simulate full order submissions for testing
  app.post('/api/orders/simulate-all', async (req, res) => {
    try {
      const timeStr = timeNow();
      const [{ data: shopRows, error: shopsError }, { data: productRows, error: productsError }] = await Promise.all([
        supabase.from('shops').select('*'),
        supabase.from('products').select('*'),
      ]);
      if (shopsError) throw shopsError;
      if (productsError) throw productsError;

      const shops = (shopRows || []).map(shopFromDb);
      const products = (productRows || []).map(productFromDb);

      const newOrders = shops.map((shop) => {
        const items: Record<string, number> = {};
        products.forEach((p) => {
          const avg = shop.historicalAvg[p.id] || 12;
          items[p.id] = Math.max(1, Math.round(avg * (0.9 + Math.random() * 0.3)));
        });
        return {
          shopId: shop.id,
          items,
          status: 'submitted',
          submittedAt: timeStr,
          managerName: shop.manager,
        };
      });

      const { error: upsertError } = await supabase.from('orders').upsert(newOrders.map(orderToDb));
      if (upsertError) throw upsertError;

      const ordersRecord: Record<number, any> = {};
      newOrders.forEach((o) => {
        ordersRecord[o.shopId] = o;
      });

      res.json({ success: true, orders: ordersRecord });
    } catch (e) {
      console.error('Failed to simulate orders:', e);
      res.status(500).json({ error: 'Failed to simulate orders' });
    }
  });

  // Submit or save order for a specific coffee shop
  app.post('/api/orders/:shopId', async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { items, status, notes, managerName } = req.body;

      const { data: shopRow, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();
      if (shopError || !shopRow) {
        return res.status(404).json({ error: 'Coffee shop not found' });
      }
      const shop = shopFromDb(shopRow);

      const { data: existingOrderRow } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();
      const existingOrder = existingOrderRow ? orderFromDb(existingOrderRow) : null;

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

      const timeStr = timeNow();
      const order = {
        shopId,
        items: items || {},
        status: status || 'submitted',
        submittedAt: status === 'submitted' ? timeStr : existingOrder?.submittedAt || timeStr,
        acceptedAt: status === 'accepted' ? timeStr : existingOrder?.acceptedAt,
        managerName: managerName || shop.manager,
        notes,
        anomalies: Object.keys(anomalies).length > 0 ? anomalies : undefined,
      };

      const { error: upsertError } = await supabase.from('orders').upsert(orderToDb(order));
      if (upsertError) throw upsertError;

      // Log every actual submission (not draft saves) to the append-only history table
      if (status === 'submitted') {
        await supabase.from('order_history').insert({
          shop_id: shopId,
          items: order.items,
          manager_name: order.managerName,
        });
      }

      res.json({ success: true, order });
    } catch (e) {
      console.error('Failed to save order:', e);
      res.status(500).json({ error: 'Failed to save order' });
    }
  });

  // Past submitted orders for one shop, newest first — powers the manager's order history view
  app.get('/api/orders/:shopId/history', async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('shop_id', shopId)
        .order('submitted_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      res.json({ history: (data || []).map(orderHistoryFromDb) });
    } catch (e) {
      console.error('Failed to fetch order history:', e);
      res.status(500).json({ error: 'Failed to fetch order history' });
    }
  });

  // Update order status (accept / reject / submitted)
  app.patch('/api/orders/:shopId/status', async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { status } = req.body;
      const timeStr = timeNow();

      const { data: existingOrderRow } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .maybeSingle();

      let order: any;
      if (existingOrderRow) {
        order = orderFromDb(existingOrderRow);
        order.status = status;
        if (status === 'accepted') order.acceptedAt = timeStr;
      } else {
        const { data: shopRow } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle();
        const shop = shopRow ? shopFromDb(shopRow) : null;
        order = {
          shopId,
          items: {},
          status: status || 'draft',
          managerName: shop?.manager || '',
          acceptedAt: status === 'accepted' ? timeStr : undefined,
        };
      }

      const { error } = await supabase.from('orders').upsert(orderToDb(order));
      if (error) throw error;

      res.json({ success: true, order });
    } catch (e) {
      console.error('Failed to update order status:', e);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // Send reminder notifications to all unsubmitted coffee shops
  app.post('/api/reminders/send-all', async (req, res) => {
    try {
      const timeStr = timeNow();
      const [{ data: shopRows, error: shopsError }, { data: orderRows, error: ordersError }] = await Promise.all([
        supabase.from('shops').select('*'),
        supabase.from('orders').select('*'),
      ]);
      if (shopsError) throw shopsError;
      if (ordersError) throw ordersError;

      const shops = (shopRows || []).map(shopFromDb);
      const ordersByShop: Record<number, any> = {};
      (orderRows || []).forEach((r) => {
        const o = orderFromDb(r);
        ordersByShop[o.shopId] = o;
      });

      const unsubmittedShops = shops.filter(
        (shop) => !ordersByShop[shop.id] || ordersByShop[shop.id].status === 'draft'
      );

      const newNotifications = unsubmittedShops.map((shop) => ({
        id: `notif-${Date.now()}-${shop.id}`,
        shopId: shop.id,
        shopName: shop.name,
        sentAt: timeStr,
        message: `🔔 Напоминание: Управляющий ${shop.manager}, пожалуйста, завершите и отправьте заявку на витрину до 10:30!`,
      }));

      if (newNotifications.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(newNotifications.map(notificationToDb));
        if (insertError) throw insertError;
      }

      const { data: allNotifications, error: selectError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (selectError) throw selectError;

      res.json({
        success: true,
        sentCount: unsubmittedShops.length,
        unsubmittedShops: unsubmittedShops.map((s) => s.name),
        notifications: (allNotifications || []).map(notificationFromDb),
      });
    } catch (e) {
      console.error('Failed to send reminders:', e);
      res.status(500).json({ error: 'Failed to send reminders' });
    }
  });

  // AI Order Express Analysis Endpoint
  app.post('/api/ai/analyze-order', async (req, res) => {
    try {
      const { shopId, items } = req.body;
      const { data: shopRow, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shopRow) {
        return res.status(404).json({ error: 'Shop not found' });
      }
      const shop = shopFromDb(shopRow);

      const { data: productRows, error: productsError } = await supabase.from('products').select('*');
      if (productsError) throw productsError;
      const products = (productRows || []).map(productFromDb);

      let totalPcs = 0;
      let totalCost = 0;
      const orderDetails: string[] = [];

      Object.entries(items || {}).forEach(([pId, qtyVal]) => {
        const qty = Number(qtyVal) || 0;
        const product = products.find((p) => p.id === pId);
        if (product && qty > 0) {
          totalPcs += qty;
          totalCost += qty * product.price;
          const avg = shop.historicalAvg[pId] || 10;
          orderDetails.push(
            `- ${product.name}: ${qty} ${product.unit} (среднее обычно: ${avg} ${product.unit}, цена: ${product.price} ₸)`
          );
        }
      });

      const ai = getClaudeClient();
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

          const response = await ai.messages.create({
            model: 'claude-opus-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          });
          const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');

          const analysisText = textBlock?.text || 'Анализ завершен успешно.';
          return res.json({ success: true, analysisText, totalPcs, totalCost });
        } catch (err: any) {
          console.error('Claude API error:', err);
        }
      }

      // Smart algorithmic fallback if ANTHROPIC_API_KEY is not configured
      const analysisText = `
📊 **Экспресс-анализ заказа витрины для ${shop.name}:**

• **Объем и сумма:** Заказано ${totalPcs} ед. на сумму **${totalCost.toLocaleString('ru-RU')} ₸**.
• **Баланс категорий:** Заказ покрывает основные потребности витрины. Свежая выпечка и сэндвичи составляют основу утреннего трафика.
• **Сроки годности:** Обратите внимание на позиции со сроком 24 ч (Салаты и Боулы). Рекомендуется выставлять их в первую очередь на фронтальную зону витрины.
• **Рекомендация ИИ:** Проверьте динамику продаж к 14:00 для своевременного перераспределения продукции.
      `;

      return res.json({ success: true, analysisText, totalPcs, totalCost });
    } catch (e) {
      console.error('Failed to analyze order:', e);
      res.status(500).json({ error: 'Failed to analyze order' });
    }
  });

  // AI Total Procurement Insights Endpoint
  app.post('/api/ai/predictive-procurement', async (req, res) => {
    try {
      const [{ data: orderRows, error: ordersError }, { data: productRows, error: productsError }] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('products').select('*'),
      ]);
      if (ordersError) throw ordersError;
      if (productsError) throw productsError;

      const products = (productRows || []).map(productFromDb);
      const orders = (orderRows || []).map(orderFromDb);

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

      orders.forEach((order) => {
        if (order.status === 'submitted' || order.status === 'accepted') {
          submittedShopsCount++;
          Object.entries(order.items || {}).forEach(([pId, qtyVal]) => {
            const qty = Number(qtyVal) || 0;
            const p = products.find((prod) => prod.id === pId);
            if (p && qty > 0) {
              productTotals[pId] = (productTotals[pId] || 0) + qty;
              categoryTotals[p.department] = (categoryTotals[p.department] || 0) + qty;
              grandTotalPcs += qty;
              grandTotalCost += qty * p.price;
            }
          });
        }
      });

      const ai = getClaudeClient();
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
${products.map((p) => `- ${p.name}: ${productTotals[p.id] || 0} ${p.unit}`).join('\n')}

Дай профессиональное ИИ-заключение для шеф-повара и начальника производства:
1. Анализ нагрузки на цеха.
2. Рекомендации по закупке сырья (мука, сливки, семга, курятина).
3. Советы по минимизации брака при логистике.
          `;

          const response = await ai.messages.create({
            model: 'claude-opus-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          });
          const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');

          return res.json({
            success: true,
            report: textBlock?.text,
            categoryTotals,
            grandTotalPcs,
            grandTotalCost,
            submittedShopsCount,
          });
        } catch (e) {
          console.error('Claude API error:', e);
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
    } catch (e) {
      console.error('Failed to build procurement report:', e);
      res.status(500).json({ error: 'Failed to build procurement report' });
    }
  });

  return app;
}
