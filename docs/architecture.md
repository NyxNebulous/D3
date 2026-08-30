# Architecture

D3 V1 is a mobile-first QR restaurant ordering system using React, TypeScript, Vite, Node.js, Express, TypeScript, SQLite, and runtime schema validation.

This document is an architecture blueprint only. No production application code exists yet.

## V1 Scope

The authoritative V1 workflow is:

1. Customer scans a permanent table QR code.
2. Customer lands on D3.
3. Customer enters name and mobile number.
4. Customer verifies OTP delivered through SMS.
5. Customer browses configured D3 menu categories and items.
6. Customer creates a cart.
7. Customer confirms the order.
8. Server creates the order with authoritative prices and total.
9. Customer pays offline.
10. Authorized admin/staff records offline payment.
11. Authorized admin/staff marks the order completed.

V1 does not include online payment, payment webhooks, refunds, item modifiers, item availability, inventory, customer notes, shared table carts, advanced order statuses, realtime infrastructure, analytics, public business pages, or complex RBAC.

## Architecture Goals

- Keep the system small, modular, and understandable.
- Treat the browser as an untrusted client.
- Keep security-sensitive validation and derivation on the backend.
- Separate customer UI, admin/staff UI, API, domain logic, persistence, providers, and shared schemas.
- Allow OTP provider, authentication implementation, database access, customer UI, admin/staff UI, order states, menu features, and future online payment providers to evolve without rewriting unrelated modules.
- Avoid speculative business rules.
- Keep future features out of V1 implementation.

## Planned Repository Structure

The following structure is planned, not implemented:

```text
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── createApp.ts
│   │   │   │   └── server.ts
│   │   │   ├── config/
│   │   │   ├── db/
│   │   │   │   ├── migrations/
│   │   │   │   ├── sqlite/
│   │   │   │   └── transaction.ts
│   │   │   ├── middleware/
│   │   │   ├── modules/
│   │   │   │   ├── admin/
│   │   │   │   ├── auth/
│   │   │   │   ├── carts/
│   │   │   │   ├── customers/
│   │   │   │   ├── menu/
│   │   │   │   ├── orders/
│   │   │   │   ├── otp/
│   │   │   │   ├── payments/
│   │   │   │   ├── qr/
│   │   │   │   └── tables/
│   │   │   ├── observability/
│   │   │   ├── security/
│   │   │   └── test-support/
│   │   └── tests/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── api/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── admin/
│       │   │   └── customer/
│       │   ├── hooks/
│       │   ├── routes/
│       │   ├── state/
│       │   ├── styles/
│       │   ├── test-support/
│       │   └── utils/
│       └── tests/
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── api/
│       │   ├── domain/
│       │   ├── errors/
│       │   └── validation/
│       └── tests/
└── docs/
```

The first implementation may create only the parts needed for the current phase. Empty folders should not be added merely to mirror this tree.

## Frontend Architecture

The frontend should be one Vite React application with separate customer and admin feature areas. It can be split later only if product or deployment needs require it.

### Customer Features

- QR landing/start page.
- Name and mobile number entry.
- OTP request and verification.
- Menu category and item browsing.
- Cart review and quantity updates.
- Confirm order.
- Order confirmation with human-friendly order number.
- Current table-session order history.

### Admin Features

- Staff login.
- Order list.
- Order detail.
- Table and customer operational information.
- Payment state display.
- Mark offline payment as received.
- Mark order as completed.
- Menu category/item/price modification.

### Frontend Rules

- Do not put the application into one large `App.tsx`.
- Separate pages/features, reusable components, API client, state, hooks, domain types, validation, and utilities.
- Do not let frontend state become authoritative for table, identity, OTP status, prices, totals, payment state, order ownership, admin privileges, or completion state.
- Treat client validation as usability only.
- Do not store authentication/session secrets in localStorage.
- Do not build V1 screens for future features.

## Backend Architecture

The backend should be an Express API with domain modules and thin HTTP routes.

### Backend Layers

- routes/controllers: HTTP request parsing, response shape, and status codes.
- validation: runtime request and response schemas.
- services: domain workflows, authorization decisions, and state transitions.
- repositories: database reads and writes.
- provider adapters: OTP delivery provider abstraction for V1.
- authentication: customer and staff session creation, verification, renewal, and invalidation.
- authorization: customer/table/order checks and admin/staff action checks.
- middleware: request IDs, body limits, security headers, CORS, cookies, sessions, rate limits, and error handling.
- configuration: validated environment and feature configuration.
- observability: structured logs and audit events.

