# Security

D3 V1 must be designed as a zero-trust restaurant ordering system. This document records the V1 threat model and required security controls.

No production application code exists yet.

## Security Principles

- Treat browser input as untrusted.
- Validate request shape and domain rules at runtime.
- Derive table context, customer identity, prices, totals, payment state, order ownership, admin privileges, and completion state on the backend.
- Authorize every customer, table, cart, order, admin, menu, payment-state, and fulfillment action.
- Use database constraints and transactions for integrity.
- Keep offline payment marking staff-authorized.
- Keep V1 online payment, payment webhooks, refunds, and reconciliation out of scope.
- Avoid leaking sensitive details in client errors.
- Test valid behavior and malicious or invalid behavior.

## Assets To Protect

- QR identity and table context.
- Customer name, mobile number, verification state, and sessions.
- Staff credentials and sessions.
- OTP challenges and attempts.
- Menu categories, items, and prices.
- Cart contents and backend-derived totals.
- Orders, order item snapshots, payment state, and fulfillment state.
- Admin actions for offline payment, order completion, and menu modification.
- Secrets, signing keys, database contents, logs, and audit trails.

## Actors

- Customer using a browser on a personal device.
- Authorized admin/staff user using the admin portal.
- D3 backend.
- SQLite database.
- OTP/SMS provider.
- Network intermediaries, reverse proxies, or deployment platform.
- Malicious user attempting tampering, replay, abuse, fraud, or unauthorized access.

V1 has no payment provider actor.

## Threat Model

### QR And Table Threats

Threats:

- table ID tampering;
- QR data tampering;
- QR credential guessing;
- use of revoked QR identities in the future;
- cross-table session access.

Controls:

- use permanent QR data that does not expose sensitive secrets;
- validate QR data on the backend;
- map QR identity to table server-side;
- ignore client-provided table IDs for authorization;
- bind customer sessions to validated table context;
- support future revocation/rotation in the data model;
- rate limit QR validation attempts where needed;
- audit suspicious scan failures where needed.

V1 does not attempt GPS, Wi-Fi, Bluetooth, or other physical-presence proof.

### Customer Session Threats

Threats:

- session fixation;
- session theft;
- stale sessions;
- cross-table access;
- client-forged customer identity;
- client-forged OTP verification state.

Controls:

- issue opaque sessions from the backend;
- store session token hashes server-side;
- establish authenticated sessions only after successful OTP verification;
- bind sessions to customer and table context;
- verify expiry and revocation on every request;
- regenerate or upgrade session after OTP verification;
- use HTTP-only secure cookies where appropriate;
- require HTTPS in production;
- do not store authentication/session secrets in localStorage.

Exact production session lifetime is a deferred technical decision.

### OTP Threats

Threats:

- OTP brute force;
- OTP replay;
- OTP flooding;
- mobile-number enumeration;
- delayed or failed SMS delivery;
- plaintext OTP disclosure through logs or storage.

Controls:

- generate random OTPs;
- store hashed OTPs where avoidable;
- expire challenges;
- consume successful challenges once;
- invalidate after successful verification;
- enforce OTP request rate limiting;
- enforce OTP verification rate limiting;
- enforce attempt limits;
- use generic responses that avoid enumeration;
- never log OTPs in production;
- isolate SMS provider details behind an OTP provider abstraction.

Production SMS provider is unresolved.

### Menu, Cart, And Pricing Threats

Threats:

- client-provided price manipulation;
- client-provided subtotal or total manipulation;
- stale client prices;
- invalid item IDs;
- invalid quantities;
- duplicate order creation;
- order spam.

Controls:

- server owns menu prices;
- server recalculates totals from current menu data when order is submitted;
- reject or ignore client-provided prices, subtotals, and totals;
- validate menu item IDs;
- validate quantities with configurable limits;
- use transactions and idempotency protections for order creation;
- snapshot order item names and prices at order creation.

V1 has no modifiers, availability system, stock, inventory, discounts, service charges, tax, or customer notes.

### Order And Offline Payment Threats

Threats:

- customer marks own order as paid;
- customer marks own order as completed;
- client-forged payment state;
- client-forged fulfillment state;
- unauthorized order access;
- cross-table order access;
- race conditions during order creation or admin updates.

Controls:

