# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Master Bakery" — an order/production management system for a chain of 27 coffee shops in Kazakhstan (shop-facing name is "Master Bakery"; internal metadata still says "Master Coffee Kazakhstan" — that's stale, not a second product). Shop managers place daily showcase orders; admins run production (recipes/costing, checklists, personnel, sales points) with AI-assisted anomaly detection and procurement forecasting. Originally generated via Google AI Studio, now developed directly and deployed as a Telegram Mini App.

## Commands

```bash
npm run dev      # tsx server.ts — local dev server (Express + Vite middleware) on :3000
npm run lint      # tsc --noEmit — this is the only "test"; there is no test suite
npm run build     # vite build (client) + esbuild bundle of server.ts -> dist/server.cjs
npm run start     # node dist/server.cjs — run the production build locally
```

There are no unit/integration tests in this repo. After any change, run `npm run lint` and, for anything touching the API or a UI flow, actually exercise it against the running dev server (`npm run dev`, then hit `/api/...` with `curl`/`fetch` or drive the UI) — don't rely on the type check alone.

Local dev needs Supabase credentials in `.env` (see `.env.example`) — the server will throw on startup without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.

Deploys to Vercel on every push to `main` (GitHub integration is linked). To deploy manually: `npx vercel --prod --token=<VERCEL_TOKEN>`.

## Architecture

### Two runtimes sharing one API, no route logic duplicated

The Express route definitions live in **`src/server/apiApp.ts`** (`createApiApp()`), which both entrypoints reuse:
- **`server.ts`** — local dev only. Wraps `createApiApp()` with Vite's middleware (HMR) and `app.listen()`.
- **`api/index.ts`** — the Vercel serverless function. Exports the same Express app directly (Express apps are callable as `(req, res)`, which Vercel's Node runtime accepts as a handler). `vercel.json` rewrites `/api/(.*)` to this function; Vercel serves the Vite-built `dist/` as static assets separately, so `api/index.ts` has no static-file or Vite-middleware code.

When changing an API route, edit `apiApp.ts` only — never re-add route logic to `server.ts` or `api/index.ts` directly.

### Data layer: Supabase, not the old local JSON file

All persistent state lives in Supabase Postgres (schema in `supabase/schema.sql`). There is **no in-memory state and no local-file persistence** in the current server — that was an earlier iteration (`.data/app-state.json` with atomic writes + rotating backups) that has been fully replaced because it can't survive Vercel's serverless model (no shared disk between invocations). Don't reintroduce file-based state.

- `src/lib/supabaseServer.ts` — the server-only Supabase client, built with the `service_role` key (bypasses RLS). Never import this from client code or expose the key to the browser.
- `src/lib/dbMappers.ts` — hand-written `xFromDb`/`xToDb` converters between Postgres's snake_case columns and the app's existing camelCase JSON shapes. This is what let the entire migration from local-file storage happen without touching the frontend at all — `apiApp.ts` returns exactly the same JSON shapes the client already expected.
- Endpoints that receive "the whole array" from the client (raw materials, staff, shops, products, dish costings, etc.) use `replaceTable()` in `apiApp.ts` — it upserts the new rows then deletes whatever's no longer present, rather than delete-then-insert, so a partial failure never leaves a table transiently empty.
- `GET /api/initial-data` is the single hydration point; it fans out to all tables in parallel and reshapes array-of-rows into the `Record<id, T>` maps the client expects for `orders`, `dishCostings`, and `checklistAssignments`.

`scripts/migrate-to-supabase.mjs` is a one-off script (not part of the app) that was used to copy seed/live data from the old JSON-file server into Supabase; keep it around as a reference for bulk-loading data, not as something that runs regularly.

### Client state: `useSyncedState`

In `src/App.tsx`, most top-level state (`shops`, `products`, `staff`, `registrationRequests`, `rawMaterials`, `rawCategoryDefs`, `semiFinishedList`, `dishCostings`, `checklistAssignments`) is held via a local `useSyncedState<T>(initial, endpoint, bodyKey)` helper: a `useState` whose setter also fire-and-forgets a `POST` of the *entire new value* to the given endpoint. This means every one of those endpoints expects (and the corresponding `apiApp.ts` handler treats) a full-array/full-object replacement, not a diff — see `replaceTable()` above. `orders` and `notifications` are the exception: they're mutated via dedicated per-item endpoints (`/api/orders/:shopId`, `/api/orders/:shopId/status`, etc.) since those are naturally row-level operations.

On mount, `App.tsx` fetches `/api/initial-data` once and calls each of these setters with the server's data — which itself re-POSTs it back (harmless, just a redundant round-trip on load).

### Role-based views, one App component

`UserRole = 'manager' | 'admin' | 'territorial'` (`src/types.ts`) drives which top-level view `App.tsx` renders — `ManagerView`, `AdminView`, or `TerritorialManagerView` — there's no router. Role switching happens via `Header.tsx` (PIN entry for admin, a dropdown of territorial-manager staff members for that role). `TerritorialManagerView` is a read-only mirror of parts of `AdminView`/`SalesPointsManager` scoped to whichever shops are in that manager's `assignedShopIds`.

`AdminView` hosts the "Управление цехом" tile grid, which opens full-screen modal-like panels: `CostingsManager` (recipes/costing — dishes, semi-finished products, raw materials), `PersonnelManager`, `SalesPointsManager`, and `PrintChecklistsModal` (see below).

### Production checklists print as A3

`PrintChecklistsModal.tsx` has two views per department: a shop-floor "production" calculator (per-dish ingredient math derived from `dishCostings` + `semiFinishedList`, aggregated into a category-grouped shopping list) and a "summary" per-shop distribution table. It's rendered via `createPortal(..., document.body)` specifically so printing can hide the rest of the app (`#root { display: none }` in `index.css`'s `@media print` block) without fighting the modal's own DOM position — don't move this back to inline rendering without re-solving that. Print output targets A3 landscape (`@page { size: A3 landscape; }` in `index.css`) to match a specific reference layout; if print output is spilling to a second page, that's the first thing to check.

