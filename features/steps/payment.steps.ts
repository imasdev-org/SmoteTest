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
  const passcardExisting = page.locator('[id*="TXTCARD"]').filter({ hasText: /6280|passcard|PASS/i });
  if (await passcardExisting.first().isVisible({ timeout: 3000 }).catch(() => false)) {
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
});

When('selecciono nueva tarjeta de crédito', async ({ page }) => {
  const el = page.locator('#W0057W0032W0006TXTCARD_0002').or(page.getByText('Nueva tarjeta de crédito').first());
  await expect(el.first()).toBeVisible({ timeout: 10_000 });
  await el.first().click();
  await page.waitForTimeout(3000);
});

When('elijo el tipo {string}', async ({ page }, cardType: string) => {
  const option = page.getByText(cardType).first();
  await expect(option).toBeVisible({ timeout: 10_000 });

  const popupPromise = page.waitForEvent('popup', { timeout: 30_000 }).catch(() => null);
  await option.click();
  const popup = await popupPromise;

  if (popup) {
    // Guardar popup en el contexto para el siguiente step
    (page as any).__geopayPopup = popup;
  } else {
    // GeoPay no disponible
    test.skip(true, 'GeoPay no disponible - popup del procesador de pago no se abrió');
  }
});

When('completo los datos de la PASSCARD en el popup de GeoPay', async ({ page }) => {
  const popup = (page as any).__geopayPopup;
  if (!popup) {
    test.skip(true, 'GeoPay popup no disponible');
    return;
  }

  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(5000);

  // Llenar número de tarjeta
  for (const sel of ['input[name*="card" i]', 'input[id*="card" i]', 'input[name*="number" i]', 'input[type="tel"]']) {
    const input = popup.locator(sel).first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(PASSCARD.number);
      break;
    }
  }

  // Llenar vencimiento
  for (const sel of ['input[name*="expir" i]', 'input[id*="expir" i]', 'input[placeholder*="MM" i]']) {
    const input = popup.locator(sel).first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(PASSCARD.expiry);
      break;
    }
  }

  // Llenar CVV
  for (const sel of ['input[name*="cvv" i]', 'input[name*="cvc" i]', 'input[id*="cvv" i]']) {
    const input = popup.locator(sel).first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await input.fill(PASSCARD.cvv);
      break;
    }
  }

  // Confirmar
  const confirmBtn = popup.getByRole('button', { name: /guardar|confirmar|aceptar|enviar|pagar|save/i })
    .or(popup.locator('input[type="submit"]:visible, button[type="submit"]:visible'));
  if (await confirmBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.first().click();
  }

  await popup.waitForEvent('close', { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(5000);
});

When('selecciono {int} cuotas', async ({ page }, installments: number) => {
  const cuotasSelect = page.locator('select:visible').filter({ has: page.locator('option:has-text("cuota")') });
  if (await cuotasSelect.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await cuotasSelect.first().selectOption({ label: new RegExp(`${installments}`) });
  } else {
    const cuotaOption = page.getByText(new RegExp(`${installments}\\s*cuota`)).first();
    if (await cuotaOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cuotaOption.click();
    }
  }
  await page.waitForTimeout(2000);
});
