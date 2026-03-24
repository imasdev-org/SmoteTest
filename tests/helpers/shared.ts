import { Page, expect } from '@playwright/test';

/**
 * Helpers compartidos para desktop y mobile.
 *
 * GeneXus renderiza selectores diferentes según viewport:
 * - Desktop: #MPW0017W0019LBLLOGIN, #MPW0017W0019CARTCOUNT, #MPW0017W0019vCARTIMG, #MPW0017W0019BTNCHECKOUT
 * - Mobile:  #CARTCOUNT_MPAGE, #vCARTIMG_MPAGE, y el login puede estar en un menú hamburguesa
 */

export const USER = { email: 'laguiar@adinet.com.uy', password: '123' };
export const PASSCARD = { number: '6280261111113352', expiry: '12/28', cvv: '123' };

export function getSearchTerm(baseURL: string): string {
  if (baseURL.includes('tiendainglesa.com.uy')) return 'pilas';
  return 'camara digital nikon';
}

function isMobile(page: Page): boolean {
  const viewport = page.viewportSize();
  return !!viewport && viewport.width < 768;
}

// --- Login ---

export async function login(page: Page) {
  if (isMobile(page)) {
    // En mobile, el botón de login puede estar en el menú hamburguesa o ser diferente
    const mobileLoginBtn = page.locator('#LBLLOGIN_MPAGE, [id*="LBLLOGIN"]').first();
    const hamburger = page.locator('#MenuButton, [class*="hamburger" i], [class*="menu-toggle" i]').first();

    if (await mobileLoginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mobileLoginBtn.click();
    } else if (await hamburger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hamburger.click();
      await page.waitForTimeout(1000);
      const loginInMenu = page.getByText(/ingresar|login/i).first();
      await loginInMenu.click();
    } else {
      // Fallback: navegar directo a login
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
}

// --- Carrito ---

export async function getCartCount(page: Page): Promise<number> {
  const selector = isMobile(page) ? '#CARTCOUNT_MPAGE' : '#MPW0017W0019CARTCOUNT';
  const text = await page.locator(selector).textContent().catch(() => '0') || '0';
  return parseInt(text) || 0;
}

export async function emptyCart(page: Page) {
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

// --- Búsqueda ---

export async function searchAndAdd(page: Page, term: string) {
  const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
  await searchbox.fill(term);
  await searchbox.press('Enter');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const agregarBtn = page.getByText('Agregar al carrito').first();
  const addById = page.locator('input[id^="add"]').first();
  if (await agregarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await agregarBtn.click();
  } else if (await addById.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addById.click();
  }
  await page.waitForTimeout(3000);
}

export async function goToProductDetail(page: Page, term: string) {
  const searchbox = page.getByRole('textbox', { name: /buscar/i }).first();
  await searchbox.fill(term);
  await searchbox.press('Enter');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const productLink = page.locator('a[href*=".producto"]').first();
  const href = await productLink.getAttribute('href') || '';
  await page.goto(href);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  return href;
}

// --- Checkout ---

export async function startCheckout(page: Page) {
  if (isMobile(page)) {
    // En mobile: navegar directo al carrito y buscar Pagar
    await page.goto('/supermercado/carrito');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Scroll al final y click en PAGAR via JS (puede estar fuera de viewport)
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
}

export async function selectAddress(page: Page) {
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

export async function selectPickupStore(page: Page) {
  await page.getByText('Retiro').first().click();
  await page.waitForTimeout(2000);

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

  // Zona: Montevideo
  const zonaSelect = page.locator('#W0063vSTOREZONEID');
  if (await zonaSelect.isVisible().catch(() => false)) {
    const zonaOptions = await zonaSelect.locator('option').allTextContents();
    const mvdOption = zonaOptions.find(o => /montevideo/i.test(o)) || zonaOptions[1];
    await zonaSelect.selectOption({ label: mvdOption });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
  }

  // Sucursal: Click & Go Central
  const sucursalSelect = page.locator('#W0063vCLICKANDGOSTOREID');
  if (await sucursalSelect.isVisible().catch(() => false)) {
    const options = await sucursalSelect.locator('option').allTextContents();
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

export async function selectDateFar(page: Page) {
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
      if (!el.className.includes('Disabled') && !el.className.includes('disabled') && el.offsetWidth > 0) {
        lastSlot = el;
      }
    });
    if (lastSlot) (lastSlot as HTMLElement).click();
  });
  await page.waitForTimeout(1000);

  // Fallback: click por texto en último horario visible
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
}

export async function continueToPayment(page: Page) {
  await page.locator('#W0063BTNCHECKOUTCONTINUE').click({ force: true });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
}

// --- Verificación de producto ---

export async function verifyProductDetail(page: Page) {
  // Imagen
  const img = page.locator('img').first();
  await expect(img).toBeVisible();
  console.log('Imagen: visible');

  // Precio principal
  const price = page.locator('.wProductPrimaryPrice, .ProductPriceAccent, .ProductPrice').first();
  await expect(price).toBeVisible();
  const priceText = await price.textContent();
  console.log(`Precio: ${priceText}`);
  expect(priceText).toContain('$');

  // Precio promocional
  const promoPrice = page.locator('.ProductSpecialPrice').first();
  if (await promoPrice.isVisible().catch(() => false)) {
    console.log(`Precio promo: ${await promoPrice.textContent()}`);
  }

  // Precio "antes"
  const beforePrice = page.locator('.wTxtProductPriceBefore').first();
  if (await beforePrice.isVisible().catch(() => false)) {
    console.log(`Precio antes: ${await beforePrice.textContent()}`);
  }

  // Cocardas
  const badges = page.locator('.card-product-badge');
  for (let i = 0; i < await badges.count(); i++) {
    if (await badges.nth(i).isVisible().catch(() => false)) {
      console.log(`Badge: ${await badges.nth(i).textContent()}`);
    }
  }
}
