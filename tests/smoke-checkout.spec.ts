import { test, expect } from '@playwright/test';
import {
  USER, PASSCARD, getSearchTerm,
  login, getCartCount, emptyCart, searchAndAdd,
  startCheckout, selectAddress, selectDateFar, continueToPayment,
} from './helpers/shared';

/**
 * Ciclo de prueba 1 - Pilas (producto financiable)
 *
 * Envío a domicilio + PASSCARD
 * Corre en desktop y mobile según el project de Playwright.
 */

test.describe.serial('Ciclo de prueba 1 - Pilas', () => {

  test('1. Login, vaciar carrito, buscar y agregar producto', async ({ page, baseURL }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);
    await page.screenshot({ path: 'test-results/c1-01-logged-in.png' });

    const count = await getCartCount(page);
    console.log(`Items en carrito: ${count}`);
    if (count > 0) {
      console.log('Vaciando carrito...');
      await emptyCart(page);
    }

    const searchTerm = getSearchTerm(baseURL || '');
    console.log(`Buscando: "${searchTerm}"`);
    await searchAndAdd(page, searchTerm);
    await page.screenshot({ path: 'test-results/c1-02-added.png' });

    const newCount = await getCartCount(page);
    console.log(`Items en carrito: ${newCount}`);
    expect(newCount).toBeGreaterThan(0);
  });

  test('2. Checkout: envío a domicilio, fecha lejana, continuar a pago', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    await startCheckout(page);

    // Envío a domicilio
    await page.getByText('Envío a domicilio').click();
    await page.waitForTimeout(2000);
    await selectAddress(page);
    await page.screenshot({ path: 'test-results/c1-03-address.png' });

    await selectDateFar(page);
    const fechaText = page.locator('.ReadonlyAttributeEditFormDateEdit').first();
    if (await fechaText.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`Fecha seleccionada: ${await fechaText.textContent()}`);
    }
    await page.screenshot({ path: 'test-results/c1-04-date.png' });

    await continueToPayment(page);
    console.log(`URL: ${page.url()}`);
    await page.screenshot({ path: 'test-results/c1-05-forma-pago.png' });
    expect(page.url()).toContain('caja?2');
  });

  test.skip('3. Forma de pago: PASSCARD (requiere GeoPay)', async ({ page }) => {
    // TODO: Completar cuando GeoPay esté disponible
    // - Eliminar PASSCARD existente si hay
    // - Nueva tarjeta de crédito → Pass Card → popup GeoPay
    // - Ingresar 6280261111113352, 12/28, CVV 123
    // - Seleccionar 2 cuotas
    // - Continuar a confirmación
    // - Verificar fecha y dirección
  });
});
