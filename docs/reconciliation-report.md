# D3 Repository Reconciliation Report

_Generated: 2026-08-30. Every claim in this report is backed by evidence from actual source files._

---

## Top-Line Summary (Read This First)

1. **The application is substantially built — not just scaffolded.** The full V1 happy path (QR scan → OTP → menu → cart → order → admin payment/completion) is implemented end-to-end in both backend and frontend.
2. **The `env.ts` config module was truncated — it is the central broken thing.** It defines `AppConfig` with only 5 fields, but 15 call sites across 5 source files expect 10 more fields (`qrSecret`, `sessionSecret`, `secureCookies`, `otpTtlMs`, `otpMaxAttempts`, `preSessionTtlMs`, `customerSessionTtlMs`, `staffSessionTtlMs`, `enableDevSeed`). This causes **15 TypeScript compile errors and all 4 API integration tests to fail at runtime.**
3. **The OTP system is effectively inoperative** because `sessionSecret` is `undefined` at runtime. `createHmac("sha256", undefined)` throws a `TypeError`. All four integration tests fail with exactly that error. QR verification, OTP hashing, and cookie security all depend on the same missing config fields.
4. **No production secrets are committed** — secrets are .gitignore'd — but there is no `.env.example` file, so the project cannot be started from a fresh clone without undocumented knowledge of what to set.
5. **The web app has zero frontend tests.** The `src/test/setup.ts` file exists (one import only); there are no test files at all in `apps/web`.
6. **Documentation and code are in strong structural agreement** on the V1 plan, but the docs still carry the claim "No production application code exists yet" — written during the documentation-only phase and now stale.
7. **No secrets are hardcoded in production code paths**, but the seed file commits a known dev password (`admin12345`) to source. This is acceptable only if the seed guard is working — and that guard (`config.enableDevSeed`) is itself currently missing from `AppConfig`.
8. **The architecture rule "do not put the application into one large App.tsx" is technically followed** — routing goes to `CustomerOrderPage` or `AdminPage` — but those two files (382 and 467 lines respectively) inline all their state, data fetching, and business logic rather than separating concerns as the architecture spec requires.
9. **The backend module structure does not match the documented plan.** Each module is a single `*.routes.ts` file containing routes, validation, database queries, business logic, and helper functions mixed together — not the `routes / service / repository` separation described in `architecture.md`.
10. **The corrected resume point is: fix `env.ts`.** One file needs to be updated to restore the full `AppConfig` with all 10 missing fields. Once done, all 4 API tests should pass and TypeScript will compile cleanly.

---

## Step 1 — Full Inventory

### 1.1 Directory Tree

