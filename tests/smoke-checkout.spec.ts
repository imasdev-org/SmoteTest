import { test, expect, Page } from '@playwright/test';

/**
 * Smoke Test - Ciclo de compra completo con PASSCARD
 *
 * Usuario: laguiar@adinet.com.uy
 * Tarjeta PASSCARD: 6280261111113352, 12/28, CVV 123
 * Producto: "camara digital nikon" (trunk/staging) o "pilas" (prod)
 *
 * Pasos:
 * 1. Login, vaciar carrito, buscar producto, agregar al carrito
 * 2. Checkout: envío a domicilio, seleccionar fecha lejana, continuar
 * 3. Forma de pago: seleccionar tarjetas → Nueva tarjeta de crédito → Pass Card
 *    → Se abre popup de GeoPay para ingresar datos de tarjeta
 *    TODO: completar cuando GeoPay esté disponible
 * 4. Seleccionar 2 cuotas, continuar a confirmación
 * 5. Verificar fecha y dirección en pantalla final
 */

const USER = { email: 'laguiar@adinet.com.uy', password: '123' };
const PASSCARD = { number: '6280261111113352', expiry: '12/28', cvv: '123' };

function getSearchTerm(baseURL: string): string {
  if (baseURL.includes('tiendainglesa.com.uy')) return 'pilas';
  return 'camara digital nikon';
}

// --- Helpers ---

