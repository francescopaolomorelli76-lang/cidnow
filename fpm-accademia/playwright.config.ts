import { defineConfig, devices } from '@playwright/test';

/**
 * E2E dei due ruoli contro l'app reale (API + PostgreSQL + frontend Vite).
 * Usa un database dedicato (fpm_e2e) per non toccare quello di sviluppo.
 */
const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://fpm:fpm_dev_only@localhost:5432/fpm_e2e';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    // Microfono e videocamera finti di Chromium, permessi concessi: per provare lo Smart Setup senza hardware.
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    permissions: ['microphone', 'camera'],
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npm run start -w @fpm/server',
      url: 'http://127.0.0.1:8787/api/health',
      env: { DATABASE_URL: E2E_DB, NODE_ENV: 'development', PAYMENT_PROVIDER: 'mock', PORT: '8787', RATE_LIMIT_SCALE: '20' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @fpm/web',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
