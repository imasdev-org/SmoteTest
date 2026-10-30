import { Given, When, Then, Before, After } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { ENV } from '../../support/env';
import { T } from '../../support/texts';
import { appId, inWebview, installedVersion, restartApp } from '../../support/app';
import { findAllByText, findByText, isVisibleNow, isVisibleText, scrollToText, tapText, tapTextIfVisible, visibleTexts, waitForLoading, screenshot, PRICE_RE } from '../../support/ui';
import { ctx, resetCtx } from '../../support/context';
import {
  acceptDialog, backToHome, openDetailFromImage, cancelAllPendingOrders, cancelOrder, cartCount, closeCart, closeMenu, closeOverlay, confirmCancelDialog, fillLogin, firstPlus, isLoggedIn,
  login, logout, openCart, waitForAppReady, openMisPedidos, orderStatus, search, tapButton,
} from '../../support/flows';

Before(async () => {
  resetCtx();
  // Si la app quedó en una home (Super o Express) se sigue desde ahí; si quedó en otra pantalla
  // (detalle, checkout, Mis pedidos...) se reinicia para arrancar limpio. Reiniciar cuesta ~20 s.
  // Antes de reiniciar se prueba volver con "atrás" (búsqueda, detalle, listados): reiniciar además
  // reabre la app en el último mundo usado y obliga a cambiar de mundo (~12 s más).
  await driver.activateApp(appId());
  // iOS: en Mis pedidos (barra nativa con "nav menu icon") cada búsqueda por texto tarda 15-85 s por la lista larga
  // y desde ahí no hay "atrás": se reinicia directo
  if (driver.isIOS && await $("-ios predicate string:type == 'XCUIElementTypeButton' AND name == 'nav menu icon'").isExisting()) {
    await restartApp();
    await waitForAppReady();
    return;
  }
  // Mis pedidos también dice "Entrega en" (en cada pedido) pero no tiene el logo del header
  const enHome = async () => await isVisibleNow(T.appCargada)
    && await isVisibleNow([...T.home, ...T.homeExpress, 'Prod List Title'])
    && !(await isVisibleNow([...T.usuarioLogueado, ...T.imagenDetalle, ...T.pagar, 'Filtrar', 'Pedido Nº', 'Volver a Comprar']));
  // En la home la app ya está lista: waitForAppReady sólo hace falta después de reiniciar
  // (costaba ~5 s por escenario esperando pantallas de arranque que no están)
  for (let i = 0; i < 3 && !(await enHome()); i++) {
    // Con el menú abierto "atrás" cierra la app: el menú se cierra con swipe
    if (await isVisibleNow(T.usuarioLogueado)) await closeMenu();
    else await closeOverlay();
    if ((await driver.queryAppState(appId())) !== 4) break;
  }
  if (await enHome()) return;
  await restartApp();
  await waitForAppReady();
});

// Red de seguridad: si el escenario falló después de confirmar un pedido, se intenta anularlo
After(async ({ result }) => {
  if (!ctx.orderNumber || result?.status === 'PASSED') return;
  if (ENV.keepOrder) {
    console.log(`[After] KEEP_ORDER: el pedido ${ctx.orderNumber} queda sin anular para revisarlo`);
    return;
  }
  try {
    // Reiniciar: la app puede haber quedado en una pantalla sin header (ej. "Estado del pedido")
    await restartApp();
    await waitForAppReady();
    await openMisPedidos();
    if ((await orderStatus(ctx.orderNumber)) !== T.anulado) {
      await cancelOrder(ctx.orderNumber);
      console.log(`[After] Pedido ${ctx.orderNumber} cancelado por la red de seguridad`);
    }
  } catch (e) {
    console.log(`[After] ATENCIÓN: no se pudo cancelar el pedido ${ctx.orderNumber}, anularlo a mano: ${e}`);
  }
});

// --- App ---

Given('que la app está abierta', async () => {
  await driver.activateApp(appId());
  await waitForLoading();
});

Then('la versión instalada es la esperada', async () => {
  const version = await installedVersion();
  console.log(`Versión instalada (${driver.isAndroid ? 'Android' : 'iOS'} / ${ENV.name}): ${version}`);
  if (!ENV.expectedVersion) {
    throw new Error(`Definí APP_VERSION con la versión que se está publicando (instalada: ${version})`);
  }
  expect(version).toBe(ENV.expectedVersion);
});

// --- Sesión ---

Given('que estoy logueado con el usuario de prueba', async () => {
  if (!(await isLoggedIn())) await login();
});