```
D3/
├── .gitignore              — excludes .env, .env.*, data/, dist/, node_modules/
│                             includes !.env.example (but .env.example DOES NOT EXIST)
├── README.md               — brief project overview; no setup instructions
├── package.json            — npm workspaces root: shared, api, web; Node >=26 required
├── tsconfig.base.json      — shared TS: strict, noUncheckedIndexedAccess, @d3/shared path alias
├── apps/
│   ├── api/
│   │   ├── data/           — d3.sqlite + WAL files (296 KB WAL = server has been run before)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── createApp.ts      — Express factory: helmet, CORS, cookie-parser, origin guard, all routers
│   │   │   │   └── server.ts         — Entry: loadConfig → openDatabase → runMigrations → ensureDevSeed → listen
│   │   │   ├── config/
│   │   │   │   └── env.ts            — ⚠️ TRUNCATED: AppConfig has only 5 of the 15 fields used by the codebase
│   │   │   ├── db/
│   │   │   │   ├── database.ts       — DatabaseSync wrapper; FK=ON; WAL mode; transaction() helper
│   │   │   │   ├── migrations.ts     — 1 migration: all 13 V1 tables
│   │   │   │   ├── seed.ts           — Dev seed (table, QR, admin user, sample menu); gated by config.enableDevSeed (MISSING)
│   │   │   │   └── time.ts           — toSqliteTimestamp(): ISO8601 → "YYYY-MM-DD HH:MM:SS"
│   │   │   ├── middleware/
│   │   │   │   ├── errors.ts         — AppError, asyncHandler, notFoundHandler, createErrorHandler
│   │   │   │   ├── originGuard.ts    — Checks Origin on mutating requests; allows GET/HEAD/OPTIONS
│   │   │   │   ├── rateLimit.ts      — In-memory bucket limiter; resetRateLimitsForTests() for test isolation
│   │   │   │   ├── requestValidation.ts — Zod schema middleware
│   │   │   │   └── sessionAuth.ts    — ⚠️ uses config.secureCookies (MISSING)
│   │   │   │                           requirePreSession, requireCustomerSession, requireStaffSession
│   │   │   ├── modules/
│   │   │   │   ├── admin/admin.routes.ts   — Staff login/logout/session; uses config.staffSessionTtlMs (MISSING)
│   │   │   │   ├── auth/auth.routes.ts     — OTP request/verify/session/logout; uses config.otpTtlMs,
│   │   │   │   │                             sessionSecret, otpMaxAttempts, customerSessionTtlMs (ALL MISSING)
│   │   │   │   ├── cart/cart.routes.ts     — GET /api/cart, PUT /api/cart/items; server-authoritative price
│   │   │   │   ├── menu/menu.routes.ts     — Public GET /api/menu; staff CRUD categories+items
│   │   │   │   ├── orders/orders.routes.ts — Customer order create+history; staff mark-paid/completed; idempotency
│   │   │   │   └── qr/qr.routes.ts         — POST /api/qr/validate; uses config.qrSecret, preSessionTtlMs (MISSING)
│   │   │   └── security/
│   │   │       └── crypto.ts         — opaque token, hashToken, HMAC signQrId/verifyQrSignature, createOtp,
│   │   │                               hashOtp/verifyOtp, scrypt hashPassword/verifyPassword; timing-safe
│   │   └── tests/
│   │       └── api.test.ts           — 4 integration tests (QR tamper, server totals, customer-cannot-pay,
│   │                                   staff payment+fulfillment); ALL 4 CURRENTLY FAILING
│   └── web/
│       ├── index.html                — Mounts #root
│       ├── vite.config.ts            — Vite + React plugin; jsdom test env; setup.ts
│       ├── src/
│       │   ├── main.tsx              — React 19 createRoot; imports global.css
│       │   ├── app/App.tsx           — Pathname router: /admin → AdminPage, /t/:id → CustomerOrderPage
│       │   ├── api/client.ts         — apiGet, apiPost, apiPatch, apiPut; credentials:include; typed responses
│       │   ├── components/
│       │   │   ├── StatusPill.tsx    — <span> with tone CSS class (neutral/success/warning)
│       │   │   └── ToolbarButton.tsx — Icon+label button; primary/secondary/quiet variants
│       │   ├── features/
│       │   │   ├── admin/AdminPage.tsx    — Staff login, orders, mark-paid, mark-completed, menu CRUD (467 lines)
│       │   │   └── customer/CustomerOrderPage.tsx — QR, OTP, menu, cart stepper, place order, history (382 lines)
│       │   ├── styles/global.css     — ~480 lines; custom properties; responsive; warm neutral palette; no framework
│       │   └── test/setup.ts         — Only: import "@testing-library/jest-dom/vitest"; NO TEST FILES EXIST
│       └── dist/                     — Built web assets (web was successfully built at some point)
└── packages/
    └── shared/
        ├── src/
        │   ├── index.ts    — Re-exports money, schemas, states
        │   ├── money.ts    — formatInrFromPaise (Intl.NumberFormat); CURRENCY = "INR"
        │   ├── schemas.ts  — All Zod schemas: qrValidateRequestSchema, requestOtpSchema, verifyOtpSchema,
        │   │                 updateCartItemSchema, createOrderSchema (EMPTY strict object), adminLoginSchema,
        │   │                 menu CRUD schemas
        │   └── states.ts   — paymentStates, fulfillmentStates as const + exported types
        └── tests/
            └── schemas.test.ts — 3 tests: offline states only; rejects client totalPaise; quantity 0 OK
```

### 1.2 Domain Area Status Report

