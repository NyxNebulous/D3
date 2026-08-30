# D3

D3 is planned as a mobile-first restaurant QR ordering system.

This repository is intentionally in a documentation-first phase. It does not yet contain an application, API, database schema, authentication, OTP flow, QR flow, payment flow, kitchen workflow, menu management, or production UI.

## Current Phase

The current phase establishes the project rules, architecture direction, security posture, and unresolved product decisions before implementation begins.

## Intended Customer Journey

1. Customer scans a table QR code.
2. Customer lands on D3.
3. Customer starts ordering.
4. Customer verifies identity.
5. Customer completes OTP verification.
6. Backend establishes authenticated customer and table context.
7. Customer browses category-based menu.
8. Customer customizes menu items.
9. Customer reviews cart.
10. Customer chooses a payment mode.
11. Customer completes payment.
12. Backend verifies the payment result independently.
13. Verified paid order becomes available to kitchen or staff.
14. Customer tracks order status.

## Initial Technology Direction

Unless changed by a later explicit product decision:

- Frontend: React, TypeScript, Vite.
- Backend: Node.js, Express, TypeScript.
- Database: SQLite.
- Runtime validation: Zod or an equivalent schema validation library.

No implementation has been created yet.

## Documentation Map

- [Project constitution](docs/project-constitution.md): non-negotiable engineering and product rules.
- [Architecture](docs/architecture.md): planned system boundaries and architecture principles.
- [Security](docs/security.md): threat model and security requirements.
- [Decisions](docs/decisions.md): accepted and unresolved decisions.
- [Assumptions audit](docs/assumptions-audit.md): assumptions explicitly avoided at this phase.

## Development Rules

- Do not invent unspecified business rules.
- Do not trust browser-provided security-sensitive values.
- Do not mark payment as successful from a browser redirect alone.
- Do not mix payment state with food-preparation state.
- Do not put application logic in one large frontend or backend file.
- Do not implement a feature while a required business or security decision is unresolved.