- initialize orders as `UNPAID`;
- allow only authorized staff/admin sessions to mark `PAID`;
- allow only authorized staff/admin sessions to mark `COMPLETED`;
- enforce order ownership for customer reads;
- enforce staff authorization for admin reads/writes;
- persist order creation and state changes inside transactions;
- audit offline payment and completion changes.

V1 has no refunds, cancellation, payment webhooks, reconciliation, or advanced fulfillment states.

### Admin And Staff Threats

Threats:

- staff password compromise;
- brute force against admin login;
- staff role spoofing;
- customer session accessing admin APIs;
- unauthorized menu changes;
- unauthorized payment/completion changes;
- admin privilege escalation.

Controls:

- use separate staff authentication;
- manually provision staff accounts;
- hash staff passwords securely;
- issue opaque staff sessions;
- protect admin login with rate limiting;
- never trust browser-provided admin privileges;
- centralize authorization checks;
- audit admin actions.

V1 uses a simple authorized staff account model, not complex RBAC.

### API And Platform Threats

Threats:

- malformed requests;
- oversized requests;
- SQL injection;
- XSS;
- CSRF where applicable;
- unsafe CORS;
- debug endpoints;
- secret leakage;
- error information leakage;
- direct API abuse;
- unsafe proxy trust;
- server restart and recovery problems.

Controls:

- runtime request validation;
- strict body size limits;
- parameterized database access;
- safe React rendering and no unsafe HTML injection;
- CSRF controls when cookie-authenticated cross-site requests are possible;
- explicit CORS allowlist;
- no production debug endpoints;
- startup configuration validation;
- safe centralized error responses;
- structured logs with redaction;
- rate limiting;
- SQLite migrations, constraints, indexes, and transactions;
- documented backup and recovery before production.

Production hosting and operations remain unresolved.

### Future Online Payment Threats

Online payment, UPI, card gateways, payment SDKs, webhooks, refunds, and reconciliation are not V1 features.

When online payment becomes in scope, the system must reintroduce provider-authenticated payment verification, amount and currency checks, webhook idempotency, and the rule that browser redirects never mark orders paid.

## Trust Boundaries

### Customer Browser To Web App

WHAT IS TRUSTED:

- The static frontend code only after it is served from a trusted D3 origin.

WHAT IS NOT TRUSTED:

- Browser storage, URL parameters, QR payloads before server validation, displayed table numbers, customer-entered data, route state, client-calculated prices, client-calculated totals, payment-state claims, and completion-state claims.

HOW IT IS VERIFIED:

- The backend validates every API request, derives sensitive values, and authorizes access using server-side session and database state.

### Web App To API

WHAT IS TRUSTED:

- TLS-protected transport after production HTTPS is configured.
- Backend-issued opaque session references only after server lookup.

WHAT IS NOT TRUSTED:

- Request bodies, headers, IDs, cookies before validation, table IDs, customer IDs, prices, totals, payment states, fulfillment states, admin privilege claims, timestamps, and device identifiers.

HOW IT IS VERIFIED:

- Runtime schemas, session lookup, CSRF checks where applicable, authorization policies, rate limits, and domain service validation.

### Customer Session To Backend State

WHAT IS TRUSTED:

- Server-side customer session records that are found by token hash and pass expiry, revocation, and table-context checks.

WHAT IS NOT TRUSTED:

- Client claims about customer identity, table identity, OTP completion, session freshness, cart ownership, or order ownership.

HOW IT IS VERIFIED:

- Session middleware loads the server record and binds the request to customer/table context used by authorization policies.

### Admin Browser To API

WHAT IS TRUSTED:

- Server-side staff session records after username/password authentication.

WHAT IS NOT TRUSTED:

- Browser-provided staff user IDs, admin flags, role names, permissions, menu update authority, order payment state, and order completion state.

HOW IT IS VERIFIED:

- Staff authentication middleware, centralized authorization checks, database-backed staff account lookup, and audit logging.

### API To SQLite

WHAT IS TRUSTED:

- Database constraints and committed transaction state.

WHAT IS NOT TRUSTED:

- Raw SQL assembled from request input, unchecked enum strings, unchecked foreign keys, and application assumptions not enforced by constraints.

HOW IT IS VERIFIED:

- Parameterized queries, migrations, foreign keys, unique constraints, check constraints, transactions, repository tests, and rollback behavior.

### API To OTP/SMS Provider

WHAT IS TRUSTED:

- Provider responses only after they match the configured OTP provider adapter contract.