### Backend Module Shape

Each domain module should follow this shape when useful:

```text
modules/<domain>/
├── <domain>.routes.ts
├── <domain>.controller.ts
├── <domain>.service.ts
├── <domain>.repository.ts
├── <domain>.schemas.ts
├── <domain>.types.ts
└── <domain>.test.ts
```

This is a guideline, not a requirement to create unnecessary files.

### V1 Domain Modules

- `qr`: validate permanent QR data and establish server-authoritative table context.
- `tables`: manage configured table records.
- `customers`: store required customer identity fields.
- `otp`: create, deliver, verify, expire, consume, and audit OTP challenges.
- `auth`: issue and validate customer/admin sessions.
- `menu`: categories, items, prices, and admin menu modification.
- `carts`: backend-owned carts and server-authoritative total calculation.
- `orders`: order creation, order snapshots, current-session order history, and simple completion state.
- `payments`: internal offline payment state only.
- `admin`: staff authentication and authorized operational actions.

### Provider Boundaries

V1 uses only an OTP provider abstraction:

- `OtpProvider`: send OTP challenge and return delivery metadata where supported.

The production SMS provider is unresolved. A development provider may be used for local development and automated tests.

Do not implement a V1 payment provider adapter, payment SDK, webhook handler, refund workflow, or reconciliation workflow. A future online payment module should be able to plug into the payment boundary without changing carts, orders, or admin authorization.

## Database Architecture

SQLite is the V1 database. Schema changes must use migrations. Application code must use parameterized queries through repositories and transactions for multi-step changes.

### Entity Groups

The database design is conceptual until migrations are implemented.

#### Tables And QR

- `dining_tables`: stable server-side table records; table count is configurable.
- `table_qr_codes`: permanent QR identities mapped to dining tables, with fields to support validation, revocation, and future rotation.
- `qr_scan_events`: security/audit record of QR scan attempts if needed.

Relationships:

- one dining table may have one current permanent QR code and may have historical QR records later;
- one QR record maps to one dining table;
- the browser cannot choose a table by changing a request parameter.

V1 has no QR management dashboard and no physical-presence proof.

#### Customers And Sessions

- `customers`: customer identifier, required name, mobile number, and timestamps.
- `customer_sessions`: server-issued session records bound to a customer and dining table.
- `pre_verification_sessions`: short-lived records created after QR validation and before OTP success, if needed.

Relationships:

- one customer may have many sessions over time;
- one dining table may have many customer sessions;
- one customer session is tied to one table context;
- one customer can place multiple orders in the same session;
- multiple customers at the same table have independent sessions, carts, and orders.

Exact data retention remains unresolved.

#### OTP

- `otp_challenges`: challenge records with hashed OTP, mobile number reference or hash, expiration, attempt counters, consumed timestamp, and provider metadata.
- `otp_attempts`: audit records for verification attempts if needed.

Relationships:

- one authentication flow may create OTP challenges according to rate-limit policy;
- one challenge can be consumed once;
- successful verification establishes or upgrades the customer session.

Production SMS provider remains unresolved.

#### Menu

- `menu_categories`: configured category records.
- `menu_items`: configured item records with category association and authoritative integer INR price.
- `menu_change_events`: audit trail for admin menu modifications if needed.

Relationships:

- one category has many menu items;
- one menu item belongs to one category;
- order items snapshot names and prices so historical orders remain stable after menu edits.

V1 has no modifiers, customization, availability flags, stock quantities, ingredient tracking, inventory, or customer notes.

The real D3 menu content remains unresolved.

#### Carts

- `carts`: backend-owned cart bound to one authenticated customer session and table.
- `cart_items`: selected menu item IDs and quantities.

Relationships:

- one customer session may have an active cart;
- one cart has many cart items;
- one cart belongs to one customer/table session;
- carts are not shared globally across the table.

The server recalculates totals from current menu prices when an order is submitted.

#### Orders

