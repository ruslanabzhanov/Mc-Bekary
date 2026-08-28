// One-time data migration: takes the current live app state (from the running local
// dev server, which reflects everything the admin has already added) and inserts it
// into the Supabase tables created via supabase/schema.sql.
//
// Usage: node scripts/migrate-to-supabase.mjs
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function upsert(table, rows, label) {
  if (!rows.length) {
    console.log(`- ${label}: nothing to insert`);
    return;
  }
  const { error } = await supabase.from(table).upsert(rows);
  if (error) {
    console.error(`FAILED: ${label}`, error);
    process.exit(1);
  }
  console.log(`- ${label}: ${rows.length} rows`);
}

async function main() {
  console.log('Fetching current app state from http://localhost:3000/api/initial-data ...');
  const res = await fetch('http://localhost:3000/api/initial-data');
  if (!res.ok) {
    throw new Error(`Failed to fetch initial data: ${res.status}`);
  }
  const data = await res.json();

  console.log('Migrating into Supabase...');

  await upsert(
    'shops',
    data.shops.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      manager: s.manager,
      phone: s.phone,
      district: s.district,
      frequent_items: s.frequentItems || [],
      historical_avg: s.historicalAvg || {},
    })),
    'shops'
  );

  await upsert(
    'products',
    data.products.map((p) => ({
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
    })),
    'products'
  );

  await upsert(
    'orders',
    Object.values(data.orders).map((o) => ({
      shop_id: o.shopId,
      items: o.items || {},
      status: o.status,
      submitted_at: o.submittedAt || null,
      accepted_at: o.acceptedAt || null,
      manager_name: o.managerName || null,
      notes: o.notes || null,
      anomalies: o.anomalies || null,
    })),
    'orders'
  );

  await upsert(
    'notifications',
    (data.notifications || []).map((n) => ({
      id: n.id,
      shop_id: n.shopId,
      shop_name: n.shopName,
      sent_at: n.sentAt,
      message: n.message,
    })),
    'notifications'
  );

  await upsert(
    'raw_materials',
    data.rawMaterials.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      category_label: r.categoryLabel,
      unit: r.unit,
      default_unit_price: r.defaultUnitPrice,
    })),
    'raw_materials'
  );

  await upsert(
    'raw_category_defs',
    data.rawCategoryDefs.map((c) => ({ key: c.key, label: c.label })),
    'raw_category_defs'
  );

  await upsert(
    'semi_finished',
    data.semiFinishedList.map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit,
      unit_cost: s.unitCost,
      category: s.category,
      category_label: s.categoryLabel,
      prep_instructions: s.prepInstructions,
      ingredients: s.ingredients || [],
    })),
    'semi_finished'
  );

  // dish_costings.product_id has a foreign key into products — a handful of seed recipes
  // are leftover from before the bakery rebrand and reference products that no longer
  // exist (e.g. "bowl", "medovik"), so they're skipped rather than failing the migration.
  const validProductIds = new Set(data.products.map((p) => p.id));
  const orphanedCostings = Object.keys(data.dishCostings).filter((id) => !validProductIds.has(id));
  if (orphanedCostings.length) {
    console.log(`- dish_costings: skipping ${orphanedCostings.length} orphaned entries (no matching product): ${orphanedCostings.join(', ')}`);
  }
  await upsert(
    'dish_costings',
    Object.values(data.dishCostings)
      .filter((c) => validProductIds.has(c.productId))
      .map((c) => ({
        product_id: c.productId,
        semi_finished_items: c.semiFinishedItems || [],
        raw_ingredients: c.rawIngredients || [],
      })),
    'dish_costings'
  );

  await upsert(
    'checklist_assignments',
    Object.entries(data.checklistAssignments).map(([key, ids]) => ({
      department_key: key,
      product_ids: ids,
    })),
    'checklist_assignments'
  );

  await upsert(
    'staff',
    (data.staff || []).map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      shop_id: s.shopId,
      assigned_shop_ids: s.assignedShopIds || null,
      phone: s.phone || null,
    })),
    'staff'
  );

  await upsert(
    'registration_requests',
    (data.registrationRequests || []).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone || null,
      requested_shop_id: r.requestedShopId,
      requested_role: r.requestedRole,
      submitted_at: r.submittedAt,
    })),
    'registration_requests'
  );

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
