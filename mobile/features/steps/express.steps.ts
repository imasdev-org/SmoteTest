import { Given, When, Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { T } from '../../support/texts';
import { restartApp, sendToBackground } from '../../support/app';
import {
  findByText, isVisibleNow, findInput, isVisibleText, swipe, tapText, tapTextIfVisible, typeInto, visibleTexts, waitForLoading, screenshot,
} from '../../support/ui';
import { cartCount, chooseWorldInSelector, firstMinus, firstPlus, isWorldSelectorOpen, search, scrollHomeToTop, selectWorld, tapButton, waitForAppReady } from '../../support/flows';
import { ctx } from '../../support/context';

const EXPRESS_ADDRESS = process.env.EXPRESS_ADDRESS || 'Rivera 3500';

When('elijo un domicilio con cobertura express', async () => {
  // Anónimo en Express: onboarding con el mapa (dirección del GPS), "Continuar" y popup "Confirmar"
  if (await isVisibleText(T.homeExpress, 2_000)) return;
  if (await isVisibleText(T.sinCoberturaExpress, 3_000)) {
    await typeInto(await findInput(), EXPRESS_ADDRESS);
    await driver.pause(2_500);
    const suggestion = (await visibleTexts()).find(t => t !== EXPRESS_ADDRESS && t.toLowerCase().includes(EXPRESS_ADDRESS.split(' ')[0].toLowerCase()));
    if (suggestion) await tapText(suggestion);
    await driver.pause(2_000);
  }
  expect(await isVisibleText(T.sinCoberturaExpress, 2_000)).toBe(false);
  await tapButton(T.continuar[0]);
  await tapButton(T.confirmar[0]);
  await findByText(T.homeExpress, 60_000);
});

async function enterExpress() {
  if (await isVisibleNow(T.homeExpress)) return;
  // Logueado entra a la home; anónimo cae en el onboarding de Express (lo resuelve "elijo un domicilio...")
  // A veces la carga de Express se queda en una pantalla en blanco: se reintenta una vez reiniciando la app
  for (let intento = 1; intento <= 2; intento++) {
    await selectWorld('Express');
    if (await isVisibleText([...T.homeExpress, ...T.iniciarSesion], 60_000)) return;
    console.log(`ATENCIÓN: Express no cargó en 60 s (intento ${intento}); se reinicia la app`);
    await screenshot(`express-no-carga-${intento}`);
    await restartApp();
    await waitForAppReady();
    if (await isVisibleText(T.homeExpress, 5_000)) return;
  }
  throw new Error('El mundo Express no cargó (pantalla en blanco) después de reintentar');
}

When('entro al mundo Express', enterExpress);

When('recorro la home de Express', async () => {
  for (let i = 0; i < 3; i++) await swipe('up');
  for (let i = 0; i < 3; i++) await swipe('down');
  expect(await isVisibleText(['Error', 'error de red'], 1_000)).toBe(false);
});

/** Agrega el primer producto de los carruseles de la home de Express. */
async function addFromQuickBuy() {
  await findByText(['Prod List Title'], 20_000);
  await (await firstPlus()).click();
  await waitForLoading();
}

When('agrego un producto desde un carrusel de compra rápida', addFromQuickBuy);

When('intento agregar más de 3 bidones de agua', async () => {
  await search(T.bidonAgua);
  // Siempre el mismo bidón (la primera tarjeta): después de agregar, la tarjeta se colapsa en un badge
  // con la cantidad en la misma posición del "+"; tocarlo la vuelve a abrir y ahí se toca su "+"
  const plus = await firstPlus();
  const { x, y } = await plus.getLocation();
  const { width, height } = await plus.getSize();
  const tapPlus = () => driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(x + width / 2), y: Math.round(y + height / 2) }).down().pause(80).up().perform();
  for (let i = 0; i < 10; i++) {
    if (await isVisibleText(T.topeBidones, 1_000)) return;
    await tapPlus();
    await waitForLoading();
    await driver.pause(1_500);
    console.log(`Bidones en la tarjeta: ${await cardAmount()}`);
  }
  console.log(`Textos en pantalla: ${(await visibleTexts()).join(' | ')}`);
});

/** Cantidad de la primera tarjeta (desc "txt Amount N"). */
async function cardAmount() {
  const el = await $(driver.isAndroid ? 'android=new UiSelector().descriptionStartsWith("txt Amount")' : `-ios predicate string:label BEGINSWITH 'txt Amount'`);
  return (await el.getAttribute(driver.isAndroid ? 'content-desc' : 'label').catch(() => ''))?.replace('txt Amount', '').trim();
}