Given('que entro a la app como anónimo', async () => {
  if (await isLoggedIn()) await logout();
});

When('me logueo con el usuario de prueba si me lo pide', async () => {
  // Como anónimo, agregar al carrito muestra "Debe iniciar sesión para agregar al carrito" → ACEPTAR → login
  if (await isVisibleText(T.debeIniciarSesion, 3_000)) await acceptDialog(['ACEPTAR', 'Aceptar'], 5_000);
  if (await isVisibleText(T.password, 5_000)) await fillLogin();
  else if (await tapTextIfVisible(T.iniciarSesion, 2_000)) await fillLogin();
});

// --- Pedidos ---

Given('no hay pedidos pendientes', async () => {
  await openMisPedidos();
  const n = await cancelAllPendingOrders();
  console.log(`Pedidos pendientes cancelados: ${n}`);
  await backToHome();
});

Then('muestro el estado del pedido indicado en ORDER', async () => {
  const order = process.env.ORDER;
  if (!order) throw new Error('Definí ORDER con el número de pedido');
  await openMisPedidos();
  console.log(`Pedido ${order}: ${await orderStatus(order)}`);
});

When('anulo el pedido indicado en ORDER', async () => {
  const order = process.env.ORDER;
  if (!order) throw new Error('Definí ORDER con el número de pedido a anular');
  ctx.orderNumber = order;
  await openMisPedidos();
  await cancelOrder(order);
});

When('cancelo el pedido desde mis pedidos', async () => {
  if (!ctx.orderNumber) throw new Error('No hay número de pedido (¿falló la confirmación?)');
  if (ENV.keepOrder) return console.log(`KEEP_ORDER: no se anula el pedido ${ctx.orderNumber}`);
  // Después de la notificación la app puede quedar en una pantalla sin header: arrancar desde la home
  await restartApp();
  await waitForAppReady();
  await openMisPedidos();
  // El pedido recién confirmado tiene que figurar en Mis pedidos y no estar anulado
  const status = await orderStatus(ctx.orderNumber);
  console.log(`Pedido ${ctx.orderNumber} en Mis pedidos antes de anular: ${status}`);
  if (!status || status === T.anulado) throw new Error(`El pedido ${ctx.orderNumber} no figura como activo en Mis pedidos (estado: "${status}")`);
  await cancelOrder(ctx.orderNumber);
});

When('cancelo el pedido', async () => {
  if (ENV.keepOrder) return console.log(`KEEP_ORDER: no se anula el pedido ${ctx.orderNumber}`);
  // Desde el widget de la home hay dos variantes del detalle:
  //  - "Estado del pedido": página web dentro de la app (WebView) con el botón "Cancelar pedido"
  //  - detalle nativo con botón "Opciones"
  await waitForLoading();
  if (await isVisibleText(['Opciones'], 3_000)) {
    await tapText(['Opciones']);
    await driver.pause(1_500);
    await screenshot('widget-opciones');
    await (await findByText([...T.cancelarPedido, 'Cancelar'], 15_000)).click();
  } else if (await isVisibleText(T.cancelarPedido, 3_000)) {
    await (await findByText(T.cancelarPedido)).click();
  } else {
    const clicked = await inWebview(async () => {
      const btn = await $('//*[self::button or self::a or self::div or self::span][contains(translate(normalize-space(.), "CANCELARPEDIO", "cancelarpedio"), "cancelar pedido")]');
      if (!(await btn.isExisting())) return false;
      await btn.click();
      return true;
    }, 15_000).catch(() => false);
    if (!clicked) {
      // Último recurso: el widget ya se validó (abrió el detalle del pedido); se anula desde Mis pedidos
      console.log('No pude tocar "Cancelar pedido" en la página del pedido: se anula desde Mis pedidos');
      await restartApp();
      await waitForAppReady();
      await openMisPedidos();
      await cancelOrder(ctx.orderNumber!);
      return;
    }
  }
  await driver.pause(2_000);
  if (await isVisibleText(T.motivoCancelacion, 5_000)) {
    await confirmCancelDialog();
  } else {
    await acceptDialog(['Sí', 'SI', 'Aceptar', 'ACEPTAR', 'Confirmar', ...T.cancelarPedido], 5_000);
    await waitForLoading();
  }
  await screenshot('cancelado-desde-widget');
});

