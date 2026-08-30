# Assumptions Audit

This file records assumptions intentionally avoided during the documentation-first phase.

## Repository Inspection

The working directory contained only a `.git` directory at the start of this phase. No application source, package manifest, database schema, configuration, tests, or existing documentation were present on disk.

An `AGENTS.md` tab was open in the IDE context, but no `AGENTS.md` file existed in the repository when inspected.

## Assumptions Explicitly Avoided

- No payment provider was chosen.
- No OTP or SMS provider was chosen.
- No exact menu, categories, prices, modifiers, or availability rules were invented.
- No table count or table numbering scheme was invented.
- No QR signing, rotation, revocation, or replay policy was invented.
- No tax, GST, service charge, discount, rounding, or currency rule was invented.
- No restaurant address, operating hours, contact information, refund policy, or cancellation policy was invented.
- No staff roles or staff permissions were invented.
- No customer session lifetime was invented.
- No production hosting, deployment architecture, secret storage, backup policy, monitoring, or log-retention policy was invented.
- No simultaneous customer behavior for one table was invented.
- No authentication, OTP, QR, payment, order, kitchen, menu, production database, or real UI implementation was created.

