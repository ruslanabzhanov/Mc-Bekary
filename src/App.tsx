import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ManagerView } from './components/ManagerView';
import { AdminView } from './components/AdminView';
import { TerritorialManagerView } from './components/TerritorialManagerView';
import { OrderPreviewModal } from './components/OrderPreviewModal';
import { SubmittedOrdersModal } from './components/SubmittedOrdersModal';
import { COFFEE_SHOPS, PRODUCTS, INITIAL_ORDERS, INITIAL_STAFF, INITIAL_REGISTRATION_REQUESTS } from './data/mockData';
import { INITIAL_SEMI_FINISHED, INITIAL_DISH_COSTINGS, INITIAL_RAW_MATERIALS } from './data/costingData';
import { CoffeeShop, Product, ShopOrder, DisciplineNotification, SemiFinishedProduct, DishCosting, OrderStatus, StaffMember, RegistrationRequest, UserRole, RawMaterial, ChecklistAssignments, RolePermissions } from './types';

// A useState that also fires-and-forgets a POST to persist every update to the Express backend,
// so the value survives a full page reload (not just re-opening a modal within the same session).
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
  return [value, setSynced] as const;
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

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('manager');
  const [currentTerritorialManagerId, setCurrentTerritorialManagerId] = useState<string | null>(null);
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
  const [shops, setShops] = useSyncedState<CoffeeShop[]>(COFFEE_SHOPS, '/api/shops', 'shops');
  const [products, setProducts] = useSyncedState<Product[]>(PRODUCTS, '/api/products', 'products');
  const [orders, setOrders] = useState<Record<number, ShopOrder>>(INITIAL_ORDERS);
  const [notifications, setNotifications] = useState<DisciplineNotification[]>([]);
  const [semiFinishedList, setSemiFinishedList] = useSyncedState<SemiFinishedProduct[]>(
    INITIAL_SEMI_FINISHED,
    '/api/semi-finished',
    'semiFinishedList'
  );
  const [dishCostings, setDishCostings] = useSyncedState<Record<string, DishCosting>>(
    INITIAL_DISH_COSTINGS,
    '/api/dish-costings',
    'dishCostings'
  );
  const [rawMaterials, setRawMaterials] = useSyncedState<RawMaterial[]>(
    INITIAL_RAW_MATERIALS,
    '/api/raw-materials',
    'rawMaterials'
  );
  const [rawCategoryDefs, setRawCategoryDefs] = useSyncedState<{ key: string; label: string }[]>(
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
  const [checklistAssignments, setChecklistAssignments] = useSyncedState<ChecklistAssignments>(
    DEFAULT_CHECKLIST_ASSIGNMENTS,
    '/api/checklist-assignments',
    'checklistAssignments'
  );
  const [staff, setStaff] = useSyncedState<StaffMember[]>(INITIAL_STAFF, '/api/staff', 'staff');
  const [registrationRequests, setRegistrationRequests] = useSyncedState<RegistrationRequest[]>(
    INITIAL_REGISTRATION_REQUESTS,
    '/api/registration-requests',
    'registrationRequests'
  );
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

  // Fetch initial state from server on startup
  useEffect(() => {
    fetch('/api/initial-data')
      .then((res) => res.json())
      .then((data) => {
        if (data.shops) setShops(data.shops);
        if (data.products) setProducts(data.products);
        if (data.orders) setOrders(data.orders);
        if (data.notifications) setNotifications(data.notifications);
        if (data.rawMaterials) setRawMaterials(data.rawMaterials);
        if (data.rawCategoryDefs) setRawCategoryDefs(data.rawCategoryDefs);
        if (data.semiFinishedList) setSemiFinishedList(data.semiFinishedList);
        if (data.dishCostings) setDishCostings(data.dishCostings);
        if (data.checklistAssignments) setChecklistAssignments(data.checklistAssignments);
        if (data.rolePermissions) setRolePermissions(data.rolePermissions);
        if (data.staff) setStaff(data.staff);
        if (data.registrationRequests) setRegistrationRequests(data.registrationRequests);
      })
      .catch((err) => {
        console.log('Using local fallback state:', err);
      });
  }, []);

  // When opened inside Telegram as a Mini App, expand to full height and signal readiness.
  // No-op in a regular browser, where window.Telegram is undefined.
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.initData) {
        setTelegramInitData(tg.initData);
        fetch('/api/auth/telegram-owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        })
          .then((res) => res.json())
          .then((data) => setIsOwnerVerified(!!data.isOwner))
          .catch((e) => console.error('Failed to verify Telegram owner:', e));
      }
    }
  }, []);

  // Owner-only: change what each role is allowed to do. Sends the raw initData string
  // again so the server can re-verify identity rather than trust this call's caller.
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

  // Update shop order
  const handleUpdateOrder = async (
    shopId: number,
    items: Record<string, number>,
    status: 'draft' | 'submitted' = 'draft'
  ) => {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;

    // Optimistic local update
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setOrders((prev) => ({
      ...prev,
      [shopId]: {
        shopId,
        items,
        status,
        submittedAt: status === 'submitted' ? timeStr : prev[shopId]?.submittedAt || timeStr,
        managerName: shop.manager,
      },
    }));

    if (status === 'submitted') {
      showToast(`✅ Заявка для Кофейни №${shopId} (${shop.name}) успешно отправлена в производство!`);
    }

    // Persist to Express backend
    try {
      await fetch(`/api/orders/${shopId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          status,
          managerName: shop.manager,
        }),
      });
    } catch (e) {
      console.error('Failed to sync order to server:', e);
    }
  };

  // Admin/Manager: Update single order status (accept / reject)
  const handleUpdateOrderStatus = async (shopId: number, status: OrderStatus) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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

    try {
      await fetch(`/api/orders/${shopId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Admin: Update a single product's card fields (photo, category, price, etc.)
  const handleUpdateProduct = (productId: string, updates: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updates } : p)));
  };

  // Personnel: update an existing staff member's point/role
  const handleUpdateStaffMember = (staffId: string, updates: Partial<StaffMember>) => {
    setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, ...updates } : s)));
  };

  // Personnel: anyone can submit a registration request specifying their point and desired role
  const handleAddRegistrationRequest = (request: Omit<RegistrationRequest, 'id' | 'submittedAt'>) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newRequest: RegistrationRequest = {
      ...request,
      id: `reg-${Date.now()}`,
      submittedAt: timeStr
    };
    setRegistrationRequests((prev) => [...prev, newRequest]);
  };

  // Personnel: edit a pending request's point/role before approving it
  const handleUpdateRegistrationRequest = (requestId: string, updates: Partial<RegistrationRequest>) => {
    setRegistrationRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, ...updates } : r)));
  };

  // Personnel: approve a pending request into the staff roster
  const handleApproveRegistrationRequest = (requestId: string) => {
    const request = registrationRequests.find((r) => r.id === requestId);
    if (!request) return;
    const newStaffMember: StaffMember = {
      id: `staff-${Date.now()}`,
      name: request.name,
      role: request.requestedRole,
      shopId: request.requestedShopId,
      phone: request.phone
    };
    setStaff((prev) => [...prev, newStaffMember]);
    setRegistrationRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  // Personnel: reject/dismiss a pending request
  const handleRejectRegistrationRequest = (requestId: string) => {
    setRegistrationRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  // Personnel: manually add a new staff member (e.g. a point manager, added directly from the shop card)
  const handleAddStaffMember = (member: Omit<StaffMember, 'id'>) => {
    const newMember: StaffMember = { ...member, id: `staff-${Date.now()}` };
    setStaff((prev) => [...prev, newMember]);
  };

  // Personnel: remove a staff member entirely
  const handleDeleteStaffMember = (staffId: string) => {
    setStaff((prev) => prev.filter((s) => s.id !== staffId));
  };

  // Personnel: a point can only have one territorial manager — reassigning removes it from whoever had it before
  const handleAssignTerritorialManager = (shopId: number, staffId: string) => {
    setStaff((prev) =>
      prev.map((s) => {
        if (s.role !== 'territorial_manager') return s;
        const withoutShop = (s.assignedShopIds || []).filter((id) => id !== shopId);
        if (s.id === staffId) {
          return { ...s, assignedShopIds: [...withoutShop, shopId] };
        }
        return { ...s, assignedShopIds: withoutShop };
      })
    );
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
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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
      await fetch('/api/orders/accept-all', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  // Admin: Send reminder to all unsubmitted shops
  const handleSendRemindersAll = async () => {
    try {
      const res = await fetch('/api/reminders/send-all', { method: 'POST' });
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Admin: Send reminder to single shop
  const handleSendReminderSingle = (shopId: number) => {
    const shop = shops.find((s) => s.id === shopId);
    if (!shop) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

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
  const handleSimulateAll = async () => {
    try {
      const res = await fetch('/api/orders/simulate-all', { method: 'POST' });
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
        showToast('🚀 Все 27 кофеен сети успешно заполнили и подали заявки!');
      }
    } catch (e) {
      console.error(e);
    }
  };

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
  const currentTerritorialManager = staff.find((s) => s.id === currentTerritorialManagerId) || null;

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    if (role !== 'territorial') setCurrentTerritorialManagerId(null);
  };

  const handleLoginTerritorial = (staffId: string) => {
    setCurrentTerritorialManagerId(staffId);
    setCurrentRole('territorial');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      <div>
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold shadow-xl flex items-center space-x-2 animate-bounce border border-indigo-500">
            <span className="text-xs uppercase tracking-wide">{toastMessage}</span>
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
          shops={shops}
          staff={staff}
          onSubmitRegistrationRequest={handleAddRegistrationRequest}
          onLoginTerritorial={handleLoginTerritorial}
          currentTerritorialManagerName={currentTerritorialManager?.name}
          isOwnerVerified={isOwnerVerified}
        />

        {/* Workspace Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentRole === 'manager' ? (
            <ManagerView
              coffeeShops={shops}
              products={products}
              selectedShopId={selectedShopId}
              onSelectShop={setSelectedShopId}
              currentOrder={currentOrder}
              onUpdateOrder={handleUpdateOrder}
              onOpenPreview={() => setIsPreviewOpen(true)}
              notifications={notifications}
            />
          ) : currentRole === 'admin' || currentRole === 'owner' ? (
            <AdminView
              isOwner={currentRole === 'owner'}
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
              rawMaterials={rawMaterials}
              setRawMaterials={setRawMaterials}
              rawCategoryDefs={rawCategoryDefs}
              setRawCategoryDefs={setRawCategoryDefs}
              checklistAssignments={checklistAssignments}
              onUpdateChecklistAssignments={setChecklistAssignments}
              staff={staff}
              registrationRequests={registrationRequests}
              onUpdateStaffMember={handleUpdateStaffMember}
              onUpdateRegistrationRequest={handleUpdateRegistrationRequest}
              onApproveRegistrationRequest={handleApproveRegistrationRequest}
              onRejectRegistrationRequest={handleRejectRegistrationRequest}
              onAddShop={handleAddShop}
              onUpdateShop={handleUpdateShop}
              onAddStaffMember={handleAddStaffMember}
              onDeleteStaffMember={handleDeleteStaffMember}
              onAssignTerritorialManager={handleAssignTerritorialManager}
              onAcceptAllOrders={handleAcceptAllOrders}
              onSendRemindersAll={handleSendRemindersAll}
              onSimulateAll={handleSimulateAll}
              onOpenSubmittedOrdersModal={() => setIsSubmittedModalOpen(true)}
            />
          ) : (
            <TerritorialManagerView
              managerName={currentTerritorialManager?.name || 'Территориальный управляющий'}
              shops={shops.filter((s) => currentTerritorialManager?.assignedShopIds?.includes(s.id))}
              orders={orders}
              products={products}
              staff={staff}
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
        onSendReminderSingle={handleSendReminderSingle}
      />

      {/* Bottom Status Bar (Geometric Balance Theme) */}
      <footer className="h-9 bg-indigo-950 flex items-center px-6 justify-between text-[10px] font-bold text-indigo-200 uppercase tracking-widest border-t border-indigo-900">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Engine: Active
          </span>
          <span>Anomaly Detection: Scan complete</span>
        </div>
        <div>© 2026 Master Bakery Supply System</div>
      </footer>

    </div>
  );
}
