import { test, expect, Page } from '@playwright/test';

/**
 * Smoke Test - Ciclo 2: Manzana + Click & Go + PASSCARD
 *
 * 1. Login, vaciar carrito, buscar "manzana", agregar al carrito
 * 2. Ir al detalle del producto: verificar imagen, precio, promos
 * 3. Checkout: Click & Go (Retiro), seleccionar zona y sucursal
 * 4. Forma de pago: PASSCARD (requiere GeoPay)
 * 5. Completar compra
 * 6. Widget de status del pedido → cancelar pedido
 */

const USER = { email: 'laguiar@adinet.com.uy', password: '123' };
const PASSCARD = { number: '6280261111113352', expiry: '12/28', cvv: '123' };

async function login(page: Page) {
  await page.locator('#MPW0017W0019LBLLOGIN').first().click();
  await page.waitForSelector('#W0009vUSER', { timeout: 10_000 });
  await page.locator('#W0009vUSER').fill(USER.email);
  await page.locator('#W0009vPASSWORD').fill(USER.password);
  await page.locator('#W0009ENTER').click();
  await page.waitForURL(/(?!.*ingresar)/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

async function emptyCart(page: Page) {
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

async function selectPickupStore(page: Page) {
  // Click en Retiro
  await page.getByText('Retiro').first().click();
  await page.waitForTimeout(2000);

  // Seleccionar zona: Montevideo y Ciudad de la Costa
  const zonaSelect = page.locator('#W0063vSTOREZONEID');
  if (await zonaSelect.isVisible().catch(() => false)) {
    const zonaOptions = await zonaSelect.locator('option').allTextContents();
    const mvdOption = zonaOptions.find(o => /montevideo/i.test(o)) || zonaOptions[1];
    await zonaSelect.selectOption({ label: mvdOption });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
  }

  // Seleccionar sucursal: Click & Go Central
  const sucursalSelect = page.locator('#W0063vCLICKANDGOSTOREID');
  if (await sucursalSelect.isVisible().catch(() => false)) {
    const options = await sucursalSelect.locator('option').allTextContents();
    console.log(`Sucursales: ${options.join(', ')}`);
    const centralOption = options.find(o => /central/i.test(o));
    if (centralOption) {
      await sucursalSelect.selectOption({ label: centralOption });
    } else if (options.length > 1) {
      await sucursalSelect.selectOption({ index: 1 });
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }
}

async function selectDateFar(page: Page) {
  const fechaInput = page.getByText('Elegí cuando').first();
  if (!(await fechaInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

  await fechaInput.click({ force: true });
  await page.waitForTimeout(3000);

  const dateModal = page.locator('#W0063TABLEPOPUP');
  await expect(dateModal).toBeVisible({ timeout: 10_000 });

  // Seleccionar último día habilitado
  await page.evaluate(() => {
    const popup = document.getElementById('W0063TABLEPOPUP');
    if (!popup) return;
    const slides = popup.querySelectorAll('.slick-slide:not(.slick-cloned)');
    let lastEnabled: HTMLElement | null = null;
    slides.forEach(slide => {
      const el = slide as HTMLElement;
      const hasDisabled = el.className.includes('Disabled') || el.className.includes('disabled')
        || el.querySelector('[class*="Disabled"]') !== null;
      if (!hasDisabled && el.offsetWidth > 0) lastEnabled = el;
    });
    if (lastEnabled) (lastEnabled as HTMLElement).click();
  });
  await page.waitForTimeout(2000);

  // Seleccionar último horario habilitado (no gris/disabled)
  await page.evaluate(() => {
    const popup = document.getElementById('W0063TABLEPOPUP');
    if (!popup) return;
    const slots = popup.querySelectorAll('[class*="Slot"], [class*="slot"], [class*="Schedule"]');
    let lastSlot: HTMLElement | null = null;
    slots.forEach(s => {
      const el = s as HTMLElement;
      if (!el.className.includes('Disabled') && !el.className.includes('disabled') && el.offsetWidth > 0) {
        lastSlot = el;
      }
    });
    if (lastSlot) (lastSlot as HTMLElement).click();
  });
  await page.waitForTimeout(1000);

  // Fallback: intentar click por texto en el último horario visible
  const timeSlots = dateModal.getByText(/\d{2}:\d{2}\s*a\s*\d{2}:\d{2}/);
  const slotCount = await timeSlots.count();
  for (let i = slotCount - 1; i >= 0; i--) {
    if (await timeSlots.nth(i).isVisible().catch(() => false)) {
      await timeSlots.nth(i).click({ force: true });
      console.log(`Horario seleccionado: ${await timeSlots.nth(i).textContent()}`);
      break;
    }
  }
  await page.waitForTimeout(1000);

  // Confirmar
  const confirmarBtns = dateModal.locator('input[value="Confirmar"]:visible');
  if (await confirmarBtns.count() > 0) {
    await confirmarBtns.first().click({ force: true });
  } else {
    await page.evaluate(() => {
      const popup = document.getElementById('W0063TABLEPOPUP');
      if (!popup) return;
      popup.querySelectorAll('input[type="button"]').forEach(btn => {
        const b = btn as HTMLInputElement;
        if (b.value === 'Confirmar' && b.offsetWidth > 0 && !b.id.includes('NOSLOTS')) b.click();
      });
    });
  }
  await page.waitForTimeout(3000);
}

// --- Tests ---

test.describe.serial('Ciclo de prueba 2 - Manzana', () => {

  test('1. Login, vaciar carrito, buscar manzana y agregar', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    const cartCount = page.locator('#MPW0017W0019CARTCOUNT');
    const countText = await cartCount.textContent() || '0';
    if (parseInt(countText) > 0) {
      console.log(`Vaciando carrito (${countText} items)...`);
      await emptyCart(page);
    }

    // Buscar manzana
    const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
    await searchbox.fill('manzana');
    await searchbox.press('Enter');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/c2-01-search-manzana.png' });

    // Agregar al carrito
    const agregarBtn = page.getByText('Agregar al carrito').first();
    const addById = page.locator('input[id^="add"]').first();
    if (await agregarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agregarBtn.click();
    } else if (await addById.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addById.click();
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/c2-02-added.png' });

    const newCount = await cartCount.textContent() || '0';
    console.log(`Items en carrito: ${newCount}`);
    expect(parseInt(newCount)).toBeGreaterThan(0);
  });

  test('2. Detalle del producto: verificar imagen, precio, promos', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    // Buscar manzana y entrar al detalle
    const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
    await searchbox.fill('manzana');
    await searchbox.press('Enter');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Click en el primer producto para ir al detalle
    const productLink = page.locator('a[href*=".producto"]').first();
    const href = await productLink.getAttribute('href') || '';
    console.log(`Producto: ${href}`);
    await page.goto(href);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/c2-03-product-detail.png' });

    // Verificar imagen
    const productImg = page.locator('img').first();
    await expect(productImg).toBeVisible();
    console.log('Imagen: visible');

    // Verificar precio principal
    const price = page.locator('.wProductPrimaryPrice, .ProductPriceAccent, .ProductPrice').first();
    await expect(price).toBeVisible();
    const priceText = await price.textContent();
    console.log(`Precio: ${priceText}`);
    expect(priceText).toContain('$');

    // Precio promocional
    const promoPrice = page.locator('.ProductSpecialPrice').first();
    const hasPromo = await promoPrice.isVisible().catch(() => false);
    if (hasPromo) {
      console.log(`Precio promo: ${await promoPrice.textContent()}`);
    }

    // Precio "antes"
    const beforePrice = page.locator('.wTxtProductPriceBefore').first();
    const hasBefore = await beforePrice.isVisible().catch(() => false);
    if (hasBefore) {
      console.log(`Precio antes: ${await beforePrice.textContent()}`);
    }

    // Cocardas/badges
    const badges = page.locator('.card-product-badge');
    const badgeCount = await badges.count();
    for (let i = 0; i < badgeCount; i++) {
      if (await badges.nth(i).isVisible().catch(() => false)) {
        console.log(`Badge: ${await badges.nth(i).textContent()}`);
      }
    }

    await page.screenshot({ path: 'test-results/c2-04-product-prices.png', fullPage: true });
  });

  test('3. Checkout: Click & Go, seleccionar sucursal', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    // Ir al checkout
    await page.locator('#MPW0017W0019BTNCHECKOUT').click({ force: true });
    await page.waitForTimeout(3000);
    const confirmarAddr = page.getByRole('button', { name: /confirmar/i });
    if (await confirmarAddr.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmarAddr.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    await expect(page).toHaveURL(/caja/, { timeout: 10_000 });
    await page.screenshot({ path: 'test-results/c2-05-checkout.png' });

    // Seleccionar Click & Go (Retiro)
    await selectPickupStore(page);
    await page.screenshot({ path: 'test-results/c2-06-pickup.png' });

    // Puede aparecer modal "¿Cómo querés comprar?" con opciones de surtido
    // Seleccionar "Surtido completo" o "Ingresar" en la primera opción
    const surtidoModal = page.getByText('¿Cómo querés comprar?');
    if (await surtidoModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Modal de surtido detectado');
      await page.screenshot({ path: 'test-results/c2-06b-surtido-modal.png' });
      // Click en "Ingresar" del primer tipo (Entrega en el día o Surtido completo)
      const ingresarBtn = page.getByText('Ingresar').first();
      if (await ingresarBtn.isVisible().catch(() => false)) {
        await ingresarBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
    }

    // Seleccionar fecha si es necesario
    await selectDateFar(page);

    const fechaText = page.locator('.ReadonlyAttributeEditFormDateEdit').first();
    if (await fechaText.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`Fecha: ${await fechaText.textContent()}`);
    }
    await page.screenshot({ path: 'test-results/c2-07-date.png' });

    // Continuar a Forma de Pago
    await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    console.log(`URL: ${page.url()}`);
    await page.screenshot({ path: 'test-results/c2-08-forma-pago.png' });
    expect(page.url()).toContain('caja?2');
  });

  test.skip('4. Pagar con PASSCARD y completar compra (requiere GeoPay)', async ({ page }) => {
    // TODO: Cuando GeoPay funcione:
    // - Seleccionar tarjetas → Nueva tarjeta de crédito → Pass Card
    // - Popup GeoPay: ingresar 6280261111113352, 12/28, CVV 123
    // - Seleccionar cuotas
    // - Continuar a confirmación
    // - Completar compra
  });

  test.skip('5. Widget status del pedido y cancelar (requiere compra completada)', async ({ page }) => {
    // TODO: Después de completar la compra:
    // - Verificar landing de status del pedido
    // - Click en widget de status
    // - Cancelar el pedido
    // - Verificar cancelación
  });
});
