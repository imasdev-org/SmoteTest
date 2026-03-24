import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke Test - Tienda Inglesa
 *
 * Ambientes (configurar con BASE_URL):
 *   trunk:   https://trunktest-web.imasdev.com
 *   staging: https://staging-web.imasdev.com
 *   prod:    https://www.tiendainglesa.com.uy
 *
 * Uso:
 *   npx playwright test                                            # todos los projects
 *   npx playwright test --project=desktop                          # solo desktop
 *   npx playwright test --project=mobile                           # solo mobile
 *   BASE_URL=https://staging-web.imasdev.com npx playwright test   # staging
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  use: {
    baseURL: process.env.BASE_URL || 'https://trunk-web.imasdev.com',
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--disable-popup-blocking'],
        },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 14'],
        launchOptions: {
          args: ['--disable-popup-blocking'],
        },
      },
    },
  ],
});