- `orders`: order header with internal ID, public order number, customer, table, session, authoritative total, currency, payment state, fulfillment state, and timestamps.
- `order_items`: immutable item snapshots with item name, quantity, unit price, and line total.
- `order_state_events`: audit trail for payment and fulfillment changes.

Relationships:

- one cart may create one order inside a transaction;
- one order belongs to one customer and one dining table;
- one order has many order items;
- historical order item prices remain stable after creation.

V1 payment states:

- `UNPAID`;
- `PAID_OFFLINE`.

V1 fulfillment states:

- `PENDING`;
- `COMPLETED`.

No customer cancellation, staff cancellation, refunds, or advanced preparation states are included in V1.

#### Staff/Admin

- `staff_users`: manually provisioned staff accounts with username and securely hashed password.
- `staff_sessions`: server-issued staff session records.
- `admin_action_events`: audit trail for payment, completion, menu, and login-related admin actions if needed.

Relationships:

- one staff user may have many sessions over time;
- V1 uses a simple authorized staff account model;
- future roles can be added later without changing customer/order ownership.

#### Offline Payments

- payment state can live on `orders` for V1 because payment is offline and simple.
- `order_state_events` should record admin/staff action when an order is marked `PAID_OFFLINE`.

There are no payment attempts, payment provider events, payment webhooks, refunds, or reconciliation tables in V1.

#### Operational Integrity

- `idempotency_keys`: duplicate-sensitive request protection for order creation and possibly admin state changes.
- `rate_limit_buckets`: persisted or replaceable rate-limit state if needed.
- `audit_log` or domain action event tables: security-sensitive events and administrative changes.

Retention periods and production log storage remain unresolved.

### Database Constraints

Expected constraints include:

- foreign keys enabled on every SQLite connection;
- unique stable table identifiers;
- unique active QR identities;
- unique active session token hashes;
- unique staff usernames;
- unique public order numbers;
- check constraints for `UNPAID`/`PAID_OFFLINE` payment state;
- check constraints for `PENDING`/`COMPLETED` fulfillment state;
- positive quantity checks for cart and order items;
- integer INR money values;
- indexes on session lookup, table/order lookup, order number lookup, admin order list fields, OTP lookup, and rate-limit keys.

## Shared Types And Schemas Architecture

Shared code should live in `packages/shared` and contain only code safe for both frontend and backend.

Shared package contents:

- API request schemas;
- API response schemas;
- public domain enums such as V1 payment and fulfillment states;
- error code types;
- validation helpers that do not depend on server secrets;
- serialization formats for IDs, timestamps, and integer money values.

Shared package exclusions:

- database queries;
- OTP provider SDK code;
- secret-bearing configuration;
- authorization decisions;
- server-only pricing derivation.

The backend remains authoritative even when schemas are shared.

## Authentication Architecture

D3 should use opaque backend-issued sessions rather than trusting client-stored identity claims.

### Customer Authentication

Customer authentication is tied to validated QR/table context and SMS OTP verification.

Flow:

1. Backend validates QR data and maps it to a table.
2. Backend creates a pre-verification flow or session.
3. Customer submits required name and mobile number.
4. Backend creates an OTP challenge.
5. OTP provider abstraction sends SMS.
6. Customer submits OTP.
7. Backend verifies challenge state, attempt limits, expiry, and one-time use.
8. Backend establishes a customer session bound to customer and table.

### Staff Authentication

Staff authentication is separate from customer authentication.

Flow:

1. Staff account is manually provisioned.
2. Staff logs in with username and password.
3. Backend verifies securely hashed password.
4. Backend issues an opaque staff session.
5. Admin actions are authorized against the server-side staff session.

V1 has no public staff registration and no complex RBAC.

## Customer Session Architecture

Customer sessions should be server-side records referenced by an opaque HTTP-only cookie where appropriate.

The backend must bind each customer session to:

- customer ID;
- customer name and mobile number record;
- validated dining table context;
- session token hash;
- expiry and revocation state;
- security metadata needed for abuse detection.

Every customer request must verify that the session exists, has not expired, has not been revoked, and is authorized for the requested cart/order/table context.

Production requires HTTPS.

## Table And QR Security Architecture

QR codes are permanent and physically attached to restaurant tables. The QR establishes the intended table context, but the server remains authoritative.

The QR architecture should support:

