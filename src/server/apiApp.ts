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
  shiftFromDb,
  advanceRequestFromDb,
  advanceRequestToDb,
  dishPollFromDb,
  dishPollToDb,
  dishPollVoteFromDb,
  dishPollVoteToDb,
} from '../lib/dbMappers.js';
import { verifyTelegramInitData } from '../lib/telegramAuth.js';
import { sendTelegramMessage } from '../lib/telegramNotify.js';

// All 27 shops are in Kazakhstan (UTC+5, unified nationwide since 2024). Using
// Date#getHours()/getMinutes() here would report the server runtime's own timezone (UTC on
// Vercel) instead — every submitted_at/accepted_at would silently be off by several hours from
// the real Kazakhstan wall-clock time an order was actually placed at.
function timeNow() {
  return new Date().toLocaleTimeString('ru-RU', {
    timeZone: 'Asia/Almaty',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Today's Kazakhstan calendar day as YYYY-MM-DD. The whole app's "day" is this, not the
// server's — an order placed at 23:30 in Astana belongs to that day, not to whatever day it
// already is in UTC.
function almatyToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
}

// UTC instant bounds [start, end) of one Kazakhstan calendar day, for querying a timestamptz
// column by "which Almaty-local day did this fall on". Almaty is a fixed UTC+5 with no DST
// (nationwide since 2024), so a literal offset is exact — no timezone-table lookup needed.
function almatyDayRangeUtc(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00+05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
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
// Everyone who supervises the network: the Owner plus any production managers listed in
// ADMIN_NOTIFY_TELEGRAM_IDS (comma-separated Telegram ids).
function supervisorRecipientIds(): Set<string> {
  const ids = new Set<string>();
  if (process.env.OWNER_TELEGRAM_ID) ids.add(process.env.OWNER_TELEGRAM_ID);
  (process.env.ADMIN_NOTIFY_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .forEach((id) => ids.add(id));
  return ids;
}

// Everyone with a stake in one point: its own staff (a point can have several managers and a
// barista who all need to know an order went in, whoever actually pressed the button) and the
// territorial manager whose patch it is. Telegram ids are whatever we captured at registration
// — anyone without one simply isn't reachable yet and is skipped.
async function shopAudienceIds(shopId: number): Promise<Set<string>> {
  const ids = new Set<string>();
  const { data, error } = await supabase.from('staff').select('*');
  if (error) {
    console.error('Failed to load staff for notifications:', error);
    return ids;
  }
  for (const row of data || []) {
    const member = staffFromDb(row);
    if (!member.telegramUserId) continue;
    const worksHere = member.shopId === shopId;
    const overseesHere = Array.isArray(member.assignedShopIds) && member.assignedShopIds.includes(shopId);
    if (worksHere || overseesHere) ids.add(String(member.telegramUserId));
  }
  return ids;
}

// Send one message per Telegram id, whatever combination of roles put them on the list.
function makeSender(botToken: string, webAppUrl: string) {
  const sent = new Set<string>();
  return async (chatId: string | undefined | null, text: string) => {
    const id = chatId ? String(chatId) : '';
    if (!id || sent.has(id)) return;
    sent.add(id);
    await sendTelegramMessage(botToken, id, text, webAppUrl).catch((e) =>
      console.error(`Failed to notify ${id}:`, e)
    );
  };
}

const WEB_APP_URL = 'https://mc-bekary.vercel.app';

// Имя бота для ссылок на голосование за блюда (t.me/<бот>?startapp=vote_<id>).
const DISH_POLL_BOT_USERNAME = 'Master_Bekarybot';

// A point's order has just gone in. Nobody was told about this before — supervision had to
// open the app and look, and the point's other staff had no way to know it was already done.
async function notifyOrderSubmitted(shopId: number, order: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const { data: shopRow } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle();
  const shop = shopRow ? shopFromDb(shopRow) : null;
  const shopLabel = shop ? (shop.district || '').trim() || shop.address || `Точка №${shopId}` : `Точка №${shopId}`;
  const size = await orderSizeLabel(order);

  const send = makeSender(botToken, WEB_APP_URL);
  const supervisorText =
    `📥 <b>Заявка подана</b>\n\n🏪 ${shopLabel}\n👤 ${order.managerName || '—'}\n📦 ${size}\n\n` +
    `Принять или отклонить — в «Реестре заявок».`;
  const teamText =
    `📥 <b>Заявка вашей точки подана</b>\n\n🏪 ${shopLabel}\n👤 ${order.managerName || '—'}\n📦 ${size}\n\n` +
    `Ждём решения управляющего производством.`;

  // Supervision first — they're the ones who have to act on it.
  for (const chatId of supervisorRecipientIds()) await send(chatId, supervisorText);
  for (const chatId of await shopAudienceIds(shopId)) await send(chatId, teamText);
  // The submitter may not be registered staff yet (or opened the app outside Telegram).
  await send(order.submittedByTelegramId, teamText);
}

// Pieces and money for one order, so a message says something without opening the app.
async function orderSizeLabel(order: any) {
  const { data: productRows } = await supabase.from('products').select('id, price');
  const priceById = new Map<string, number>((productRows || []).map((r: any) => [r.id, Number(r.price) || 0]));
  let pcs = 0;
  let sum = 0;
  Object.entries(order.items || {}).forEach(([pid, q]) => {
    const qty = Number(q) || 0;
    if (qty > 0) {
      pcs += qty;
      sum += qty * (priceById.get(pid) || 0);
    }
  });
  return `${pcs} шт · ${sum.toLocaleString('ru-RU')} ₸`;
}

// Accept/reject push. The submitter gets it addressed to them ("ваша заявка"); the Owner and
// the production managers get the same decision phrased as network news, with the point named
// and the order's size, so it reads on its own without opening the app. Sent to each Telegram
// id once even when the same person is both submitter and supervisor.
async function notifyOrderDecision(shopId: number, status: 'accepted' | 'rejected', order: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const { data: shopRow } = await supabase.from('shops').select('*').eq('id', shopId).maybeSingle();
  const shop = shopRow ? shopFromDb(shopRow) : null;
  const shopLabel = shop ? (shop.district || '').trim() || shop.address || `Точка №${shopId}` : `Точка №${shopId}`;
  const size = await orderSizeLabel(order);

  const send = makeSender(botToken, WEB_APP_URL);

  // What the point actually sent, versus what is being accepted. If someone edited the order
  // in between, the point has to hear it — otherwise they expect one delivery and get another.
  let changeNote = '';
  if (status === 'accepted') {
    const { data: lastSubmission } = await supabase
      .from('order_history')
      .select('items')
      .eq('shop_id', shopId)
      .order('submitted_at', { ascending: false })
      .limit(1);
    const submittedItems = lastSubmission?.[0]?.items || null;
    if (submittedItems) {
      const { data: productRows } = await supabase.from('products').select('id, name');
      const nameById = new Map<string, string>((productRows || []).map((r: any) => [r.id, r.name]));
      const changes = describeOrderChanges(submittedItems, order.items || {}, nameById);
      if (changes) {
        changeNote = `\n\n✏️ <b>Состав изменён перед приёмом:</b>\n${changes}`;
      }
    }
  }

  const submitterText =
    status === 'accepted'
      ? `✅ <b>Заявка принята</b>\n\nВаша заявка для точки «${shopLabel}» принята Управляющим Производством.\n${size}${changeNote}`
      : `❌ <b>Заявка отклонена</b>\n\nВаша заявка для точки «${shopLabel}» отклонена Управляющим Производством. Уточните детали у управляющего.\n${size}`;

  const teamText =
    status === 'accepted'
      ? `✅ <b>Заявка вашей точки принята</b>\n\n🏪 ${shopLabel}\n👤 ${order.managerName || '—'}\n📦 ${size}${changeNote}`
      : `❌ <b>Заявка вашей точки отклонена</b>\n\n🏪 ${shopLabel}\n👤 ${order.managerName || '—'}\n📦 ${size}\n\nУточните детали у управляющего.`;

  const supervisorText =
    status === 'accepted'
      ? `✅ <b>Заявка принята</b>\n\n🏪 ${shopLabel}\n👤 ${order.managerName || '—'}\n📦 ${size}`
      : `❌ <b>Заявка отклонена</b>\n\n🏪 ${shopLabel}\n👤 ${order.managerName || '—'}\n📦 ${size}`;

  // The person waiting on the answer first, so they're never held up by the rest of the list.
  await send(order.submittedByTelegramId, submitterText);
  // Then everyone else at that point and its territorial manager — an order is the point's,
  // not one person's, and the next shift needs to know it was decided.
  for (const chatId of await shopAudienceIds(shopId)) await send(chatId, teamText);
  for (const chatId of supervisorRecipientIds()) await send(chatId, supervisorText);
}

// When a point is expected to have ordered by. Shown in messages and mirrored by the cron
// schedule in vercel.json (which is in UTC — 10:30 Almaty is 05:30 UTC).
const ORDER_DEADLINE = '10:30';

// Who still hasn't ordered today, and telling the people who can do something about it.
// Shared by the manual "Напомнить отстающим" button and the automatic deadline run, so both
// behave identically — the button used to only write an in-app banner, which nobody sees
// unless they happen to open the app, which is exactly the case being chased here.
async function remindLaggingShops({ automatic }: { automatic: boolean }) {
  const [{ data: shopRows }, { data: orderRows }, { data: staffRows }] = await Promise.all([
    supabase.from('shops').select('*'),
    supabase.from('orders').select('*').eq('order_date', almatyToday()),
    supabase.from('staff').select('*'),
  ]);

  const shops = (shopRows || []).map(shopFromDb);
  const submittedShopIds = new Set(
    (orderRows || [])
      .map(orderFromDb)
      .filter((o: any) => o.status !== 'draft')
      .map((o: any) => o.shopId)
  );
  const lagging = shops.filter((s: any) => !submittedShopIds.has(s.id));
  const label = (s: any) => (s.district || '').trim() || s.address || `Точка №${s.id}`;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken && lagging.length > 0) {
    const send = makeSender(botToken, WEB_APP_URL);
    const staff = (staffRows || []).map(staffFromDb);
    const opener = automatic
      ? `⏰ <b>Дедлайн ${ORDER_DEADLINE} прошёл</b>`
      : `🔔 <b>Напоминание о заявке</b>`;

    // The points themselves — everyone who works there, since any of them can place it.
    for (const shop of lagging) {
      const text =
        `${opener}\n\n🏪 ${label(shop)}\n\nЗаявка на витрину ещё не подана. ` +
        `Откройте приложение и отправьте её.`;
      for (const member of staff) {
        if (member.telegramUserId && member.shopId === shop.id) {
          await send(String(member.telegramUserId), text);
        }
      }
    }

    // Each territorial manager gets only their own points — a list of somebody else's
    // shops is noise they can't act on.
    for (const member of staff) {
      if (!member.telegramUserId || member.role !== 'territorial_manager') continue;
      const mine = lagging.filter((s: any) => member.assignedShopIds?.includes(s.id));
      if (mine.length === 0) continue;
      await send(
        String(member.telegramUserId),
        `${opener}\n\nПо вашим точкам не подано заявок: <b>${mine.length}</b>\n\n` +
          mine.map((s: any) => `• ${label(s)}`).join('\n')
      );
    }

    // Supervision sees the whole network.
    const overview =
      `${opener}\n\nНе подали заявку: <b>${lagging.length}</b> из ${shops.length}\n\n` +
      lagging.slice(0, 30).map((s: any) => `• ${label(s)}`).join('\n') +
      (lagging.length > 30 ? `\n…и ещё ${lagging.length - 30}` : '');
    for (const chatId of supervisorRecipientIds()) await send(chatId, overview);
  }

  // Keep writing the in-app banner too — it's what a manager sees on opening the app.
  const timeStr = timeNow();
  const newNotifications = lagging.map((shop: any) => ({
    id: `notif-${Date.now()}-${shop.id}`,
    shopId: shop.id,
    shopName: shop.name,
    sentAt: timeStr,
    message: `🔔 Напоминание: пожалуйста, завершите и отправьте заявку на витрину до ${ORDER_DEADLINE}!`,
  }));
  if (newNotifications.length > 0) {
    const { error } = await supabase.from('notifications').insert(newNotifications.map(notificationToDb));
    if (error) console.error('Failed to write reminder notifications:', error);
  }

  return { lagging, shops };
}

// What changed between what a point sent and what was actually accepted. Returns null when
// nothing did, so the common case adds nothing to the message.
function describeOrderChanges(
  submittedItems: Record<string, any>,
  acceptedItems: Record<string, any>,
  productNameById: Map<string, string>
): string | null {
  const lines: string[] = [];
  const ids = new Set([...Object.keys(submittedItems || {}), ...Object.keys(acceptedItems || {})]);
  for (const id of ids) {
    const was = Number(submittedItems?.[id]) || 0;
    const now = Number(acceptedItems?.[id]) || 0;
    if (was === now) continue;
    const name = productNameById.get(id) || id;
    if (was === 0) lines.push(`• ${name}: добавлено ${now}`);
    else if (now === 0) lines.push(`• ${name}: убрано (было ${was})`);
    else lines.push(`• ${name}: ${was} → ${now}`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

// The applicant finally hears back. Until now approval was silent: their device discovered it
// on its own next poll, and a rejection was never communicated at all.
async function notifyRegistrationDecision(request: any, status: 'approved' | 'rejected') {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !request?.telegramUserId) return;

  const send = makeSender(botToken, WEB_APP_URL);
  const text =
    status === 'approved'
      ? `✅ <b>Регистрация подтверждена</b>\n\n${request.name}, ваша заявка одобрена — приложение уже открыто для вас.\n\n` +
        `Откройте его и начинайте работать.`
      : `❌ <b>Заявка на регистрацию отклонена</b>\n\n${request.name}, управляющий отклонил вашу заявку. ` +
        `Уточните детали у управляющего и при необходимости подайте её заново.`;

  await send(request.telegramUserId, text);
}

async function notifyNewRegistrationRequests(requests: any[]) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const recipientIds = supervisorRecipientIds();
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
        dishCategoryDefs,
        checklistAssignments,
        staff,
        registrationRequests,
        rolePermissions,
        advanceRequests,
      ] = await Promise.all([
        supabase.from('shops').select('*'),
        supabase.from('products').select('*'),
        // Today only: yesterday's row is left in place but is not part of today's picture.
        supabase.from('orders').select('*').eq('order_date', almatyToday()),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('raw_materials').select('*'),
        supabase.from('raw_category_defs').select('*'),
        supabase.from('semi_finished').select('*'),
        supabase.from('semi_category_defs').select('*'),
        supabase.from('dish_costings').select('*'),
        supabase.from('dish_category_defs').select('*'),
        supabase.from('checklist_assignments').select('*'),
        supabase.from('staff').select('*'),
        supabase.from('registration_requests').select('*'),
        supabase.from('role_permissions').select('*'),
        supabase.from('advance_requests').select('*').order('created_at', { ascending: false }),
      ]);

      for (const r of [
        shops, products, orders, notifications, rawMaterials, rawCategoryDefs,
        semiFinished, semiCategoryDefs, dishCostings, dishCategoryDefs, checklistAssignments, staff,
        registrationRequests, rolePermissions, advanceRequests,
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
        dishCategoryDefs: (dishCategoryDefs.data || []).map((r: any) => ({ key: r.key, label: r.label })),
        checklistAssignments: checklistAssignmentsRecord,
        staff: (staff.data || []).map(staffFromDb),
        registrationRequests: (registrationRequests.data || []).map(registrationRequestFromDb),
        rolePermissions: buildRolePermissions(rolePermissions.data || []),
        advanceRequests: (advanceRequests.data || []).map(advanceRequestFromDb),
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

  // Telegram calls this itself (configured once via the Bot API's setWebhook, not from our
  // code) whenever the bot receives a message — in particular, the contact a person shares
  // via the "Поделиться номером" button in the registration flow. Authenticated by a shared
  // secret Telegram echoes back in a header, not by anything in the request body — anyone
  // could otherwise POST a fake phone number here.
  app.post('/api/telegram/webhook', async (req, res) => {
    // Telegram retries on anything but 200, so failures are logged and swallowed rather than
    // surfaced — a malformed/unexpected update should never turn into a retry storm.
    try {
      const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
      const provided = req.headers['x-telegram-bot-api-secret-token'];
      if (!expected || provided !== expected) {
        return res.status(401).json({ ok: false });
      }
      const message = req.body?.message;
      const contact = message?.contact;
      // Telegram's "share phone number" button can only ever share the sender's own number —
      // this check is just belt-and-suspenders against a differently-shaped update.
      if (contact?.phone_number && contact?.user_id != null && String(message?.from?.id) === String(contact.user_id)) {
        const { error } = await supabase.from('telegram_contacts').upsert({
          telegram_user_id: String(contact.user_id),
          phone_number: String(contact.phone_number),
          first_name: contact.first_name || null,
          last_name: contact.last_name || null,
          received_at: new Date().toISOString(),
        });
        if (error) console.error('Failed to store Telegram contact:', error);
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('Telegram webhook error:', e);
      res.json({ ok: true });
    }
  });

  // Polled by the registration screen after it asks Telegram for the user's phone number —
  // the actual number arrives asynchronously via the webhook above (a normal chat message to
  // the bot, not a response to this request), so the client has to ask "did it arrive yet?".
  app.post('/api/registration/contact-status', async (req, res) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const { initData } = req.body || {};
      if (!botToken) return res.json({ ready: false });
      const { valid, userId } = verifyTelegramInitData(initData, botToken);
      if (!valid || userId == null) {
        return res.status(400).json({ ready: false, error: 'invalid initData' });
      }
      const { data, error } = await supabase
        .from('telegram_contacts')
        .select('*')
        .eq('telegram_user_id', String(userId))
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.json({ ready: false });
      res.json({
        ready: true,
        phone: data.phone_number,
        firstName: data.first_name || undefined,
        lastName: data.last_name || undefined,
      });
    } catch (e) {
      console.error('Failed to check contact status:', e);
      res.status(500).json({ ready: false });
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

  // Persist the dish (Product) category registry
  app.post('/api/dish-category-defs', async (req, res) => {
    try {
      if (Array.isArray(req.body?.dishCategoryDefs)) {
        await replaceTable('dish_category_defs', 'key', req.body.dishCategoryDefs);
      }
      const { data, error } = await supabase.from('dish_category_defs').select('*');
      if (error) throw error;
      res.json({ success: true, dishCategoryDefs: data || [] });
    } catch (e) {
      console.error('Failed to save dish category defs:', e);
      res.status(500).json({ error: 'Failed to save dish category defs' });
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

  // Persist the staff roster.
  // Replaces the WHOLE table with what the caller sends — so it must only ever be used by a
  // caller holding a complete, fresh list. The app itself no longer uses it: every add/edit
  // goes through /api/staff/upsert below, because two devices writing whole arrays silently
  // delete each other's rows (that is what cost several people their records on 2026-09-17).
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

  // Add or change specific people without touching anyone else. Takes one member or several
  // (reassigning a point's territorial manager moves it between two records at once).
  app.post('/api/staff/upsert', async (req, res) => {
    try {
      const incoming = Array.isArray(req.body?.staff)
        ? req.body.staff
        : req.body?.staff
        ? [req.body.staff]
        : null;
      if (!incoming || incoming.length === 0) {
        return res.status(400).json({ error: 'staff is required' });
      }
      const { error } = await supabase.from('staff').upsert(incoming.map(staffToDb));
      if (error) throw error;
      const { data, error: readError } = await supabase.from('staff').select('*');
      if (readError) throw readError;
      res.json({ success: true, staff: (data || []).map(staffFromDb) });
    } catch (e) {
      console.error('Failed to upsert staff:', e);
      res.status(500).json({ error: 'Failed to upsert staff' });
    }
  });

  app.delete('/api/staff/:staffId', async (req, res) => {
    try {
      const { error } = await supabase.from('staff').delete().eq('id', String(req.params.staffId));
      if (error) throw error;
      const { data, error: readError } = await supabase.from('staff').select('*');
      if (readError) throw readError;
      res.json({ success: true, staff: (data || []).map(staffFromDb) });
    } catch (e) {
      console.error('Failed to delete a staff member:', e);
      res.status(500).json({ error: 'Failed to delete staff member' });
    }
  });

  // Remembers where to reach one staff member. Sent by their own device on startup, which
  // covers everyone who registered before the id was captured at registration time. The id is
  // unverified — the same standard as submittedByTelegramId — because it only ever decides
  // where a notification goes, never what anyone is allowed to do.
  app.post('/api/staff/telegram-link', async (req, res) => {
    try {
      const { staffId, telegramUserId } = req.body || {};
      if (!staffId || !telegramUserId) {
        return res.status(400).json({ error: 'staffId and telegramUserId are required' });
      }
      const { error } = await supabase
        .from('staff')
        .update({ telegram_user_id: String(telegramUserId) })
        .eq('id', String(staffId));
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to link a Telegram id to a staff member:', e);
      res.status(500).json({ error: 'Failed to link Telegram id' });
    }
  });

  // One person submits their own registration. Writes exactly their row: during a hiring push
  // a dozen phones register within minutes, each holding a list loaded when it opened the app,
  // and a whole-table write from any of them erases everyone who registered since. That is what
  // stranded several people on 2026-09-17 — their request vanished while their phone kept
  // showing "заявка на рассмотрении" and the Owner never saw them at all.
  app.post('/api/registration-requests/submit', async (req, res) => {
    try {
      const request = req.body?.request;
      if (!request?.id || !request?.name) {
        return res.status(400).json({ error: 'request with id and name is required' });
      }
      // Trusting the client's timestamp is how this already worked (it always sends one) —
      // stamped here too so a caller that doesn't (a test, a future client change) gets a
      // real row instead of a 500 from the not-null column.
      const withDefaults = { ...request, submittedAt: request.submittedAt || timeNow(), status: request.status || 'pending' };
      const { error } = await supabase
        .from('registration_requests')
        .upsert(registrationRequestToDb(withDefaults));
      if (error) throw error;

      notifyNewRegistrationRequests([withDefaults]).catch((e) =>
        console.error('Failed to send registration notifications:', e)
      );
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to submit a registration request:', e);
      res.status(500).json({ error: 'Failed to submit registration request' });
    }
  });

  // The decision on one request (approve/reject), or an edit to its point/role before deciding.
  // Reads the stored status first so the applicant is notified exactly once, on the real
  // pending -> decided transition, however many times the screen re-saves afterwards.
  app.patch('/api/registration-requests/:requestId', async (req, res) => {
    try {
      const requestId = String(req.params.requestId);
      const { data: existing, error: readError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();
      if (readError) throw readError;
      if (!existing) return res.status(404).json({ error: 'Registration request not found' });

      const updates = req.body?.updates || {};
      const patch: Record<string, unknown> = {};
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.requestedShopId !== undefined) patch.requested_shop_id = updates.requestedShopId;
      if (updates.requestedShopIds !== undefined) patch.requested_shop_ids = updates.requestedShopIds;
      if (updates.requestedRole !== undefined) patch.requested_role = updates.requestedRole;
      if (updates.requestedPosition !== undefined) patch.requested_position = updates.requestedPosition;
      if (updates.name !== undefined) patch.name = updates.name;
      if (updates.phone !== undefined) patch.phone = updates.phone;
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'updates is required' });
      }

      const { data: updated, error } = await supabase
        .from('registration_requests')
        .update(patch)
        .eq('id', requestId)
        .select('*')
        .maybeSingle();
      if (error) throw error;

      const decided =
        existing.status === 'pending' && (patch.status === 'approved' || patch.status === 'rejected');
      if (decided) {
        notifyRegistrationDecision(registrationRequestFromDb(updated), patch.status as any).catch((e) =>
          console.error('Failed to notify about a registration decision:', e)
        );
      }
      res.json({ success: true, request: registrationRequestFromDb(updated) });
    } catch (e) {
      console.error('Failed to update a registration request:', e);
      res.status(500).json({ error: 'Failed to update registration request' });
    }
  });

  // One request by id — what the waiting screen polls, instead of refetching all 11 tables.
  app.get('/api/registration-requests/:requestId', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('id', String(req.params.requestId))
        .maybeSingle();
      if (error) throw error;
      res.json({ request: data ? registrationRequestFromDb(data) : null });
    } catch (e) {
      console.error('Failed to read a registration request:', e);
      res.status(500).json({ error: 'Failed to read registration request' });
    }
  });

  // A shop-floor employee asking to be paid part of what the timesheet already shows them as
  // having earned, ahead of the normal payday. Same row-level-write shape as registration
  // requests above — one person's own submission, never a whole-table replace.
  async function notifyNewAdvanceRequest(request: any) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;
    const recipientIds = supervisorRecipientIds();
    if (recipientIds.size === 0) return;
    const text =
      `💸 <b>Заявка на аванс</b>\n\n` +
      `👤 ${request.staffName}\n` +
      `💰 ${Number(request.amount).toLocaleString('ru-RU')} ₸\n` +
      `📱 Kaspi: ${request.kaspiPhone}\n\n` +
      `Одобрить или отклонить — в разделе «Авансы».`;
    for (const chatId of recipientIds) {
      await sendTelegramMessage(botToken, chatId, text, WEB_APP_URL);
    }
  }

  async function notifyAdvanceDecision(request: any, status: 'approved' | 'rejected') {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;
    const { data: staffRow } = await supabase
      .from('staff')
      .select('telegram_user_id')
      .eq('id', request.staffId)
      .maybeSingle();
    const chatId = staffRow?.telegram_user_id;
    if (!chatId) return;
    const text =
      status === 'approved'
        ? `✅ <b>Аванс одобрен</b>\n\n${Number(request.amount).toLocaleString('ru-RU')} ₸ переведут на Kaspi ${request.kaspiPhone}.`
        : `❌ <b>Заявка на аванс отклонена</b>\n\nУточните детали у управляющего.`;
    await sendTelegramMessage(botToken, chatId, text, WEB_APP_URL);
  }

  app.post('/api/advance-requests/submit', async (req, res) => {
    try {
      const request = req.body?.request;
      if (!request?.id || !request?.staffId || !request?.amount || !request?.kaspiPhone) {
        return res.status(400).json({ error: 'staffId, amount and kaspiPhone are required' });
      }
      const withDefaults = { ...request, submittedAt: request.submittedAt || timeNow(), status: 'pending' };
      const { error } = await supabase
        .from('advance_requests')
        .upsert(advanceRequestToDb(withDefaults));
      if (error) throw error;
      notifyNewAdvanceRequest(withDefaults).catch((e) =>
        console.error('Failed to notify about a new advance request:', e)
      );
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to submit an advance request:', e);
      res.status(500).json({ error: 'Failed to submit advance request' });
    }
  });

  // The decision on one advance request. Reads the stored status first so the employee is
  // notified exactly once, on the real pending -> decided transition.
  app.patch('/api/advance-requests/:id', async (req, res) => {
    try {
      const id = String(req.params.id);
      const { data: existing, error: readError } = await supabase
        .from('advance_requests')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw readError;
      if (!existing) return res.status(404).json({ error: 'Advance request not found' });

      const status = req.body?.updates?.status;
      if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ error: 'updates.status must be approved or rejected' });
      }

      const { data: updated, error } = await supabase
        .from('advance_requests')
        .update({ status })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;

      if (existing.status === 'pending') {
        notifyAdvanceDecision(advanceRequestFromDb(updated), status).catch((e) =>
          console.error('Failed to notify about an advance decision:', e)
        );
      }
      res.json({ success: true, request: advanceRequestFromDb(updated) });
    } catch (e) {
      console.error('Failed to update an advance request:', e);
      res.status(500).json({ error: 'Failed to update advance request' });
    }
  });

  // Anonymous dish-tasting polls. Management (create/edit/close/delete) is Owner-only — this
  // feature has no admin equivalent, unlike almost everything else in AdminView, so it's
  // worth a real requireOwner check rather than just hiding the tile. Reading a poll and
  // voting on it are deliberately open: a voter has no identity to check against at all.
  app.get('/api/dish-polls', async (req, res) => {
    try {
      const [{ data, error }, { data: voteRows, error: voteError }] = await Promise.all([
        supabase.from('dish_polls').select('*').order('created_at', { ascending: false }),
        supabase.from('dish_poll_votes').select('poll_id'),
      ]);
      if (error) throw error;
      if (voteError) throw voteError;
      const counts: Record<string, number> = {};
      (voteRows || []).forEach((r: any) => {
        counts[r.poll_id] = (counts[r.poll_id] || 0) + 1;
      });
      res.json({
        polls: (data || []).map((r) => ({ ...dishPollFromDb(r), voteCount: counts[r.id] || 0 })),
      });
    } catch (e) {
      console.error('Failed to load dish polls:', e);
      res.status(500).json({ error: 'Failed to load dish polls' });
    }
  });

  // ?voter=<telegram id> — чтобы вернувшийся по той же ссылке гость увидел, что он уже
  // оценил меню, а не пустую форму: иначе он решит, что оценки не сохранились, и
  // переголосует наспех поверх своих же вдумчивых оценок.
  app.get('/api/dish-polls/:id', async (req, res) => {
    try {
      const pollId = String(req.params.id);
      const voter = req.query.voter ? String(req.query.voter) : null;
      const { data, error } = await supabase.from('dish_polls').select('*').eq('id', pollId).maybeSingle();
      if (error) throw error;
      if (!data) return res.json({ poll: null });

      let myVote = null;
      if (voter) {
        const { data: voteRow, error: voteError } = await supabase
          .from('dish_poll_votes')
          .select('*')
          .eq('poll_id', pollId)
          .eq('telegram_user_id', voter)
          .maybeSingle();
        if (voteError) throw voteError;
        if (voteRow) myVote = dishPollVoteFromDb(voteRow);
      }
      res.json({ poll: dishPollFromDb(data), myVote });
    } catch (e) {
      console.error('Failed to load a dish poll:', e);
      res.status(500).json({ error: 'Failed to load dish poll' });
    }
  });

  // Картинка QR отдаётся через нас, а не прямой ссылкой на сторонний сервис: так адрес
  // остаётся своим, и браузер (в отличие от кросс-доменной ссылки) действительно сохраняет
  // файл по кнопке «Скачать».
  app.get('/api/dish-polls/:id/qr', async (req, res) => {
    try {
      const pollId = String(req.params.id);
      const size = Math.min(1000, Math.max(120, Number(req.query.size) || 600));
      const link = `https://t.me/${DISH_POLL_BOT_USERNAME}?startapp=vote_${pollId}`;
      const upstream = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(link)}`
      );
      if (!upstream.ok) {
        return res.status(502).json({ error: 'Не удалось получить QR-код' });
      }
      const png = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      if (req.query.download) {
        res.setHeader('Content-Disposition', `attachment; filename="qr-${pollId}.png"`);
      }
      res.send(png);
    } catch (e) {
      console.error('Failed to build a dish poll QR:', e);
      res.status(500).json({ error: 'Не удалось получить QR-код' });
    }
  });

  app.post('/api/dish-polls', async (req, res) => {
    try {
      const { initData, poll } = req.body || {};
      if (!requireOwner(initData)) {
        return res.status(403).json({ error: 'Not allowed to create a dish poll' });
      }
      const dishNames = Array.isArray(poll?.dishNames) ? poll.dishNames.map((n: unknown) => String(n).trim()).filter(Boolean) : [];
      if (
        !poll?.id ||
        !poll?.name?.trim() ||
        !Array.isArray(poll?.criteria) ||
        poll.criteria.length === 0 ||
        dishNames.length === 0
      ) {
        return res.status(400).json({ error: 'name, at least one dish and one criterion are required' });
      }
      const { error } = await supabase.from('dish_polls').insert(
        dishPollToDb({ ...poll, dishNames, status: 'active' })
      );
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to create a dish poll:', e);
      res.status(500).json({ error: 'Failed to create dish poll' });
    }
  });

  app.patch('/api/dish-polls/:id', async (req, res) => {
    try {
      const { initData, updates } = req.body || {};
      if (!requireOwner(initData)) {
        return res.status(403).json({ error: 'Not allowed to edit a dish poll' });
      }
      const pollId = String(req.params.id);

      // Removing a dish also has to strip that index out of every already-cast vote's
      // `entries` array — those are stored aligned by position to dishNames, so leaving them
      // untouched would silently shift every later dish's scores onto the wrong dish.
      if (typeof updates?.deleteDishIndex === 'number') {
        const dishIndex = updates.deleteDishIndex;
        const { data: pollRow, error: pollError } = await supabase
          .from('dish_polls')
          .select('dish_names')
          .eq('id', pollId)
          .maybeSingle();
        if (pollError) throw pollError;
        if (!pollRow) return res.status(404).json({ error: 'Poll not found' });
        const dishNames: string[] = pollRow.dish_names || [];
        if (dishIndex < 0 || dishIndex >= dishNames.length) {
          return res.status(400).json({ error: 'deleteDishIndex out of range' });
        }
        if (dishNames.length <= 1) {
          return res.status(400).json({ error: 'A poll needs at least one dish' });
        }
        const newDishNames = dishNames.filter((_, i) => i !== dishIndex);
        const { error: updatePollErr } = await supabase
          .from('dish_polls')
          .update({ dish_names: newDishNames })
          .eq('id', pollId);
        if (updatePollErr) throw updatePollErr;

        const { data: voteRows, error: votesError } = await supabase
          .from('dish_poll_votes')
          .select('id, entries')
          .eq('poll_id', pollId);
        if (votesError) throw votesError;
        await Promise.all(
          (voteRows || []).map((v: any) => {
            const entries = Array.isArray(v.entries) ? v.entries : [];
            if (entries.length <= dishIndex) return Promise.resolve();
            const newEntries = entries.filter((_: unknown, i: number) => i !== dishIndex);
            return supabase.from('dish_poll_votes').update({ entries: newEntries }).eq('id', v.id);
          })
        );
        return res.json({ success: true });
      }

      // A criterion can only be added, never removed — removing one would leave every past
      // vote's scores keyed by a criterion name the poll no longer recognizes.
      if (typeof updates?.addCriterion === 'string') {
        const criterion = updates.addCriterion.trim();
        if (!criterion) return res.status(400).json({ error: 'addCriterion cannot be empty' });
        const { data: pollRow, error: pollError } = await supabase
          .from('dish_polls')
          .select('criteria')
          .eq('id', pollId)
          .maybeSingle();
        if (pollError) throw pollError;
        if (!pollRow) return res.status(404).json({ error: 'Poll not found' });
        const criteria: string[] = pollRow.criteria || [];
        if (!criteria.includes(criterion)) {
          const { error: updateErr } = await supabase
            .from('dish_polls')
            .update({ criteria: [...criteria, criterion] })
            .eq('id', pollId);
          if (updateErr) throw updateErr;
        }
        return res.json({ success: true });
      }

      const patch: Record<string, unknown> = {};
      if (updates?.status) patch.status = updates.status;
      if (updates?.name) patch.name = updates.name;
      if (Array.isArray(updates?.dishNames)) {
        const dishNames = updates.dishNames.map((n: unknown) => String(n).trim()).filter(Boolean);
        if (dishNames.length === 0) {
          return res.status(400).json({ error: 'dishNames cannot be empty' });
        }
        patch.dish_names = dishNames;
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'updates is required' });
      }
      const { error } = await supabase.from('dish_polls').update(patch).eq('id', pollId);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to update a dish poll:', e);
      res.status(500).json({ error: 'Failed to update dish poll' });
    }
  });

  app.delete('/api/dish-polls/:id', async (req, res) => {
    try {
      const { initData } = req.body || {};
      if (!requireOwner(initData)) {
        return res.status(403).json({ error: 'Not allowed to delete a dish poll' });
      }
      const { error } = await supabase.from('dish_polls').delete().eq('id', String(req.params.id));
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to delete a dish poll:', e);
      res.status(500).json({ error: 'Failed to delete dish poll' });
    }
  });

  // The Owner's results view: every vote plus a per-dish, per-criterion average, computed here
  // rather than shipping every row to the client to average — this list only ever grows.
  // `averages` is an array aligned with the poll's own dishNames, one criterion-average map each.
  app.get('/api/dish-polls/:id/results', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('dish_poll_votes')
        .select('*')
        .eq('poll_id', String(req.params.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      const votes = (data || []).map(dishPollVoteFromDb);
      const totals: Record<string, { sum: number; count: number }>[] = [];
      for (const v of votes) {
        v.entries.forEach((entry: { scores: Record<string, number> }, dishIndex: number) => {
          if (!totals[dishIndex]) totals[dishIndex] = {};
          for (const [criterion, score] of Object.entries(entry.scores || {})) {
            if (!totals[dishIndex][criterion]) totals[dishIndex][criterion] = { sum: 0, count: 0 };
            totals[dishIndex][criterion].sum += Number(score) || 0;
            totals[dishIndex][criterion].count += 1;
          }
        });
      }
      const averages = totals.map((dishTotals) => {
        const out: Record<string, number> = {};
        for (const [criterion, { sum, count }] of Object.entries(dishTotals || {})) {
          out[criterion] = count > 0 ? sum / count : 0;
        }
        return out;
      });
      res.json({ votes, voteCount: votes.length, averages });
    } catch (e) {
      console.error('Failed to load dish poll results:', e);
      res.status(500).json({ error: 'Failed to load dish poll results' });
    }
  });

  // A customer votes on every dish in the poll at once. No identity check beyond "does
  // Telegram say who you are" — this is feedback on a croissant, not a security boundary. One
  // row per (poll, telegram user): voting again corrects the same response instead of counting
  // them twice.
  app.post('/api/dish-polls/:id/vote', async (req, res) => {
    try {
      const pollId = String(req.params.id);
      const { telegramUserId, telegramUsername, telegramName, entries } = req.body || {};
      // Эти тексты видит гость на своём экране, поэтому они по-русски и без технических
      // подробностей: единственное, что он может сделать — переоткрыть ссылку.
      const CHANGED = 'Голосование изменили, пока вы оценивали. Откройте ссылку заново и оцените ещё раз.';
      if (!telegramUserId || !telegramName || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'Не удалось прочитать ваши оценки. Откройте ссылку заново.' });
      }
      const { data: pollRow, error: pollError } = await supabase
        .from('dish_polls')
        .select('*')
        .eq('id', pollId)
        .maybeSingle();
      if (pollError) throw pollError;
      if (!pollRow) return res.status(404).json({ error: 'Голосование не найдено — возможно, ссылка устарела.' });
      if (pollRow.status !== 'active') {
        return res.status(400).json({ error: 'Голосование уже завершено — приём оценок закрыт.' });
      }

      const criteria: string[] = pollRow.criteria || [];
      const dishNames: string[] = pollRow.dish_names || [];
      const allowComments = pollRow.allow_comments !== false;
      if (entries.length !== dishNames.length) {
        return res.status(400).json({ error: CHANGED });
      }
      const cleanEntries: { scores: Record<string, number>; comment?: string }[] = [];
      for (let i = 0; i < entries.length; i++) {
        const scores = entries[i]?.scores;
        if (!scores || typeof scores !== 'object') {
          return res.status(400).json({ error: CHANGED });
        }
        const cleanScores: Record<string, number> = {};
        for (const criterion of criteria) {
          // Критерия нет вовсе — значит его добавили уже после того, как гость открыл форму.
          if (scores[criterion] === undefined || scores[criterion] === null) {
            return res.status(400).json({ error: CHANGED });
          }
          // Ноль на клиенте означает «не оценено» и до сюда доходить не должен, поэтому
          // принимаем всё строго больше нуля: шаг ползунка 0,5, так что 0,5 — валидная оценка.
          const n = Number(scores[criterion]);
          if (!Number.isFinite(n) || n <= 0 || n > 10) {
            return res.status(400).json({ error: `Оценка по критерию «${criterion}» должна быть от 0,5 до 10.` });
          }
          cleanScores[criterion] = n;
        }
        const comment = allowComments && entries[i]?.comment ? String(entries[i].comment) : undefined;
        cleanEntries.push({ scores: cleanScores, ...(comment ? { comment } : {}) });
      }

      const { error } = await supabase.from('dish_poll_votes').upsert(
        dishPollVoteToDb({
          pollId,
          telegramUserId: String(telegramUserId),
          telegramUsername: telegramUsername || undefined,
          telegramName,
          entries: cleanEntries,
        }),
        { onConflict: 'poll_id,telegram_user_id' }
      );
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to submit a dish poll vote:', e);
      res.status(500).json({ error: 'Не удалось сохранить оценки. Попробуйте ещё раз.' });
    }
  });

  // Whole-table replace — same hazard as /api/staff above, kept only for bulk restores.
  // The app writes single rows through the three routes above instead.
  app.post('/api/registration-requests', async (req, res) => {
    try {
      const incoming = Array.isArray(req.body?.registrationRequests) ? req.body.registrationRequests : null;
      if (incoming) {
        const { data: existingRows } = await supabase.from('registration_requests').select('id, status');
        const previousStatus = new Map((existingRows || []).map((r) => [r.id, r.status]));
        const newlyAdded = incoming.filter((r) => !previousStatus.has(r.id));
        // A request that just stopped being 'pending' is a decision someone is waiting on.
        // Comparing against what was stored is what makes this reliable: the client sends the
        // whole array every time, so "approved" alone would re-notify on every later save.
        const justDecided = incoming.filter(
          (r) =>
            previousStatus.has(r.id) &&
            previousStatus.get(r.id) === 'pending' &&
            (r.status === 'approved' || r.status === 'rejected')
        );

        await replaceTable('registration_requests', 'id', incoming.map(registrationRequestToDb));

        if (newlyAdded.length > 0) {
          notifyNewRegistrationRequests(newlyAdded).catch((e) =>
            console.error('Failed to send registration notifications:', e)
          );
        }
        for (const request of justDecided) {
          notifyRegistrationDecision(request, request.status).catch((e) =>
            console.error('Failed to notify about a registration decision:', e)
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
  // Owner-verified: one call flips every submitted order in the network to accepted, so it
  // must not be reachable by anyone who simply knows the URL. Only the Owner cabinet renders
  // this button today; if a production-manager role is reintroduced later, widen this check
  // rather than removing it.
  app.post('/api/orders/accept-all', async (req, res) => {
    try {
      if (!requireOwner(req.body?.initData)) {
        return res.status(403).json({ error: 'Not allowed to accept all orders' });
      }
      const timeStr = timeNow();
      const { error } = await supabase
        .from('orders')
        .update({ status: 'accepted', accepted_at: timeStr })
        .eq('status', 'submitted')
        .eq('order_date', almatyToday());
      if (error) throw error;

      const { data, error: selectError } = await supabase.from('orders').select('*').eq('order_date', almatyToday());
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
  // NOTE: there used to be a POST /api/orders/simulate-all here, left over from an early
  // demo. It generated a full made-up order for every shop and every product and wrote them
  // in as 'submitted' under each shop's real manager name, replacing whatever those shops had
  // actually ordered that day. It had no button anywhere, but the route was live and
  // unauthenticated, so a single request could wipe a real working day for all 27 points.
  // Deleted deliberately — do not reintroduce it against the production database.

  // Submit or save order for a specific coffee shop
  app.post('/api/orders/:shopId', async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { items, status, notes, managerName, submittedByTelegramId } = req.body;

      const { data: shopRow, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();
      if (shopError || !shopRow) {
        return res.status(404).json({ error: 'Coffee shop not found' });
      }
      const shop = shopFromDb(shopRow);

      const today = almatyToday();
      const { data: existingOrderRow } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .eq('order_date', today)
        .maybeSingle();
      // A row left over from an earlier day is not carried forward — today starts clean, and
      // the write below overwrites it (shop_id is the primary key).
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
        orderDate: today,
        items: items || {},
        status: status || 'submitted',
        submittedAt: status === 'submitted' ? timeStr : existingOrder?.submittedAt || timeStr,
        acceptedAt: status === 'accepted' ? timeStr : existingOrder?.acceptedAt,
        managerName: managerName || shop.manager,
        notes,
        anomalies: Object.keys(anomalies).length > 0 ? anomalies : undefined,
        submittedByTelegramId: submittedByTelegramId || existingOrder?.submittedByTelegramId,
      };

      const { error: upsertError } = await supabase.from('orders').upsert(orderToDb(order));
      if (upsertError) throw upsertError;

      // Log every actual submission (not draft saves) to the append-only history table. Errors
      // here must never fail the request (the order itself is already saved above) — but must
      // not be silently swallowed either, since a lost insert here means that submission simply
      // never shows up in the shop's order history with no other trace.
      if (status === 'submitted') {
        const { error: historyError } = await supabase.from('order_history').insert({
          shop_id: shopId,
          items: order.items,
          manager_name: order.managerName,
        });
        if (historyError) {
          console.error(`Failed to append order_history for shop ${shopId}:`, historyError);
        }
      }

      res.json({ success: true, order });

      // After the response: supervision needs to know there's something to decide on, and the
      // point's other staff need to know it's already been sent so nobody sends it twice.
      if (status === 'submitted') {
        notifyOrderSubmitted(shopId, order).catch((e) =>
          console.error(`Failed to notify about submitted order for shop ${shopId}:`, e)
        );
      }
    } catch (e) {
      console.error('Failed to save order:', e);
      res.status(500).json({ error: 'Failed to save order' });
    }
  });

  // Lightweight single-shop order fetch — lets the manager's own device poll for status changes
  // (accepted/rejected) without re-fetching the whole /api/initial-data payload every time.
  app.get('/api/orders/:shopId', async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .eq('order_date', almatyToday())
        .maybeSingle();
      if (error) throw error;
      res.json({ order: data ? orderFromDb(data) : null });
    } catch (e) {
      console.error('Failed to fetch order:', e);
      res.status(500).json({ error: 'Failed to fetch order' });
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

  // The days the network actually ordered on, newest first, with each day's totals. Backs the
  // "История заявок" screen, which opens on a list of days rather than making someone guess a
  // date in a picker. Aggregated here because the money needs product prices.
  app.get('/api/order-history/days', async (req, res) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 120);
      // Reach back a generous window rather than trying to page by day — a day with no orders
      // simply doesn't appear, so "last 30 days of calendar" and "last 30 ordering days" differ.
      const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: rows, error }, { data: productRows, error: productsError }] = await Promise.all([
        supabase
          .from('order_history')
          .select('*')
          .gte('submitted_at', since)
          .order('submitted_at', { ascending: false }),
        supabase.from('products').select('id, price'),
      ]);
      if (error) throw error;
      if (productsError) throw productsError;

      const priceById = new Map<string, number>(
        (productRows || []).map((r: any) => [r.id, Number(r.price) || 0])
      );

      // Group by the Kazakhstan day the submission landed on, keeping only each shop's latest
      // one — the same rule the per-date registry uses, so the totals agree with it.
      const byDay = new Map<string, Map<number, any>>();
      for (const row of rows || []) {
        const day = new Date(row.submitted_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Almaty' });
        if (!byDay.has(day)) byDay.set(day, new Map());
        const shops = byDay.get(day)!;
        if (!shops.has(row.shop_id)) shops.set(row.shop_id, row);
      }

      const days = Array.from(byDay.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, limit)
        .map(([date, shops]) => {
          let pcs = 0;
          let sum = 0;
          let accepted = 0;
          let rejected = 0;
          for (const row of shops.values()) {
            if (row.status === 'accepted') accepted++;
            if (row.status === 'rejected') rejected++;
            Object.entries(row.items || {}).forEach(([pid, q]) => {
              const qty = Number(q) || 0;
              if (qty > 0) {
                pcs += qty;
                sum += qty * (priceById.get(pid) || 0);
              }
            });
          }
          return { date, shops: shops.size, pcs, sum, accepted, rejected };
        });

      res.json({ days });
    } catch (e) {
      console.error('Failed to fetch order history days:', e);
      res.status(500).json({ error: 'Failed to fetch order history days' });
    }
  });

  // "Реестр заявок" for a past date: one entry per shop (its latest submission that day, with
  // whatever accept/reject decision was eventually recorded — see the sync in the status PATCH
  // below), across all 27 shops. Powers the registry's date picker; "today" uses live /orders
  // data instead since that's already accurate and actionable (accept/reject/delete).
  app.get('/api/order-history-by-date', async (req, res) => {
    try {
      const dateStr = String(req.query.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      }
      const { startIso, endIso } = almatyDayRangeUtc(dateStr);
      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .gte('submitted_at', startIso)
        .lt('submitted_at', endIso)
        .order('submitted_at', { ascending: false });
      if (error) throw error;

      const latestPerShop = new Map<number, any>();
      for (const row of data || []) {
        if (!latestPerShop.has(row.shop_id)) latestPerShop.set(row.shop_id, row);
      }
      res.json({ history: Array.from(latestPerShop.values()).map(orderHistoryFromDb) });
    } catch (e) {
      console.error('Failed to fetch order history by date:', e);
      res.status(500).json({ error: 'Failed to fetch order history by date' });
    }
  });

  // Update order status (accept / reject / submitted)
  app.patch('/api/orders/:shopId/status', async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { status } = req.body;
      const timeStr = timeNow();

      const today = almatyToday();
      const { data: existingOrderRow } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', shopId)
        .eq('order_date', today)
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
          orderDate: today,
          items: {},
          status: status || 'draft',
          managerName: shop?.manager || '',
          acceptedAt: status === 'accepted' ? timeStr : undefined,
        };
      }
      order.orderDate = today;

      const { error } = await supabase.from('orders').upsert(orderToDb(order));
      if (error) throw error;

      res.json({ success: true, order });

      // Keep the append-only history in sync with the final decision, so a past date's history
      // shows what actually happened (not just that something was submitted that day). Applies
      // only to the single most recent submission for this shop (found first, then updated by
      // id — an update() can't itself be ordered/limited, that would touch every past row).
      if (status === 'accepted' || status === 'rejected') {
        supabase
          .from('order_history')
          .select('id')
          .eq('shop_id', shopId)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .then(({ data: rows, error: selectError }) => {
            if (selectError) {
              console.error(`Failed to find latest order_history row for shop ${shopId}:`, selectError);
              return;
            }
            if (!rows || rows.length === 0) return;
            return supabase
              .from('order_history')
              .update({ status, decided_at: new Date().toISOString() })
              .eq('id', rows[0].id);
          })
          .then((result) => {
            if (result && 'error' in result && result.error) {
              console.error(`Failed to sync order_history status for shop ${shopId}:`, result.error);
            }
          });
      }

      // Tell everyone with a stake in the decision: the manager who submitted it (otherwise
      // their device only finds out on its own next poll), plus the Owner and the production
      // managers, so a decision is visible to supervision without opening the app.
      if (status === 'accepted' || status === 'rejected') {
        notifyOrderDecision(shopId, status, order).catch((e) =>
          console.error(`Failed to notify about order decision for shop ${shopId}:`, e)
        );
      }
    } catch (e) {
      console.error('Failed to update order status:', e);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // Owner/Admin: wipe a shop's current order entirely — for clearing out a stray/test entry
  // (e.g. accepted or rejected by mistake with nothing actually ordered), not a normal part of
  // daily use. The shop reverts to its default "never ordered" state; order_history is untouched.
  app.delete('/api/orders/:shopId', async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId, 10);
      const { error } = await supabase.from('orders').delete().eq('shop_id', shopId);
      if (error) throw error;
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to delete order:', e);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // ---------------------------------------------------------------------------------------
  // Timesheet (табель). One `shifts` row per person per day actually worked; `rate` is frozen
  // on the row so a later raise never rewrites past months' pay.
  // ---------------------------------------------------------------------------------------

  // Calendar-month bounds as plain YYYY-MM-DD, which is what a `date` column compares against.
  // No timezone maths needed: a date has no time, and month boundaries are the same everywhere.
  const monthRange = (month: string) => {
    const m = /^(\d{4})-(\d{2})$/.exec(month || '');
    if (!m) return null;
    const year = Number(m[1]);
    const mon = Number(m[2]);
    if (mon < 1 || mon > 12) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    return { from: `${year}-${pad(mon)}-01`, to: `${year}-${pad(mon)}-${pad(lastDay)}` };
  };

  // Read the month's shifts — everyone's, or one person's with ?staffId=. Deliberately open,
  // like every other read in this app: there is no server-side identity for employees yet, and
  // gating this would only look like protection without being any.
  app.get('/api/timesheet', async (req, res) => {
    try {
      const range = monthRange(String(req.query.month || ''));
      if (!range) return res.status(400).json({ error: 'month must be YYYY-MM' });

      let query = supabase
        .from('shifts')
        .select('*')
        .gte('work_date', range.from)
        .lte('work_date', range.to)
        .order('work_date', { ascending: true });

      const staffId = req.query.staffId ? String(req.query.staffId) : null;
      if (staffId) query = query.eq('staff_id', staffId);

      const { data, error } = await query;
      if (error) throw error;
      res.json({ shifts: (data || []).map(shiftFromDb) });
    } catch (e) {
      console.error('Failed to load timesheet:', e);
      res.status(500).json({ error: 'Failed to load timesheet' });
    }
  });

  // Record or correct one shift. Reachable by the Owner or «Заведующий производством» — see
  // the comment above the endpoint definitions removed from requireOwner, below.
  app.post('/api/timesheet/shift', async (req, res) => {
    try {
      const { staffId, workDate, rate, note, actorName } = req.body || {};
      // Used to be requireOwner-only, back when Owner was the only reachable admin identity.
      // «Заведующий производством» now reaches this same screen (AdminView's "Табель" tile,
      // gated by the manage_personnel permission) and needs to actually be able to save a
      // shift, not just look at the tile — same UI-gated-only posture as personnel/catalog
      // edits elsewhere in this app.
      if (!staffId || !/^\d{4}-\d{2}-\d{2}$/.test(String(workDate || ''))) {
        return res.status(400).json({ error: 'staffId and workDate (YYYY-MM-DD) are required' });
      }
      const numericRate = Number(rate);
      if (!Number.isFinite(numericRate) || numericRate < 0) {
        return res.status(400).json({ error: 'rate must be a non-negative number' });
      }

      // Upsert on (staff_id, work_date) so re-recording the same day corrects that row rather
      // than adding a second one — the unique constraint makes double pay impossible anyway,
      // this just turns it into an update instead of an error.
      const { data, error } = await supabase
        .from('shifts')
        .upsert(
          { staff_id: staffId, work_date: workDate, rate: numericRate, note: note || null },
          { onConflict: 'staff_id,work_date' }
        )
        .select()
        .maybeSingle();
      if (error) throw error;

      // Fire-and-forget: who touched this person's pay, and when — see shift_changes in
      // schema.sql. Never blocks the write itself on the log succeeding.
      const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).maybeSingle();
      supabase.from('shift_changes').insert({
        staff_id: staffId,
        staff_name: staffRow?.name || staffId,
        work_date: workDate,
        action: 'set',
        rate: numericRate,
        actor_name: actorName || 'Неизвестно',
      }).then(({ error: logError }) => {
        if (logError) console.error('Failed to log a shift change:', logError);
      });

      res.json({ success: true, shift: data ? shiftFromDb(data) : null });
    } catch (e) {
      console.error('Failed to save shift:', e);
      res.status(500).json({ error: 'Failed to save shift' });
    }
  });

  // Remove one shift (the person didn't work that day after all).
  app.delete('/api/timesheet/shift', async (req, res) => {
    try {
      const { staffId, workDate, actorName } = req.body || {};
      if (!staffId || !workDate) {
        return res.status(400).json({ error: 'staffId and workDate are required' });
      }
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('staff_id', staffId)
        .eq('work_date', workDate);
      if (error) throw error;

      const { data: staffRow } = await supabase.from('staff').select('name').eq('id', staffId).maybeSingle();
      supabase.from('shift_changes').insert({
        staff_id: staffId,
        staff_name: staffRow?.name || staffId,
        work_date: workDate,
        action: 'delete',
        rate: null,
        actor_name: actorName || 'Неизвестно',
      }).then(({ error: logError }) => {
        if (logError) console.error('Failed to log a shift change:', logError);
      });

      res.json({ success: true });
    } catch (e) {
      console.error('Failed to delete shift:', e);
      res.status(500).json({ error: 'Failed to delete shift' });
    }
  });

  // The change log for one month — who set or removed a shift, and when. Read-only, same
  // openness as the rest of the timesheet reads.
  app.get('/api/timesheet/log', async (req, res) => {
    try {
      const range = monthRange(String(req.query.month || ''));
      if (!range) return res.status(400).json({ error: 'month must be YYYY-MM' });
      const { data, error } = await supabase
        .from('shift_changes')
        .select('*')
        .gte('work_date', range.from)
        .lte('work_date', range.to)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.json({
        entries: (data || []).map((r) => ({
          id: r.id,
          staffId: r.staff_id,
          staffName: r.staff_name,
          workDate: r.work_date,
          action: r.action,
          rate: r.rate,
          actorName: r.actor_name,
          createdAt: r.created_at,
        })),
      });
    } catch (e) {
      console.error('Failed to load shift change log:', e);
      res.status(500).json({ error: 'Failed to load shift change log' });
    }
  });

  // Send reminder notifications to all unsubmitted coffee shops. Owner-verified: this pushes
  // real Telegram messages out to every lagging point, so an open route here is a way to spam
  // the whole network from outside the app.
  // Fired by Vercel Cron at the deadline (see vercel.json). Nobody has to remember to press
  // anything, and it still runs on a morning when the Owner is asleep or away. Guarded by a
  // shared secret rather than a Telegram signature — a scheduler has no Telegram identity.
  const runDeadlineReminder = async (req: any, res: any) => {
    try {
      const secret = process.env.CRON_SECRET;
      const provided =
        (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.query?.key || '');
      if (!secret || provided !== secret) {
        return res.status(403).json({ error: 'Not allowed' });
      }
      const { lagging, shops } = await remindLaggingShops({ automatic: true });
      res.json({ success: true, lagging: lagging.length, total: shops.length });
    } catch (e) {
      console.error('Deadline reminder failed:', e);
      res.status(500).json({ error: 'Deadline reminder failed' });
    }
  };
  // Vercel Cron issues a GET; POST is here so the run can be triggered by hand too.
  app.get('/api/cron/deadline-reminder', runDeadlineReminder);
  app.post('/api/cron/deadline-reminder', runDeadlineReminder);

  app.post('/api/reminders/send-all', async (req, res) => {
    try {
      if (!requireOwner(req.body?.initData)) {
        return res.status(403).json({ error: 'Not allowed to send reminders' });
      }
      const { lagging } = await remindLaggingShops({ automatic: false });

      const { data: allNotifications, error: selectError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (selectError) throw selectError;

      res.json({
        success: true,
        sentCount: lagging.length,
        unsubmittedShops: lagging.map((s: any) => s.name),
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
        supabase.from('orders').select('*').eq('order_date', almatyToday()),
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