Which products appear on a given department's checklist is independent of `Product.category` — it's an explicit admin-editable mapping in `checklist_assignments`, seeded once from category but freely reassignable afterward via the modal's own settings panel.

### Telegram Mini App

`index.html` loads `telegram-web-app.js`; `App.tsx` calls `window.Telegram.WebApp.ready()/.expand()` on mount (no-ops outside Telegram). The bot (`@Master_Bekarybot`) has its menu button configured via the Bot API (`setChatMenuButton`) to open the deployed Vercel URL as a `web_app` — that configuration lives on Telegram's side, not in this repo, so re-run it via the Bot API if the production URL ever changes.

Because the app is just a normal website that Telegram happens to open in a `web_app` button, it keeps working even if Telegram itself is down — the same production URL loads fine in a plain browser (the SDK calls above are no-ops there). Only the one-tap launch convenience depends on Telegram.

### Shop selection (manager) — stopgap, not real identity

`App.tsx`'s `selectedShopId` is persisted to `localStorage` (`mc-bekary-selected-shop-id`) rather than hardcoded, and `ManagerView.tsx` has a shop-picker (pencil icon on the "Точка №X" tile) that calls `onSelectShop`. This means each **device** remembers which shop it represents — it is still not tied to who is actually holding the device. Real per-manager identity (Telegram `initData` → shop lookup) is still not implemented; this is a stopgap, matching the "🔴 Blocking" item this section used to describe.

### Order history

Every order that transitions to `status: 'submitted'` (not draft saves) is also appended to `order_history` (shop_id, items, manager_name, submitted_at — a real Postgres timestamp, unlike `orders.submitted_at` which is just an `HH:MM` string). `GET /api/orders/:shopId/history` returns it newest-first. In `ManagerView.tsx`, clicking the "Точка №X" tile opens `OrderHistoryModal.tsx`, which fetches this endpoint and lets the manager drill into any past submission's full item breakdown. This is append-only and independent of the single current-order-per-shop row in `orders`.

### Owner role and the permission matrix

`UserRole` includes `'owner'` in addition to `manager | admin | territorial`. Unlike every other role (PIN, or picking a name from a dropdown — all client-side, unauthenticated), **Owner is the one real, server-verified identity** in the app:

