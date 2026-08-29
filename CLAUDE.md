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

### Known dead files

`src/components/PrintPrepChecklistModal.tsx`, `src/components/MatrixTable.tsx`, and `src/components/DisciplineTracker.tsx` are not imported anywhere — leftovers from an earlier iteration. Don't assume they're wired in; check import sites before touching them.

### AI features degrade gracefully

Both `/api/ai/analyze-order` and `/api/ai/predictive-procurement` call Gemini (`@google/genai`) only if `GEMINI_API_KEY` is set to something other than the `MY_GEMINI_API_KEY` placeholder; otherwise they return an algorithmic fallback response with the same shape. Don't assume a Gemini key is configured in dev or prod.

## Known issues — pre-launch audit (2026-08-29), not yet fixed

Found while checking readiness for real multi-shop concurrent ordering. Priority order:

### 🔴 Blocking: shop switching doesn't exist
`selectedShopId` in `App.tsx` is `useState<number>(1)` and never changes — the `onSelectShop` callback it passes down to `ManagerView` is accepted as a prop but **never called from anywhere in `ManagerView.tsx`**. Every manager session is permanently pinned to shop id `1`, regardless of who opens the app. Right now, if multiple shops opened the Mini App at once, they'd all be viewing/overwriting the same shop's order — the other 26 shops have no way to place an order at all. This must be fixed before real rollout: needs either a real per-shop identity mechanism (see next item) or, as a stopgap, a manual shop picker wired to `onSelectShop`.

### 🟠 Important: no real per-user identity/access control
Nothing in the app ties a Telegram user to a specific shop or role — everything is selection-based, not authorization-based:
- Admin: shared PIN, not tied to a person.
- Territorial manager: picked from a dropdown of names (`Header.tsx`) — anyone can pick anyone.
- Manager: no identity at all (see above).

The correct fix is to read Telegram's signed `initData` (available via `window.Telegram.WebApp.initData`/`initDataUnsafe`, includes the opening user's Telegram `id`) and look up that `id` against a `telegram_user_id` column on `staff`/`shops` server-side, rather than trusting client-selected role/shop. Not implemented yet.

### 🟡 Secondary, not blocking
- `GET /api/initial-data` fetches all 11 tables for every session regardless of role — a plain manager pulls raw materials, dish costings, staff, and registration requests it never uses. Wasteful under concurrent load, not broken (Supabase's PostgREST API scales via HTTP, not a per-request Postgres connection, so this doesn't risk connection exhaustion — just adds avoidable latency/payload).
- Anomaly detection (`apiApp.ts`, `/api/orders/:shopId`) falls back to `avg = 10` when `shop.historicalAvg` has no entry for a product. A newly added product with no historical data seeded for all 27 shops will misfire anomaly warnings until real order history accumulates.
- The `replaceTable()` full-array-replace pattern (see above) means two admins editing the same catalog (raw materials, dish costings, etc.) concurrently can silently clobber each other — last write wins on the whole array. Doesn't affect order submission (that's per-shop-row), only admin-side catalog edits.
