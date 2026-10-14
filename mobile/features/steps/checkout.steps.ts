import { When, Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { ENV, PASSCARD, USER } from '../../support/env';
import { T } from '../../support/texts';
import { inWebview, tapNotification } from '../../support/app';
import {
  findAllByText, findByText, findExact, isVisibleText, scrollToText, scrollableContaining, swipeElement, tapText, tapTextIfVisible,
  visibleTexts, waitForLoading, screenshot,
} from '../../support/ui';
import { enterSuperFromSelector, isWorldSelectorOpen, firstMinus, firstPlus, openCart, scrollToButton, tapButton } from '../../support/flows';
import { ctx } from '../../support/context';
import { orderSummary } from '../../support/products';

// --- Carrito → checkout ---

When('voy al carrito y toco pagar', async () => {
  // Si quedó abierto el popup de tope de Express, se paga desde ahí
  if (await isVisibleText(T.irAPagar, 2_000)) {
    await tapButton(T.irAPagar[0]);
  } else {
    // Si el panel del carrito ya está abierto (ej. después de "Quitar productos") no volver a abrirlo
    if (!(await isVisibleText(T.vaciarCarrito, 1_500))) await openCart();
    await tapButton(T.pagar[0]);
  }
  await tapTextIfVisible(T.pedidoNuevo, 3_000);
  await findByText(T.lugarDeEntrega, 30_000);
});

Then('veo el carrito cargado', async () => {
  await findByText(T.fecha);
  expect(await isVisibleText(['Error', 'error de red'], 1_000)).toBe(false);
  await screenshot('checkout-cargado');
});

/** Elige una opción de un spinner (combo) de GeneXus. */
async function selectSpinner(current: string, option: string) {
  await tapText(current);
  await tapText(option, 10_000);
  await waitForLoading();
}

When('elijo {string}', async (option: string) => {
  await tapText(T.lugarDeEntrega);
  if (option === 'Click & Go') {
    await tapText(T.tabRetiro);
    await tapText(T.clickAndGo);
    if (await isVisibleText(T.seleccionar, 3_000)) await selectSpinner(T.seleccionar[0], T.region);
    if (await isVisibleText(T.seleccionar, 3_000)) await selectSpinner(T.seleccionar[0], T.sucursal);
  } else {
    // Se usa el domicilio por defecto del usuario de prueba
    await tapText(T.tabEnvio);
  }
  await tapButton(T.confirmar[0]);
  if (option === 'Click & Go') {
    await findByText(['Retira en sucursal'], 15_000);
  } else {
    // Con envío el encabezado dice "Entrega a domicilio" o "Lugar de Entrega" según el ambiente
    await findByText(['Entrega a domicilio', 'Lugar de Entrega'], 15_000);
    expect(await isVisibleText(['Retira en sucursal'], 1_000)).toBe(false);
  }
});

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

When('elijo la fecha de entrega más lejana', async () => {
  await tapText(T.fecha);
  await findByText(['Elegí un día'], 15_000);
  await findByText(WEEKDAYS, 15_000);
  // Avanzar el carrusel de días hasta el final
  // Carrusel de días: el scrollable que contiene los nombres de los días; se desliza sobre él
  const daysRow = await scrollableContaining(`android=new UiSelector().textMatches("^(${WEEKDAYS.join('|')})$")`);
  let prev = '';
  for (let i = 0; i < 8 && daysRow; i++) {
    const cur = (await visibleTexts()).filter(t => WEEKDAYS.includes(t)).join('|');
    if (cur === prev) break;
    prev = cur;
    await swipeElement(daysRow, 'left');
  }
  // Último día visible (el de más a la derecha)
  let last: { el: WebdriverIO.Element; x: number } | undefined;
  for (const { el } of await findAllByText(WEEKDAYS)) {
    const { x } = await el.getLocation();
    if (!last || x > last.x) last = { el, x };
  }
  // Los textos del día/horario no son clickeables (lo es su contenedor): tap por coordenadas
  await (last!.el).click();
  await waitForLoading();
  await driver.pause(2_000); // al cambiar de día se recargan los horarios
  // Primer horario: el texto puede venir junto ("10:00 a 13:59") o separado en "10:00" / "a" / "13:59"
  const slotSel = driver.isAndroid
    ? 'android=new UiSelector().textMatches("^ *[0-9]{1,2}:[0-9]{2}.*")'
    : `-ios predicate string:label MATCHES '^ *[0-9]{1,2}:[0-9]{2}.*'`;
  const slot = await $(slotSel);
  await slot.waitForDisplayed({ timeout: 15_000, timeoutMsg: 'No hay horarios de entrega para el día elegido' });
  console.log(`Horario: ${await slot.getText()}`);
  await (slot).click();
  await waitForLoading();
  await tapButton(T.continuar[0]);
  if (await tapTextIfVisible(['ACEPTAR', 'Aceptar'], 2_000)) throw new Error('La app no tomó el horario ("Seleccioná un rango horario de entrega")');
  const fecha = await findByText(T.fecha);
  console.log(`Fecha elegida: ${await fecha.getAttribute(driver.isAndroid ? 'content-desc' : 'label')}`);
});

When('continúo a forma de pago', async () => {
  await tapButton(T.continuar[0]);
  await findByText(T.moneda, 30_000);
});

When('edito la forma de pago', async () => {
  await findByText(['Forma de pago'], 30_000);
  // El primer "Editar" es el de la forma de pago (el segundo es el de la entrega)
  const [forma] = await findAllByText(['Forma de pago']);
  const editar = (await findAllByText(['Editar'])).find(e => Math.abs(e.y - forma.y) < 120);
  if (!editar) throw new Error('No encontré "Editar" de la forma de pago');
  await (editar.el).click();
  await findByText(T.moneda, 30_000);
});

// --- Pagos ---

async function ensurePesos() {
  if (await isVisibleText(T.pesos, 2_000)) return;
  await tapText(['Dolares', 'Dólares']);
  await tapText(T.pesos);
  await waitForLoading();
}

async function deleteSavedPasscard() {
  const [card] = await findAllByText(T.passcardGuardada);
  if (!card) return;
  console.log('PASSCARD guardada encontrada, eliminando...');
  // Cada tarjeta tiene su propio "Eliminar" debajo: no tocar el de otra tarjeta
  const del = (await findAllByText(T.eliminar)).find(e => e.y > card.y);
  if (!del) throw new Error('No encontré el botón Eliminar de la PASSCARD');
  await del.el.click();
  await tapTextIfVisible(['Sí', 'Aceptar', 'Confirmar', ...T.eliminar], 3_000);
  await waitForLoading();
}

/** Completa el formulario de GeoPay (webview dentro de la app, mismos ids que en la web). */
async function fillGeopay() {
  await inWebview(async () => {
    const [month, year] = PASSCARD.expiry.split('/');
    await $('#cardNumber').waitForDisplayed({ timeout: 30_000, timeoutMsg: 'GeoPay no cargó el formulario (en trunk la pasarela no está disponible)' });
    await $('#cardNumber').setValue(PASSCARD.number);
    await $('#dueDateMonth').setValue(month);
    await $('#dueDateYear').setValue(year);
    for (const [id, value] of [['#firstName', 'Laura'], ['#lastName', 'Prueba Aguiar'], ['#phone', '59891320045'], ['#email', USER.email]]) {
      const el = await $(id);
      if (await el.isDisplayed().catch(() => false)) await el.setValue(value);
    }
    const terms = await $('#terms');
    if (await terms.isDisplayed().catch(() => false) && !(await terms.isSelected())) await terms.click();
    await $('button[type="submit"], input[type="submit"]').click();
  });
  await waitForLoading(60_000);
}

When('si no es quick checkout completo el checkout con la PASSCARD', async () => {
  await findByText([...T.confirmarPedido, ...T.fecha, ...T.moneda], 30_000);
  if (await isVisibleText(['Resumen'], 2_000)) return console.log('Quick checkout: se confirma directo');
  console.log('Checkout normal (no quick checkout)');
  if (await isVisibleText(T.fecha, 2_000)) {
    // La fecha de Express ya viene elegida (próxima franja)
    await tapButton(T.continuar[0]);
    await findByText(T.moneda, 30_000);
  }
  await payWithPasscard();
});

When('pago con tarjeta de crédito PASSCARD', async () => payWithPasscard());

async function payWithPasscard() {
  await ensurePesos();
  await tapText(T.tarjetas);
  await findByText(T.nuevaTarjetaCredito, 20_000);
  // Android: se paga con la PASSCARD guardada. iOS: se da de alta (borrándola antes).
  if (driver.isAndroid && await tapTextIfVisible(T.passcardGuardada, 2_000)) {
    console.log('Usando PASSCARD guardada');
  } else {
    // En producción no se dan de alta tarjetas: la PASSCARD de prueba sólo existe en los ambientes de test
    if (ENV.name === 'prod') {
      if (await tapTextIfVisible(T.passcardGuardada, 2_000)) return;
      throw new Error('En prod el usuario de prueba tiene que tener una PASSCARD/crédito guardada (no se dan de alta tarjetas en producción)');
    }
    await deleteSavedPasscard();
    await tapText(T.nuevaTarjetaCredito);
    await tapText(T.tipoPassCard);
    await fillGeopay();
    await tapText(T.passcardGuardada, 30_000);
    await screenshot('passcard-alta');
  }
  await waitForLoading();
}

When('pago con tarjeta de débito', async () => {
  await ensurePesos();
  await tapText(T.tarjetas);
  await findByText(T.nuevaTarjetaDebito, 20_000);
  const [saved] = await findAllByText(T.debitoGuardada);
  if (!saved) {
    throw new Error('El usuario de prueba no tiene tarjeta de débito guardada: falta definir la tarjeta de débito de prueba (Maestro vault / VISA débito GeoPay)');
  }
  await saved.el.click();
  await waitForLoading();
});

When('elijo {int} cuotas', async (n: number) => {
  if (!(await isVisibleText(T.cuotas, 5_000))) {
    throw new Error('No aparece el selector de cuotas (¿producto no financiable o moneda incorrecta?)');
  }
  // "Cuotas" es una etiqueta; el combo (Spinner) está a la derecha con el valor actual
  const label = await scrollToText(T.cuotas);
  const labelY = (await label.getLocation()).y;
  const spinnerSel = driver.isAndroid ? 'android=new UiSelector().className("android.widget.Spinner")' : '-ios class chain:**/XCUIElementTypePickerWheel';
  let spinner: WebdriverIO.Element | undefined;
  for (const sp of await $$(spinnerSel)) {
    if (Math.abs((await sp.getLocation()).y - labelY) < 100) { spinner = sp; break; }
  }
  if (!spinner) throw new Error('No encontré el combo de cuotas');
  await (spinner).click();
  await (await findExact(String(n))).click();
  await waitForLoading();
  const value = await spinner.$(driver.isAndroid ? 'android=new UiSelector().resourceId("android:id/text1")' : '-ios class chain:**');
  console.log(`Cuotas: ${await value.getText().catch(() => '?')}`);
  expect((await value.getText()).trim()).toBe(String(n));
});

When('confirmo el pedido', async () => {
  // Pantalla "Tarjeta seleccionada" (cuotas): hay que continuar para llegar a "Confirmar Pedido"
  if (await isVisibleText(['Tarjeta seleccionada'], 3_000)) await tapButton(T.continuar[0]);
  await findByText(T.confirmarPedido, 30_000);
  // Validación de montos: Total = SubTotal + gastos (envío/preparación) - descuentos
  await waitForLoading();
  const summary = await orderSummary();
  console.log(`Resumen: ${summary.map(l => `${l.label} ${l.amount}`).join(' | ')}`);
  const total = summary.find(l => /^Total$/i.test(l.label));
  const parts = summary.filter(l => !/^Total$/i.test(l.label));
  if (!total || !parts.length) throw new Error('No pude leer el resumen del pedido (SubTotal / Total)');
  const sum = Math.round(parts.reduce((a, l) => a + l.amount, 0) * 100) / 100;
  if (Math.abs(sum - total.amount) > 0.5) throw new Error(`El total del pedido no cierra: ${summary.map(l => `${l.label} ${l.amount}`).join(' + ')} → suma ${sum} vs Total ${total.amount}`);
  ctx.orderTotal = total.amount;
  await (await scrollToButton(T.confirmarPedido[0])).click();
  await waitForLoading(60_000);
});

Then('el pedido se confirmó', async () => {
  await findByText(T.pedidoConfirmado, 60_000);
  const text = (await visibleTexts()).find(t => /pedido N/i.test(t)) ?? '';
  ctx.orderNumber = text.match(/N\S*\s*(\d{5,})/)?.[1];
  console.log(`Pedido confirmado: ${ctx.orderNumber}`);
  await screenshot('pedido-confirmado');
  expect(ctx.orderNumber).toBeTruthy();
  // "Continuar" lleva al selector de mundos: se cierra y queda la home
  await tapButton(T.continuar[0]);
  await driver.pause(1_500);
  if (await isWorldSelectorOpen()) await enterSuperFromSelector();
});

Then('estoy en el quick checkout', async () => {
  await findByText(['Quick', 'Checkout rápido', ...T.confirmarPedido], 30_000);
  await screenshot('quick-checkout');
});

When('toco la notificación del pedido', async () => {
  await tapNotification(T.notificacionPedido[0]);
  await waitForLoading();
});

When('toco el widget de status del pedido en la landing', async () => {
  // La tarjeta "Pedido # N - Confirmado" está más abajo en la home
  const widget = await scrollToText(ctx.orderNumber ? [`Pedido # ${ctx.orderNumber}`] : T.widgetStatusPedido, 12);
  console.log(`Widget: ${await widget.getText().catch(() => '')}`);
  await (widget).click();
  await waitForLoading();
  await screenshot('widget-pedido');
});

// --- Pesables (manzanas) ---

/** Cantidad y unidades aproximadas de la primera tarjeta ("1,0 kg" / "Aprox 5 unidades"). */
async function cardState() {
  const texts = await visibleTexts();
  return [texts.find(t => /\d+,\d+\s*kg/.test(t) && !/x kg/.test(t)), texts.find(t => /Aprox/i.test(t))].map(t => t?.trim() ?? '');
}

Then('la tarjeta del producto muestra {string}', async (_text: string) => {
  await findByText(T.unidadesAproximadas, 10_000);
  ctx.cardTexts = await cardState();
  console.log(`Tarjeta: ${ctx.cardTexts.join(' | ')}`);
});

When('sumo una unidad desde la tarjeta del producto', async () => {
  ctx.cardTexts = await cardState();
  await (await firstPlus()).click();
  await waitForLoading();
  await driver.pause(1_000);
});

When('resto una unidad desde la tarjeta del producto', async () => {
  await (await firstMinus()).click();
  await waitForLoading();
  await driver.pause(1_000);
});

Then('el precio y las unidades aproximadas se actualizan', async () => {
  const now = await cardState();
  console.log(`Antes: ${ctx.cardTexts?.join(' | ')} / Después: ${now.join(' | ')}`);
  expect(now[0]).not.toBe(ctx.cardTexts![0]);
});

Then('el precio y las unidades aproximadas vuelven al valor anterior', async () => {
  expect(await cardState()).toEqual(ctx.cardTexts);
});