- stable non-sensitive QR identity;
- tamper-evident QR data;
- server-side mapping from QR identity to table;
- key versioning;
- future revocation;
- future rotation;
- scan audit events if needed;
- rate limiting.

V1 does not require a QR management dashboard, daily QR rotation, GPS, Wi-Fi, Bluetooth, or other physical-presence systems.

## OTP Architecture

The OTP module owns challenge creation, random OTP generation, delivery request, verification, attempt counting, expiration, consumption, session establishment, and audit events.

OTP provider-specific details belong behind an adapter. Domain code must not depend directly on an SMS SDK.

OTP verification must:

- generate random OTPs;
- store only hashed OTPs where avoidable;
- expire challenges;
- consume successful challenges once;
- invalidate challenges after successful verification;
- enforce request rate limits;
- enforce verification rate limits;
- enforce attempt limits;
- avoid enumeration through overly specific responses;
- protect against session fixation when establishing the authenticated session;
- avoid logging OTPs in production.

Production SMS provider remains unresolved.

## Menu Architecture

The menu module owns trusted categories, items, and integer INR prices.

The customer frontend receives menu display data from the backend. Cart and order workflows reference backend IDs, and the backend revalidates every selection against current trusted menu data.

Menu architecture must support:

- category browsing;
- item browsing;
- current configured price display;
- admin category/item/price modification;
- immutable order item snapshots.

V1 must not implement modifiers, customization, availability, stock, inventory, ingredients, or customer notes.

## Cart Architecture

Carts are backend-owned and tied to one authenticated customer/table session. There is no shared table cart.

The browser may submit:

- menu item ID;
- quantity.

The browser must not submit authoritative:

- price;
- subtotal;
- total;
- table ID;
- customer ID;
- order ownership.

Cart service responsibilities:

- validate customer/table session ownership;
- validate menu item existence;
- validate quantities using configurable technical limits;
- calculate line totals and cart totals from trusted menu prices;
- revalidate menu data when order is submitted;
- prevent duplicate order creation during checkout.

Price-change behavior is simple: the current server-authoritative menu price is used when creating the order.

## Order Architecture

Orders are created from a validated cart inside a database transaction.

The order must record:

- internal order ID;
- human-friendly public order number;
- customer association;
- table association;
- ordered items;
- quantities;
- authoritative unit prices;
- authoritative line totals;
- authoritative order total;
- currency;
- creation timestamp;
- payment state;
- fulfillment state.

Order service responsibilities:

- create orders from validated carts;
- generate public order numbers;
- snapshot item names and prices;
- expose current-session customer order history;
- expose authorized admin order lists and details;
- allow authorized staff to mark offline payment received;
- allow authorized staff to mark orders completed;
- audit state changes.

V1 does not include cancellation, refunds, advanced preparation states, realtime kitchen queues, or WebSockets.

## Payment Architecture

V1 payment is offline only.

Payment service responsibilities:

- initialize new customer orders as `UNPAID`;
- expose payment state to the customer and admin UI;
- allow only authorized staff/admin sessions to mark an order `PAID_OFFLINE`;
- prevent customers from marking their own orders paid;
- audit offline payment state changes.

Do not integrate Razorpay, Stripe, Cashfree, UPI gateway, card gateway, or any payment SDK in V1.

Future online payment support should be added through a separate provider boundary without changing cart ownership, order snapshots, or admin authorization rules.

## Payment Webhook Architecture

V1 has no payment webhooks.

No webhook endpoint, provider signature verification, payment event table, refund flow, or reconciliation job should be implemented for V1.

Future online payment architecture must use provider-authenticated webhooks or equivalent verified provider events, idempotent processing, amount/currency validation, and no browser-authoritative payment success.

## Admin And Fulfillment Architecture

V1 admin portal is the internal operational UI.

Admin/staff can:

- log in;
- view orders;
- see order details;
- see table context;
- see customer information necessary for operations;
- see authoritative total;
- see payment state;
- mark offline payment as received;
- mark order as completed;
- modify menu categories, items, and prices.

The fulfillment model is deliberately simple:

- `PENDING`;
- `COMPLETED`.

No sophisticated kitchen workflow, advanced queues, realtime infrastructure, WebSockets, or analytics are included in V1.

## Authorization Architecture

Authorization should be centralized in policy functions used by controllers and services.

Customer policies:

