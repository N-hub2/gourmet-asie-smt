# Stage 1 — Local publication review

Review date: 30 October 2026. The public destination is N-hub2/gourmet-asie-smt. Its public metadata and Git refs were read without sending project files; no existing refs were advertised during this review. The remote may change and must be checked again before publication.

## Security review

- The complete local progress report was copied byte-for-byte to restricted storage outside the checkout and cloud-synchronised workspace. SHA-256 equality was verified. The original remains unchanged and is excluded from Git.
- The staged source and documentation were checked for private machine identifiers, embedded database credentials, common private-key/token signatures and secret assignments. Matches were reviewed: the connection template contains a replacement marker; test passwords and email addresses are synthetic; dependency metadata is not a deployment credential.
- Secret configuration and database files are outside the checkout. Ignore rules were tested for environment files, encrypted secrets, keys, database files/backups, browser authentication state and generated artefacts. The environment example and Drizzle migration remain included.
- No known live secret or personal machine identifier was found in the candidate content. Pattern searches cannot guarantee detection of every secret; this assessment applies to the reviewed candidate files only.
- Application source and test code were not changed by this preparation. Existing Stage 1 test results are recorded in STAGE1_PUBLIC_REPORT.md; tests were not rerun for these documentation/ignore-rule changes.
- Original setup documents remain unchanged. The current public technical status and their historical limitations are explained in STAGE1_PUBLIC_REPORT.md.
- The owner confirmed the author name N-hub2 and the exact GitHub noreply email. Identity is configured only for this local repository; no personal contact email is included in the candidate files. The initial baseline commit and stage-1-approved tag are authorised locally.
- No push, service configuration change, database operation or software installation was performed. Push requires separate explicit owner approval.

## Candidate file inventory

Only the files listed below are intended for the baseline. Generated files and the original private progress report are excluded.

- `.env.example`
- `.gitignore`
- `app/app.vue`
- `app/assets/css/main.css`
- `app/components/PageTitle.vue`
- `app/error.vue`
- `app/middleware/staff.ts`
- `app/pages/admin.vue`
- `app/pages/connexion.vue`
- `app/pages/index.vue`
- `app/pages/personnel.vue`
- `ARCHITECTURE.md`
- `compose.yaml`
- `docs/BACKUP_RESTORE.md`
- `docs/STAGE1_PUBLIC_REPORT.md`
- `docs/STAGE1_PUBLICATION_REVIEW.md`
- `drizzle.config.ts`
- `drizzle/0000_cheerful_machine_man.sql`
- `drizzle/meta/_journal.json`
- `drizzle/meta/0000_snapshot.json`
- `eslint.config.mjs`
- `nuxt.config.ts`
- `package.json`
- `playwright.config.ts`
- `playwright.postgres.config.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `README.md`
- `scripts/create-admin.ts`
- `scripts/migrate.ts`
- `server/api/auth/login.post.ts`
- `server/api/auth/logout.post.ts`
- `server/api/auth/me.get.ts`
- `server/api/management/[resource].ts`
- `server/api/management/staff.post.ts`
- `server/auth/password.ts`
- `server/auth/provision-admin.ts`
- `server/auth/session.ts`
- `server/database/client.ts`
- `server/database/schema.ts`
- `server/http/request-body.ts`
- `server/integrations/pos/port.ts`
- `server/middleware/security.ts`
- `shared/types/auth.ts`
- `shared/validation/management.ts`
- `tests/e2e/login.spec.ts`
- `tests/foundation.test.ts`
- `tests/integration.test.ts`
- `tests/postgres/safe-reporter.ts`
- `tests/postgres/stage1.spec.ts`
- `tests/provision-admin.test.ts`
- `tests/request-body.test.ts`
- `tsconfig.json`
- `tsconfig.tools.json`
- `vitest.config.ts`