#### QR / Table Security
- **STATUS: Implemented but broken (runtime)**
- `POST /api/qr/validate` calls `verifyQrSignature(qrId, signature, config.qrSecret)` at `qr.routes.ts:26`. At runtime, `config.qrSecret` is `undefined`, causing `createHmac("sha256", undefined)` to throw a `TypeError`.
- Tests: **4/4 FAILING** — all cascade from this same error.
- Design is correct: signature verified server-side before any DB lookup; `revoked_at IS NULL` and `dining_tables.active = 1` checked in query. Table context established in pre-session; client cannot inject table ID.

#### OTP / Auth
- **STATUS: Implemented but broken (runtime)**
- Same root cause: `config.sessionSecret` is `undefined`, so every call to `hashOtp()` or `verifyOtp()` crashes.
- No hardcoded OTP bypass exists. `devOtp` returned in response body only when `config.nodeEnv !== "production"` (line 90–91); `nodeEnv` defaults to `"development"` — intentional dev affordance, not a security hole.
- OTP logic itself is correct: hashed (HMAC+salt), attempt-counted, expiry-checked, one-time-consumed, pre-session gated.

#### Menu
- **STATUS: Implemented**
- Public `GET /api/menu` (no auth — intentional: customers browse before authenticating).
- Staff CRUD gated by `requireStaffSession`. Integer paise prices. No modifiers/availability/stock (correct for V1).
- No specific menu tests; covered indirectly.

#### Cart
- **STATUS: Implemented**
- Client sends only `menuItemId` + `quantity`. Price is read from DB in `cart.routes.ts:115`. ✓
- Cart is per customer session, not shared across table. ✓
- `readCart` exported and used by orders module for price re-derivation. ✓

#### Orders
- **STATUS: Implemented**
- `createOrderSchema = z.object({}).strict()` — any client field (e.g. `totalPaise`) rejected with 400. ✓
- Price derived fresh from DB at order creation time (`orders.routes.ts:88`). ✓
- `assertCustomerOwnsOrder` prevents IDOR (`orders.routes.ts:401–413`). ✓
- Idempotency key required; duplicate creation returns existing order. ✓
- State events logged to `order_state_events`. ✓

#### Payments
- **STATUS: Implemented (offline only)**
- DB check: `payment_state IN ('UNPAID', 'PAID')`. ✓
- `mark-paid-offline` requires staff session. `mark-completed` requires both staff session and `payment_state = 'PAID'` first. ✓
- No payment gateway, SDK, webhook, or refund. ✓

#### Kitchen / Staff UI
- **STATUS: Partially implemented** (admin portal exists; no dedicated kitchen view)
- Staff login, order list+detail, mark-paid, mark-completed, menu CRUD all present. ✓
- No real-time push/WebSockets (correct for V1). ✓

#### Database Schema
- **STATUS: Implemented**
- 13 tables: `dining_tables`, `table_qr_codes`, `pre_verification_sessions`, `customers`, `customer_sessions`, `otp_challenges`, `staff_users`, `staff_sessions`, `menu_categories`, `menu_items`, `carts`, `cart_items`, `orders`, `order_items`, `order_state_events`, `idempotency_keys` (+ `schema_migrations`).
- FK ON ✓, unique constraints on token hashes/usernames/order numbers ✓, check constraints on payment/fulfillment state/quantity ✓, integer money ✓, WAL mode ✓.
- Optional audit tables (`qr_scan_events`, `otp_attempts`, `admin_action_events`) not present — acceptable per "if needed" language in docs.

#### Frontend UI
- **STATUS: Implemented**
- Full customer flow (QR landing → OTP → menu+cart → place order → order history). ✓
- Full admin flow (login → orders → mark-paid → mark-completed → menu CRUD). ✓
- Responsive (860px + 520px breakpoints). Mobile-first. Custom CSS. No UI framework.

#### Design System / Theme
- **STATUS: Implemented**
- `global.css`: warm neutral palette, CSS component classes, no external system.

#### OTP Provider Abstraction
- **STATUS: Not implemented**
- Architecture requires an `OtpProvider` adapter. None exists. OTP creation is inline in `auth.routes.ts:57`. No SMS delivery path at all (dev returns OTP in response body).

