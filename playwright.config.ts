import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke Test - Tienda Inglesa
 *
 * Ambientes y plataformas:
 *   Cada ambiente tiene su versión desktop y mobile.
 *
 * Uso:
 *   npx playwright test                                        # TODOS (8 projects)
 *   npx playwright test --project="trunk-desktop"              # solo trunk desktop
 *   npx playwright test --project="staging-mobile"             # solo staging mobile
 *   npx playwright test --project="*desktop*"                  # todos los desktop
 *   npx playwright test --project="trunk*"                     # trunk desktop + mobile
 *   npx playwright test --project="prod*"                      # prod desktop + mobile
 */

const environments = [
  { name: 'trunk',   baseURL: 'https://trunk-web.imasdev.com' },
  { name: 'staging', baseURL: 'https://staging-web.imasdev.com' },
  { name: 'preprod', baseURL: 'https://preprod-web.tiendainglesa.com.uy' },
  { name: 'prod',    baseURL: 'https://www.tiendainglesa.com.uy' },
];

const launchOptions = { args: ['--disable-popup-blocking'] };

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  use: {
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: environments.flatMap(env => [
    {
      name: `${env.name}-desktop`,
      use: {
        baseURL: env.baseURL,
        browserName: 'chromium' as const,
        viewport: { width: 1280, height: 720 },
        launchOptions,
      },
    },
    {
      name: `${env.name}-mobile`,
      use: {
        baseURL: env.baseURL,
        ...devices['iPhone 14'],
        launchOptions,
      },
    },
  ]),
});
