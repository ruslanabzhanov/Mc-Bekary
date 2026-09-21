import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ManagerView } from './components/ManagerView';
import { AdminView } from './components/AdminView';
import { TerritorialManagerView } from './components/TerritorialManagerView';
import { EmployeeView } from './components/EmployeeView';
import { OrderPreviewModal } from './components/OrderPreviewModal';
import { SubmittedOrdersModal } from './components/SubmittedOrdersModal';
import { RegistrationGate } from './components/RegistrationGate';
import { DishPollVoteScreen } from './components/DishPollVoteScreen';
import { DeadlineModal } from './components/DeadlineModal';
import { SplashScreen, wasSplashShownThisSession, markSplashShown } from './components/SplashScreen';
import { COFFEE_SHOPS, PRODUCTS, INITIAL_ORDERS, INITIAL_STAFF, INITIAL_REGISTRATION_REQUESTS } from './data/mockData';
import { INITIAL_SEMI_FINISHED, INITIAL_DISH_COSTINGS, INITIAL_RAW_MATERIALS } from './data/costingData';
import { CoffeeShop, Product, ShopOrder, DisciplineNotification, SemiFinishedProduct, DishCosting, OrderStatus, StaffMember, StaffRole, RegistrationRequest, AdvanceRequest, UserRole, RawMaterial, ChecklistAssignments, RolePermissions } from './types';

// A useState that also fires-and-forgets a POST to persist every update to the Express backend,
// so the value survives a full page reload (not just re-opening a modal within the same session).
// Returns [value, setSynced, hydrate]. `setSynced` is a real edit — it POSTs the whole new
// value back. `hydrate` only fills local state and writes nothing: use it for data that just
// came *from* the server, so opening the app never pushes a device's copy of the catalogs
// back over whatever the server now holds.
function useSyncedState<T>(initial: T, endpoint: string, bodyKey: string) {
  const [value, setValue] = useState<T>(initial);
  const setSynced: React.Dispatch<React.SetStateAction<T>> = (update) => {
    setValue((prev) => {
      const next = typeof update === 'function' ? (update as (p: T) => T)(prev) : update;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [bodyKey]: next }),
      }).catch((e) => console.error(`Failed to sync ${bodyKey} to server:`, e));
      return next;
    });
  };
  return [value, setSynced, setValue] as const;
}

// Default checklist -> product assignment, seeded from each department's matching product category
const DEPT_CATEGORY_MAP: Record<string, string> = {
  bakery: 'croissants',
  sandwiches: 'sandwiches',
  desserts: 'desserts',
  bar_prep: 'bar_prep',
  kitchen_prep: 'kitchen_prep',
  new_items: 'new_items',
};
const DEFAULT_CHECKLIST_ASSIGNMENTS: ChecklistAssignments = Object.fromEntries(
  Object.entries(DEPT_CATEGORY_MAP).map(([deptKey, category]) => [
    deptKey,
    PRODUCTS.filter((p) => p.category === category).map((p) => p.id),
  ])
);

// All 27 shops are in Kazakhstan (UTC+5, unified nationwide since 2024). This is only an
// optimistic local echo of what the server will save (see timeNow() in apiApp.ts, the
// authoritative value) — but a device whose OS timezone is misconfigured would otherwise show
// a briefly-wrong time before the next refetch, so pin it explicitly here too.
const timeNowAlmaty = () =>
  new Date().toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit', hour12: false });

// Remembers that this browser/device was last sitting in the Owner cabinet, so a page
// reload doesn't bounce the Owner back to the Manager view. Safe to persist client-side:
// Owner identity is re-verified against real Telegram initData on every load (see the
// telegram-owner effect below), which reverts this if verification doesn't confirm Owner.
const OWNER_VIEW_STORAGE_KEY = 'mc-bekary-owner-view';

// Which territorial_manager staff record this device was approved as, set once by
// grantAccess() on registration approval and never changed afterward — a territorial
// manager's device has no UI to switch to a different role or a different territorial
// identity (see Header.tsx). Deterministically `staff-from-<registrationRequestId>`,
// computed the same way in handleApproveRegistrationRequest below.
const TERRITORIAL_ID_STORAGE_KEY = 'mc-bekary-territorial-manager-id';

// How the last write to a shop's order ended, so a failure can be shown instead of logged.
type OrderSyncEntry = { status: 'sending' | 'failed'; isSubmit: boolean; retry: () => void };

// Same idea for an approved internal employee: without this the device only knew "someone
// registered here" and fell through to the shop-ordering screen, with no way to tell whose
// timesheet to show. Set once by grantAccess() and never changed.
const EMPLOYEE_ID_STORAGE_KEY = 'mc-bekary-employee-id';

// «Заведующий производством» is an internal-staff position (EMPLOYEE_POSITIONS), but the
// person holding it runs production — they get the same cabinet as Owner's "Цех" view
// (AdminView), gated by the same role_permissions matrix everyone else already has (see
// role_permissions in apiApp.ts — this was built and ready, just never reachable by anyone
// but the real Owner). Set once by grantAccess() on approval, same pattern as the two above.
const ADMIN_ID_STORAGE_KEY = 'mc-bekary-admin-id';

// Which staff record this device belongs to, whatever the role. A point can have several
// managers plus a barista; without this, a shop_manager device knew only its point and could
// not say which of those people it was — so there was no way to notify the others.
const STAFF_ID_STORAGE_KEY = 'mc-bekary-staff-id';

