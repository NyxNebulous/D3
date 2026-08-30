# Decisions

This file records confirmed D3 V1 product decisions, technical defaults, future features, and remaining unresolved decisions.

The D3 V1 product specification is authoritative. Future features must not be implemented as V1 features.

## Confirmed Product Decisions

### DEC-001: Project Name

Status: ACCEPTED

Decision: The restaurant and application name is `D3`.

Rationale: The product specification explicitly defines the name and forbids invented variants.

### DEC-002: Frontend Stack

Status: ACCEPTED

Decision: Use React, TypeScript, and Vite.

Rationale: This stack was explicitly requested and supports a modular mobile-first frontend.

### DEC-003: Backend Stack

Status: ACCEPTED

Decision: Use Node.js, Express, and TypeScript.

Rationale: This stack was explicitly requested and supports a simple modular API.

### DEC-004: Database

Status: ACCEPTED

Decision: Use SQLite for V1 with migrations, foreign keys, constraints, indexes where justified, transactions, and integer money representation.

Rationale: SQLite was explicitly requested for V1. JSON files must not be used as the database.

### DEC-005: V1 Workflow

Status: ACCEPTED

Decision: V1 workflow is scan QR, land on D3, enter mobile number and name, verify OTP, browse menu, create cart, confirm order, order is created, customer pays offline, authorized admin/staff records payment, and order is fulfilled.

Rationale: This is the authoritative V1 workflow.

### DEC-006: V1 Payment Model

Status: ACCEPTED

Decision: V1 has no online payment gateway. Payment happens offline. The internal payment states are `UNPAID` and `PAID_OFFLINE`.

Rationale: The product specification explicitly excludes online payment, UPI, cards, payment SDKs, payment webhooks, refunds, and reconciliation from V1.

### DEC-007: Customer Authentication

Status: ACCEPTED

Decision: Customer authentication uses mobile number plus mandatory OTP delivered through SMS. Customer name is required during the ordering/authentication flow.

Rationale: The product specification requires mobile number, SMS OTP, and customer name.

### DEC-008: Currency And Money

Status: ACCEPTED

Decision: Use INR and store authoritative money values as safe integers. V1 has no tax, no service charge, no coupons, no promotional discounts, and no discount engine.

Rationale: The product specification explicitly defines INR/simple pricing and excludes tax, service charges, and discounts from V1.

### DEC-009: Menu Scope

Status: ACCEPTED

Decision: V1 menu data supports categories, menu items, and prices. V1 does not include modifiers, item customization, availability flags, stock, inventory, ingredients, or customer notes.

Rationale: The product specification requires a proper menu data model but intentionally excludes those extra features from V1.

### DEC-010: Tables And QR Codes

Status: ACCEPTED

Decision: Table count is configurable. Each table has a stable server-side identity. QR codes are permanent and physically attached to tables. V1 does not include a QR management dashboard or physical-presence checks such as GPS, Wi-Fi, or Bluetooth.

Rationale: The product specification requires permanent table QR codes, server-authoritative table context, and a simple physical model.

### DEC-011: Customer Sessions

Status: ACCEPTED

Decision: Customer sessions are associated with the authenticated customer and the table context established by the QR flow. Sessions must use secure server-side authorization and secure HTTP-only cookies where appropriate. Authentication/session secrets must not be stored in localStorage. Production requires HTTPS.

Rationale: The product specification requires table-bound customer sessions and forbids treating the frontend as a security boundary.

### DEC-012: Staff Account Model

Status: ACCEPTED

Decision: V1 uses a simple authorized admin/staff account model rather than complex multi-role RBAC. Staff authenticate with username and password. Staff accounts are manually provisioned. Public staff registration is not included.

Rationale: The product specification requires an admin portal and staff login, but explicitly excludes invented roles and complex RBAC.

### DEC-013: Order Lifecycle

Status: ACCEPTED

