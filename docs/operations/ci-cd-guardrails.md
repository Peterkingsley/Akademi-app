# CI/CD Guardrails

## What CI enforces now

### Backend

- dependency installation with `npm ci`
- Prisma client generation and backend TypeScript typecheck via:
  - `npm run ci:check`

### Frontend

- dependency installation with `npm ci`
- frontend TypeScript typecheck via:
  - `npm run ci:check`

### Render safety

- validates the backend render build contract at a lighter level
- checks:
  - backend typecheck
  - Prisma schema validation

## Why this setup exists

- CI should fail fast on compile/type regressions.
- CI should not depend on local-only migration hacks like `fix-db.js`.
- Deploy safety checks should catch backend drift before Render does.

## What this does not enforce yet

- backend integration tests with a real database
- frontend E2E/mobile tests
- lint/format enforcement
- automatic deploy gates tied to Render or EAS

## Recommended next CI/CD upgrades

1. add backend database-backed test job
2. add branch protection requiring CI success before merge
3. add EAS build verification for release branches
4. add Render deploy hooks only after CI passes
