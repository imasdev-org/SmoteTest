import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

const USER = { email: 'laguiar@adinet.com.uy', password: '123' };

function isMobile(page: import('@playwright/test').Page): boolean {
  const viewport = page.viewportSize();
  return !!viewport && viewport.width < 768;
}

// --- Login ---

Given('que estoy logueado con el usuario de prueba', async ({ page }) => {
  await page.goto('/supermercado');
  await page.waitForLoadState('networkidle');

  if (isMobile(page)) {
    const mobileLoginBtn = page.locator('#LBLLOGIN_MPAGE, [id*="LBLLOGIN"]').first();
    if (await mobileLoginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mobileLoginBtn.click();
    } else {
      await page.goto('/supermercado/ingresar');
    }
  } else {
    await page.locator('#MPW0017W0019LBLLOGIN').first().click();
  }

  await page.waitForSelector('#W0009vUSER', { timeout: 10_000 });
  await page.locator('#W0009vUSER').fill(USER.email);
  await page.locator('#W0009vPASSWORD').fill(USER.password);
  await page.locator('#W0009ENTER').click();
  await page.waitForURL(/(?!.*ingresar)/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
});

// --- Carrito ---

Given('el carrito está vacío', async ({ page }) => {
  const selector = isMobile(page) ? '#CARTCOUNT_MPAGE' : '#MPW0017W0019CARTCOUNT';
  const text = await page.locator(selector).textContent().catch(() => '0') || '0';
  const count = parseInt(text) || 0;

  if (count > 0) {
    await page.goto('/supermercado/carrito');
    await page.waitForLoadState('networkidle');
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
    await page.waitForLoadState('networkidle');
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
  await page.waitForLoadState('networkidle');
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
  await page.waitForLoadState('networkidle');
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