Decision: V1 uses a simple order lifecycle. Orders are either pending/not completed or completed/done. Customers cannot cancel orders. Staff cancellation is not required in V1.

Rationale: The product specification intentionally excludes advanced order states, cancellation, and refund workflows from V1.

### DEC-014: Restaurant Business Information

Status: ACCEPTED

Decision: V1 does not include public business-information pages, address, phone, opening hours, refund policy, legal information, social media, or restaurant description.

Rationale: The product specification explicitly forbids inventing these details.

### DEC-015: Multiple Customers Per Table

Status: ACCEPTED

Decision: A table can have multiple customers. Each scanner can independently place one or more orders. There is no globally shared cart.

Rationale: The product specification defines independent sessions/orders per table and forbids a complicated shared-table-cart system.

### DEC-016: Customer Order History Scope

Status: ACCEPTED

Decision: V1 provides simple customer access to current-session orders for the current table session. Broader customer account/history features are future scope.

Rationale: The product specification requires only current-session order history in V1.

### DEC-017: Admin Portal Scope

Status: ACCEPTED

Decision: V1 admin portal allows authorized staff to log in, view orders, see order details, see table, see customer information necessary for operations, see total, see payment state, mark offline payment as received, mark order as completed, and modify menu data.

Rationale: These capabilities are explicitly required for V1.

## Technical Defaults

### DEC-018: Planned Repository Shape

Status: TECHNICAL DEFAULT

Decision: Use `apps/api`, `apps/web`, `packages/shared`, and `docs` as the top-level structure when implementation begins.

Rationale: This keeps frontend, backend, shared schemas, and documentation separate without unnecessary infrastructure.

### DEC-019: Single Frontend Application Initially

Status: TECHNICAL DEFAULT

Decision: Start with one Vite React frontend containing separate customer and admin/staff feature areas.

Rationale: This keeps V1 small while allowing customer UI and admin/staff UI to split later if required.

### DEC-020: Domain-Modular Backend

Status: TECHNICAL DEFAULT

Decision: Organize backend code by domain modules with thin routes/controllers, runtime validation, services, repositories, middleware, configuration, authentication, authorization, and provider adapters where needed.

Rationale: This keeps business logic out of route handlers and allows domains to evolve independently.

### DEC-021: OTP Provider Abstraction

Status: TECHNICAL DEFAULT

Decision: Use an OTP provider abstraction. V1 may use a development provider for local development and testing. No production SMS provider is selected yet.

Rationale: SMS provider selection is not finalized, but OTP delivery must remain replaceable.

### DEC-022: Server-Authoritative Cart And Pricing

Status: TECHNICAL DEFAULT

Decision: Carts are backend-owned. The server resolves menu items and calculates authoritative totals using current configured menu prices when an order is submitted.

Rationale: The browser is not authoritative for price, subtotal, or total, and V1 avoids a complex price-lock system.

### DEC-023: Opaque Server-Side Sessions

Status: TECHNICAL DEFAULT

Decision: Use backend-issued opaque sessions for customer and staff authentication rather than client-stored identity claims.

Rationale: Opaque sessions support revocation, server-side context checks, session fixation protection, and table-bound authorization.

### DEC-024: Shared Schemas Package

Status: TECHNICAL DEFAULT

Decision: Use a shared package for API schemas, public domain types, validation helpers, and error code types that are safe for frontend and backend use.

Rationale: Shared schemas reduce drift while preserving backend authority for security-sensitive derivation.

### DEC-025: QR Validation Shape

Status: TECHNICAL DEFAULT

Decision: QR URLs should carry a stable non-sensitive QR identity and tamper-evident data that the server validates against server-side table mapping. The design must allow future revocation and rotation.

Rationale: Permanent QR codes must remain simple and physically stable while preventing clients from changing table numbers to access another table.

### DEC-026: Staff Password Storage

Status: TECHNICAL DEFAULT

Decision: Staff passwords must be securely hashed. Plaintext passwords must never be stored.

