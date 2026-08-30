# D3 Project Constitution

This constitution defines the rules for building D3. It exists so future implementation work starts from explicit constraints rather than hidden assumptions.

## Product Identity

The restaurant name is exactly `D3`.

Do not rename, expand, decorate, or infer another brand name. If brand assets are unavailable, use only `D3` as the temporary textual brand.

## Current Project Scope

D3 is a restaurant QR ordering system. It must support a mobile-first customer journey from scanning a table QR code through authenticated ordering, verified payment, kitchen or staff visibility, and order status tracking.

This repository currently contains documentation only. It must not claim implemented functionality until code, tests, and verification exist.

## Zero-Trust Rule

Everything received from the browser is untrusted.

The backend must independently validate or derive security-sensitive values, including:

- table number;
- QR payload;
- session identity;
- customer identity;
- OTP verification state;
- item price;
- subtotal;
- tax;
- discount;
- total;
- payment amount;
- payment status;
- order status;
- staff role;
- item availability;
- timestamps;
- device identifiers.

## No-Assumptions Rule

If a product or business requirement is not explicitly specified, do not invent it.

When a missing decision blocks implementation:

1. Identify the decision.
2. Explain why it matters.
3. Record it in [decisions.md](decisions.md).
4. Mark it `UNRESOLVED`.
5. Stop the blocked implementation path.

## Architecture Rule

The codebase must be modular, maintainable, testable, and secure even while the infrastructure remains simple.

The frontend must separate components, pages or features, API communication, state, domain types, validation, and reusable utilities.

The backend must separate routes or controllers, validation, services, repositories, authentication, authorization, configuration, and middleware.

## Security Rule

Security-sensitive behavior must have automated tests covering valid behavior and malicious or invalid behavior.

The frontend is not a security boundary. Browser behavior may improve user experience, but backend validation, authorization, payment verification, and database integrity are authoritative.

## Payment Rule

The browser must never be authoritative for payment success.

The backend must determine the expected amount and verify external payment provider events before an order can become eligible for kitchen or staff release.

Browser redirects must never mark orders as paid.

## Order State Rule

Payment state and food-preparation state must be separate concepts with explicit state machines.

An unpaid order must not appear as paid, kitchen-released, or ready for preparation.

## Database Rule

SQLite is the initial database direction.

The database layer must use migrations, foreign keys, indexes, unique constraints, transactions, safe money representation, and database-level integrity where appropriate.

JSON files must not be used as the production database.