### 1.3 Build / Test / Typecheck Results — Actual Output

**Shared package tests (`packages/shared`):**
```
✓ keeps payment states offline-only
✓ rejects client-provided totals during order creation
✓ accepts quantity zero so the backend can remove cart items
3/3 PASSING
```

**API integration tests (`apps/api`):**
```
✗ rejects QR signature tampering before establishing table context
  TypeError: The "key" argument must be of type string... Received undefined
  at signQrId (src/security/crypto.ts:23)
  at createTestServer (tests/api.test.ts:180)

✗ creates orders with server-derived totals and offline V1 states  [same]
✗ does not allow a customer session to mark offline payment        [same]
✗ keeps payment and fulfillment changes staff-authorized and sequential [same]

0/4 PASSING
Root cause: createTestConfig() calls createTestConfig({}) which omits config.qrSecret,
so signQrId(qrId, config.qrSecret) = signQrId(qrId, undefined) → TypeError
```

**Web tests (`apps/web`):**
```
No test files found — exit code 1
(setup.ts exists; no *.test.* files present)
```

**TypeScript typecheck:**
```
@d3/shared: 0 errors  ✓
@d3/web:    0 errors  ✓
@d3/api:    15 errors across 5 files

  src/db/seed.ts
    :17  — config.enableDevSeed does not exist on type 'AppConfig'
    :68  — config.qrSecret does not exist on type 'AppConfig'

  src/middleware/sessionAuth.ts
    :47  — config.secureCookies does not exist on type 'AppConfig'
    :57  — config.secureCookies does not exist on type 'AppConfig'

  src/modules/admin/admin.routes.ts
    :53  — config.staffSessionTtlMs does not exist on type 'AppConfig'
    :64  — config.staffSessionTtlMs does not exist on type 'AppConfig'

  src/modules/auth/auth.routes.ts
    :60  — config.otpTtlMs does not exist on type 'AppConfig'
    :82  — config.sessionSecret does not exist on type 'AppConfig'
    :132 — config.otpMaxAttempts does not exist on type 'AppConfig'
    :136 — config.sessionSecret does not exist on type 'AppConfig'
    :170 — config.customerSessionTtlMs does not exist on type 'AppConfig'
    :195 — config.customerSessionTtlMs does not exist on type 'AppConfig'

  src/modules/qr/qr.routes.ts
    :26  — config.qrSecret does not exist on type 'AppConfig'
    :51  — config.preSessionTtlMs does not exist on type 'AppConfig'
    :67  — config.preSessionTtlMs does not exist on type 'AppConfig'
```

---

## Step 2 — Diff Against Documented Plan