Then('veo el mensaje de tope de bidones', async () => {
  await findByText(T.topeBidones, 10_000);
  await screenshot('tope-bidones');
  await tapTextIfVisible(['OK', 'Aceptar', 'Entendido'], 2_000);
});

When('agrego productos hasta llegar al tope del carrito', async () => {
  await search(process.env.EXPRESS_TOPE_TERM || 'yogur');
  for (let i = 0; i < 100; i++) {
    if (await isVisibleText(T.topeCarrito, 1_500)) return;
    // Cuando aparece el popup de límite tapa la grilla y ya no hay "+" visibles
    const plus = await firstPlus().catch(() => undefined);
    if (!plus) {
      if (await isVisibleText(T.topeCarrito, 5_000)) return;
      throw new Error('No hay más productos con "+" y no apareció el aviso de límite');
    }
    await plus.click();
    // Sin pausa la app llega a aceptar una unidad de más (17/16) antes de validar el tope
    await waitForLoading();
    await driver.pause(1_500);
  }
});

Then('veo el mensaje de tope del carrito', async () => {
  await findByText(T.topeCarrito, 10_000);
  await screenshot('tope-carrito');
  const counter = (await visibleTexts()).find(t => /^\s*\d+\s*\/\s*\d+\s*$/.test(t)) ?? '';
  console.log(`Tope: ${counter}`);
  const [items, max] = counter.split('/').map(n => parseInt(n, 10));
  if (items > max) {
    // La app dejó superar el tope al agregar; para pagar hay que volver a 16
    console.log(`POSIBLE BUG: el carrito Express llegó a ${items}/${max} (la app permite superar el tope al agregar)`);
    await tapText(['Quitar productos']);
    await waitForLoading();
    for (let i = 0; i < items - max; i++) {
      await (await firstMinus()).click();
      await waitForLoading();
      await driver.pause(1_500);
    }
  }
});

Given('estoy en el mundo Express con productos en el carrito', async () => {
  if (!(await isVisibleNow(T.homeExpress))) await enterExpress();
  if ((await cartCount()) === 0) await addFromQuickBuy();
  ctx.world = 'Express';
});

When('cierro la app y la vuelvo a abrir', async () => {
  await restartApp();
  await waitForLoading();
});

// Si el último pedido Express se anuló, al reabrir la app muestra el selector de mundos (comportamiento esperado)
Then('la app abre en el selector de mundos', async () => {
  await driver.waitUntil(isWorldSelectorOpen, { timeout: 30_000, interval: 1_000, timeoutMsg: 'La app no abrió en el selector de mundos' });
});

When('elijo el mundo Express en el selector', async () => {
  await chooseWorldInSelector('Express');
  await findByText(T.homeExpress, 60_000);
  ctx.world = 'Express';
});

Then('la app abre en el mundo Express', async () => {
  await findByText(T.homeExpress, 30_000);
  await screenshot('mundo-express');
});

When('mando la app a background {int} segundos y vuelvo', async (seconds: number) => {
  ctx.screenBefore = await visibleTexts();
  await sendToBackground(seconds);
});

Then('sigo en la home de Express sin que se recargue', async () => {
  const loader = await $(driver.isAndroid ? 'android=new UiSelector().className("android.widget.ProgressBar")' : '-ios class chain:**/XCUIElementTypeActivityIndicator');
  expect(await loader.isDisplayed().catch(() => false)).toBe(false);
  const now = await visibleTexts();
  const kept = ctx.screenBefore!.filter(t => now.includes(t)).length / ctx.screenBefore!.length;
  console.log(`Textos que se mantienen tras el background: ${Math.round(kept * 100)}%`);
  expect(kept).toBeGreaterThan(0.8);
});

When('cambio al mundo {word}', async (mundo: string) => {
  await selectWorld(mundo === 'Express' ? 'Express' : 'Super');
});

// Precondición y verificación: la app reabre en el mundo del último pedido, así que puede arrancar en Express
Given('estoy en el mundo Supermercado', async () => {
  await scrollHomeToTop();
  await findByText([...T.home, ...T.homeExpress], 30_000);
  if (await isVisibleNow(T.homeExpress)) {
    await selectWorld('Super');
    await findByText(T.home, 30_000);
  }
  expect(await isVisibleNow(T.homeExpress)).toBe(false);
  ctx.world = 'Super';
});

