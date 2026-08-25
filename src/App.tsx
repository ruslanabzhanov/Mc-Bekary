import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ManagerView } from './components/ManagerView';
import { AdminView } from './components/AdminView';
import { TerritorialManagerView } from './components/TerritorialManagerView';
import { OrderPreviewModal } from './components/OrderPreviewModal';
import { SubmittedOrdersModal } from './components/SubmittedOrdersModal';
import { COFFEE_SHOPS, PRODUCTS, INITIAL_ORDERS, INITIAL_STAFF, INITIAL_REGISTRATION_REQUESTS } from './data/mockData';
import { INITIAL_SEMI_FINISHED, INITIAL_DISH_COSTINGS } from './data/costingData';
import { CoffeeShop, Product, ShopOrder, DisciplineNotification, SemiFinishedProduct, DishCosting, OrderStatus, StaffMember, RegistrationRequest, UserRole } from './types';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('manager');
  const [currentTerritorialManagerId, setCurrentTerritorialManagerId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<number>(1);
  const [shops, setShops] = useState<CoffeeShop[]>(COFFEE_SHOPS);
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [orders, setOrders] = useState<Record<number, ShopOrder>>(INITIAL_ORDERS);
  const [notifications, setNotifications] = useState<DisciplineNotification[]>([]);
  const [semiFinishedList, setSemiFinishedList] = useState<SemiFinishedProduct[]>(INITIAL_SEMI_FINISHED);
  const [dishCostings, setDishCostings] = useState<Record<string, DishCosting>>(INITIAL_DISH_COSTINGS);
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>(INITIAL_REGISTRATION_REQUESTS);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSubmittedModalOpen, setIsSubmittedModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  // Fetch initial state from server on startup
  useEffect(() => {
    fetch('/api/initial-data')
      .then((res) => res.json())
      .then((data) => {
        if (data.shops) setShops(data.shops);
        if (data.products) setProducts(data.products);
        if (data.orders) setOrders(data.orders);
        if (data.notifications) setNotifications(data.notifications);
      })
      .catch((err) => {
        console.log('Using local fallback state:', err);
      });
  }, []);

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
          ) : currentRole === 'admin' ? (
            <AdminView
              shops={shops}
              products={products}
              orders={orders}
              semiFinishedList={semiFinishedList}
              dishCostings={dishCostings}
              onUpdateSemiFinished={setSemiFinishedList}
              onUpdateDishCostings={setDishCostings}
              onUpdateProduct={handleUpdateProduct}
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