| AREA | DOCUMENTED PLAN | ACTUAL STATE | GAP TYPE |
|---|---|---|---|
| Repository structure | `apps/api`, `apps/web`, `packages/shared`, `docs/` | Present and matches | MATCHES |
| `config/env.ts` | Validated env config including all secrets (qrSecret, sessionSecret, etc.) | Only 5 of ~15 config fields defined; all security fields missing | PARTIALLY REMOVED |
| `db/migrations.ts` | All V1 tables with FK, constraints, indexes | All 13 tables present with FK, constraints, indexes | MATCHES |
| `db/seed.ts` | Dev seed gated by `enableDevSeed` | Seed exists, gated by `config.enableDevSeed` (missing from AppConfig) | PARTIALLY REMOVED |
| `security/crypto.ts` | Crypto helpers for sessions, OTP, QR, passwords | All helpers present; timing-safe; node:crypto only | MATCHES |
| `qr.routes.ts` | QR validation with HMAC verification | Implemented correctly; wired to `config.qrSecret` which is missing | PARTIALLY REMOVED |
| `auth.routes.ts` | OTP request/verify, session issue/revoke | Implemented; wired to `config.sessionSecret`, `otpTtlMs`, etc. (missing) | PARTIALLY REMOVED |
| `cart.routes.ts` | Server-authoritative cart; server-calculated totals | Correctly implemented; client cannot send price | MATCHES |
| `orders.routes.ts` | Server-derived total; idempotency; state events; auth checks | Correctly implemented | MATCHES |
| `menu.routes.ts` | Public browse + staff CRUD | Implemented | MATCHES |
| `admin.routes.ts` | Staff login/logout; session; mark-paid; mark-completed | Login/logout/session here; payment/completion in orders.routes.ts — functional but split | MATCHES |
| OTP provider abstraction | `OtpProvider` adapter, SMS delivery behind interface | Not implemented; OTP is inline; no SMS | MISSING |
| `sessionAuth.ts` middleware | Opaque tokens, HTTP-only cookies, revocation checks | Implemented; uses `config.secureCookies` (missing) | PARTIALLY REMOVED |
| Backend module shape | `routes / service / repository` separation per module | All logic in single `*.routes.ts` per module; no service/repo layer | DRIFTED |
| Structured logging | Structured logs with request ID; redacted | No logging; only `console.error` in error handler | MISSING |
| Request correlation ID | Each request has correlation ID | Not present | MISSING |
| `src/observability/` dir | Planned | Not present | MISSING |
| Frontend `hooks/`, `state/`, `utils/` dirs | Planned | Not present | MISSING |
| Frontend component separation | "Do not put app into one large App.tsx; separate pages, components, API client, state, hooks" | `CustomerOrderPage.tsx` (382 lines) and `AdminPage.tsx` (467 lines) mix all concerns | DRIFTED |
| `.env.example` | `.gitignore` explicitly preserves `!.env.example` | File does not exist | MISSING |
| Frontend tests | Component and flow tests | No test files at all | MISSING |
| API tests | Integration tests covering security behavior | 4 tests written; 0 passing (config broken) | PARTIALLY REMOVED |
| `qr_scan_events` table | "if needed" | Not present | MISSING (acceptable) |
| `otp_attempts` table | "if needed" | Not present | MISSING (acceptable) |
| `admin_action_events` table | "if needed" | Not present | MISSING (acceptable) |
| Rate limit thresholds | "Exact production thresholds should be configurable" | Hardcoded in each route file; not in AppConfig | DRIFTED |
| `order_state_events` | Audit trail for state changes | Present and used on create + payment + completion | MATCHES |
| `idempotency_keys` | Order creation idempotency | Present and used | MATCHES |
| Payment: offline only | UNPAID → PAID only; no gateway | Correct; no gateway code | MATCHES |
| Dev seed guard | Blocked in production | Gate exists; `enableDevSeed` flag missing from AppConfig | PARTIALLY REMOVED |
| Architecture doc | Accurate description of current state | Line 5: "No production application code exists yet" — now stale | DRIFTED |
| `assumptions-audit.md` | Record of what was explicitly avoided | Line 24 claims no auth/OTP/QR/payment implementation — now stale | DRIFTED |

**Gap type counts:**
- MATCHES: 14
- PARTIALLY REMOVED: 6 (all trace to `env.ts` truncation)
- DRIFTED: 5 (module shape; page file size; rate limit config; two stale docs)
- MISSING: 8 (OTP adapter; logging; correlation ID; `.env.example`; frontend tests; dirs; optional audit tables)
- ORPHANED: 0

---

## Step 3 — Security-Critical Recheck

### Can the client influence price, total, table identity, payment status, or order status?

**Price / Total: NO — correctly protected**
- `createOrderSchema = z.object({}).strict()` at `packages/shared/src/schemas.ts:60`
- Any client field (e.g. `{ totalPaise: 1 }`) is rejected with HTTP 400 (`VALIDATION_ERROR`)
- Test at `api.test.ts:59` confirms `.send({ totalPaise: 1 }).expect(400)`
- Prices re-read from `menu_items.price_paise` at order creation (`orders.routes.ts:88`)

**Table identity: NO — correctly protected**
- No route accepts a client-provided `tableId` or `diningTableId`
- Table context is established server-side in `pre_verification_sessions` by `qr.routes.ts`, then carried into `customer_sessions.dining_table_id` at OTP completion (`auth.routes.ts:184`)
- Orders inherit `diningTableId` from `customerSession.diningTableId` (`orders.routes.ts:124`)

