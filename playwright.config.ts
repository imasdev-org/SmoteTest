import { defineConfig } from '@playwright/test';

/**
 * Smoke Test - Tienda Inglesa
 *
 * Ambientes disponibles (configurar con BASE_URL):
 *   trunk:   https://trunktest-web.imasdev.com
 *   staging: https://staging-web.imasdev.com
 *   prod:    https://www.tiendainglesa.com.uy
 *
 * Uso:
 *   npx playwright test                                          # usa trunk por defecto
 *   BASE_URL=https://staging-web.imasdev.com npx playwright test # staging
 *   BASE_URL=https://www.tiendainglesa.com.uy npx playwright test # prod
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  use: {
    baseURL: process.env.BASE_URL || 'https://trunktest-web.imasdev.com',
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'smoke',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--disable-popup-blocking'],
        },
      },
    },
  ],
});
