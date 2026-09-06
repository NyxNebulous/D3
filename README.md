# D3 Restaurant Ordering

D3 is a mobile-first restaurant ordering system. Diners scan a table QR code, browse the menu, build a cart, and place an order. Staff use the admin portal to manage the menu, review orders, record offline payment, and mark orders complete.

This repository is a working TypeScript monorepo with a React frontend, Hono API, local SQLite development support, Cloudflare D1 production support, shared validation schemas, signed QR links, customer sessions, staff sessions, and automated tests.

## Implemented Features

- Signed table QR validation with server-side table lookup.
- Customer table sessions and customer login with name and mobile number.
- Menu browsing, backend-owned carts, and server-derived order totals.
- Order creation, customer order history, and fulfillment status.
- Staff login, protected admin operations, and menu management.
- Offline payment and order-completion state transitions.
- Local SQLite and Cloudflare D1 database adapters.
- QR image generation through `genQr.sh`.

Online payments, refunds, inventory, modifiers, and complex role-based access control are outside the current V1 implementation.

## Repository Map

```text
apps/api/                 Hono API, database layer, migrations, scripts, tests
apps/api/src/app.ts       API routes and middleware
apps/api/src/db/          Queries, migrations, seed data, adapters
apps/api/src/security/    Password, token, and QR cryptography
apps/api/wrangler.jsonc   Cloudflare Worker and D1 configuration
apps/web/                 React customer and admin application
apps/web/src/features/    Customer and admin workflows
packages/shared/          Shared schemas, states, and money helpers
docs/                     Architecture, decisions, and security notes
qrs/                      Generated QR images; ignored by Git
genQr.sh                  Generate all signed QR PNGs
```

The web app runs on Vite and React. During local development, Vite serves port `5173` and proxies `/api` to the API on port `4000`. The API runs on Node.js with SQLite locally and as a Cloudflare Worker with D1 in production. The API is authoritative for table identity, sessions, prices, totals, order ownership, payment state, and fulfillment state.

## Prerequisites

- Node.js 20 or newer.
- npm.
- `qrencode` for QR image generation.

On Debian or Ubuntu:

```bash
sudo apt install qrencode
```

## First-Time Setup

Install dependencies from the repository root:

```bash
npm install
```

Create a root `.env` file. It is ignored by Git and must never be committed:

```dotenv
NODE_ENV=development
PORT=4000
D3_DATABASE_PATH=data/d3.sqlite
D3_CORS_ORIGIN=http://localhost:5173
D3_REQUEST_BODY_LIMIT=32kb
HMAC_SECRET=<at-least-32-character-QR-signing-secret>
SESSION_SECRET=<at-least-32-character-session-secret>
D3_SECURE_COOKIES=false
D3_OTP_TTL_MS=600000
D3_OTP_MAX_ATTEMPTS=5
D3_PRE_SESSION_TTL_MS=1800000
D3_CUSTOMER_SESSION_TTL_MS=28800000
D3_STAFF_SESSION_TTL_MS=28800000
D3_ENABLE_DEV_SEED=false
```

Generate strong values with `openssl rand -hex 32`. Use separate values for `HMAC_SECRET` and `SESSION_SECRET`. Rotate any secret exposed in chat, logs, screenshots, or commits.

## Local Development

Start the API in one terminal:

```bash
npm run dev:api
```

Start the frontend in another:

```bash
npm run dev:web
```

Open `http://localhost:5173`. API health checks are available at `http://localhost:4000/health` and `http://localhost:4000/api/health`.

The local server applies migrations to `D3_DATABASE_PATH`. Local database files under `apps/api/data/` are ignored by Git.

## QR Codes

QR links use HMAC-SHA256 signatures over `qr:<qr-id>`. The generator and deployed API must use the same `HMAC_SECRET`.

Generate signed links and PNG files for all configured tables:

```bash
./genQr.sh
```

The output is written as `qrs/table-1.png`, `qrs/table-2.png`, and so on. Use `TABLE_COUNT=2 ./genQr.sh` for a small test batch. The generator refuses to run without `HMAC_SECRET`; there is no fallback signing key.

## Database

The schema covers dining tables and QR identities, customer and staff sessions, OTP challenges, menu categories and items, carts, orders, order items, state events, and idempotency keys.

Local migrations run automatically from `apps/api/migrations/*.sql` when the API starts. For Cloudflare D1:

```bash
npx wrangler d1 migrations apply D3_DB --remote \
	--config apps/api/wrangler.jsonc
```

Review migration files before applying schema changes to an existing production database.

## Testing And Builds

```bash
npm test
npm run typecheck
npm run build
```

Focused commands:

```bash
npm run test --workspace @d3/api
npm run test --workspace @d3/web -- CustomerOrderPage.test.tsx
npm run typecheck --workspace @d3/api
```

## Deployment

The API Worker is configured in `apps/api/wrangler.jsonc`. Production secrets are Cloudflare secrets:

```bash
npx wrangler secret put HMAC_SECRET --config apps/api/wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config apps/api/wrangler.jsonc
npx wrangler deploy --config apps/api/wrangler.jsonc
```

The deployed frontend uses `https://d3-api.nyxnebulous7.workers.dev` by default on `pages.dev`. Set `VITE_API_BASE_URL` during the web build to use another API URL.

After changing `HMAC_SECRET`, regenerate every physical QR code with `./genQr.sh`; old signatures will no longer validate.

## Security Rules

- Never commit `.env`, database files, generated QR images, or secrets.
- Never add a fallback or placeholder signing/session secret.
- Never trust browser-provided table IDs, prices, totals, payment state, or admin flags.
- Keep sessions opaque and server-validated.
- Use HTTPS and secure cookies in production.
- Treat QR validation as the source of table context.
- Authorize state-changing staff operations on the server.

## Documentation

- [Architecture and boundaries](docs/architecture.md)
- [Security model](docs/security.md)
- [Project constitution](docs/project-constitution.md)
- [Decisions](docs/decisions.md)
- [Assumptions audit](docs/assumptions-audit.md)
- [Reconciliation report](docs/reconciliation-report.md)

Some older documents describe the original planned architecture and may mention Express or unimplemented modules. Treat the source tree, package scripts, migrations, and tests as the current implementation source of truth.