- can access only carts/orders bound to the authenticated customer session and table context;
- cannot provide table/order/customer IDs to bypass ownership;
- cannot mark payment received;
- cannot mark orders completed;
- cannot access admin APIs.

Admin/staff policies:

- require staff authentication;
- allow V1 admin operations only for authorized staff accounts;
- never infer admin privilege from the browser;
- protect login and admin actions against brute force and CSRF where applicable.

System policies:

- order creation derives prices from menu data;
- offline payment changes require staff session authorization;
- fulfillment completion requires staff session authorization.

Future roles can be added later, but V1 must not invent role names such as manager, kitchen, cashier, or super admin.

## Error Handling

The API should use a consistent error model:

- stable machine-readable error code;
- safe human-readable message;
- HTTP status code;
- request correlation ID;
- optional field-level validation details;
- no stack traces, secrets, OTP values, password details, SQL details, or session internals in client responses.

Authentication and OTP errors should avoid account or mobile-number enumeration.

## Logging

Logging should be structured and include request IDs.

Logs may contain:

- request ID;
- order ID where relevant;
- timestamp;
- operation;
- error information necessary for debugging.

Logs must not contain:

- OTPs;
- passwords;
- session secrets;
- API keys;
- payment secrets;
- unnecessary sensitive customer information.

Log categories:

- HTTP request summary;
- QR validation outcome;
- OTP send and verification outcome without OTP values;
- customer session events;
- staff login events;
- rate-limit decisions;
- cart and order creation events;
- offline payment marking events;
- fulfillment completion events;
- menu modification events;
- unexpected errors.

## Rate Limiting

Rate limiting should be middleware plus domain-specific guards. Exact production thresholds should be configurable.

Required V1 rate-limit areas:

- OTP requests;
- OTP verification;
- authentication;
- order creation;
- admin login.

Optional rate-limit keys:

- IP address or trusted proxy-derived client IP;
- customer session ID;
- table context;
- mobile number hash;
- QR identity;
- staff username or staff user ID;
- operation name.

Do not add CAPTCHA in V1.

## Testing Architecture

Testing must include both valid behavior and malicious or invalid behavior.

Expected test layers:

- shared schema tests;
- service unit tests for domain rules;
- repository tests against SQLite migrations;
- API integration tests for validation, authentication, authorization, and error handling;
- security tests for QR tampering, OTP abuse, IDOR/BOLA, cross-table access, duplicate order creation, customer payment-state tampering, admin privilege escalation, and SQL injection resistance;
- frontend component and flow tests for customer and admin screens once UI exists;
- end-to-end tests for the V1 customer and admin journeys after feature implementation.

OTP provider adapters should have contract tests using development/test provider fixtures. Future payment provider adapters should be tested only when online payment becomes in scope.

## Configuration Architecture

Configuration should be validated at startup using runtime schemas.

Configuration groups:

- server host, port, and public base URLs;
- web app origin and CORS policy;
- database path and migration settings;
- session secrets and cookie settings;
- QR signing or validation keys;
- OTP provider mode and credentials;
- rate-limit settings;
- logging level and redaction controls;
- staff bootstrap/provisioning settings if used;
- deployment mode and trusted proxy settings.

Secrets must not be committed. Missing required configuration must fail startup.

## Deployment Boundaries

Initial deployment boundaries should stay simple:

- web app: static frontend assets;
- API app: Express server handling API routes;
- SQLite database: durable server-side database file with backups;
- OTP provider: SMS delivery behind adapter;
- reverse proxy or platform edge: TLS termination, request size limits, and trusted client IP forwarding if used.

Production requires HTTPS.

Production hosting, domains, CORS origins, cookie domain, secret storage, trusted proxy settings, backups, restore process, logging infrastructure, monitoring, and operational ownership remain unresolved.

## Implementation Gates

Architecture is ready to guide V1 scaffolding. Feature implementation must stop when it reaches an unresolved product decision.

Current gates:

- Production menu content is blocked until the real D3 menu is provided.
- Production SMS delivery is blocked until a production SMS provider is selected.
- Production deployment is blocked until hosting, HTTPS/proxy, domains, secrets, backups, logging, monitoring, and CORS/cookie settings are decided.
- Data-retention automation is blocked until retention/deletion policy is decided.

V1 implementation must not include explicitly deferred future features.