Then('el pedido queda anulado', async () => {
  if (ENV.keepOrder && !process.env.ORDER) return console.log(`KEEP_ORDER: pedido ${ctx.orderNumber} confirmado y SIN anular — revisarlo y anularlo a mano`);
  // La lista de Mis pedidos tiene "Ver Detalles" (la pantalla "Estado del pedido" también dice "Pedido N°")
  if (!(await isVisibleText(['Ver Detalles'], 2_000))) {
    await restartApp();
    await waitForAppReady();
    await openMisPedidos();
  }
  // La tarjeta se actualiza unos segundos después del aviso "Pedido cancelado correctamente"
  let status: string | undefined;
  await driver.waitUntil(async () => (status = await orderStatus(ctx.orderNumber!)) === T.anulado, { timeout: 20_000, interval: 2_000 }).catch(() => {});
  console.log(`Pedido ${ctx.orderNumber}: ${status}`);
  await screenshot('pedido-anulado');
  expect(status).toBe(T.anulado);
});

// --- Carrito ---

Given('el carrito está vacío', async () => {
  // Si quedó abierto el popup de límite de Express, "Ir a pagar"/"Quitar productos" tapan el header
  if (await isVisibleText(T.topeCarrito, 1_500)) await tapText(['Quitar productos']);
  // Se abre siempre: el badge puede no haber cargado todavía al llegar a la home
  if (!(await isVisibleText(T.vaciarCarrito, 1_500))) await openCart();
  // Con el panel abierto el badge del header queda corrido (en iOS cartCount da 0): vale también el aviso del panel
  // El panel carga después de abrirse: esperar a que muestre el aviso de vacío o productos antes de decidir
  const panelLoaded = [...T.carritoSinProductos, ...T.vaciarCarrito, ...(driver.isIOS ? ['Product Name Camel'] : [])];
  await findByText(panelLoaded, 20_000).catch(() => {});
  if ((await cartCount()) > 0 || !(await isVisibleNow(T.carritoSinProductos))) {
    // "Vaciar carrito" está al final de la lista de productos del panel
    await (await scrollToText(T.vaciarCarrito, 15)).click();
    // "¿Confirma vaciar el carrito?" puede tardar varios segundos en aparecer con prod lenta
    if (await isVisibleText(['Confirma vaciar'], 15_000)) await acceptDialog(['ACEPTAR', 'Aceptar'], 5_000);
    else await acceptDialog(['Sí', 'Aceptar', 'Confirmar'], 2_000);
    await waitForLoading();
    // Vacío = el panel ya no lista productos (con el panel abierto el badge del header no se ve)
    await driver.waitUntil(async () => !(await isVisibleNow(['Product Name Camel'])), { timeout: 20_000, interval: 1_000 })
      .catch(() => { throw new Error('El carrito sigue con productos después de vaciarlo'); });
  }
  if (await isVisibleText(T.pagar, 1_000)) await closeCart();
  await driver.pause(1_500);
  expect(await cartCount()).toBe(0);
});

Then('el carrito tiene al menos {int} producto(s)', async (min: number) => {
  await driver.pause(1_500);
  const count = await cartCount();
  console.log(`Badge del carrito: ${count}`);
  expect(count).toBeGreaterThanOrEqual(min);
});

// --- Búsqueda / producto ---

When('busco {string}', search);

When('busco el producto financiable del ambiente', async () => {
  await search(ENV.productoFinanciable);
  expect(await isVisibleText(T.sinResultados, 1_500)).toBe(false);
});

When('agrego el primer producto al carrito desde la búsqueda', async () => {
  await (await firstPlus()).click();
  await waitForLoading();
});

When('entro al detalle del primer producto', async () => {
  if (ctx.lastSearch && !(await isVisibleText(T.imagenEnGrilla, 2_000))) await search(ctx.lastSearch);
  await findByText(T.imagenEnGrilla, 20_000);
  // El tap se pierde si la grilla todavía está cargando (pantalla oscurecida): reintentar hasta ver el detalle
  for (let i = 0; i < 3; i++) {
    const [img] = await findAllByText(T.imagenEnGrilla);
    // Sin grilla: el tap anterior abrió el detalle y todavía está cargando (esqueleto gris)
    if (!img) { await findByText(T.imagenDetalle, 20_000); return; }
    await openDetailFromImage(img.el);
    if (await isVisibleText(T.imagenDetalle, 15_000)) return;
  }
});

Then('veo la imagen, el nombre y el precio del producto', async () => {
  await findByText(T.imagenDetalle, 15_000);
  await findByText(T.nombreProducto);
  expect((await visibleTexts()).some(t => PRICE_RE.test(t))).toBe(true);
  await screenshot('detalle-producto');
  await closeOverlay();
});