**Payment status: NO — correctly protected**
- `POST /api/admin/orders/:orderId/mark-paid-offline` is gated by `requireStaffSession` (`orders.routes.ts:246–248`)
- A customer session attempting this gets HTTP 401 (test at `api.test.ts:98` covers this)

**Order completion status: NO — correctly protected**
- `mark-completed` also requires `requireStaffSession` and enforces `payment_state = 'PAID'` as a precondition (`orders.routes.ts:312`)

### Is OTP verification currently enforced server-side?

**The OTP logic is architecturally correct but entirely inoperative due to missing config.**

Exact failure chain:
1. `auth.routes.ts:82` — `hashOtp(otp, salt, config.sessionSecret)` — `config.sessionSecret` is `undefined`
2. `crypto.ts:36` — `createHmac("sha256", undefined)` — throws `TypeError: The "key" argument must be of type string...`
3. Every OTP request and verification attempt crashes at the server level

**No hardcoded OTP bypass exists.** There is no pattern like `if (otp === "000000") return true`. The `devOtp` field in the response is gated on `config.nodeEnv !== "production"` (`auth.routes.ts:90–91`). Since `nodeEnv` defaults to `"development"`, the OTP is visible in dev responses — but this is intentional, documented behavior, not a bypass.

**Verdict: No security shortcut. The OTP check is correct in design. It fails because the secret is missing from config, not because of a deliberate bypass.**

### Are any secrets committed to source?

**No production secrets are committed.**

Confirmed by searching all `.ts` files for API keys, HMAC secrets, and credentials:
- No `D3_QR_SECRET`, `D3_SESSION_SECRET`, or any provider credential values appear in source
- `.env` and `.env.*` files are gitignore'd and do not exist in the repo (filesystem confirmed)
- `seed.ts:14` contains `const devAdminPassword = "admin12345"` — a dev-only known credential committed to source. This is used only when `config.enableDevSeed` is true AND `config.nodeEnv !== "production"`. Because `enableDevSeed` is missing from `AppConfig`, it evaluates as `undefined` (falsy), so the seed would not run in any environment. The production guard works by accident.

**Outstanding issue:** No `.env.example` file exists despite `.gitignore` preserving `!.env.example`. There is no documentation anywhere of which env vars are required to run the project.

### Is QR/table signature verification wired into the relevant routes?

**Yes — in the right place — but broken due to missing config.**

- `qr.routes.ts:26` — `verifyQrSignature(qrId, signature, config.qrSecret)` is called **before** any DB lookup
- If the HMAC check fails → HTTP 400 returned immediately
- No other route accepts a raw `qrId` from the client
- All table-context-dependent routes use pre-session or customer session tokens, not client-provided table IDs
- The signature check is correctly placed as the first gate; it is not bypassable in the current code. It simply crashes because `config.qrSecret` is `undefined`.

---

## Step 4 — Salvage Assessment

### PARTIALLY REMOVED items (all relate to `env.ts` truncation)

**`env.ts` AppConfig missing 10 fields — RECOMMEND KEEP & FIX**
- All 10 missing fields are used correctly throughout the codebase; only the type definition and loading are absent
- One-file fix: add fields to `envSchema`, `AppConfig` type, `loadConfig()` return, and `createTestConfig()` defaults
- Missing fields: `qrSecret`, `sessionSecret`, `secureCookies`, `otpTtlMs`, `otpMaxAttempts`, `preSessionTtlMs`, `customerSessionTtlMs`, `staffSessionTtlMs`, `enableDevSeed`
- Corresponding env vars: `D3_QR_SECRET`, `D3_SESSION_SECRET`, `D3_SECURE_COOKIES`, `D3_OTP_TTL_MS`, `D3_OTP_MAX_ATTEMPTS`, `D3_PRE_SESSION_TTL_MS`, `D3_CUSTOMER_SESSION_TTL_MS`, `D3_STAFF_SESSION_TTL_MS`, `D3_ENABLE_DEV_SEED`

### DRIFTED items

