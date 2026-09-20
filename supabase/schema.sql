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
  -- Which Kazakhstan calendar day this order belongs to. Reads ignore anything that isn't
  -- today, so the network starts each day empty — yesterday's submissions live on in
  -- order_history. Deliberately a stored day rather than a scheduled midnight wipe: a cron
  -- that fails one night leaves the whole chain ordering against stale figures, whereas a
  -- date can't drift and needs nothing to run.
  order_date date,
  items jsonb not null default '{}',
  status text not null default 'draft',
  submitted_at text,
  accepted_at text,
  manager_name text,
  notes text,
  anomalies jsonb,
  -- Telegram user id of whoever submitted this order (captured client-side from
  -- window.Telegram.WebApp.initDataUnsafe at submit time, not server-verified — fine for a
  -- courtesy accept/reject push, not used for authorization). Lets us notify the actual
  -- submitter without needing full per-manager Telegram identity linkage.
  submitted_by_telegram_id text
);

-- Append-only log of every order actually submitted (not drafts), so a shop's
-- manager can look back at what was ordered before, by whom, and when.
create table if not exists order_history (
  id bigserial primary key,
  shop_id integer not null references shops(id),
  items jsonb not null default '{}',
  manager_name text,
  submitted_at timestamptz not null default now(),
  -- Kept in sync with the eventual accept/reject decision on this submission (see
  -- PATCH /api/orders/:shopId/status), so a past date's history shows the real outcome, not
  -- just that something was submitted. 'submitted' until decided.
  status text not null default 'submitted',
  decided_at timestamptz
);
create index if not exists orders_order_date_idx on orders(order_date);
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

create table if not exists semi_category_defs (
  key text primary key,
  label text not null
);

-- Dish (Product) category registry, mirroring raw/semi — lets the Owner/Admin add and remove
-- categories instead of being limited to whatever's baked into ManagerView's fixed tabs.
-- Seeded once with the app's original 6 fixed categories so existing dishes keep working.
create table if not exists dish_category_defs (
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
  ingredients jsonb not null default '[]',
  yield_quantity numeric not null default 1
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
  phone text,
  -- Job title, only meaningful for role 'employee' — see EMPLOYEE_POSITIONS in types.ts.
  -- Descriptive only, not a separate app permission level.
  position text,
  -- Current pay per shift. This is the *default* copied onto a new shift, not the figure
  -- earnings are computed from — see the shifts table below.
  shift_rate numeric not null default 0,
  -- Where to send this person a notification. Unverified (captured from Telegram at
  -- registration, or by their own device on startup) — it decides delivery, never permission.
  telegram_user_id text
);

-- One row per person per day they actually worked. The timesheet is a record of fact, not
-- a roster of who was scheduled.
create table if not exists shifts (
  id bigserial primary key,
  staff_id text not null references staff(id) on delete cascade,
  -- A night shift belongs to the day it started on.
  work_date date not null,
  -- Copied from staff.shift_rate when the shift is recorded, and frozen there. Earnings are
  -- summed from this column, never from the employee's current rate — otherwise a raise would
  -- retroactively rewrite every past month's pay.
  rate numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  -- One shift per person per day: makes it impossible to pay the same day twice. A double
  -- shift is recorded as a higher rate on that day plus a note.
  unique (staff_id, work_date)
);
create index if not exists shifts_work_date_idx on shifts(work_date);
create index if not exists shifts_staff_month_idx on shifts(staff_id, work_date);
alter table shifts enable row level security;

-- One row per change to a shift (set or delete) — the shifts table itself only ever shows the
-- current state, so without this there's no way to answer "who changed this person's pay and
-- when". staff_name is denormalized (copied at write time, not joined) so the entry still
-- reads correctly even if the staff record is later renamed or removed.
create table if not exists shift_changes (
  id bigserial primary key,
  staff_id text not null,
  staff_name text not null,
  work_date date not null,
  action text not null check (action in ('set', 'delete')),
  rate numeric,
  actor_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists shift_changes_work_date_idx on shift_changes(work_date);

-- A shop-floor employee's request to be paid part of what the timesheet already shows as
-- earned, ahead of the normal payday. staff_name is denormalized, same reasoning as
-- shift_changes.staff_name above.
create table if not exists advance_requests (
  id text primary key,
  staff_id text not null references staff(id) on delete cascade,
  staff_name text not null,
  amount numeric not null,
  kaspi_phone text not null,
  status text not null default 'pending',
  submitted_at text not null,
  created_at timestamptz not null default now()
);
create index if not exists advance_requests_staff_idx on advance_requests(staff_id);

-- Anonymous dish-tasting polls, reached by customers via a Telegram deep link — no
-- registration, no staff record. criteria is a plain array of strings the Owner types in when
-- creating the poll (e.g. ["Вкус", "Внешний вид", "Размер порции"]); each vote's `scores` keys
-- against those same strings by name, not by id, since the poll's own criteria never change
-- after votes start coming in (only a brand-new poll — e.g. a "copy" — gets a new list).
create table if not exists dish_polls (
  id text primary key,
  dish_name text not null,
  criteria jsonb not null default '[]',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- One row per person per poll. telegram_user_id is what Telegram Mini Apps read automatically
-- with no form field — the entire point of this feature is that a customer never types
-- anything about who they are. Unique per (poll_id, telegram_user_id) so re-voting corrects
-- the same row (upsert) instead of padding the count.
create table if not exists dish_poll_votes (
  id bigserial primary key,
  poll_id text not null references dish_polls(id) on delete cascade,
  telegram_user_id text not null,
  telegram_username text,
  telegram_name text not null,
  scores jsonb not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  unique (poll_id, telegram_user_id)
);
create index if not exists dish_poll_votes_poll_idx on dish_poll_votes(poll_id);

create table if not exists registration_requests (
  id text primary key,
  name text not null,
  phone text,
  requested_shop_id integer not null,
  requested_shop_ids jsonb,
  requested_role text not null,
  requested_position text,
  telegram_user_id text,
  submitted_at text not null,
  status text not null default 'pending'
);

-- Phone numbers Telegram itself has vouched for, captured via the bot's "share my contact"
-- button (see POST /api/telegram/webhook). Populated *before* a registration request even
-- exists — the registration form reads from here instead of a free-typed phone field, so a
-- number can't be typo'd or faked. One row per Telegram account; a re-share just overwrites it.
create table if not exists telegram_contacts (
  telegram_user_id text primary key,
  phone_number text not null,
  first_name text,
  last_name text,
  received_at timestamptz not null default now()
);
