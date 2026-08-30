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
  category: Category;
  categoryLabel: string;
  unit: string;
  price: number; // in KZT
  unitWeight: string;
  shelfLife: string;
  department: 'bakery' | 'sandwiches' | 'desserts' | 'bar_prep' | 'kitchen_prep' | 'new_items';
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
  items: Record<string, number>; // productId -> quantity
  status: OrderStatus;
  submittedAt?: string;
  acceptedAt?: string;
  managerName?: string;
  notes?: string;
  anomalies?: Record<string, string>; // productId -> anomaly message
}

export interface OrderHistoryEntry {
  id: number;
  shopId: number;
  items: Record<string, number>; // productId -> quantity
  managerName?: string;
  submittedAt: string; // ISO timestamp
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

export type UserRole = 'manager' | 'admin' | 'territorial' | 'owner';

export type Permission =
  | 'accept_reject_orders'
  | 'send_reminders'
  | 'manage_checklists'
  | 'manage_costings'
  | 'manage_personnel'
  | 'manage_sales_points';

export type RolePermissions = Record<'admin' | 'territorial', Record<Permission, boolean>>;

export type StaffRole = 'employee' | 'territorial_manager' | 'shop_manager';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  shopId: number | null; // assigned point, null for staff not tied to a single point
  assignedShopIds?: number[]; // for territorial managers: the points they oversee
  phone?: string;
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
  submittedAt: string;
  status: RegistrationRequestStatus;
}

export const MAX_TERRITORIAL_SHOPS = 8;