- `src/lib/telegramAuth.ts` — `verifyTelegramInitData(initData, botToken)` implements Telegram's official Mini App HMAC check (`crypto`, no new dependency). Never trust `window.Telegram.WebApp.initDataUnsafe` from the client for authorization — only this server-side check proves the request actually came from Telegram.
- `OWNER_TELEGRAM_ID` (env var, both locally and in Vercel) is the one Telegram numeric user id allowed to become Owner. `POST /api/auth/telegram-owner` (called from `App.tsx`'s Telegram-detection `useEffect`, only when `tg.initData` is non-empty — i.e. only inside real Telegram) tells the client whether the current user is the Owner.
- Owner can do everything Admin can, plus edit the **permission matrix**: which of Admin's six real capabilities (accept/reject orders, send reminders, manage checklists, costings, personnel, sales points) are actually enabled, stored in the `role_permissions` table (`GET`/`POST /api/role-permissions`). `POST /api/role-permissions` **re-verifies** the caller's `initData` server-side before writing — it never trusts a client-sent "I am the Owner" flag. This is the only endpoint in the app with real server-side authorization; every other endpoint is still unauthenticated by design (matches the rest of this app's current security posture — see "Known issues" below).
- Missing rows in `role_permissions` default to today's fixed behavior (`admin` = everything on, `territorial` = everything off) via `DEFAULT_ROLE_PERMISSIONS` in `apiApp.ts` — adding this table was not a behavior change for existing admins.
- `TerritorialManagerView.tsx` has no action buttons at all today, so the `territorial` column in the matrix is stored but has no effect yet — wiring it up is separate follow-up work, not done.
- Testing Owner mode requires opening the app **inside real Telegram** — `initData` is empty in a plain browser (including a Vercel preview URL opened directly), so this can only be verified against a URL Telegram actually opens the Mini App from.

### Known dead files

`src/components/PrintPrepChecklistModal.tsx`, `src/components/MatrixTable.tsx`, and `src/components/DisciplineTracker.tsx` are not imported anywhere — leftovers from an earlier iteration. Don't assume they're wired in; check import sites before touching them.

### AI features degrade gracefully

Both `/api/ai/analyze-order` and `/api/ai/predictive-procurement` call Gemini (`@google/genai`) only if `GEMINI_API_KEY` is set to something other than the `MY_GEMINI_API_KEY` placeholder; otherwise they return an algorithmic fallback response with the same shape. Don't assume a Gemini key is configured in dev or prod.

## Known issues — pre-launch audit (2026-08-29)

Found while checking readiness for real multi-shop concurrent ordering. Status as of the Owner-role work below.

### ✅ Fixed: shop switching
Was: every manager session was permanently pinned to shop id `1` (`onSelectShop` was accepted as a prop but never called). Fixed with a device-level shop picker + `localStorage` persistence — see "Shop selection (manager)" above. Still a stopgap, not real per-manager identity (next item).

### 🟠 Important, partially addressed: no real per-user identity/access control
Owner is now a real, server-verified identity (Telegram `initData` HMAC check — see "Owner role and the permission matrix" above). Admin and Territorial are still purely client-side/selection-based, same as before:
- Admin: shared PIN, not tied to a person.
- Territorial manager: picked from a dropdown of names (`Header.tsx`) — anyone can pick anyone.
- Manager: device-level shop picker (see above), not tied to a specific person either.

Extending the same `verifyTelegramInitData` approach used for Owner to Admin/Territorial/Manager (looking up the verified Telegram id against a `telegram_user_id` column on `staff`) would close this gap fully. Not implemented yet — deliberately scoped out of the Owner-role work to keep that change reviewable.

### 🟡 Also still true: nothing else in the API is server-authorized
`POST /api/role-permissions` is the only endpoint that verifies the caller's identity server-side. Every other endpoint (accept-all, order status changes, catalog edits, etc.) has zero server-side auth — anyone who can reach the URL can call them directly, regardless of what the UI shows. This was already true before the Owner-role work and isn't a regression, but it means the permission matrix's enforcement (see above) is UI-level only for Admin/Territorial, not a real security boundary yet.

### 🟡 Secondary, not blocking
- `GET /api/initial-data` fetches all 11 tables for every session regardless of role — a plain manager pulls raw materials, dish costings, staff, and registration requests it never uses. Wasteful under concurrent load, not broken (Supabase's PostgREST API scales via HTTP, not a per-request Postgres connection, so this doesn't risk connection exhaustion — just adds avoidable latency/payload).
- Anomaly detection (`apiApp.ts`, `/api/orders/:shopId`) falls back to `avg = 10` when `shop.historicalAvg` has no entry for a product. A newly added product with no historical data seeded for all 27 shops will misfire anomaly warnings until real order history accumulates.
- The `replaceTable()` full-array-replace pattern (see above) means two admins editing the same catalog (raw materials, dish costings, etc.) concurrently can silently clobber each other — last write wins on the whole array. Doesn't affect order submission (that's per-shop-row), only admin-side catalog edits.