WHAT IS NOT TRUSTED:

- Browser claims that OTP was sent or verified, provider delivery success as proof of customer identity, and unvalidated callback data if callbacks are ever used.

HOW IT IS VERIFIED:

- Local challenge records, hashed OTP comparison, attempt counters, expiration, one-time consumption, provider adapter validation, and generic user-facing responses.

### Reverse Proxy Or Hosting Platform To API

WHAT IS TRUSTED:

- Forwarded protocol and client IP headers only from explicitly configured trusted proxies.

WHAT IS NOT TRUSTED:

- Forwarded headers from arbitrary clients, platform environment variables before validation, request size limits unless configured, and any deployment claim not represented in validated configuration.

HOW IT IS VERIFIED:

- Explicit trusted proxy configuration, startup configuration validation, HTTPS/TLS policy, request limits, and operational documentation.

### Future Payment Provider Boundary

WHAT IS TRUSTED:

- Nothing in V1 because no payment provider is integrated.

WHAT IS NOT TRUSTED:

- Any browser claim that an order has been paid online.

HOW IT IS VERIFIED:

- In V1, only authorized staff/admin action can change payment state to `PAID`. Future online payment must add provider-authenticated verification before any online paid state is accepted.

## Security Control Requirements

### Request Validation

Every API request must be validated with runtime schemas before domain logic and database writes.

### Authentication

Customer authentication must use mobile number plus SMS OTP. Staff authentication must use username and password. Both must establish backend-issued opaque sessions.

### Authorization

Authorization must be explicit per action. IDOR/BOLA checks must be tested for customer and admin APIs.

### CSRF

If browser sessions use cookies, CSRF protection must be included for state-changing routes where SameSite policy is insufficient for the deployment shape.

### XSS

The frontend must avoid unsafe HTML injection. V1 has no customer notes, which reduces free-text abuse scope. Admin-entered menu text must still be rendered safely.

### SQL Injection

Repositories must use parameterized queries and must not concatenate untrusted SQL fragments.

### Idempotency

Duplicate-sensitive operations must use idempotency keys, transactions, unique constraints, or equivalent safeguards. Required areas include order creation and admin state changes where duplicate submissions could cause inconsistent state.

### Rate Limiting

Rate limits must cover OTP requests, OTP verification, authentication, order creation, and admin login. Exact thresholds should be configurable.

### Error Handling

Client errors must not reveal stack traces, SQL errors, OTP state details, password details, session internals, secret values, or whether a mobile number is known.

### Logging And Audit

Logs must be structured and redacted. Audit records should cover QR validation, OTP events, customer sessions, staff login, order creation, offline payment marking, order completion, and menu changes.

## Security Testing Expectations

Security-sensitive features must include valid and malicious tests.

Required future V1 test areas:

- QR tampering and cross-table protection;
- OTP rate limits, expiry, replay, attempt limits, and enumeration resistance;
- session creation, upgrade, expiry, revocation, fixation protection, and cross-table authorization;
- IDOR/BOLA resistance for customer and admin APIs;
- backend-derived cart totals and rejected client-provided totals;
- invalid item IDs and invalid quantities;
- duplicate order creation prevention;
- customer attempts to mark orders `PAID`;
- customer attempts to mark orders `COMPLETED`;
- unauthorized admin access;
- admin login brute-force protection;
- staff password hashing behavior;
- menu modification authorization;
- database transaction rollback on failure;
- safe error responses;
- redaction of OTPs, passwords, session secrets, and unnecessary customer data from logs.

Future online payment tests must be added only when online payment enters scope.

## Security Implementation Gates

Do not implement the following until decisions are resolved:

- Production menu seed/content without the real D3 menu.
- Production SMS delivery without selecting a production SMS provider.
- Production deployment without hosting, HTTPS/proxy, domains, secrets, backups, logging, monitoring, CORS, cookie, and trusted proxy decisions.
- Retention/deletion automation without a data retention policy.

Do not implement these V1-deferred features:

- online payment gateway;
- payment SDK integration;
- payment webhooks;
- refunds;
- reconciliation;
- item availability;
- inventory;
- modifiers;
- customer notes;
- tax;
- discounts;
- service charges;
- advanced order states;
- complex kitchen workflow;
- realtime/WebSocket infrastructure;
- analytics;
- loyalty;
- advanced customer history;
- advanced staff roles;
- QR management dashboard.

