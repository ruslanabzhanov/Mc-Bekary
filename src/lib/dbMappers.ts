// Converts between Postgres rows (snake_case) and the app's existing JSON shapes
// (camelCase) so the frontend never has to change — only the storage layer moved.

export const shopFromDb = (r: any) => ({
  id: r.id,
  name: r.name,
  address: r.address,
  manager: r.manager,
  phone: r.phone,
  district: r.district,
  frequentItems: r.frequent_items || [],
  historicalAvg: r.historical_avg || {},
});
export const shopToDb = (s: any) => ({
  id: s.id,
  name: s.name,
  address: s.address,
  manager: s.manager,
  phone: s.phone,
  district: s.district,
  frequent_items: s.frequentItems || [],
  historical_avg: s.historicalAvg || {},
});

export const productFromDb = (r: any) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  categoryLabel: r.category_label,
  unit: r.unit,
  price: r.price,
  unitWeight: r.unit_weight,
  shelfLife: r.shelf_life,
  department: r.department,
  imageEmoji: r.image_emoji,
  imageUrl: r.image_url,
  description: r.description,
});
export const productToDb = (p: any) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  category_label: p.categoryLabel,
  unit: p.unit,
  price: p.price,
  unit_weight: p.unitWeight,
  shelf_life: p.shelfLife,
  department: p.department,
  image_emoji: p.imageEmoji,
  image_url: p.imageUrl,
  description: p.description,
});

export const orderFromDb = (r: any) => ({
  shopId: r.shop_id,
  items: r.items || {},
  status: r.status,
  submittedAt: r.submitted_at || undefined,
  acceptedAt: r.accepted_at || undefined,
  managerName: r.manager_name || undefined,
  notes: r.notes || undefined,
  anomalies: r.anomalies || undefined,
});
export const orderToDb = (o: any) => ({
  shop_id: o.shopId,
  items: o.items || {},
  status: o.status,
  submitted_at: o.submittedAt || null,
  accepted_at: o.acceptedAt || null,
  manager_name: o.managerName || null,
  notes: o.notes || null,
  anomalies: o.anomalies || null,
});

export const orderHistoryFromDb = (r: any) => ({
  id: r.id,
  shopId: r.shop_id,
  items: r.items || {},
  managerName: r.manager_name || undefined,
  submittedAt: r.submitted_at,
});

export const notificationFromDb = (r: any) => ({
  id: r.id,
  shopId: r.shop_id,
  shopName: r.shop_name,
  sentAt: r.sent_at,
  message: r.message,
});
export const notificationToDb = (n: any) => ({
  id: n.id,
  shop_id: n.shopId,
  shop_name: n.shopName,
  sent_at: n.sentAt,
  message: n.message,
});

export const rawMaterialFromDb = (r: any) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  categoryLabel: r.category_label,
  unit: r.unit,
  defaultUnitPrice: r.default_unit_price,
});
export const rawMaterialToDb = (r: any) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  category_label: r.categoryLabel,
  unit: r.unit,
  default_unit_price: r.defaultUnitPrice,
});

export const semiFinishedFromDb = (r: any) => ({
  id: r.id,
  name: r.name,
  unit: r.unit,
  unitCost: r.unit_cost,
  category: r.category,
  categoryLabel: r.category_label,
  prepInstructions: r.prep_instructions,
  ingredients: r.ingredients || [],
});
export const semiFinishedToDb = (s: any) => ({
  id: s.id,
  name: s.name,
  unit: s.unit,
  unit_cost: s.unitCost,
  category: s.category,
  category_label: s.categoryLabel,
  prep_instructions: s.prepInstructions,
  ingredients: s.ingredients || [],
});

export const dishCostingFromDb = (r: any) => ({
  productId: r.product_id,
  semiFinishedItems: r.semi_finished_items || [],
  rawIngredients: r.raw_ingredients || [],
});
export const dishCostingToDb = (c: any) => ({
  product_id: c.productId,
  semi_finished_items: c.semiFinishedItems || [],
  raw_ingredients: c.rawIngredients || [],
});

export const staffFromDb = (r: any) => ({
  id: r.id,
  name: r.name,
  role: r.role,
  shopId: r.shop_id,
  assignedShopIds: r.assigned_shop_ids || undefined,
  phone: r.phone || undefined,
});
export const staffToDb = (s: any) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  shop_id: s.shopId,
  assigned_shop_ids: s.assignedShopIds || null,
  phone: s.phone || null,
});

export const registrationRequestFromDb = (r: any) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || undefined,
  requestedShopId: r.requested_shop_id,
  requestedRole: r.requested_role,
  submittedAt: r.submitted_at,
});
export const registrationRequestToDb = (r: any) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || null,
  requested_shop_id: r.requestedShopId,
  requested_role: r.requestedRole,
  submitted_at: r.submittedAt,
});