**Backend: all logic in `*.routes.ts` files — RECOMMEND ASK**
- Architecture spec describes `routes / controller / service / repository` per module
- Current code puts everything in one file per module — correct behavior, no layering
- The code is readable and works at the current scale; the rule exists for long-term maintainability
- Question for human: *Is the module refactor (splitting each routes.ts into service.ts + repository.ts) required before V1 launch, or can it be deferred to post-launch cleanup?*

**Frontend: large monolithic page files — RECOMMEND ASK**
- `CustomerOrderPage.tsx` (382 lines) and `AdminPage.tsx` (467 lines) mix state, fetching, and rendering
- Architecture rule: "Separate pages/features, reusable components, API client, state, hooks"
- These are not App.tsx-style god files — each is a coherent single page — but they violate the separation rule
- Question for human: *Should these pages be split into sub-components (OtpForm, MenuSection, CartPanel, etc.) before continuing, or is the monolithic page structure acceptable for V1?*

**Rate limit thresholds hardcoded — RECOMMEND ASK**
- Docs say "exact production thresholds should be configurable"
- Currently hardcoded inline (OTP: 5/10min; order: 20/10min; etc.) — reasonable values for V1
- Question for human: *Should rate-limit thresholds be moved to AppConfig env vars, or are the hardcoded values acceptable for V1?*

**Stale documentation — RECOMMEND FIX (low urgency)**
- `docs/architecture.md:5` — "No production application code exists yet" — now false
- `docs/assumptions-audit.md:24` — "No authentication, OTP, QR, payment, order... implementation was created" — now false
- These should be updated but are not blocking anything

### MISSING items that may be needed

**OTP provider abstraction — RECOMMEND ASK**
- Architecture requires an `OtpProvider` adapter; none exists
- DEC-032 (SMS provider selection) is still UNRESOLVED, making a real adapter academic
- The current design returns `devOtp` in the JSON response for non-production; tests rely on this
- Question for human: *Should an `OtpProvider` interface and dev stub be added now (correct code position for future SMS), or is the inline dev OTP sufficient until the provider is chosen?*

**`.env.example` — RECOMMEND ADD (blocking for new developers)**
- `.gitignore` explicitly preserves `!.env.example`, strongly implying it was planned
- Without it, there is zero documentation of required env vars
- This is the second piece (alongside `env.ts` fix) needed for the project to be startable from a fresh clone

**Structured logging / request IDs — RECOMMEND ASK**
- Architecture requires structured logs with request IDs
- Currently: only `console.error` in the error handler
- Not a correctness issue but a production-readiness gap
- Question for human: *Is structured logging required before V1 launch, or can it be added post-launch?*

**Frontend tests — RECOMMEND ADD (eventually, not blocking)**
- `setup.ts` + vitest config exist; no test files
- Known planned gap; not a surprise removal

---

## Step 5 — Corrected Phase Checklist

| PHASE | ORIGINAL SCOPE | CURRENT STATUS | REMAINING WORK |
|---|---|---|---|
| Bootstrap | Monorepo, workspace config, package.json, tsconfig | ✅ Complete | None |
| Database | Migrations, schema, FK, constraints, seed | ✅ Complete | None |
| QR / Session | QR validation, pre-session creation, table binding | ⚠️ BROKEN — logic correct, config missing | **Fix `env.ts` (restore 10 fields); add `.env.example`; fix `createTestConfig()` defaults** |
| OTP | OTP challenge, hash, verify, attempt limits, expiry, consume, session upgrade | ⚠️ BROKEN — same root cause | Fixed by same `env.ts` fix |
| Design system / theme | CSS design system, component tokens | ✅ Complete | None |
| Customer UI | QR landing, OTP flow, menu browse, cart, place order, order history | ✅ Complete (sub-component split deferred) | Optional refactor for architecture compliance |
| Server-side cart validation | Server-authoritative prices, menu item ID validation, quantity limits | ✅ Complete | None |
| Orders | Order creation from cart, idempotency, snapshots, state events, customer history | ✅ Complete | None |
| Payments | Offline payment state, staff mark-paid, mark-completed, state machine | ✅ Complete | None |
| Kitchen / Staff | Admin portal: login, orders, detail, mark-paid, mark-completed, menu CRUD | ✅ Complete | None |
| Reliability | Transactions, idempotency keys, WAL mode | ✅ Mostly complete | Rate limit thresholds in config (optional) |
| Security audit | Verify zero-trust, no client price, no session fixation | ⚠️ BLOCKED while tests fail | Fix `env.ts` first; then run and verify all 4 tests pass |
| E2E tests | Full customer + admin journeys | ❌ Not started | Not started |
| Performance | Load testing, query optimization | ❌ Not started | Not started |
| Production | HTTPS, proxy, secret storage, backups, monitoring | ❌ Not started — DEC-034 unresolved | Blocked on hosting decisions |
| QR management | QR issuance, rotation, dashboard | Out of V1 scope | Future feature |
| Final audit | Assumptions check, decisions audit | ❌ Not done | Do after reconciliation is acted on |
| README | Setup instructions, dev guide | Thin README only | Add after `.env.example` |
| Assumptions audit | Verify no scope creep | ⚠️ Stale doc | Update to reflect current implemented state |

