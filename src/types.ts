export type Category = 
  | 'croissants' 
  | 'sandwiches' 
  | 'desserts' 
  | 'bar_prep' 
  | 'kitchen_prep' 
  | 'new_items';

export interface Product {
  id: string;
  name: string;
  category: string; // key into the dish category registry (see dishCategoryDefs in App.tsx) — was the fixed Category union
  categoryLabel: string;
  unit: string;
  price: number; // in KZT
  unitWeight: string;
  shelfLife: string;
  department: string;
  imageEmoji: string;
  imageUrl: string;
  description: string;
}

export interface CoffeeShop {
  id: number;
  name: string;
  address: string;
  manager: string;
  phone: string;
  district: string;
  frequentItems: string[]; // array of product IDs
  historicalAvg: Record<string, number>; // productId -> average qty for current day
}

export type OrderStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'in_production';

export interface ShopOrder {
  shopId: number;
  orderDate?: string; // YYYY-MM-DD Kazakhstan day this order belongs to; earlier days are ignored
  items: Record<string, number>; // productId -> quantity
  status: OrderStatus;
  submittedAt?: string;
  acceptedAt?: string;
  managerName?: string;
  notes?: string;
  anomalies?: Record<string, string>; // productId -> anomaly message
  submittedByTelegramId?: string; // captured client-side at submit time, for accept/reject push notifications
}

export interface OrderHistoryEntry {
  id: number;
  shopId: number;
  items: Record<string, number>; // productId -> quantity
  managerName?: string;
  submittedAt: string; // ISO timestamp
  status: OrderStatus; // kept in sync with the eventual accept/reject decision, see apiApp.ts
  decidedAt?: string; // ISO timestamp of that decision, if any
}

export interface DisciplineNotification {
  id: string;
  shopId: number;
  shopName: string;
  sentAt: string;
  message: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  unit: string; // 'кг', 'л', 'шт'
  defaultUnitPrice: number; // in KZT
}

export interface SemiIngredient {
  id: string;
  rawMaterialName: string;
  quantity: number; // e.g. 1.15 kg for 1 kg of finished semi
  unit: string; // kg, l, pcs
  unitPrice: number; // cost per unit in KZT
}

export interface SemiFinishedProduct {
  id: string;
  name: string;
  unit: string; // kg, l, pcs
  unitCost: number; // computed or set cost in KZT per unit
  category: string; // key into the semi-finished category registry (see semiCategoryDefs in App.tsx)
  categoryLabel: string;
  prepInstructions: string;
  ingredients: SemiIngredient[];
  // Actual output weight/volume after cooking (in `unit`) — usually less than the sum of
  // ingredient quantities, since heat treatment loses moisture. Cost per `unit` is the
  // total ingredient cost divided by this, not by 1 — see calculateSemiCost.
  yieldQuantity: number;
}

export interface DishSemiItem {
  semiFinishedId: string;
  quantity: number; // quantity per 1 portion/piece of finished dish
  unit: string;
}

export interface DishRawItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface DishCosting {
  productId: string; // links to Product.id
  semiFinishedItems: DishSemiItem[];
  rawIngredients: DishRawItem[];
}

export type UserRole = 'manager' | 'admin' | 'territorial' | 'owner' | 'employee';

export type Permission =
  | 'accept_reject_orders'
  | 'send_reminders'
  | 'manage_checklists'
  | 'manage_costings'
  | 'manage_personnel'
  | 'manage_sales_points';

export type RolePermissions = Record<'admin' | 'territorial', Record<Permission, boolean>>;

export type StaffRole = 'employee' | 'territorial_manager' | 'shop_manager';

// Registration groups roles into two categories the applicant picks between first: shop-facing
// staff (shop_manager/territorial_manager) vs internal employees, who then also pick a specific
// job title from this list — purely descriptive (HR/org-chart labeling), not a separate app
// permission level; every position here is still the 'employee' StaffRole.
export const EMPLOYEE_POSITIONS = [
  'Шеф-пекарь',
  'Пекарь',
  'Ночной пекарь',
  'Кондитер',
  'Заведующий производством',
  'Заготовщик бара',
  'Заготовщик кухни',
  'Ночной заготовщик кухни',
  'Заготовщик полуфабрикатов',
  'Кухонная рабочая'
] as const;

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  shopId: number | null; // assigned point, null for staff not tied to a single point
  assignedShopIds?: number[]; // for territorial managers: the points they oversee
  phone?: string;
  position?: string; // job title, only meaningful for role 'employee' — see EMPLOYEE_POSITIONS
  shiftRate?: number; // current pay per shift; the default copied onto a new Shift, see below
  telegramUserId?: string; // for notifications only — unverified, never an authorization input
}

// One recorded day of work. `rate` is frozen at the moment the shift is entered rather than
// read from the employee's current shiftRate — a raise must not rewrite what past months paid.
export interface Shift {
  id: number;
  staffId: string;
  workDate: string; // YYYY-MM-DD, Kazakhstan calendar day
  rate: number;
  note?: string;
}

export type ChecklistAssignments = Record<string, string[]>; // checklist dept key -> assigned product IDs

export type RegistrationRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RegistrationRequest {
  id: string;
  name: string;
  phone?: string;
  requestedShopId: number; // used for 'shop_manager'/'employee' (single point)
  requestedShopIds?: number[]; // used for 'territorial_manager' (up to 8 points)
  requestedRole: StaffRole;
  requestedPosition?: string; // job title when requestedRole is 'employee' — see EMPLOYEE_POSITIONS
  telegramUserId?: string; // captured at submit so the decision can be pushed back to them
  submittedAt: string;
  status: RegistrationRequestStatus;
}

export const MAX_TERRITORIAL_SHOPS = 5;

