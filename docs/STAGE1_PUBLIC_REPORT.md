# Gourmet d'Asie — Approved Stage 1

Public technical status, 30 October 2026. Stage 1 has been approved by project management. Stage 2 has not started. Approval covers the development foundation; it does not constitute production deployment approval.

This document is the current public status reference. The original local progress report is retained privately and excluded from Git. Earlier setup notes in README.md, ARCHITECTURE.md and BACKUP_RESTORE.md describe planning states before the completed PostgreSQL verification; statements there that installation or connection remains untested are historical. Those files have been preserved without rewriting them.

## Scope and architecture

- Staff-only Nuxt 4 / Vue 3 application, strict TypeScript, Tailwind CSS, PostgreSQL, Drizzle and Zod. French user interface.
- A single application contains frontend pages, server API routes, authentication, validation and database access. No mandatory cloud subscription or microservices.
- ADMIN manages reference data and creates staff; WAITER can read authorised reference data. The server checks active account status, session and role.
- Password hashing, opaque database-backed sessions, logout, session expiry and origin validation are implemented. Production cookies require HTTPS.
- Requests have a 16 KiB body limit enforced on received bytes, including chunked requests. Rejected requests return HTTP 413 before database operations.
- Reference-data changes and audit writes are transactional. Prices are integer cents, and order items preserve historical product information and unit prices.
- The POS layer defines an interface only. No external POS connection is claimed.
- Customer ordering, QR ordering, payments, smart tables and IoT are outside Stage 1.

## Database

The initial versioned migration defines twelve tables: users, staff_profiles, sessions, categories, products, product_variants, restaurant_tables, table_visits, orders, order_items, order_status_history and audit_logs.

Real PostgreSQL 17.11 verification covered migration execution and replay, foreign keys, the composite product/variant relationship and runtime/migration privilege separation. Runtime access uses a dedicated restricted database role, separate from the migration role. Deployment credentials and database data are not part of this repository.

## Recorded verification

The final Stage 1 regression results were recorded on 29 October 2026. Preparing this Git baseline did not rerun these tests or modify application code.

| Suite or check | Result |
| --- | --- |
| Vitest | 42 passed, 0 failed, 0 skipped |
| Playwright against real PostgreSQL 17.11 | 12 passed, 0 failed, 0 skipped |
| Playwright production-build smoke tests | 2 passed, 0 failed, 0 skipped |
| TypeScript | Passed |
| ESLint | Passed |
| Production build | Passed |

Total: 56 successful tests. Of the Vitest tests, 30 depend on PGlite and 12 do not; the 12 real PostgreSQL browser/integration tests are reported separately.

Real integration coverage includes ADMIN and WAITER browser login, incorrect passwords, logout, expiry, role separation, rejected price changes, ADMIN reference-data operations, audit records, historical price snapshots, rollback, validation and oversized requests after the ECONNRESET correction. Earlier comparison failures were traced to inconsistent JavaScript timestamp parsing in the test harness; the final run passed after correcting the comparison setup. Existing database records were verified unchanged, and newly created synthetic fixtures were retained.

## Running and testing

Use the Node.js and pnpm versions declared in package.json and the committed lockfile. Provision PostgreSQL separately; do not reuse development credentials for deployment. Keep credentials outside the checkout, particularly if the checkout is cloud-synchronised. Inject DATABASE_URL and APP_ORIGIN into the process environment using a suitable local secret store. Do not paste credentials into shell commands or commit environment files.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

Dependency and browser installation, if needed, require the environment owner's approval. Migration changes schema; run `pnpm db:migrate` only against a separately approved database using a migration role. `pnpm admin:create` accepts the initial password on standard input and refuses provisioning when users already exist.

The real PostgreSQL suite requires PG_RUNTIME_URL and PG_MIGRATION_URL supplied securely in the test process environment and the development database explicitly allowed by the test guard. It creates new synthetic staff accounts and records and retains those records; it must not run against production. Read tests/postgres/stage1.spec.ts before authorising a run. No database reset is required.

## Remaining limits

- The admin interface supports viewing and adding reference data; full edit/delete controls and staff lifecycle screens remain incomplete. API operations exist; some selectors currently require a page reload.
- No order-taking API is delivered in Stage 1. Historical-price verification covers the data model, not a completed order workflow.
- Production HTTPS, sustained load, a real backup/restore exercise and persistence after a complete host/session restart have not been verified.
- Login throttling is process-local; password recovery, proxy policy, retention and broader audit requirements remain management decisions.
- Repository checks look for common secret patterns and review candidate content; they do not prove the absence of every possible secret. Ignore rules do not protect a file that has already been committed.

## Publication boundary

Only application source, synthetic tests, configuration templates, schema migrations, dependency lockfile and reviewed technical documentation belong in the public baseline. Database files, backups, local progress history, credentials, encrypted secret files, personal machine identifiers, build output and test artefacts are excluded.

The Git author must use the owner's confirmed name and exact confirmed GitHub noreply address. The initial commit and stage-1-approved tag are local operations. Publishing requires separate explicit owner approval; no push is authorised by this preparation.
