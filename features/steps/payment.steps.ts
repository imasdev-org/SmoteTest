import { expect } from '@playwright/test';
import { When, Then, test } from './fixtures';

const PASSCARD = { number: '6280261111113352', expiry: '12/28', cvv: '123' };

When('selecciono la pestaña {string}', async ({ page }, tabName: string) => {
  const tab = page.getByText(tabName).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(2000);
  }
});

When('elimino la PASSCARD existente si la hay', async ({ page }) => {
  // Buscar tarjeta que contenga "asscard" o "628026" en la lista
  const passcardRow = page.getByText(/asscard|628026/i).first();
  if (await passcardRow.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('PASSCARD existente encontrada, eliminando...');

    // Buscar "Eliminar" cerca de la PASSCARD
    const eliminarBtn = page.getByText('Eliminar').first();
    if (await eliminarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eliminarBtn.click();
      await page.waitForTimeout(3000);

      // Confirmar eliminación si hay modal
      const confirmDel = page.getByRole('button', { name: /confirmar|sí|aceptar|ok/i });
      if (await confirmDel.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmDel.click();
        await page.waitForTimeout(3000);
      }
      console.log('PASSCARD eliminada');
      await page.screenshot({ path: 'test-results/passcard-deleted.png' });
    }
  } else {
    console.log('No hay PASSCARD existente');
  }
  await page.waitForTimeout(2000);
});

When('selecciono nueva tarjeta de crédito', async ({ page }) => {
  const newCard = page.getByText('Nueva tarjeta de crédito').first();
  await expect(newCard).toBeVisible({ timeout: 10_000 });
  await newCard.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/card-type-modal.png' });
});

When('elijo el tipo {string}', async ({ page }, cardType: string) => {
  const option = page.getByText(cardType).first();
  await expect(option).toBeVisible({ timeout: 10_000 });

  const popupPromise = page.waitForEvent('popup', { timeout: 30_000 }).catch(() => null);
  await option.click();
  const popup = await popupPromise;

  if (popup) {
    (page as any).__geopayPopup = popup;
    console.log(`GeoPay popup abierto: ${popup.url()}`);
  } else {
    await page.screenshot({ path: 'test-results/geopay-no-popup.png', fullPage: true });
    throw new Error('GeoPay popup no se abrió. Verificar que el servicio está disponible.');
  }
});

When('completo los datos de la PASSCARD en el popup de GeoPay', async ({ page }) => {
  const popup = (page as any).__geopayPopup;
  if (!popup) throw new Error('GeoPay popup no disponible');

  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(5000);
  await popup.screenshot({ path: 'test-results/geopay-popup.png', fullPage: true });

  // Campos de GeoPay: cardNumber, dueDateMonth, dueDateYear, firstName, lastName, phone, email, terms
  const [month, year] = PASSCARD.expiry.split('/');

  await popup.locator('#cardNumber').fill(PASSCARD.number);
  console.log('Número de tarjeta ingresado');

  await popup.locator('#dueDateMonth').fill(month);
  await popup.locator('#dueDateYear').fill(year);
  console.log(`Vencimiento ingresado: ${month}/${year}`);

  // Nombre y apellido
  const firstName = popup.locator('#firstName');
  if (await firstName.isVisible().catch(() => false)) {
    await firstName.fill('Laura');
  }
  const lastName = popup.locator('#lastName');
  if (await lastName.isVisible().catch(() => false)) {
    await lastName.fill('Prueba Aguiar');
  }

  // Teléfono y email
  const phone = popup.locator('#phone');
  if (await phone.isVisible().catch(() => false)) {
    await phone.fill('59891320045');
  }
  const email = popup.locator('#email');
  if (await email.isVisible().catch(() => false)) {
    await email.fill('laguiar@adinet.com.uy');
  }

  // Aceptar términos
  const terms = popup.locator('#terms');
  if (await terms.isVisible().catch(() => false)) {
    await terms.check();
  }

  await popup.screenshot({ path: 'test-results/geopay-filled.png', fullPage: true });

  // Buscar y clickear botón de confirmar/enviar
  const allBtns = popup.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible');
  const btnCount = await allBtns.count();
  console.log(`Botones en GeoPay: ${btnCount}`);
  for (let i = 0; i < btnCount; i++) {
    const text = await allBtns.nth(i).textContent().catch(() => '');
    const value = await allBtns.nth(i).getAttribute('value');
    console.log(`  btn[${i}] value="${value}" text="${text?.trim().substring(0, 40)}"`);
  }

  const confirmBtn = popup.getByRole('button', { name: /guardar|confirmar|aceptar|enviar|pagar|save|submit|agregar|dar de alta/i })
    .or(popup.locator('input[type="submit"]:visible, button[type="submit"]:visible'));
  if (await confirmBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.first().click();
    console.log('Tarjeta confirmada en GeoPay');
  } else {
    // Último botón visible como fallback
    if (btnCount > 0) {
      await allBtns.last().click();
      console.log('Click en último botón del popup');
    }
  }

  // Esperar a que el popup se cierre o timeout
  await popup.waitForEvent('close', { timeout: 30_000 }).catch(() => {
    console.log('Popup no se cerró automáticamente');
  });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/after-geopay.png', fullPage: true });
  console.log('GeoPay completado');
});

When('selecciono cuotas', async ({ page }) => {
  // El selector de cuotas está al final de la página de forma de pago
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Buscar el select de cuotas (está al lado de "Cuotas:")
  const allSelects = page.locator('select:visible');
  const selectCount = await allSelects.count();
  console.log(`Selects visibles: ${selectCount}`);

  for (let i = 0; i < selectCount; i++) {
    const options = await allSelects.nth(i).locator('option').allTextContents();
    console.log(`  select[${i}] options: ${options.join(', ')}`);
    // El select de cuotas tiene opciones numéricas (1, 2, 3, etc.)
    if (options.some(o => /^\d+$/.test(o.trim()))) {
      // Seleccionar la segunda opción disponible (primera cuota en cuotas)
      const numericOptions = options.filter(o => /^\d+$/.test(o.trim())).map(o => parseInt(o.trim()));
      const target = numericOptions.length > 1 ? numericOptions[1] : numericOptions[0];
      await allSelects.nth(i).selectOption(String(target));
      console.log(`${target} cuotas seleccionadas`);
      break;
    }
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/cuotas-selected.png' });
});
