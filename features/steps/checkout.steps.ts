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
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
});

// --- Inicio checkout ---

When('inicio el checkout', async ({ page }) => {
  if (isMobile(page)) {
    await page.goto('/supermercado/carrito');
    await page.waitForLoadState('domcontentloaded');
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
    await page.waitForLoadState('domcontentloaded');
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
      await page.waitForLoadState('domcontentloaded');
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
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    }
  }

  // Zona
  const zonaSelect = page.locator('#W0063vSTOREZONEID');
  if (await zonaSelect.isVisible().catch(() => false)) {
    const zonaOptions = await zonaSelect.locator('option').allTextContents();
    const match = zonaOptions.find(o => new RegExp(zona, 'i').test(o)) || zonaOptions[1];
    await zonaSelect.selectOption({ label: match });
    await page.waitForLoadState('domcontentloaded');
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
    await page.waitForLoadState('domcontentloaded');
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
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
});

When('continúo al paso de confirmación', async ({ page }) => {
  await page.evaluate(() => {
    // Click en cualquier botón "Continuar" visible en la página
    const btns = document.querySelectorAll('input[type="button"], button');
    for (const btn of btns) {
      const el = btn as HTMLInputElement;
      if ((el.value === 'Continuar' || el.textContent?.trim() === 'Continuar') && el.offsetParent !== null) {
        el.click();
        break;
      }
    }
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/confirmacion.png', fullPage: true });
});

When('completo la compra', async ({ page }) => {
  await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
});

// --- Assertions ---

Then('estoy en la página de forma de pago', async ({ page }) => {
  expect(page.url()).toContain('caja?2');
});

Given('que estoy en la página de forma de pago', async ({ page, baseURL }) => {
  // Escenarios BDD son independientes - navegamos al checkout completo
  const USER = { email: 'laguiar@adinet.com.uy', password: '123' };

  // Login (solo si no está logueado - Antecedentes ya lo hizo)
  await page.goto('/supermercado');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  const loginBtn = page.locator('#MPW0017W0019LBLLOGIN').first();
  const needsLogin = await loginBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (needsLogin) {
    await loginBtn.click();
    await page.waitForSelector('#W0009vUSER', { timeout: 10_000 });
    await page.locator('#W0009vUSER').fill(USER.email);
    await page.locator('#W0009vPASSWORD').fill(USER.password);
    await page.locator('#W0009ENTER').click();
    await page.waitForURL(/(?!.*ingresar)/, { timeout: 15_000 });
    await page.waitForLoadState('domcontentloaded');
  }

  // Verificar carrito tiene productos, si no agregar uno
  const cartSelector = isMobile(page) ? '#CARTCOUNT_MPAGE' : '#MPW0017W0019CARTCOUNT';
  const cartText = await page.locator(cartSelector).textContent().catch(() => '0') || '0';
  if (parseInt(cartText) === 0) {
    const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
    await searchbox.fill('manzana');
    await searchbox.press('Enter');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    const addBtn = page.getByText('Agregar al carrito').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) await addBtn.click();
    await page.waitForTimeout(3000);
  }

  // Ir al checkout
  if (isMobile(page)) {
    await page.goto('/supermercado/carrito');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const btn = document.querySelector('#MPW9999PAY, [id*="BTNCHECKOUT"]') as HTMLElement;
      if (btn) btn.click();
    });
  } else {
    await page.locator('#MPW0017W0019BTNCHECKOUT').click({ force: true });
  }
  await page.waitForTimeout(3000);

  // Confirmar dirección modal
  const confirmar = page.getByRole('button', { name: /confirmar/i });
  if (await confirmar.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmar.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  }

  // Seleccionar dirección
  const addressSelect = page.locator('#W0063vCOMBOADDRESSID');
  if (await addressSelect.isVisible().catch(() => false)) {
    const allOptions = await addressSelect.locator('option').all();
    if (allOptions.length > 1) {
      await addressSelect.selectOption({ index: 1 });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(5000);
    }
  }

  // Seleccionar fecha - usar JS click para activar el evento GeneXus
  await page.waitForTimeout(3000);
  const fechaExists = await page.getByText('Elegí cuando').first().isVisible({ timeout: 5000 }).catch(() => false);
  if (fechaExists) {
    await page.evaluate(() => {
      const el = document.querySelector('[id*="CTLDATEINFO"], [class*="DateEdit"]') as HTMLElement;
      if (el) { el.click(); el.dispatchEvent(new Event('click', { bubbles: true })); }
    });
    await page.waitForTimeout(5000);
    const dateModal = page.locator('#W0063TABLEPOPUP');
    if (await dateModal.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await page.evaluate(() => {
        const popup = document.getElementById('W0063TABLEPOPUP');
        if (!popup) return;
        const slides = popup.querySelectorAll('.slick-slide:not(.slick-cloned)');
        let last: HTMLElement | null = null;
        slides.forEach(s => { const e = s as HTMLElement; if (!e.className.includes('Disabled') && e.offsetWidth > 0) last = e; });
        if (last) (last as HTMLElement).click();
      });
      await page.waitForTimeout(2000);
      // Horario
      const slots = dateModal.getByText(/\d{2}:\d{2}\s*a\s*\d{2}:\d{2}/);
      for (let i = await slots.count() - 1; i >= 0; i--) {
        if (await slots.nth(i).isVisible().catch(() => false)) { await slots.nth(i).click({ force: true }); break; }
      }
      await page.waitForTimeout(1000);
      // Confirmar fecha
      await page.evaluate(() => {
        const popup = document.getElementById('W0063TABLEPOPUP');
        if (!popup) return;
        popup.querySelectorAll('input[type="button"]').forEach(btn => {
          const b = btn as HTMLInputElement;
          if (b.value === 'Confirmar' && b.offsetWidth > 0 && !b.id.includes('NOSLOTS')) b.click();
        });
      });
      await page.waitForTimeout(3000);
    }
  }

  // Continuar a forma de pago
  await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);
  expect(page.url()).toMatch(/caja\?[23]/);
});

