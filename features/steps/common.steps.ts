import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';

const USER = { email: 'laguiar@adinet.com.uy', password: '123' };
const STORAGE_FILE = path.join(process.cwd(), 'test-results', 'storage-state.json');

function isMobile(page: import('@playwright/test').Page): boolean {
  const viewport = page.viewportSize();
  return !!viewport && viewport.width < 768;
}

// --- Login ---

Given('que estoy logueado con el usuario de prueba', async ({ page, context }) => {
  // Restaurar cookies de sesión anterior si existen
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      const storage = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
      if (storage.cookies?.length) {
        await context.addCookies(storage.cookies);
      }
    } catch {}
  }

  await page.goto('/supermercado');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Si ya está logueado, no hacer nada
  const alreadyLogged = await page.getByText(/Hola,/i).first().isVisible({ timeout: 5000 }).catch(() => false);
  if (alreadyLogged) return;

  if (isMobile(page)) {
    // Mobile: navegar directo a login (botones del header no son accesibles)
    await page.goto('/supermercado/ingresar');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  } else {
    // Desktop: click en botón Ingresar del header
    const loginBtn = page.locator('#MPW0017W0019LBLLOGIN');
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click();
    } else {
      await page.goto('/supermercado/ingresar');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    }
  }

  // Esperar formulario de login - IDs GeneXus son iguales en todos los ambientes
  await page.locator('#W0009vUSER').waitFor({ timeout: 10_000 });
  await page.locator('#W0009vUSER').fill(USER.email);
  await page.locator('#W0009vPASSWORD').fill(USER.password);
  await page.locator('#W0009ENTER').click();
  await page.waitForFunction(() => !window.location.href.includes('ingresar'), { timeout: 15_000 });
  await page.waitForLoadState('domcontentloaded');

  // Guardar cookies para reutilizar en los siguientes escenarios del ciclo
  fs.mkdirSync(path.dirname(STORAGE_FILE), { recursive: true });
  const storage = await context.storageState();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(storage));
});

// --- Carrito ---

Given('el carrito está vacío', async ({ page }) => {
  const selector = isMobile(page) ? '#CARTCOUNT_MPAGE' : '#MPW0017W0019CARTCOUNT';
  const text = await page.locator(selector).textContent().catch(() => '0') || '0';
  const count = parseInt(text) || 0;

  if (count > 0) {
    await page.goto('/supermercado/carrito');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    for (let i = 0; i < 15; i++) {
      const deleteBtn = page.locator('[class*="delete" i], [class*="trash" i], .wCartDeleteBtn, [id*="DELETE" i]').first();
      if (!(await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false))) break;
      await deleteBtn.click({ force: true });
      await page.waitForTimeout(2000);
      const confirm = page.getByRole('button', { name: /confirmar|sí|aceptar|ok/i });
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirm.click();
        await page.waitForTimeout(2000);
      }
    }
    await page.goto('/supermercado');
    await page.waitForLoadState('domcontentloaded');
  }
});

Given('que tengo un producto en el carrito', async ({ page }) => {
  const selector = isMobile(page) ? '#CARTCOUNT_MPAGE' : '#MPW0017W0019CARTCOUNT';
  const text = await page.locator(selector).textContent().catch(() => '0') || '0';
  expect(parseInt(text) || 0).toBeGreaterThan(0);
});

Then('el carrito tiene al menos {int} producto(s)', async ({ page }, minCount: number) => {
  const selector = isMobile(page) ? '#CARTCOUNT_MPAGE' : '#MPW0017W0019CARTCOUNT';
  const text = await page.locator(selector).textContent().catch(() => '0') || '0';
  expect(parseInt(text) || 0).toBeGreaterThanOrEqual(minCount);
});

// --- Búsqueda ---

When('busco {string}', async ({ page }, term: string) => {
  const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
  await searchbox.fill(term);
  await searchbox.press('Enter');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
});

When('agrego el primer producto al carrito', async ({ page }) => {
  const agregarBtn = page.getByText('Agregar al carrito').first();
  const addById = page.locator('input[id^="add"]').first();
  if (await agregarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await agregarBtn.click();
  } else if (await addById.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addById.click();
  }
  await page.waitForTimeout(3000);
});

When('entro al detalle del primer producto', async ({ page }) => {
  const productLink = page.locator('a[href*=".producto"]').first();
  const href = await productLink.getAttribute('href') || '';
  await page.goto(href);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
});

// --- Detalle de producto ---

Then('la imagen del producto es visible', async ({ page }) => {
  const img = page.locator('img').first();
  await expect(img).toBeVisible();
});

Then('el precio del producto es visible', async ({ page }) => {
  const price = page.locator('.wProductPrimaryPrice, .ProductPriceAccent, .ProductPrice').first();
  await expect(price).toBeVisible();
});

Then('el precio contiene {string}', async ({ page }, text: string) => {
  const price = page.locator('.wProductPrimaryPrice, .ProductPriceAccent, .ProductPrice').first();
  await expect(price).toContainText(text);
});