Rationale: V1 staff authentication uses username and password and must be protected against credential compromise.

### DEC-027: Order Number

Status: TECHNICAL DEFAULT

Decision: Generate a server-side human-friendly public order number that is not the database primary key and does not expose sensitive information.

Rationale: Customers need a simple order number, but internal identifiers should not be unnecessarily exposed.

### DEC-028: Rate Limiting

Status: TECHNICAL DEFAULT

Decision: Implement configurable rate limiting for OTP requests, OTP verification, authentication, order creation, and admin login. Do not add CAPTCHA in V1.

Rationale: Abuse protection is required, but exact production thresholds can remain configurable.

### DEC-029: Logging

Status: TECHNICAL DEFAULT

Decision: Use technical logs with request ID, order ID where relevant, timestamp, operation, and error information needed for debugging. Never log OTPs, passwords, session secrets, API keys, payment secrets, or unnecessary sensitive customer information.

Rationale: Logs must support debugging without expanding sensitive data exposure.

### DEC-030: Menu Administration

Status: TECHNICAL DEFAULT

Decision: Implement admin menu modification through the admin portal, limited to V1 menu data: categories, items, and prices.

Rationale: V1 requires menu modification while excluding modifiers, availability, stock, inventory, and other advanced menu features.

## Future Features

The following are explicitly future scope and must not be implemented in V1:

- online payment gateway;
- UPI;
- card payments;
- payment SDK integration;
- payment webhooks;
- payment reconciliation;
- refunds;
- item availability;
- inventory;
- stock quantities;
- ingredient tracking;
- item customization;
- modifiers;
- coupons;
- discounts;
- service charges;
- tax;
- advanced order statuses such as preparing, ready, served, or cancelled;
- complex kitchen workflow;
- realtime infrastructure;
- WebSockets;
- analytics;
- loyalty;
- advanced customer history;
- advanced staff roles;
- QR management dashboard;
- physical-presence proof through GPS, Wi-Fi, Bluetooth, or similar systems.

## Remaining Unresolved Decisions

### DEC-031: Real D3 Menu Content

Status: UNRESOLVED PRODUCT DECISION

Decision needed: The real D3 category names, menu item names, and prices.

Why it matters: The application can implement the menu model, but production menu data must come from the real D3 menu.

Blocked implementation: Production-ready menu seed/content.

### DEC-032: Production SMS Provider

Status: UNRESOLVED PRODUCT/OPERATIONS DECISION

Decision needed: Which production SMS provider will deliver OTPs.

Why it matters: Provider credentials, delivery behavior, API integration, failures, and production support depend on the selected provider.

Blocked implementation: Production SMS delivery.

### DEC-033: Data Retention

Status: UNRESOLVED PRODUCT/OPERATIONS DECISION

Decision needed: How long customer data, orders, sessions, OTP metadata, logs, and audit records are retained, and how deletion/minimization should work.

Why it matters: V1 stores customer names, mobile numbers, sessions, timestamps, orders, and operational logs.

Blocked implementation: Retention jobs, deletion workflows, and final privacy operations.

### DEC-034: Production Hosting And Operations

Status: UNRESOLVED OPERATIONS DECISION

Decision needed: Production hosting, deployment architecture, TLS/proxy setup, domain names, secret storage, backups, restore process, log retention, monitoring, alerting, and recovery objectives.

Why it matters: HTTPS, cookies, CORS, trusted proxy settings, SQLite durability, and operational reliability depend on deployment context.

Blocked implementation: Production deployment and production operational hardening.

### DEC-035: Production Security Thresholds

Status: DEFERRED TECHNICAL DECISION

Decision needed: Exact production rate-limit thresholds, session lifetime values, lockout behavior, and abuse-response thresholds.

Why it matters: The architecture requires these controls, but the exact values should be configurable and may depend on real traffic.

Blocked implementation: Final production tuning. Local secure defaults may be chosen during implementation.

