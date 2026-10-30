import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/postgres', workers: 1, retries: 0, timeout: 30000,
  reporter: './tests/postgres/safe-reporter.ts',
  use: { baseURL: 'http://127.0.0.1:3200', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: { command: 'node .output/server/index.mjs', url: 'http://127.0.0.1:3200/connexion', reuseExistingServer: false,
    env: { PORT: '3200', HOST: '127.0.0.1', APP_ORIGIN: 'http://127.0.0.1:3200', DATABASE_URL: process.env.PG_RUNTIME_URL || '', PG_MIGRATION_URL: '', PG_RUNTIME_URL: '' } },
})