export default function App() {
  const [showSplash, setShowSplash] = useState(() => !wasSplashShownThisSession());

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'manager';
    if (window.localStorage.getItem(OWNER_VIEW_STORAGE_KEY) === '1') return 'owner';
    if (window.localStorage.getItem(ADMIN_ID_STORAGE_KEY)) return 'admin';
    if (window.localStorage.getItem(TERRITORIAL_ID_STORAGE_KEY)) return 'territorial';
    if (window.localStorage.getItem(EMPLOYEE_ID_STORAGE_KEY)) return 'employee';
    return 'manager';
  });
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_ID_STORAGE_KEY) : null
  );
  const [currentTerritorialManagerId, setCurrentTerritorialManagerId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(TERRITORIAL_ID_STORAGE_KEY) : null
  );
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(EMPLOYEE_ID_STORAGE_KEY) : null
  );
  // Which employee's cabinet the Owner is previewing. Only ever set from the Owner's own
  // header switch — a real employee device uses currentEmployeeId above instead.
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | null>(null);
  // То же для кабинета территориального: чей именно участок смотрит Владелец.
  const [previewTerritorialId, setPreviewTerritorialId] = useState<string | null>(null);
  const SHOP_ID_STORAGE_KEY = 'mc-bekary-selected-shop-id';
  const [selectedShopId, setSelectedShopIdRaw] = useState<number>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(SHOP_ID_STORAGE_KEY) : null;
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : 1;
  });
  // Persists which shop this device/manager represents, so it survives a reload —
  // stopgap until real per-user Telegram identity exists (see CLAUDE.md known issues).
  const setSelectedShopId = (shopId: number) => {
    window.localStorage.setItem(SHOP_ID_STORAGE_KEY, String(shopId));
    setSelectedShopIdRaw(shopId);
  };

  // Whether this device has ever established access — either by picking a shop, or by
  // having a registration request approved with no shop attached (territorial/employee).
  // A device with neither is "new" and must register first — see the RegistrationGate
  // render below. Existing devices (already had a shop picked before this feature shipped)
  // are grandfathered in automatically, since SHOP_ID_STORAGE_KEY was already set for them.
  const REGISTERED_STORAGE_KEY = 'mc-bekary-registered';
  const [hasAccess, setHasAccess] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return (
      !!window.localStorage.getItem(SHOP_ID_STORAGE_KEY) ||
      !!window.localStorage.getItem(REGISTERED_STORAGE_KEY)
    );
  });
  // Who this device turned out to be. Normally read off the approved request; if that row was
  // lost, off the staff record the approval created — which is the durable record of the two.
  const grantAccess = (identity: {
    requestId: string;
    role: StaffRole;
    shopId: number | null;
    assignedShopIds?: number[];
    position?: string;
  }) => {
    // Same deterministic id handleApproveRegistrationRequest gives the new staff record.
    const staffId = `staff-from-${identity.requestId}`;
    window.localStorage.setItem(STAFF_ID_STORAGE_KEY, staffId);
    if (identity.role === 'shop_manager') {
      if (identity.shopId != null) setSelectedShopId(identity.shopId);
    } else if (identity.role === 'territorial_manager') {
      // Lets this device identify (and stay locked to) exactly that territorial manager.
      window.localStorage.setItem(TERRITORIAL_ID_STORAGE_KEY, staffId);
      window.localStorage.setItem(REGISTERED_STORAGE_KEY, '1');
      setCurrentTerritorialManagerId(staffId);
      setCurrentRole('territorial');
    } else if (identity.position === 'Заведующий производством') {
      // Same "Управляющий производством" cabinet Owner's own "Цех" view opens — gated by the
      // role_permissions matrix Owner sets in "Роли и права", same as it already would be for
      // this position if it were ever reachable.
      window.localStorage.setItem(ADMIN_ID_STORAGE_KEY, staffId);
      window.localStorage.setItem(REGISTERED_STORAGE_KEY, '1');
      setCurrentAdminId(staffId);
      setCurrentRole('admin');
    } else {
      // Internal employee — same deterministic id, so this device can find its own timesheet.
      window.localStorage.setItem(EMPLOYEE_ID_STORAGE_KEY, staffId);
      window.localStorage.setItem(REGISTERED_STORAGE_KEY, '1');
      setCurrentEmployeeId(staffId);
      setCurrentRole('employee');
    }
    setHasAccess(true);
    showToast('✅ Заявка одобрена! Добро пожаловать.');
  };
  const [shops, setShops, hydrateShops] = useSyncedState<CoffeeShop[]>(COFFEE_SHOPS, '/api/shops', 'shops');
  const [products, setProducts, hydrateProducts] = useSyncedState<Product[]>(PRODUCTS, '/api/products', 'products');
  const [orders, setOrders] = useState<Record<number, ShopOrder>>(INITIAL_ORDERS);
  const [notifications, setNotifications] = useState<DisciplineNotification[]>([]);
  const [semiFinishedList, setSemiFinishedList, hydrateSemiFinishedList] = useSyncedState<SemiFinishedProduct[]>(
    INITIAL_SEMI_FINISHED,
    '/api/semi-finished',
    'semiFinishedList'
  );
  const [dishCostings, setDishCostings, hydrateDishCostings] = useSyncedState<Record<string, DishCosting>>(
    INITIAL_DISH_COSTINGS,
    '/api/dish-costings',
    'dishCostings'
  );
  const [rawMaterials, setRawMaterials, hydrateRawMaterials] = useSyncedState<RawMaterial[]>(
    INITIAL_RAW_MATERIALS,
    '/api/raw-materials',
    'rawMaterials'
  );
  const [rawCategoryDefs, setRawCategoryDefs, hydrateRawCategoryDefs] = useSyncedState<{ key: string; label: string }[]>(
    [
      { key: 'meat', label: 'Мясо и птица' },
      { key: 'fish', label: 'Рыба и морепродукты' },
      { key: 'veg', label: 'Овощи и зелень' },
      { key: 'sauce', label: 'Соусы и бакалея' },
      { key: 'bakery', label: 'Крупы и мука' },
      { key: 'dairy', label: 'Молочные продукты и яйцо' },
      { key: 'packaging', label: 'Упаковка и расходники' }
    ],
    '/api/raw-category-defs',
    'rawCategoryDefs'
  );
  const [semiCategoryDefs, setSemiCategoryDefs, hydrateSemiCategoryDefs] = useSyncedState<{ key: string; label: string }[]>(
    [
      { key: 'prep_veg', label: 'Нарезка и овощи' },
      { key: 'prep_meat', label: 'Мясо и птица' },
      { key: 'prep_sauce', label: 'Соусы и заправки' },
      { key: 'prep_bakery', label: 'Тесто и коржи' },
      { key: 'prep_grain', label: 'Крупы и заготовки' }
    ],
    '/api/semi-category-defs',
    'semiCategoryDefs'
  );
  const [dishCategoryDefs, setDishCategoryDefs, hydrateDishCategoryDefs] = useSyncedState<{ key: string; label: string }[]>(
    [
      { key: 'croissants', label: 'Круассаны и слойки' },
      { key: 'sandwiches', label: 'Сэндвичи и завтраки' },
      { key: 'desserts', label: 'Десерты' },
      { key: 'bar_prep', label: 'Заготовки бара' },
      { key: 'kitchen_prep', label: 'Заготовки кухня' },
      { key: 'new_items', label: 'Новинки' }
    ],
    '/api/dish-category-defs',
    'dishCategoryDefs'
  );
  const [checklistAssignments, setChecklistAssignments, hydrateChecklistAssignments] = useSyncedState<ChecklistAssignments>(
    DEFAULT_CHECKLIST_ASSIGNMENTS,
    '/api/checklist-assignments',
    'checklistAssignments'
  );
  // Deliberately plain state, unlike the catalogs above: these two are written from many
  // devices at once during hiring, and a setter that posts the whole array would have each
  // phone overwrite the table with the list it loaded on open, deleting everyone who
  // registered since. Every change below writes its own row through a dedicated endpoint.
  const [staff, hydrateStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [registrationRequests, hydrateRegistrationRequests] =
    useState<RegistrationRequest[]>(INITIAL_REGISTRATION_REQUESTS);
  const [advanceRequests, hydrateAdvanceRequests] = useState<AdvanceRequest[]>([]);
  // До скольки точки подают заявку. Меняют владелец и заведующий производством.
  const [orderDeadline, setOrderDeadline] = useState('10:30');
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [serverDataLoaded, setServerDataLoaded] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSubmittedModalOpen, setIsSubmittedModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fixed behavior before the role-permissions feature existed — same defaults the
  // server falls back to when a role has no saved row yet (see apiApp.ts).
  const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
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
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  // Raw Telegram initData string, kept only to re-send with the one owner-only write
  // (role permissions) so the server can verify it again — never trust a client flag.
  const [telegramInitData, setTelegramInitData] = useState<string>('');
  const [isOwnerVerified, setIsOwnerVerified] = useState(false);

// Fetches the full server state and hydrates every top-level state slice. Extracted so
  // the mandatory registration gate can re-run it on demand ("Проверить статус" button)
  // instead of only ever loading once on mount.
  const refreshInitialData = () => {
    fetch('/api/initial-data')
      .then((res) => res.json())
      .then((data) => {
        // Hydrate only — never the syncing setters. This data just arrived *from* the server;
        // echoing it straight back made every device rewrite all eleven catalogs on every
        // open, which is both pointless traffic and a real way for one device's stale copy to
        // land on top of an edit someone else had just saved.
        if (data.shops) hydrateShops(data.shops);
        if (data.products) hydrateProducts(data.products);
        if (data.orders) setOrders(data.orders);
        if (data.notifications) setNotifications(data.notifications);
        if (data.rawMaterials) hydrateRawMaterials(data.rawMaterials);
        if (data.rawCategoryDefs) hydrateRawCategoryDefs(data.rawCategoryDefs);
        if (data.semiCategoryDefs) hydrateSemiCategoryDefs(data.semiCategoryDefs);
        if (data.dishCategoryDefs) hydrateDishCategoryDefs(data.dishCategoryDefs);
        if (data.semiFinishedList) hydrateSemiFinishedList(data.semiFinishedList);
        if (data.dishCostings) hydrateDishCostings(data.dishCostings);
        if (data.checklistAssignments) hydrateChecklistAssignments(data.checklistAssignments);
        if (data.rolePermissions) setRolePermissions(data.rolePermissions);
        if (data.staff) hydrateStaff(data.staff);
        if (data.registrationRequests) hydrateRegistrationRequests(data.registrationRequests);
        if (data.advanceRequests) hydrateAdvanceRequests(data.advanceRequests);
        if (data.orderDeadline) setOrderDeadline(data.orderDeadline);
        // Only now is what we hold the server's answer rather than the bundled demo rows —
        // the registration gate must not judge a missing request until this is true.
        setServerDataLoaded(true);
      })
      .catch((err) => {
        console.log('Using local fallback state:', err);
      });
  };

  // Fetch initial state from server on startup
  useEffect(() => {
    refreshInitialData();
  }, []);

  // Poll this device's own order status while a manager has the app open — otherwise an
  // accept/reject decision only ever reaches this device on its next full reload. The Telegram
  // push (see submittedByTelegramId server-side) covers "app is closed"; this covers "app is
  // open" without needing a full /api/initial-data refetch every time.
  useEffect(() => {
    if (currentRole !== 'manager') return;
    let lastStatus: string | undefined = orders[selectedShopId]?.status;
    const POLL_MS = 20000;
    const interval = setInterval(() => {
      fetch(`/api/orders/${selectedShopId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.order) return;
          if (lastStatus && lastStatus !== data.order.status) {
            if (data.order.status === 'accepted') {
              showToast(`✅ Заявка для Точки №${selectedShopId} принята Управляющим!`);
            } else if (data.order.status === 'rejected') {
              showToast(`🔴 Заявка для Точки №${selectedShopId} отклонена Управляющим`);
            }
          }
          lastStatus = data.order.status;
          setOrders((prev) => ({ ...prev, [selectedShopId]: data.order }));
        })
        .catch((e) => console.error('Failed to poll order status:', e));
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, selectedShopId]);

  // Persist which cabinet the Owner is sitting in, so a reload restores it (see
  // OWNER_VIEW_STORAGE_KEY above). Only ever remembers 'owner' — every other role still
  // starts back at the Manager view on reload, same as before.
  useEffect(() => {
    // Владелец может смотреть любой из четырёх экранов — это по-прежнему «здесь Владелец».
    // Снимать признак на время просмотра нельзя: после перезагрузки его выкинуло бы из
    // режима Владельца просто за то, что он заглянул в чужой кабинет.
    const ownerIsHere = currentRole === 'owner' || !!isOwnerVerified;
    if (ownerIsHere) {
      window.localStorage.setItem(OWNER_VIEW_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(OWNER_VIEW_STORAGE_KEY);
    }
  }, [currentRole, isOwnerVerified]);

  // When opened inside Telegram as a Mini App, expand to full height and signal readiness.
  // No-op in a regular browser, where window.Telegram is undefined.
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      // Tell the server where to reach this person. Registration captures it going forward;
      // this covers anyone already registered before that existed, and repairs it if someone
      // changes device. Cheap and idempotent — it just writes the same id again.
      const myStaffId = window.localStorage.getItem(STAFF_ID_STORAGE_KEY);
      const myTelegramId = tg.initDataUnsafe?.user?.id;
      if (myStaffId && myTelegramId) {
        fetch('/api/staff/telegram-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: myStaffId, telegramUserId: String(myTelegramId) }),
        }).catch((e) => console.error('Failed to link Telegram id:', e));
      }

      if (tg.initData) {
        setTelegramInitData(tg.initData);
        fetch('/api/auth/telegram-owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        })
          .then((res) => res.json())
          .then((data) => {
            const confirmedOwner = !!data.isOwner;
            setIsOwnerVerified(confirmedOwner);
            // The optimistic 'owner' restore above could be wrong (different person opened
            // the same device/bot) — fall back to Manager once real verification disagrees.
            if (!confirmedOwner) {
              setCurrentRole((role) => (role === 'owner' ? 'manager' : role));
            }
          })
          .catch((e) => console.error('Failed to verify Telegram owner:', e));
        return;
      }
    }
    // No Telegram context at all (or no initData) means ownership can never be verified
    // here — never trust a persisted 'owner' cabinet in that case.
    setCurrentRole((role) => (role === 'owner' ? 'manager' : role));
  }, []);

  // Owner-only: change what each role is allowed to do. Sends the raw initData string
  // again so the server can re-verify identity rather than trust this call's caller.
  // Новое время показываем только после ответа сервера: права проверяет он (по подписи
  // Telegram), и «сдвинули», когда на деле не сдвинулось, хуже короткого ожидания.
  const handleChangeOrderDeadline = async (deadline: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/settings/order-deadline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData, deadline }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok) return data.error || 'Не удалось сохранить время.';
      setOrderDeadline(data.orderDeadline);
      showToast(`Время приёма заявок: до ${data.orderDeadline}`);
      return null;
    } catch {
      return 'Нет связи с сервером. Проверьте интернет.';
    }
  };
  const canEditDeadline = currentRole === 'owner' || currentRole === 'admin';

  const handleUpdateRolePermissions = async (permissions: RolePermissions) => {
    setRolePermissions(permissions);
    try {
      await fetch('/api/role-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData, permissions }),
      });
    } catch (e) {
      console.error('Failed to save role permissions:', e);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Every mutation below (submit, accept/reject, delete) writes the same orders/<shopId> row.
  // Each is fire-and-forget for a snappy UI, but two of them for the same shop fired close
  // together (e.g. "Отклонить" immediately followed by "Удалить") can otherwise reach the
  // server out of order — a slower reject PATCH landing after a delete would silently
  // resurrect the row via upsert, undoing the deletion with no visible error. Chaining each
  // shop's requests onto a per-shop promise guarantees they reach the server in the same order
  // they were clicked, without blocking the optimistic local UI update at all.
  const orderRequestQueueRef = useRef<Record<number, Promise<unknown>>>({});
  const queueOrderRequest = (shopId: number, run: () => Promise<unknown>) => {
    const prev = orderRequestQueueRef.current[shopId] || Promise.resolve();
    const next = prev.then(run, run);
    orderRequestQueueRef.current[shopId] = next;
    return next;
  };

  // Draft saves are debounced per shop (see handleUpdateOrder) so a burst of taps becomes one
  // write instead of one per tap. Kept short: it is the window in which a closed app loses the
  // last change, so it trades a little safety for a lot less lag, not the other way round.
  const DRAFT_SAVE_DELAY_MS = 600;
  const draftTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pendingDraftRef = useRef<Record<number, () => void>>({});

  // Outcome of the last write per shop. Before this, a failed save was a console.error and
  // nothing else: the server's answer was never even checked, so an HTTP error read as
  // success, and the "заявка отправлена" toast fired before the request left. A manager could
  // be told their order went through when the bakery never received it.
  const [orderSync, setOrderSync] = useState<Record<number, OrderSyncEntry>>({});

  const clearOrderSync = (shopId: number) =>
    setOrderSync((prev) => {
      if (!prev[shopId]) return prev;
      const next = { ...prev };
      delete next[shopId];
      return next;
    });

  const cancelPendingDraft = (shopId: number) => {
    if (draftTimerRef.current[shopId]) {
      clearTimeout(draftTimerRef.current[shopId]);
      delete draftTimerRef.current[shopId];
    }
    delete pendingDraftRef.current[shopId];
  };

  const flushDraft = (shopId: number) => {
    if (draftTimerRef.current[shopId]) {
      clearTimeout(draftTimerRef.current[shopId]);
      delete draftTimerRef.current[shopId];
    }
    const run = pendingDraftRef.current[shopId];
    if (run) {
      delete pendingDraftRef.current[shopId];
      run();
    }
  };

  // Telegram backgrounds the Mini App the moment it is swiped away, which would otherwise
  // strand a debounced draft. Write it out the instant the page stops being visible.
  useEffect(() => {
    const flushAll = () => {
      Object.keys(pendingDraftRef.current).forEach((id) => flushDraft(Number(id)));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushAll);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushAll);
    };
  }, []);

  // Update shop order
  const handleUpdateOrder = async (
    shopId: number,
    items: Record<string, number>,
    status: 'draft' | 'submitted' = 'draft'
  ) => {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;

    // Who is actually holding this device, if it went through registration — a point can have
    // several managers (plus a barista), and picking "the" shop_manager for the point used to
    // mean whichever one happened to be first in the array, so every submission from that point
    // showed the same name regardless of who really pressed the button. Falls back to the old
    // guess only for a device that never registered (grandfathered pre-registration-gate).
    const myStaffId = window.localStorage.getItem(STAFF_ID_STORAGE_KEY);
    const myself = myStaffId ? staff.find((s) => s.id === myStaffId) : undefined;
    const shopManager = myself || staff.find((s) => s.role === 'shop_manager' && s.shopId === shopId);
    // shop.manager is a separate, admin-edited "nobody's formally assigned to this point yet"
    // field (see SalesPointsManager) — it's near-never empty ("Не назначен" is its own default),
    // so chaining it on as a submission-attribution fallback never actually triggers the honest
    // text below; it silently reused "Не назначен" instead, which reads as "nobody submitted
    // this" in a notification when someone plainly did — we just couldn't identify who.
    const managerName = shopManager?.name || 'Сотрудник точки (не определён)';

    // Captured client-side (only meaningful inside real Telegram) so an accept/reject decision
    // can be pushed back to whoever actually submitted this order — see submittedByTelegramId.
    const telegramUserId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;

    // Optimistic local update
    const timeStr = timeNowAlmaty();

    setOrders((prev) => ({
      ...prev,
      [shopId]: {
        shopId,
        items,
        status,
        submittedAt: status === 'submitted' ? timeStr : prev[shopId]?.submittedAt || timeStr,
        managerName,
        submittedByTelegramId: telegramUserId ? String(telegramUserId) : prev[shopId]?.submittedByTelegramId,
      },
    }));

    const isSubmit = status === 'submitted';
    if (isSubmit) showToast('📤 Отправляем заявку…');

    const writeOnce = async () => {
      const res = await fetch(`/api/orders/${shopId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Lets the write finish even if the page is being torn down (app closed, Telegram
        // swiped away) instead of being cancelled with the document.
        keepalive: true,
        body: JSON.stringify({
          items,
          status,
          managerName,
          submittedByTelegramId: telegramUserId ? String(telegramUserId) : undefined,
        }),
      });
      // A rejected request used to slip through as success: only a dropped connection was
      // caught, never an error the server actually answered with.
      if (!res.ok) throw new Error(`Сервер ответил ${res.status}`);
      return res;
    };

    const sendToServer = () =>
      queueOrderRequest(shopId, async () => {
        setOrderSync((prev) => ({ ...prev, [shopId]: { status: 'sending', isSubmit, retry: sendToServer } }));
        try {
          await writeOnce();
        } catch (first) {
          // One quiet retry, so a momentary blip on a shop's connection doesn't raise an alarm.
          await new Promise((r) => setTimeout(r, 2000));
          try {
            await writeOnce();
          } catch (second) {
            console.error('Failed to sync order to server:', second);
            // The optimistic state said "submitted". It isn't — put it back to a draft so the
            // screen can't claim an order was placed while the bakery has nothing.
            if (isSubmit) {
              setOrders((prev) => {
                const existing = prev[shopId];
                if (!existing || existing.status !== 'submitted') return prev;
                return { ...prev, [shopId]: { ...existing, status: 'draft' } };
              });
            }
            setOrderSync((prev) => ({ ...prev, [shopId]: { status: 'failed', isSubmit, retry: sendToServer } }));
            return;
          }
        }
        clearOrderSync(shopId);
        if (isSubmit) {
          showToast(`✅ Заявка для точки «${shop.district.trim() || shop.address}» отправлена в производство`);
        }
      });

    if (isSubmit) {
      // A submit supersedes any draft write still waiting for this shop: drop it and go now.
      cancelPendingDraft(shopId);
      await sendToServer();
      return;
    }

    // Draft saves are coalesced. Every keystroke and every "+" tap used to fire its own
    // request, and because they are queued one-after-another a burst of taps left the server
    // seconds behind the screen — measured at ~6s behind after ten taps. Anything that ended
    // the page in that window (closing the app, a reload) dropped the tail, so the manager saw
    // 10 on screen while the bakery received 3. Now the taps collapse into a single write of
    // the final value shortly after the manager stops touching it.
    pendingDraftRef.current[shopId] = sendToServer;
    if (draftTimerRef.current[shopId]) clearTimeout(draftTimerRef.current[shopId]);
    draftTimerRef.current[shopId] = setTimeout(() => flushDraft(shopId), DRAFT_SAVE_DELAY_MS);
  };

  // Admin/Manager: Update single order status (accept / reject)
  const handleUpdateOrderStatus = async (shopId: number, status: OrderStatus) => {
    const timeStr = timeNowAlmaty();

    setOrders((prev) => {
      const existing = prev[shopId] || { shopId, items: {}, status: 'draft' };
      return {
        ...prev,
        [shopId]: {
          ...existing,
          status,
          ...(status === 'accepted' ? { acceptedAt: timeStr } : {}),
        },
      };
    });

    const shop = shops.find((s) => s.id === shopId);
    const shopName = shop?.name.replace(`Кофейня №${shopId} — `, '') || `Точка №${shopId}`;

    if (status === 'accepted') {
      showToast(`🟢 Заявка точки "${shopName}" принята Управляющим!`);
    } else if (status === 'rejected') {
      showToast(`🔴 Заявка точки "${shopName}" отклонена Управляющим!`);
    }

    await queueOrderRequest(shopId, () =>
      fetch(`/api/orders/${shopId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch((e) => console.error(e))
    );
  };

  // Owner/Admin: wipe a shop's current order entirely (e.g. a stray accept/reject click with
  // nothing actually ordered) — reverts that shop to its default "never ordered" state.
  const handleDeleteOrder = async (shopId: number) => {
    setOrders((prev) => {
      const next = { ...prev };
      delete next[shopId];
      return next;
    });
    await queueOrderRequest(shopId, () =>
      fetch(`/api/orders/${shopId}`, { method: 'DELETE' }).catch((e) => console.error('Failed to delete order:', e))
    );
  };

  // Admin: Update a single product's card fields (photo, category, price, etc.)
  const handleUpdateProduct = (productId: string, updates: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updates } : p)));
  };

  // Admin: Create a brand-new dish (Product), with an empty costing record ready to fill in.
  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [...prev, newProduct]);
    setDishCostings((prev) => ({
      ...prev,
      [newProduct.id]: { productId: newProduct.id, semiFinishedItems: [], rawIngredients: [] }
    }));
  };

  // Admin: Delete a dish (Product) entirely, along with its recipe/costing record.
  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setDishCostings((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // Writes the given people and nobody else. Local state moves first so the screen stays
  // responsive; the request carries only the rows that actually changed.
  const saveStaffMembers = (members: StaffMember[]) => {
    if (members.length === 0) return;
    const byId = new Map(members.map((m) => [m.id, m]));
    hydrateStaff((prev) => {
      const updated = prev.map((s) => byId.get(s.id) || s);
      const added = members.filter((m) => !prev.some((s) => s.id === m.id));
      return [...updated, ...added];
    });
    fetch('/api/staff/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: members }),
    }).catch((e) => console.error('Failed to save staff:', e));
  };

  // Personnel: update an existing staff member's point/role
  const handleUpdateStaffMember = (staffId: string, updates: Partial<StaffMember>) => {
    const current = staff.find((s) => s.id === staffId);
    if (!current) return;
    saveStaffMembers([{ ...current, ...updates }]);
  };

  // The only way to register is the mandatory gate on a fresh device — whoever fills this form
  // out is the applicant, so capturing this device's own Telegram id here is always correct.
  // (There used to also be a "➕" header button letting an already-registered person submit a
  // request *for* someone else; it's gone — that path stamped the new hire's request, and every
  // later notification about them, with the submitter's own Telegram account instead of theirs.)
  // Returns the new request's id so the gate can track its status.
  const handleAddRegistrationRequest = (
    request: Omit<RegistrationRequest, 'id' | 'submittedAt' | 'status'>
  ) => {
    const timeStr = timeNowAlmaty();
    const telegramUserId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const newRequest: RegistrationRequest = {
      ...request,
      telegramUserId: telegramUserId ? String(telegramUserId) : request.telegramUserId,
      id: `reg-${Date.now()}`,
      submittedAt: timeStr,
      status: 'pending',
    };
    hydrateRegistrationRequests((prev) => [...prev, newRequest]);
    fetch('/api/registration-requests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: newRequest }),
    }).catch((e) => console.error('Failed to submit registration request:', e));
    return newRequest.id;
  };

  // Changes one request and notifies nobody else's row out of existence.
  const saveRegistrationRequest = (requestId: string, updates: Partial<RegistrationRequest>) => {
    hydrateRegistrationRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, ...updates } : r))
    );
    fetch(`/api/registration-requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    }).catch((e) => console.error('Failed to update registration request:', e));
  };

  // Personnel: edit a pending request's point/role before approving it
  const handleUpdateRegistrationRequest = (requestId: string, updates: Partial<RegistrationRequest>) => {
    saveRegistrationRequest(requestId, updates);
  };

  // Personnel: approve a pending request into the staff roster. Keeps the request around
  // (status flips to 'approved' rather than deleting it) so the device that submitted it
  // can poll for the outcome — see the mandatory registration gate in App.tsx's render.
  const handleApproveRegistrationRequest = (requestId: string) => {
    const request = registrationRequests.find((r) => r.id === requestId);
    if (!request) return;
    const isTerritorial = request.requestedRole === 'territorial_manager';
    const isInternal = request.requestedRole === 'employee';
    // Deterministic (not Date.now()) so an approved territorial manager's own device can
    // compute this same id independently and lock itself to it — see grantAccess().
    const newStaffMember: StaffMember = {
      id: `staff-from-${request.id}`,
      name: request.name,
      role: request.requestedRole,
      // Production staff aren't tied to a shop any more than a territorial manager is —
      // requestedShopId is just PRODUCTION_SHOP_ID (0) for them, a form placeholder, not a
      // real point.
      shopId: isTerritorial || isInternal ? null : request.requestedShopId,
      assignedShopIds: isTerritorial ? request.requestedShopIds : undefined,
      phone: request.phone,
      position: request.requestedRole === 'territorial_manager' ? undefined : request.requestedPosition,
      telegramUserId: request.telegramUserId
    };
    // The staff record is written before the status flips: it is what the applicant's device
    // falls back to if its own request row is ever lost, so it must exist first.
    saveStaffMembers([newStaffMember]);
    saveRegistrationRequest(requestId, { status: 'approved' });
  };

  // Personnel: reject a pending request (kept, not deleted — see approve above)
  const handleRejectRegistrationRequest = (requestId: string) => {
    saveRegistrationRequest(requestId, { status: 'rejected' });
  };

  // Employee: ask to be paid part of what the timesheet already shows as earned, ahead of
  // payday. One row-level write, same shape as registration requests above.
  const handleSubmitAdvanceRequest = (request: Omit<AdvanceRequest, 'id' | 'status' | 'submittedAt'>) => {
    const newRequest: AdvanceRequest = {
      ...request,
      id: `adv-${Date.now()}`,
      submittedAt: timeNowAlmaty(),
      status: 'pending',
    };
    hydrateAdvanceRequests((prev) => [newRequest, ...prev]);
    fetch('/api/advance-requests/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: newRequest }),
    }).catch((e) => console.error('Failed to submit advance request:', e));
  };

  // Personnel: approve/reject an advance request
  const handleDecideAdvanceRequest = (requestId: string, status: 'approved' | 'rejected') => {
    hydrateAdvanceRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status } : r))
    );
    fetch(`/api/advance-requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: { status } }),
    }).catch((e) => console.error('Failed to update advance request:', e));
  };

  // Personnel: manually add a new staff member (e.g. a point manager, added directly from the shop card)
  const handleAddStaffMember = (member: Omit<StaffMember, 'id'>) => {
    saveStaffMembers([{ ...member, id: `staff-${Date.now()}` }]);
  };

  // Personnel: remove a staff member entirely
  const handleDeleteStaffMember = (staffId: string) => {
    hydrateStaff((prev) => prev.filter((s) => s.id !== staffId));
    fetch(`/api/staff/${encodeURIComponent(staffId)}`, { method: 'DELETE' }).catch((e) =>
      console.error('Failed to delete staff member:', e)
    );
  };

  // Personnel: a point can only have one territorial manager — reassigning removes it from whoever had it before
  const handleAssignTerritorialManager = (shopId: number, staffId: string) => {
    // Only the manager gaining the point and whoever is losing it are rewritten.
    const touched = staff
      .filter(
        (s) =>
          s.role === 'territorial_manager' &&
          (s.id === staffId || (s.assignedShopIds || []).includes(shopId))
      )
      .map((s) => {
        const withoutShop = (s.assignedShopIds || []).filter((id) => id !== shopId);
        return s.id === staffId
          ? { ...s, assignedShopIds: [...withoutShop, shopId] }
          : { ...s, assignedShopIds: withoutShop };
      });
    saveStaffMembers(touched);
  };

  // Personnel: remove whichever territorial manager currently covers this point, without assigning a new one
  const handleUnassignTerritorialManager = (shopId: number) => {
    const touched = staff
      .filter((s) => s.role === 'territorial_manager' && (s.assignedShopIds || []).includes(shopId))
      .map((s) => ({ ...s, assignedShopIds: (s.assignedShopIds || []).filter((id) => id !== shopId) }));
    saveStaffMembers(touched);
  };

  // Sales Points: add a new point of sale
  const handleAddShop = (data: { address: string; manager: string; district: string }) => {
    const newId = Math.max(...shops.map((s) => s.id), 0) + 1;
    const baseAvg: Record<string, number> = {};
    products.forEach((p) => {
      let base = 8;
      if (p.category === 'croissants') base = 18;
      if (p.category === 'sandwiches') base = 14;
      if (p.category === 'desserts') base = 12;
      if (p.category === 'bar_prep') base = 3;
      if (p.category === 'kitchen_prep') base = 4;
      if (p.category === 'new_items') base = 10;
      baseAvg[p.id] = base;
    });

    const newShop: CoffeeShop = {
      id: newId,
      name: `Кофейня №${newId} — ${data.address}`,
      address: data.address,
      manager: data.manager,
      phone: '',
      district: data.district || 'Новая точка',
      frequentItems: [],
      historicalAvg: baseAvg
    };

    setShops((prev) => [...prev, newShop]);
    setOrders((prev) => ({
      ...prev,
      [newId]: { shopId: newId, items: {}, status: 'draft', managerName: data.manager }
    }));
  };

  // Sales Points: edit a point's name (district label) and/or address
  const handleUpdateShop = (shopId: number, updates: Partial<Pick<CoffeeShop, 'district' | 'address'>>) => {
    setShops((prev) =>
      prev.map((s) => {
        if (s.id !== shopId) return s;
        const merged = { ...s, ...updates };
        if (updates.address) {
          merged.name = `Кофейня №${shopId} — ${updates.address}`;
        }
        return merged;
      })
    );
  };

  // Admin: Accept all submitted orders
  const handleAcceptAllOrders = async () => {
    const timeStr = timeNowAlmaty();

    setOrders((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        const id = Number(key);
        if (updated[id].status === 'submitted') {
          updated[id] = {
            ...updated[id],
            status: 'accepted',
            acceptedAt: timeStr,
          };
        }
      });
      return updated;
    });

    try {
      const res = await fetch('/api/orders/accept-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData }),
      });
      if (!res.ok) {
        showToast('⚠️ Не удалось принять заявки: нет подтверждения доступа.');
        refreshInitialData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Admin: Send reminder to all unsubmitted shops
  const handleSendRemindersAll = async () => {
    try {
      const res = await fetch('/api/reminders/send-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData }),
      });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      } else if (!res.ok) {
        showToast('⚠️ Не удалось отправить напоминания: нет подтверждения доступа.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Admin: Send reminder to single shop
  const handleSendReminderSingle = (shopId: number) => {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    const timeStr = timeNowAlmaty();

    const notif: DisciplineNotification = {
      id: `notif-single-${Date.now()}`,
      shopId,
      shopName: shop.name,
      sentAt: timeStr,
      message: `🔔 Персональное напоминание: Управляющий ${shop.manager}, пожалуйста, подайте заявку для Точки №${shopId}!`,
    };

    setNotifications((prev) => [notif, ...prev]);
    showToast(`🔔 Напоминание отправлено управляющему ${shop.manager} (Кофейня №${shopId})`);
  };

  // Admin: Simulate full fill across all 27 shops
  const currentOrder = orders[selectedShopId] || {
    shopId: selectedShopId,
    items: {},
    status: 'draft',
    managerName: shops.find((s) => s.id === selectedShopId)?.manager || '',
  };

  const submittedCount = (Object.values(orders) as ShopOrder[]).filter(
    (o) => o.status === 'submitted' || o.status === 'accepted'
  ).length;

  const selectedShop = shops.find((s) => s.id === selectedShopId) || shops[0];
  const territorialManagers = staff.filter((s) => s.role === 'territorial_manager');
  // Обычное устройство закреплено за своим управляющим; Владелец, который смотрит этот
  // кабинет со стороны, выбирает, чей участок открыть.
  const currentTerritorialManager =
    staff.find((s) => s.id === (previewTerritorialId || currentTerritorialManagerId)) ||
    (isOwnerVerified && !currentTerritorialManagerId ? territorialManagers[0] || null : null);

  // The failed write to shout about. A submit outranks a draft, and this device's own point
  // outranks another one, so the banner names the thing most likely to matter right now.
  const failedOrderSync = (() => {
    const failures = (Object.entries(orderSync) as [string, OrderSyncEntry][])
      .filter(([, s]) => s.status === 'failed')
      .map(([id, sync]) => ({ shopId: Number(id), sync }));
    if (failures.length === 0) return null;
    const best =
      failures.find((f) => f.sync.isSubmit && f.shopId === selectedShopId) ||
      failures.find((f) => f.sync.isSubmit) ||
      failures.find((f) => f.shopId === selectedShopId) ||
      failures[0];
    const shop = shops.find((s) => s.id === best.shopId);
    return {
      sync: best.sync,
      // Naming the point only matters when it isn't the one already on screen.
      shopLabel:
        best.shopId === selectedShopId ? '' : shop ? shop.district.trim() || shop.address : `Точка №${best.shopId}`,
    };
  })();

  // Internal shop-floor staff — the only people the timesheet covers.
  const employees = staff.filter((s) => s.role === 'employee');
  // Whose cabinet the employee screen shows: the Owner's chosen preview, otherwise this
  // device's own employee record.
  const viewedEmployee =
    employees.find((s) => s.id === (previewEmployeeId || currentEmployeeId)) ||
    (previewEmployeeId ? null : employees.find((s) => s.id === currentEmployeeId) || null) ||
    (isOwnerVerified ? employees[0] || null : null);

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    if (role !== 'territorial') setCurrentTerritorialManagerId(null);
    // Ушли из чужого кабинета — не держим указатель на конкретного человека.
    if (role !== 'employee') setPreviewEmployeeId(null);
    if (role !== 'territorial') setPreviewTerritorialId(null);
  };

  // Устройство привязано к территориальному/внутреннему сотруднику, которого больше нет в
  // персонале (например, управляющий удалил дубль или понизил роль через «Персонал»). Без
  // этого экран остаётся пустым и нерабочим — человек не поймёт, что делать. Откатываем на
  // обычный экран заказа, как у только что одобренного менеджера; проверяем только после
  // того, как реальные данные точно пришли с сервера, а не по демо-заглушке при старте.
  useEffect(() => {
    if (!serverDataLoaded) return;
    if (currentRole === 'territorial' && currentTerritorialManagerId && !staff.some((s) => s.id === currentTerritorialManagerId)) {
      window.localStorage.removeItem(TERRITORIAL_ID_STORAGE_KEY);
      setCurrentTerritorialManagerId(null);
      setCurrentRole('manager');
    }
    if (currentRole === 'employee' && currentEmployeeId && !staff.some((s) => s.id === currentEmployeeId)) {
      window.localStorage.removeItem(EMPLOYEE_ID_STORAGE_KEY);
      setCurrentEmployeeId(null);
      setCurrentRole('manager');
    }
    if (currentRole === 'admin' && currentAdminId && !staff.some((s) => s.id === currentAdminId)) {
      window.localStorage.removeItem(ADMIN_ID_STORAGE_KEY);
      setCurrentAdminId(null);
      setCurrentRole('manager');
    }
  }, [serverDataLoaded, staff, currentRole, currentTerritorialManagerId, currentEmployeeId, currentAdminId]);

  // A registered device's role can change after the fact — Владелец edits someone's role or
  // position in «Персонал», or (as actually happened) a request was approved with a role and a
  // position that didn't agree with each other in the first place (shop_manager assigned a shop,
  // labelled "Заведующий производством" — grantAccess only ever runs once, at approval, so
  // fixing the staff record alone doesn't move that person's own device to the right cabinet.
  // This re-derives which cabinet the device's own staff record calls for, every time fresh
  // staff data arrives, and switches to it if that differs from what's currently showing —
  // the same precedence grantAccess uses, so a shop_manager row always wins the point screen
  // regardless of what position label happens to be attached to it.
  useEffect(() => {
    if (!serverDataLoaded) return;
    const myStaffId = window.localStorage.getItem(STAFF_ID_STORAGE_KEY);
    if (!myStaffId) return;
    const me = staff.find((s) => s.id === myStaffId);
    if (!me) return; // handled by the effect above instead

    const shouldBe: UserRole =
      me.role === 'shop_manager' ? 'manager' :
      me.role === 'territorial_manager' ? 'territorial' :
      me.position === 'Заведующий производством' ? 'admin' :
      'employee';

    if (currentRole === shouldBe) return;
    // Only ever resync a device sitting in one of its own four locked-in roles — never touch
    // an Owner's session (real Owner identity, not a stored role) or a mid-preview state.
    if (!(['manager', 'territorial', 'employee', 'admin'] as UserRole[]).includes(currentRole)) return;

    window.localStorage.removeItem(TERRITORIAL_ID_STORAGE_KEY);
    window.localStorage.removeItem(EMPLOYEE_ID_STORAGE_KEY);
    window.localStorage.removeItem(ADMIN_ID_STORAGE_KEY);
    if (shouldBe === 'territorial') {
      window.localStorage.setItem(TERRITORIAL_ID_STORAGE_KEY, myStaffId);
      setCurrentTerritorialManagerId(myStaffId);
    } else if (shouldBe === 'employee') {
      window.localStorage.setItem(EMPLOYEE_ID_STORAGE_KEY, myStaffId);
      setCurrentEmployeeId(myStaffId);
    } else if (shouldBe === 'admin') {
      window.localStorage.setItem(ADMIN_ID_STORAGE_KEY, myStaffId);
      setCurrentAdminId(myStaffId);
    } else if (me.shopId != null) {
      setSelectedShopId(me.shopId);
    }
    window.localStorage.setItem(REGISTERED_STORAGE_KEY, '1');
    setCurrentRole(shouldBe);
    showToast('Ваш доступ обновлён управляющим — открыт новый экран.');
  }, [serverDataLoaded, staff, currentRole]);

  // Reached via a Telegram deep link (t.me/<bot>?startapp=vote_<id>) — or a bare ?vote=
  // query param, for testing outside Telegram — an anonymous dish-tasting vote, entirely
  // separate from everything else in this file: no registration gate, no role, no header.
  // Checked last, after every hook above has already run unconditionally.
  const voteTg = (window as any).Telegram?.WebApp;
  const voteStartParam = voteTg?.initDataUnsafe?.start_param as string | undefined;
  const voteQueryParam = new URLSearchParams(window.location.search).get('vote');
  const votePollId = voteStartParam?.startsWith('vote_') ? voteStartParam.slice(5) : voteQueryParam;
  if (votePollId) {
    return <DishPollVoteScreen pollId={votePollId} />;
  }

  return (
    <>
      {showSplash && (
        <SplashScreen
          onDone={() => {
            markSplashShown();
            setShowSplash(false);
          }}
        />
      )}
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      <div>
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-xl flex items-center space-x-2 animate-bounce border border-indigo-500">
            <span className="text-xs uppercase tracking-wide">{toastMessage}</span>
          </div>
        )}

        {/* A failed write has to stay on screen until it is dealt with — a toast that fades
            after three seconds is exactly how an unsent order goes unnoticed. */}
        {failedOrderSync && (
          // Above the header, not beside it: both stick to the top, and an order that never
          // reached the bakery outranks the logo for that strip of screen.
          <div className="sticky top-0 z-50 bg-rose-600 text-white px-4 py-3 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-tight">
                  {failedOrderSync.sync.isSubmit ? 'Заявка не отправлена' : 'Заявка не сохранилась'}
                </p>
                <p className="text-xs text-rose-100 mt-0.5">
                  {failedOrderSync.shopLabel ? `${failedOrderSync.shopLabel}. ` : ''}
                  Нет связи с сервером. Всё, что вы набрали, на месте — попробуйте ещё раз.
                </p>
              </div>
              <button
                onClick={() => failedOrderSync.sync.retry()}
                className="shrink-0 min-h-[44px] px-4 rounded-xl bg-white text-rose-700 text-xs font-black uppercase tracking-wider hover:bg-rose-50 active:bg-rose-100 transition-colors"
              >
                Повторить
              </button>
            </div>
          </div>
        )}

        {/* Main Header */}
        <Header
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          submittedCount={submittedCount}
          totalShops={27}
          selectedShopName={selectedShop?.name}
          onOpenSubmittedOrdersModal={() => setIsSubmittedModalOpen(true)}
          currentTerritorialManagerName={currentTerritorialManager?.name}
          isOwnerVerified={isOwnerVerified}
          orderDeadline={orderDeadline}
          onEditDeadline={canEditDeadline ? () => setIsDeadlineModalOpen(true) : undefined}
        />
        <DeadlineModal
          isOpen={isDeadlineModalOpen && canEditDeadline}
          currentDeadline={orderDeadline}
          onClose={() => setIsDeadlineModalOpen(false)}
          onSave={handleChangeOrderDeadline}
        />

        {/* Workspace Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentRole === 'manager' && !hasAccess && !isOwnerVerified ? (
            <RegistrationGate
              shops={shops}
              staff={staff}
              serverDataLoaded={serverDataLoaded}
              registrationRequests={registrationRequests}
              onSubmit={handleAddRegistrationRequest}
              onApproved={grantAccess}
              onRefresh={refreshInitialData}
            />
          ) : currentRole === 'manager' ? (
            <ManagerView
              orderDeadline={orderDeadline}
              coffeeShops={shops}
              products={products}
              selectedShopId={selectedShopId}
              currentOrder={currentOrder}
              onUpdateOrder={handleUpdateOrder}
              onOpenPreview={() => setIsPreviewOpen(true)}
              notifications={notifications}
              // Выбор точки — только Владельцу, который смотрит этот экран со стороны.
              // У настоящего менеджера точка закреплена при одобрении регистрации, менять
              // её с устройства нельзя (см. CLAUDE.md, «Shop selection»).
              onSelectShop={isOwnerVerified ? setSelectedShopIdRaw : undefined}
            />
          ) : currentRole === 'employee' ? (
            <EmployeeView
              employee={viewedEmployee}
              // Only the Owner previewing someone else's cabinet gets the picker; a real
              // employee device sees exactly one person's timesheet — their own.
              allEmployees={isOwnerVerified ? employees : undefined}
              onPickEmployee={isOwnerVerified ? setPreviewEmployeeId : undefined}
              advanceRequests={advanceRequests}
              onSubmitAdvanceRequest={handleSubmitAdvanceRequest}
            />
          ) : currentRole === 'admin' || currentRole === 'owner' ? (
            <AdminView
              telegramInitData={telegramInitData}
              orderDeadline={orderDeadline}
              onEditDeadline={() => setIsDeadlineModalOpen(true)}
              isOwner={currentRole === 'owner'}
              // Who's actually at the keyboard right now — attributed on the timesheet's
              // change log, since neither role is server-verified enough to log anything
              // stronger than "whichever name this device is currently showing".
              actorName={
                currentRole === 'owner'
                  ? 'Владелец'
                  : staff.find((s) => s.id === currentAdminId)?.name || 'Управляющий производством'
              }
              permissions={rolePermissions}
              onUpdateRolePermissions={handleUpdateRolePermissions}
              shops={shops}
              products={products}
              orders={orders}
              semiFinishedList={semiFinishedList}
              dishCostings={dishCostings}
              onUpdateSemiFinished={setSemiFinishedList}
              onUpdateDishCostings={setDishCostings}
              onUpdateProduct={handleUpdateProduct}
              onAddProduct={handleAddProduct}
              onDeleteProduct={handleDeleteProduct}
              rawMaterials={rawMaterials}
              setRawMaterials={setRawMaterials}
              rawCategoryDefs={rawCategoryDefs}
              setRawCategoryDefs={setRawCategoryDefs}
              semiCategoryDefs={semiCategoryDefs}
              setSemiCategoryDefs={setSemiCategoryDefs}
              dishCategoryDefs={dishCategoryDefs}
              setDishCategoryDefs={setDishCategoryDefs}
              checklistAssignments={checklistAssignments}
              onUpdateChecklistAssignments={setChecklistAssignments}
              staff={staff}
              registrationRequests={registrationRequests}
              advanceRequests={advanceRequests}
              onUpdateStaffMember={handleUpdateStaffMember}
              onUpdateRegistrationRequest={handleUpdateRegistrationRequest}
              onApproveRegistrationRequest={handleApproveRegistrationRequest}
              onRejectRegistrationRequest={handleRejectRegistrationRequest}
              onDecideAdvanceRequest={handleDecideAdvanceRequest}
              onAddShop={handleAddShop}
              onUpdateShop={handleUpdateShop}
              onAddStaffMember={handleAddStaffMember}
              onDeleteStaffMember={handleDeleteStaffMember}
              onAssignTerritorialManager={handleAssignTerritorialManager}
              onUnassignTerritorialManager={handleUnassignTerritorialManager}
              onAcceptAllOrders={handleAcceptAllOrders}
              onSendRemindersAll={handleSendRemindersAll}
              onOpenSubmittedOrdersModal={() => setIsSubmittedModalOpen(true)}
            />
          ) : (
            <TerritorialManagerView
              orderDeadline={orderDeadline}
              managerName={currentTerritorialManager?.name || 'Территориальный управляющий'}
              shops={shops.filter((s) => currentTerritorialManager?.assignedShopIds?.includes(s.id))}
              orders={orders}
              products={products}
              staff={staff}
              onUpdateOrder={handleUpdateOrder}
              // Выбор участка — только когда кабинет смотрит Владелец со стороны.
              allManagers={isOwnerVerified ? territorialManagers : undefined}
              selectedManagerId={currentTerritorialManager?.id}
              onPickManager={isOwnerVerified ? setPreviewTerritorialId : undefined}
              onUpdateStaffMember={handleUpdateStaffMember}
              onDeleteStaffMember={handleDeleteStaffMember}
            />
          )}
        </main>
      </div>

      {/* Order Preview Modal */}
      <OrderPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        shop={selectedShop}
        products={products}
        order={currentOrder}
        onSubmit={() => handleUpdateOrder(selectedShopId, currentOrder.items, 'submitted')}
      />

      {/* Submitted Orders List & Approval Modal */}
      <SubmittedOrdersModal
        isOpen={isSubmittedModalOpen}
        onClose={() => setIsSubmittedModalOpen(false)}
        shops={shops}
        orders={orders}
        products={products}
        currentRole={currentRole}
        permissions={rolePermissions}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onDeleteOrder={handleDeleteOrder}
      />

      {/* Bottom Status Bar. The old three-column "AI Engine / Anomaly Detection" strip wrapped
          and clipped on a phone; only the copyright line is worth the space there. */}
      <footer className="bg-indigo-950 flex items-center justify-center px-4 py-2.5 text-[10px] font-bold text-indigo-200 uppercase tracking-widest border-t border-indigo-900">
        <span className="hidden sm:flex items-center gap-1.5 mr-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          AI Engine: Active
        </span>
        <span className="text-center">© 2026 Master Bakery</span>
        <span className="hidden sm:block ml-auto">Anomaly Detection: Scan complete</span>
      </footer>

    </div>
    </>
  );
}
