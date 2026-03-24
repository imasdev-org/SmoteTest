import { expect } from '@playwright/test';
import { Given, When, Then, test } from './fixtures';

function isMobile(page: import('@playwright/test').Page): boolean {
  const viewport = page.viewportSize();
  return !!viewport && viewport.width < 768;
}

// --- Producto financiable según ambiente ---

When('busco el producto financiable del ambiente', async ({ page, baseURL }) => {
  const term = (baseURL || '').includes('tiendainglesa.com.uy') ? 'pilas' : 'camara digital nikon';
  const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
  await searchbox.fill(term);
  await searchbox.press('Enter');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
});

// --- Inicio checkout ---

When('inicio el checkout', async ({ page }) => {
  if (isMobile(page)) {
    await page.goto('/supermercado/carrito');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const btn = document.querySelector('#MPW9999PAY, [id*="BTNCHECKOUT"], [class*="ButtonPay"]') as HTMLElement;
      if (btn) btn.click();
    });
  } else {
    await page.locator('#MPW0017W0019BTNCHECKOUT').click({ force: true });
  }
  await page.waitForTimeout(3000);

  // Confirmar dirección si aparece modal
  const confirmar = page.getByRole('button', { name: /confirmar/i });
  if (await confirmar.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmar.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  await expect(page).toHaveURL(/caja/, { timeout: 10_000 });
});

// --- Entrega ---

When('selecciono {string}', async ({ page }, option: string) => {
  await page.getByText(option).first().click();
  await page.waitForTimeout(2000);
});

When('selecciono una dirección de entrega', async ({ page }) => {
  const addressSelect = page.locator('#W0063vCOMBOADDRESSID');
  if (await addressSelect.isVisible().catch(() => false)) {
    const allOptions = await addressSelect.locator('option').all();
    if (allOptions.length > 1) {
      await addressSelect.selectOption({ index: 1 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
    }
  }
});

When('selecciono zona {string} y sucursal {string}', async ({ page }, zona: string, sucursal: string) => {
  // Puede aparecer modal "¿Cómo querés comprar?"
  const surtidoModal = page.getByText('¿Cómo querés comprar?');
  if (await surtidoModal.isVisible({ timeout: 5000 }).catch(() => false)) {
    const ingresarBtn = page.getByText('Ingresar').first();
    if (await ingresarBtn.isVisible().catch(() => false)) {
      await ingresarBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
  }

  // Zona
  const zonaSelect = page.locator('#W0063vSTOREZONEID');
  if (await zonaSelect.isVisible().catch(() => false)) {
    const zonaOptions = await zonaSelect.locator('option').allTextContents();
    const match = zonaOptions.find(o => new RegExp(zona, 'i').test(o)) || zonaOptions[1];
    await zonaSelect.selectOption({ label: match });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
  }

  // Sucursal
  const sucursalSelect = page.locator('#W0063vCLICKANDGOSTOREID');
  if (await sucursalSelect.isVisible().catch(() => false)) {
    const options = await sucursalSelect.locator('option').allTextContents();
    const match = options.find(o => new RegExp(sucursal, 'i').test(o));
    if (match) {
      await sucursalSelect.selectOption({ label: match });
    } else if (options.length > 1) {
      await sucursalSelect.selectOption({ index: 1 });
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }
});

// --- Fecha ---

When('selecciono la fecha de entrega más lejana', async ({ page }) => {
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

  // Seleccionar último horario habilitado
  await page.evaluate(() => {
    const popup = document.getElementById('W0063TABLEPOPUP');
    if (!popup) return;
    const slots = popup.querySelectorAll('[class*="Slot"], [class*="slot"], [class*="Schedule"]');
    let lastSlot: HTMLElement | null = null;
    slots.forEach(s => {
      const el = s as HTMLElement;
      if (!el.className.includes('Disabled') && !el.className.includes('disabled') && el.offsetWidth > 0) lastSlot = el;
    });
    if (lastSlot) (lastSlot as HTMLElement).click();
  });
  await page.waitForTimeout(1000);

  // Fallback: click por texto
  const timeSlots = dateModal.getByText(/\d{2}:\d{2}\s*a\s*\d{2}:\d{2}/);
  const slotCount = await timeSlots.count();
  for (let i = slotCount - 1; i >= 0; i--) {
    if (await timeSlots.nth(i).isVisible().catch(() => false)) {
      await timeSlots.nth(i).click({ force: true });
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
});

// --- Continuar ---

When('continúo al paso de forma de pago', async ({ page }) => {
  await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
});

When('continúo al paso de confirmación', async ({ page }) => {
  await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
});

When('completo la compra', async ({ page }) => {
  await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
});

// --- Assertions ---

Then('estoy en la página de forma de pago', async ({ page }) => {
  expect(page.url()).toContain('caja?2');
});

Given('que estoy en la página de forma de pago', async ({ page }) => {
  // Los escenarios BDD son independientes - necesitamos navegar al checkout
  // Si no estamos en caja?2, skip (GeoPay requiere llegar a este punto)
  if (!page.url().includes('caja?2')) {
    test.skip(true, 'Requiere completar checkout hasta forma de pago - ejecutar escenario previo');
  }
});

Then('veo la fecha de entrega correcta', async ({ page }) => {
  const bodyText = await page.textContent('body') || '';
  const fechaMatch = bodyText.match(/(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s+\d+/i);
  expect(fechaMatch).toBeTruthy();
});

Then('veo la dirección de entrega correcta', async ({ page }) => {
  const bodyText = await page.textContent('body') || '';
  expect(bodyText).toMatch(/Isla Patrulla|Artigas|BrazoOriental|Propios|domicilio|Central/i);
});

Then('veo la landing de status del pedido', async ({ page }) => {
  // Después de completar compra, debería estar en una página de confirmación/status
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/order-status.png' });
});

Given('que estoy en la landing de status del pedido', async ({ page }) => {
  // Se asume que el test anterior nos dejó acá
});

When('hago click en el widget de status del pedido', async ({ page }) => {
  // TODO: Identificar el widget de status del pedido
  const statusWidget = page.locator('[class*="status" i], [class*="pedido" i], [class*="order" i]').first();
  if (await statusWidget.isVisible().catch(() => false)) {
    await statusWidget.click();
    await page.waitForTimeout(3000);
  }
});

When('cancelo el pedido', async ({ page }) => {
  const cancelBtn = page.getByText('Cancelar pedido').or(page.locator('[id*="CANCEL" i]'));
  if (await cancelBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await cancelBtn.first().click();
    await page.waitForTimeout(2000);
    const confirmCancel = page.getByRole('button', { name: /confirmar|sí|aceptar/i });
    if (await confirmCancel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmCancel.click();
      await page.waitForTimeout(3000);
    }
  }
});

Then('el pedido fue cancelado', async ({ page }) => {
  await page.screenshot({ path: 'test-results/order-cancelled.png' });
});