### Where to Resume

**Immediate unblock: Fix `env.ts`** (estimated: 1–2 hours)

1. Add to `envSchema` in `env.ts`: `D3_QR_SECRET`, `D3_SESSION_SECRET`, `D3_SECURE_COOKIES`, `D3_OTP_TTL_MS`, `D3_OTP_MAX_ATTEMPTS`, `D3_PRE_SESSION_TTL_MS`, `D3_CUSTOMER_SESSION_TTL_MS`, `D3_STAFF_SESSION_TTL_MS`, `D3_ENABLE_DEV_SEED`
2. Add all to the `AppConfig` type with appropriate TypeScript types
3. Return all from `loadConfig()`
4. Add safe defaults to `createTestConfig()` (e.g. `qrSecret: "test-qr-secret"`, `sessionSecret: "test-session-secret"`, `secureCookies: false`, reasonable TTL numbers)
5. Create `.env.example` documenting every variable with example values
6. Run `npm run typecheck` — should drop from 15 errors to 0
7. Run `npm test` — all 4 API tests should now pass

After that fix, the project is in a healthy V1 state and the open decisions become:
- Do the RECOMMEND ASK items above need resolution before continuing?
- When to add the OTP provider abstraction
- When to add frontend tests

---

## Appendix: Evidence Index

| Claim | File | Line(s) |
|---|---|---|
| AppConfig only has 5 fields | `apps/api/src/config/env.ts` | 19–25 |
| qrSecret used in qr route | `apps/api/src/modules/qr/qr.routes.ts` | 26 |
| All 4 tests fail with "Received undefined" | `apps/api/tests/api.test.ts` + test run output | 180 |
| createOrderSchema rejects totalPaise | `packages/shared/src/schemas.ts` | 60 |
| Order reads price from DB | `apps/api/src/modules/orders/orders.routes.ts` | 88 |
| Table ID comes from session not client | `apps/api/src/modules/orders/orders.routes.ts` | 124 |
| mark-paid requires staff session | `apps/api/src/modules/orders/orders.routes.ts` | 246–248 |
| assertCustomerOwnsOrder prevents IDOR | `apps/api/src/modules/orders/orders.routes.ts` | 401–413 |
| devOtp gated on non-production | `apps/api/src/modules/auth/auth.routes.ts` | 90–91 |
| Hardcoded dev password | `apps/api/src/db/seed.ts` | 14 |
| QR verification before DB lookup | `apps/api/src/modules/qr/qr.routes.ts` | 26–28 |
| Timing-safe comparison | `apps/api/src/security/crypto.ts` | 66–74 |
| Cookies are httpOnly | `apps/api/src/middleware/sessionAuth.ts` | 44–51 |
| Architecture doc stale | `docs/architecture.md` | 5 |
| Assumptions-audit stale | `docs/assumptions-audit.md` | 24 |
| No OTP adapter exists | `apps/api/src/modules/auth/auth.routes.ts` | 57 |
| .env.example missing | filesystem (search confirmed) | — |
| Web tests: no test files | `apps/web/src/test/setup.ts` + test run output | — |
