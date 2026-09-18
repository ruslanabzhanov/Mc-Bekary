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
  orderDate: typeof r.order_date === 'string' ? r.order_date.slice(0, 10) : r.order_date || undefined,
  items: r.items || {},
  status: r.status,
  submittedAt: r.submitted_at || undefined,
  acceptedAt: r.accepted_at || undefined,
  managerName: r.manager_name || undefined,
  notes: r.notes || undefined,
  anomalies: r.anomalies || undefined,
  submittedByTelegramId: r.submitted_by_telegram_id || undefined,
});
export const orderToDb = (o: any) => ({
  shop_id: o.shopId,
  order_date: o.orderDate || null,
  items: o.items || {},
  status: o.status,
  submitted_at: o.submittedAt || null,
  accepted_at: o.acceptedAt || null,
  manager_name: o.managerName || null,
  notes: o.notes || null,
  anomalies: o.anomalies || null,
  submitted_by_telegram_id: o.submittedByTelegramId || null,
});

export const orderHistoryFromDb = (r: any) => ({
  id: r.id,
  shopId: r.shop_id,
  items: r.items || {},
  managerName: r.manager_name || undefined,
  submittedAt: r.submitted_at,
  status: r.status || 'submitted',
  decidedAt: r.decided_at || undefined,
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
  yieldQuantity: r.yield_quantity || 1,
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
  yield_quantity: s.yieldQuantity || 1,
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
  position: r.position || undefined,
  shiftRate: Number(r.shift_rate) || 0,
  // Unverified, captured from Telegram when the person registered or last opened the app.
  // Good enough to send them a notification; never used to decide what they may do.
  telegramUserId: r.telegram_user_id || undefined,
});
export const staffToDb = (s: any) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  shop_id: s.shopId,
  assigned_shop_ids: s.assignedShopIds || null,
  phone: s.phone || null,
  position: s.position || null,
  shift_rate: Number(s.shiftRate) || 0,
  telegram_user_id: s.telegramUserId || null,
});

export const shiftFromDb = (r: any) => ({
  id: r.id,
  staffId: r.staff_id,
  workDate: typeof r.work_date === 'string' ? r.work_date.slice(0, 10) : r.work_date,
  rate: Number(r.rate) || 0,
  note: r.note || undefined,
});

export const advanceRequestFromDb = (r: any) => ({
  id: r.id,
  staffId: r.staff_id,
  staffName: r.staff_name,
  amount: Number(r.amount) || 0,
  kaspiPhone: r.kaspi_phone,
  status: r.status || 'pending',
  submittedAt: r.submitted_at,
});
export const advanceRequestToDb = (r: any) => ({
  id: r.id,
  staff_id: r.staffId,
  staff_name: r.staffName,
  amount: r.amount,
  kaspi_phone: r.kaspiPhone,
  status: r.status || 'pending',
  submitted_at: r.submittedAt,
});

export const registrationRequestFromDb = (r: any) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || undefined,
  requestedShopId: r.requested_shop_id,
  requestedShopIds: r.requested_shop_ids || undefined,
  requestedRole: r.requested_role,
  requestedPosition: r.requested_position || undefined,
  telegramUserId: r.telegram_user_id || undefined,
  submittedAt: r.submitted_at,
  status: r.status || 'pending',
});
export const registrationRequestToDb = (r: any) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || null,
  requested_shop_id: r.requestedShopId,
  requested_shop_ids: r.requestedShopIds || null,
  requested_role: r.requestedRole,
  requested_position: r.requestedPosition || null,
  telegram_user_id: r.telegramUserId || null,
  submitted_at: r.submittedAt,
  status: r.status || 'pending',
});
