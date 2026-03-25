import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * Smoke Test - Tienda Inglesa (BDD)
 *
 * Uso:
 *   npx bddgen && npx playwright test                        # todos
 *   npx playwright test --project="trunk-desktop"             # solo trunk desktop
 *   npx playwright test --project="*mobile*"                  # todos los mobile
 *   npx playwright test --project="prod*"                     # prod desktop + mobile
 */

const testDir = defineBddConfig({
  features: 'features/*.feature',
  steps: 'features/steps/*.ts',
});

const environments = [
  { name: 'trunk',   baseURL: 'https://trunk-web.imasdev.com', userAgent: undefined },
  { name: 'staging', baseURL: 'https://staging-web.imasdev.com', userAgent: undefined },
  { name: 'preprod', baseURL: 'https://preprod-web.tiendainglesa.com.uy', userAgent: 'SmokeTest_I+Dev' },
  { name: 'prod',    baseURL: 'https://www.tiendainglesa.com.uy', userAgent: 'SmokeTest_I+Dev' },
];

const launchOptions = { args: ['--disable-popup-blocking'] };

export default defineConfig({
  testDir,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit-results.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  use: {
    screenshot: 'only-on-failure',
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
        ...(env.userAgent ? { userAgent: env.userAgent } : {}),
      },
    },
    {
      name: `${env.name}-mobile`,
      use: {
        baseURL: env.baseURL,
        ...devices['iPhone 14'],
        launchOptions,
        ...(env.userAgent ? { userAgent: env.userAgent } : {}),
      },
    },
  ]),
});