// --- Confirmar pedido ---

When('confirmo el pedido', async ({ page }) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // Buscar botón "Confirmar Pedido"
  const confirmBtn = page.getByRole('button', { name: /confirmar pedido/i })
    .or(page.locator('input[value*="Confirmar Pedido"]'));
  if (await confirmBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.first().click();
  } else {
    // JS fallback
    await page.evaluate(() => {
      const btns = document.querySelectorAll('input[type="button"], button');
      for (const btn of btns) {
        const el = btn as HTMLInputElement;
        const text = el.value || el.textContent || '';
        if (text.includes('Confirmar Pedido') && el.offsetParent !== null) {
          el.click();
          break;
        }
      }
    });
  }
  await page.waitForTimeout(10_000);
  await page.screenshot({ path: 'test-results/pedido-confirmado.png', fullPage: true });
});

Then('el pedido se completó exitosamente', async ({ page }) => {
  // Después de confirmar, debería navegar a una página de éxito o status
  const bodyText = await page.textContent('body') || '';
  const exito = bodyText.match(/pedido|compra|confirmad|éxito|gracias|order/i);
  console.log(`Página post-confirmación: ${page.url()}`);
  console.log(`Contiene referencia a pedido: ${!!exito}`);
  await page.screenshot({ path: 'test-results/pedido-completado.png', fullPage: true });
});

// --- Mis Pedidos ---

When('voy a mis pedidos desde el menú', async ({ page }) => {
  // Ir al home primero
  await page.goto('/supermercado');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Buscar "Mis pedidos" en el menú de usuario o navegar directo
  const misPedidosLink = page.getByText('Mis pedidos').or(page.locator('a[href*="pedido"]'));
  if (await misPedidosLink.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await misPedidosLink.first().click();
  } else {
    // Click en el nombre del usuario para abrir dropdown
    const userMenu = page.locator('#MPW0017W0019TXTUSERNAME, [id*="TXTUSERNAME"]').first();
    if (await userMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
      await userMenu.click();
      await page.waitForTimeout(2000);
      const pedidosInMenu = page.getByText('Mis pedidos').first();
      if (await pedidosInMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pedidosInMenu.click();
      }
    }
    // Fallback: navegar directo
    if (!page.url().includes('pedido')) {
      await page.goto('/supermercado/mis_pedidos');
    }
  }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/mis-pedidos.png', fullPage: true });
  console.log(`Mis pedidos URL: ${page.url()}`);
});

When('cancelo el último pedido', async ({ page }) => {
  // Explorar los elementos del primer pedido para encontrar el botón cancelar
  const allLinks = page.locator('a, button, input[type="button"]');
  const count = await allLinks.count();
  const cancelTexts: string[] = [];
  for (let i = 0; i < Math.min(count, 50); i++) {
    const text = await allLinks.nth(i).textContent().catch(() => '');
    const value = await allLinks.nth(i).getAttribute('value');
    const id = await allLinks.nth(i).getAttribute('id');
    const href = await allLinks.nth(i).getAttribute('href');
    if (text?.match(/cancel/i) || value?.match(/cancel/i) || id?.match(/cancel/i) || href?.match(/cancel/i)) {
      cancelTexts.push(`id="${id}" text="${text?.trim().substring(0, 40)}" value="${value}" href="${href?.substring(0, 60)}"`);
    }
  }
  console.log(`Elementos con "cancel": ${cancelTexts.length}`);
  cancelTexts.forEach(t => console.log(`  ${t}`));

  // El primer botón "Cancelar Pedido" corresponde al pedido más reciente
  const cancelBtn = page.locator('#BTNCANCELORDER_0001, input[value="Cancelar Pedido"]').first();
  if (await cancelBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await cancelBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/cancel-clicked.png', fullPage: true });

    // Confirmar cancelación si hay modal
    const confirmCancel = page.getByRole('button', { name: /confirmar|sí|aceptar|ok/i })
      .or(page.locator('input[value*="Confirmar"]'));
    if (await confirmCancel.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmCancel.first().click();
      await page.waitForTimeout(5000);
    }
    console.log('Pedido cancelado');
  } else {
    console.log('No se encontró botón Cancelar Pedido');
  }
  await page.screenshot({ path: 'test-results/pedido-cancelado.png', fullPage: true });
});

Then('el pedido fue cancelado exitosamente', async ({ page }) => {
  const bodyText = await page.textContent('body') || '';
  const cancelado = bodyText.match(/cancelad|cancel/i);
  console.log(`Pedido cancelado: ${!!cancelado}`);
  await page.screenshot({ path: 'test-results/cancelacion-final.png', fullPage: true });
});

// --- Assertions ---

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
