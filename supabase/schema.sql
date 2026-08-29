-- Master Bakery: initial schema for Supabase (Postgres)
-- Run this once in the Supabase SQL Editor. Creates empty tables only —
-- data migration from the current running app happens separately via script.

create table if not exists shops (
  id integer primary key,
  name text not null,
  address text not null,
  manager text not null,
  phone text,
  district text not null,
  frequent_items jsonb not null default '[]',
  historical_avg jsonb not null default '{}'
);

create table if not exists products (
  id text primary key,
  name text not null,
  category text not null,
  category_label text not null,
  unit text not null,
  price numeric not null default 0,
  unit_weight text,
  shelf_life text,
  department text not null,
  image_emoji text,
  image_url text,
  description text
);

-- One current order per shop (matches today's single-active-order-per-shop model)
create table if not exists orders (
  shop_id integer primary key references shops(id),
  items jsonb not null default '{}',
  status text not null default 'draft',
  submitted_at text,
  accepted_at text,
  manager_name text,
  notes text,
  anomalies jsonb
);

-- Append-only log of every order actually submitted (not drafts), so a shop's
-- manager can look back at what was ordered before, by whom, and when.
create table if not exists order_history (
  id bigserial primary key,
  shop_id integer not null references shops(id),
  items jsonb not null default '{}',
  manager_name text,
  submitted_at timestamptz not null default now()
);
create index if not exists order_history_shop_id_idx on order_history(shop_id, submitted_at desc);
alter table order_history enable row level security;

-- What each role is allowed to do, editable only by the Owner (verified via Telegram
-- identity, not by role). Missing rows fall back to today's fixed behavior in the app
-- (admin = everything, territorial = nothing) — see apiApp.ts DEFAULT_ROLE_PERMISSIONS.
create table if not exists role_permissions (
  role text primary key,
  permissions jsonb not null default '{}'
);
alter table role_permissions enable row level security;

create table if not exists notifications (
  id text primary key,
  shop_id integer not null,
  shop_name text not null,
  sent_at text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists raw_materials (
  id text primary key,
  name text not null,
  category text not null,
  category_label text not null,
  unit text not null,
  default_unit_price numeric not null default 0
);

create table if not exists raw_category_defs (
  key text primary key,
  label text not null
);

create table if not exists semi_finished (
  id text primary key,
  name text not null,
  unit text not null,
  unit_cost numeric not null default 0,
  category text not null,
  category_label text not null,
  prep_instructions text,
  ingredients jsonb not null default '[]'
);

create table if not exists dish_costings (
  product_id text primary key references products(id),
  semi_finished_items jsonb not null default '[]',
  raw_ingredients jsonb not null default '[]'
);

create table if not exists checklist_assignments (
  department_key text primary key,
  product_ids jsonb not null default '[]'
);

create table if not exists staff (
  id text primary key,
  name text not null,
  role text not null,
  shop_id integer,
  assigned_shop_ids jsonb,
  phone text
);

create table if not exists registration_requests (
  id text primary key,
  name text not null,
  phone text,
  requested_shop_id integer not null,
  requested_role text not null,
  submitted_at text not null
);
