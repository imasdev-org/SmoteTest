import { test, expect } from '@playwright/test';
import {
  login, getCartCount, emptyCart, searchAndAdd, goToProductDetail,
  verifyProductDetail, startCheckout, selectPickupStore, selectDateFar, continueToPayment,
} from './helpers/shared';

/**
 * Ciclo de prueba 2 - Manzana (producto no financiable)
 *
 * Click & Go + PASSCARD
 * Corre en desktop y mobile según el project de Playwright.
 */

test.describe.serial('Ciclo de prueba 2 - Manzana', () => {

  test('1. Login, vaciar carrito, buscar manzana y agregar', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    const count = await getCartCount(page);
    console.log(`Items en carrito: ${count}`);
    if (count > 0) {
      console.log('Vaciando carrito...');
      await emptyCart(page);
    }

    console.log('Buscando: "manzana"');
    await searchAndAdd(page, 'manzana');
    await page.screenshot({ path: 'test-results/c2-01-added.png' });

    const newCount = await getCartCount(page);
    console.log(`Items en carrito: ${newCount}`);
    expect(newCount).toBeGreaterThan(0);
  });

  test('2. Detalle del producto: verificar imagen, precio, promos', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    const href = await goToProductDetail(page, 'manzana');
    console.log(`Producto: ${href}`);
    await page.screenshot({ path: 'test-results/c2-02-detail.png' });

    await verifyProductDetail(page);
    await page.screenshot({ path: 'test-results/c2-03-prices.png', fullPage: true });
  });

  test('3. Checkout: Click & Go, seleccionar sucursal', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    await startCheckout(page);
    await page.screenshot({ path: 'test-results/c2-04-checkout.png' });

    await selectPickupStore(page);
    await page.screenshot({ path: 'test-results/c2-05-pickup.png' });

    await selectDateFar(page);
    const fechaText = page.locator('.ReadonlyAttributeEditFormDateEdit').first();
    if (await fechaText.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`Fecha: ${await fechaText.textContent()}`);
    }
    await page.screenshot({ path: 'test-results/c2-06-date.png' });

    await continueToPayment(page);
    console.log(`URL: ${page.url()}`);
    await page.screenshot({ path: 'test-results/c2-07-forma-pago.png' });
    expect(page.url()).toContain('caja?2');
  });

  test.skip('4. Pagar con PASSCARD y completar compra (requiere GeoPay)', async ({ page }) => {
    // TODO: Completar cuando GeoPay esté disponible
    // - Nueva tarjeta de crédito → Pass Card → popup GeoPay
    // - Ingresar 6280261111113352, 12/28, CVV 123
    // - Completar compra
  });

  test.skip('5. Widget status del pedido y cancelar (requiere compra completada)', async ({ page }) => {
    // TODO: Después de completar la compra
    // - Click en widget de status del pedido
    // - Cancelar el pedido
  });
});