async function login(page: Page) {
  await page.locator('#MPW0017W0019LBLLOGIN').first().click();
  await page.waitForSelector('#W0009vUSER', { timeout: 10_000 });
  await page.locator('#W0009vUSER').fill(USER.email);
  await page.locator('#W0009vPASSWORD').fill(USER.password);
  await page.locator('#W0009ENTER').click();
  await page.waitForURL(/(?!.*ingresar)/, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

async function selectAddress(page: Page) {
  const addressSelect = page.locator('#W0063vCOMBOADDRESSID');
  if (await addressSelect.isVisible().catch(() => false)) {
    const allOptions = await addressSelect.locator('option').all();
    if (allOptions.length > 1) {
      await addressSelect.selectOption({ index: 1 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
    }
  }
}

async function selectDateFar(page: Page) {
  const fechaInput = page.getByText('Elegí cuando').first();
  if (!(await fechaInput.isVisible({ timeout: 3000 }).catch(() => false))) return;

  await fechaInput.click();
  await page.waitForTimeout(3000);

  const dateModal = page.locator('#W0063TABLEPOPUP');
  await expect(dateModal).toBeVisible({ timeout: 10_000 });

  // Seleccionar el último día habilitado via JS
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

  // Seleccionar horario
  const timeSlot = dateModal.getByText(/\d{2}:\d{2}\s*a\s*\d{2}:\d{2}/).first();
  if (await timeSlot.isVisible({ timeout: 3000 }).catch(() => false)) {
    await timeSlot.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Confirmar fecha
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

test.describe.serial('Smoke: Checkout completo con PASSCARD', () => {

  test('1. Login, vaciar carrito, buscar y agregar producto', async ({ page, baseURL }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);
    await page.screenshot({ path: 'test-results/smoke-01-logged-in.png' });

    // Vaciar carrito si tiene productos
    const cartCount = page.locator('#MPW0017W0019CARTCOUNT');
    const countText = await cartCount.textContent() || '0';
    console.log(`Items en carrito: ${countText}`);

    if (parseInt(countText) > 0) {
      console.log('Vaciando carrito...');
      await page.goto('/supermercado/carrito');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      for (let i = 0; i < 15; i++) {
        const deleteBtn = page.locator('[class*="delete" i], [class*="trash" i], .wCartDeleteBtn, [id*="DELETE" i]').first();
        if (!(await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false))) break;
        await deleteBtn.click();
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

    // Buscar y agregar producto
    const searchTerm = getSearchTerm(baseURL || '');
    console.log(`Buscando: "${searchTerm}"`);
    const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
    await searchbox.fill(searchTerm);
    await searchbox.press('Enter');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/smoke-02-search.png' });

    const agregarBtn = page.getByText('Agregar al carrito').first();
    const addById = page.locator('input[id^="add"]').first();
    if (await agregarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agregarBtn.click();
    } else if (await addById.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addById.click();
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/smoke-03-added.png' });

    const newCount = await cartCount.textContent() || '0';
    console.log(`Items en carrito: ${newCount}`);
    expect(parseInt(newCount)).toBeGreaterThan(0);
  });

  test('2. Checkout: envío a domicilio, fecha lejana, continuar a pago', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    // Ir al checkout
    await page.locator('#MPW0017W0019BTNCHECKOUT').click();
    await page.waitForTimeout(3000);
    const confirmarAddr = page.getByRole('button', { name: /confirmar/i });
    if (await confirmarAddr.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmarAddr.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    await expect(page).toHaveURL(/caja/, { timeout: 10_000 });

    // Envío a domicilio
    await page.getByText('Envío a domicilio').click();
    await page.waitForTimeout(2000);

    // Seleccionar dirección y fecha
    await selectAddress(page);
    await page.screenshot({ path: 'test-results/smoke-04-address.png' });
    await selectDateFar(page);

    const fechaText = page.locator('.ReadonlyAttributeEditFormDateEdit').first();
    if (await fechaText.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`Fecha seleccionada: ${await fechaText.textContent()}`);
    }
    await page.screenshot({ path: 'test-results/smoke-05-date.png' });

    // Continuar a Forma de Pago
    await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    console.log(`URL: ${page.url()}`);
    await page.screenshot({ path: 'test-results/smoke-06-forma-pago.png' });
    expect(page.url()).toContain('caja?2');
  });

  test.skip('3. Forma de pago: seleccionar Pass Card (requiere GeoPay)', async ({ page }) => {
    await page.goto('/supermercado');
    await page.waitForLoadState('networkidle');
    await login(page);

    // Navegar al checkout → pago
    await page.locator('#MPW0017W0019BTNCHECKOUT').click();
    await page.waitForTimeout(3000);
    const confirmar = page.getByRole('button', { name: /confirmar/i });
    if (await confirmar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmar.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    await selectAddress(page);
    await selectDateFar(page);
    await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Tab Tarjetas
    const tarjetasTab = page.getByText('Tarjetas').first();
    if (await tarjetasTab.isVisible().catch(() => false)) {
      await tarjetasTab.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: 'test-results/smoke-07-pago.png' });

    // Buscar y eliminar PASSCARD existente (6280)
    const passcardExisting = page.locator('[id*="TXTCARD"]').filter({ hasText: /6280|passcard|PASS/i });
    if (await passcardExisting.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('PASSCARD existente encontrada - eliminando...');
      await passcardExisting.first().click();
      await page.waitForTimeout(2000);
      const deleteBtn = page.locator('[id*="DELETE" i]').or(page.getByText(/eliminar|borrar/i));
      if (await deleteBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteBtn.first().click();
        await page.waitForTimeout(2000);
        const confirmDel = page.getByRole('button', { name: /confirmar|sí|aceptar|eliminar/i });
        if (await confirmDel.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmDel.click();
          await page.waitForTimeout(3000);
        }
      }
    }

    // Nueva tarjeta de crédito → Pass Card
    const newCreditCard = page.locator('#W0057W0032W0006TXTCARD_0002').or(page.getByText('Nueva tarjeta de crédito').first());
    await expect(newCreditCard.first()).toBeVisible({ timeout: 10_000 });
    await newCreditCard.first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/smoke-08-card-types.png' });

    // Seleccionar Pass Card - abre popup externo de GeoPay
    const passCardOption = page.getByText('Pass Card').first();
    await expect(passCardOption).toBeVisible({ timeout: 10_000 });

    const popupPromise = page.waitForEvent('popup', { timeout: 30_000 }).catch(() => null);
    await passCardOption.click();
    const popup = await popupPromise;

    if (popup) {
      console.log(`GeoPay popup abierto: ${popup.url()}`);
      await popup.waitForLoadState('domcontentloaded');
      await popup.waitForTimeout(3000);
      await popup.screenshot({ path: 'test-results/smoke-09-geopay.png', fullPage: true });

      // TODO: Llenar formulario GeoPay con datos de PASSCARD
      // Número: 6280261111113352, Vencimiento: 12/28, CVV: 123
      // Explorar campos del formulario:
      const inputs = popup.locator('input:visible');
      const count = await inputs.count();
      console.log(`Campos en GeoPay: ${count}`);
      for (let i = 0; i < count; i++) {
        const id = await inputs.nth(i).getAttribute('id');
        const name = await inputs.nth(i).getAttribute('name');
        const type = await inputs.nth(i).getAttribute('type');
        console.log(`  [${i}] id="${id}" name="${name}" type="${type}"`);
      }

      // TODO: llenar y confirmar cuando GeoPay funcione
    } else {
      console.log('GeoPay no disponible - popup no se abrió');
      await page.screenshot({ path: 'test-results/smoke-09-no-geopay.png' });
      test.skip(true, 'GeoPay no disponible - no se pudo abrir popup del procesador de pago');
    }
  });

  // TODO: Test 4 - Seleccionar 2 cuotas y continuar a confirmación
  // TODO: Test 5 - Verificar fecha y dirección en pantalla de confirmación
});
