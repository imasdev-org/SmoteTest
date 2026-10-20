/**
 * Flujos reutilizados por varios archivos de steps.
 * (Los steps no se importan entre sí: en Windows el loader los cargaría dos
 * veces y Cucumber marca los pasos como ambiguos.)
 *
 * Relevado en Android trunk 35.1252. Los íconos del header (menú, selector de
 * mundo, carrito) no tienen accessibility label, por eso se tocan por posición.
 * Las ramas de iOS están escritas sin relevar la app: marcadas con "iOS (sin calibrar)".
 */
import { USER } from './env';
import { T } from './texts';
import { ctx } from './context';
import {
  descAttr, findAllByText, findByText, findInput, isVisibleNow, isVisibleText, px, quickSwipe, regexSelector, swipe, swipeElement,
  tapText, tapTextIfVisible, textSelector, typeInto, waitForLoading,
} from './ui';


// --- Botones ---

/** Botón por texto (evita confundirlo con un título que diga lo mismo, ej. "Confirmar Pedido"). */
export async function findButton(text: string, timeout = 20_000) {
  const sel = driver.isAndroid
    ? `android=new UiSelector().className("android.widget.Button").textContains("${text}")`
    : `-ios predicate string:type == 'XCUIElementTypeButton' AND (label CONTAINS[c] '${text}' OR name CONTAINS[c] '${text}')`;
  const el = await $(sel);
  await el.waitForDisplayed({ timeout, timeoutMsg: `No apareció el botón "${text}"` });
  return el;
}

export async function tapButton(text: string, timeout = 20_000) {
  await (await findButton(text, timeout)).click();
  await waitForLoading();
}

/** Busca el botón scrolleando hacia abajo. */
export async function scrollToButton(text: string, maxSwipes = 8) {
  for (let i = 0; i < maxSwipes; i++) {
    const el = await findButton(text, 1_500).catch(() => undefined);
    if (el) return el;
    await swipe('up');
  }
  return findButton(text, 2_000);
}

// --- Header ---
//
// Los íconos del header (menú, selector de mundo, carrito) no tienen id ni content-desc. Se ubican por
// estructura del árbol: el contenedor del header es el padre directo de los FrameLayout clickeables y del
// bloque con el logo ("Channel Logo") o el buscador (EditText). Se tocan con element.click(), sin coordenadas.

const HEADER_XPATH = "//*[android.widget.FrameLayout[@clickable='true']][*[.//*[@content-desc='Channel Logo'] or .//android.widget.EditText]]";

// iOS (sin calibrar): XCUITest no expone "clickable" ni la jerarquía de FrameLayouts. Se toman los
// botones / imágenes tocables de la franja superior de la pantalla, ordenados de izquierda a derecha.
const IOS_HEADER_SEL = "-ios predicate string:type IN {'XCUIElementTypeButton', 'XCUIElementTypeImage', 'XCUIElementTypeOther'} AND accessible == true AND visible == true";

async function headerButtons() {
  const buttons: { el: WebdriverIO.Element; x: number; y: number }[] = [];
  if (driver.isAndroid) {
    for (const el of await $$(`${HEADER_XPATH}/*[@clickable='true']`)) {
      const { x, y } = await el.getLocation();
      buttons.push({ el, x, y });
    }
  } else {
    const { height } = await driver.getWindowSize();
    for (const el of await $$(IOS_HEADER_SEL)) {
      if ((await el.getAttribute('name')) === 'Channel Logo') continue;
      const { x, y } = await el.getLocation();
      const { width: w } = await el.getSize();
      // Íconos: chicos y arriba (debajo de la status bar)
      if (y > height * 0.15 || y < 20 || w > 80) continue;
      buttons.push({ el, x, y });
    }
  }
  if (!buttons.length) throw new Error('No encontré el header de la app (menú / carrito)');
  // Primera fila del header (en la home hay una segunda fila con el escáner de código de barras)
  const top = Math.min(...buttons.map(b => b.y));
  const row = await px(60);
  return buttons.filter(b => b.y - top < row).sort((a, b) => a.x - b.x);
}

/** Menú (izquierda), logo / selector de mundo (centro) o carrito (derecha) del header. */
export async function headerButton(which: 'menu' | 'mundo' | 'carrito') {
  if (which === 'mundo' && !driver.isAndroid) {
    // iOS (sin calibrar): el logo mismo
    const logo = await $('~Channel Logo');
    if (!(await logo.isExisting())) throw new Error('No encontré el logo / selector de mundo en el header');
    return logo;
  }
  if (which === 'mundo') {
    // El contenedor clickeable del logo puede estar un nivel más adentro: se toma el más interno
    const logos = await $$(`${HEADER_XPATH}//*[@clickable='true'][.//*[@content-desc='Channel Logo']]`);
    if (!logos.length) throw new Error('No encontré el logo / selector de mundo en el header');
    return logos[logos.length - 1];
  }
  const row = await headerButtons();
  return which === 'menu' ? row[0].el : row[row.length - 1].el;
}

export async function openMenu() {
  // El tap se pierde si llega mientras la home recarga o el drawer se está cerrando
  for (let i = 0; i < 3; i++) {
    await (await headerButton('menu')).click();
    if (await isVisibleText([...T.usuarioLogueado, ...T.menuMisPedidos], 4_000)) return;
  }
  await findByText([...T.usuarioLogueado, ...T.iniciarSesion, ...T.menuMisPedidos], 5_000);
}

/** Vuelve a la pantalla anterior (detalle, Mis pedidos...). Ojo: con un drawer abierto "back" sale de la app. */
export async function closeOverlay() {
  if (driver.isAndroid) await driver.back();
  else await iosBack();
  await driver.pause(300);
}

/**
 * iOS no tiene botón atrás del sistema. Se toca el "atrás" de la barra de navegación y, si no hay,
 * se hace el gesto desde el borde izquierdo (sin calibrar).
 */
async function iosBack() {
  const navBack = await $('-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton[1]');
  if (await navBack.isDisplayed().catch(() => false)) return navBack.click();
  const { width, height } = await driver.getWindowSize();
  const y = Math.round(height / 2);
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: 2, y }).down().move({ x: Math.round(width * 0.7), y, duration: 300 }).up().perform();
}

/** Vuelve de una pantalla abierta desde el menú (Mis pedidos...): la app regresa con el drawer abierto. */
export async function backToHome() {
  await closeOverlay();
  if (await isVisibleText(T.usuarioLogueado, 1_500)) await closeMenu();
  await findByText(T.appCargada, 15_000);
}

/**
 * Lleva la home al principio (si quedó scrolleada no se ve la barra de domicilio ni los textos
 * que distinguen Super de Express). Swipe hacia abajo sobre la home; no hace "pull to refresh"
 * porque corta apenas aparece la barra.
 */
export async function scrollHomeToTop() {
  // Swipes rápidos: con scrollGesture (~2 s cada uno) volver arriba después de los carruseles costaba ~13 s
  for (let i = 0; i < 12 && !(await isVisibleNow([...T.home, ...T.homeExpress])); i++) await quickSwipe('down');
}

/** Cierra un drawer haciendo swipe sobre un elemento del propio drawer (no sobre el fondo). */
async function swipeDrawer(anchorTexts: string[], direction: 'left' | 'right') {
  const anchor = await findByText(anchorTexts, 5_000);
  await swipeElement(anchor, direction, 0.9);
  await driver.pause(300);
}

/** Cierra el menú lateral (swipe a la izquierda sobre el menú). */
export async function closeMenu() {
  await swipeDrawer([...T.menuMisPedidos, ...T.usuarioLogueado, 'Menu Title'], 'left');
}

/** Cierra el panel del carrito (swipe a la derecha sobre el panel). */
export async function closeCart() {
  await swipeDrawer([...T.vaciarCarrito, 'Product Name Camel', ...T.pagar], 'right');
}

export async function openCart() {
  await (await headerButton('carrito')).click();
  await waitForLoading();
}

/** Número del badge del carrito (0 si no hay badge). */
export async function cartCount(): Promise<number> {
  const { width, height } = await driver.getWindowSize();
  for (const el of await $$(regexSelector('^[0-9]+$'))) {
    const { x, y } = await el.getLocation();
    if (x > width * 0.85 && y < height * 0.12) return parseInt(await el.getText(), 10);
  }
  return 0;
}

// --- Sesión ---

/** Espera a que la app termine de arrancar (el arranque en frío carga la metadata de GeneXus). */
export async function waitForAppReady(timeout = 120_000) {
  const ready = [...T.appCargada, ...T.iniciarSesion, ...T.password, ...T.usuarioLogueado];
  await findByText([...ready, ...T.descartarAlInicio], timeout);
  // Descartar pantallas intermedias (verificación de email, etc.) hasta llegar a la app
  for (let i = 0; i < 3 && await tapTextIfVisible(T.descartarAlInicio, 1_500); i++) {
    await findByText([...ready, ...T.descartarAlInicio], 30_000);
  }
  // Si quedó el menú abierto de una corrida anterior, cerrarlo
  if (await isVisibleText(T.usuarioLogueado, 1_000)) await closeMenu();
  // Prod puede arrancar en el selector de mundos: entrar a Super
  if (await isWorldSelectorOpen()) await enterSuperFromSelector();
}

const worldTileSel = () => driver.isAndroid ? 'android=new UiSelector().description("image")' : `-ios predicate string:label == 'image' OR name == 'image'`;

/** El selector de mundos son tiles con desc "image" (sin la barra de domicilio de la home). */
export async function isWorldSelectorOpen() {
  // Una home scrolleada no muestra la barra de domicilio pero sí carruseles, y sus banners también
  // tienen desc "image": no confundirla con el selector
  if (await isVisibleText(T.home, 1_000) || await isVisibleNow([...T.homeExpress, 'Prod List Title'])) return false;
  return (await $$(worldTileSel())).length >= 2;
}

/** Elige el primer tile del selector (Super / "Tienda Inglesa", igual en trunk y prod). */
export async function enterSuperFromSelector() {
  const tiles: { el: WebdriverIO.Element; x: number; y: number }[] = [];
  for (const el of await $$(worldTileSel())) {
    const { x, y } = await el.getLocation();
    tiles.push({ el, x, y });
  }
  tiles.sort((a, b) => a.y - b.y || a.x - b.x);
  await tiles[0].el.click();
  await waitForLoading();
  await chooseAddressForWorld('Super');
  await findByText(T.home, 30_000);
}

/**
 * Estado de sesión conocido dentro del proceso (cada feature corre en su propio proceso).
 * Evita abrir el menú en cada escenario sólo para preguntar si está logueado.
 */
let sessionState: 'logueado' | 'anonimo' | undefined;
export const setSessionState = (s: typeof sessionState) => { sessionState = s; };

export async function isLoggedIn() {
  if (await isVisibleNow(T.password)) return false; // pantalla de login
  if (sessionState === 'logueado' && await isVisibleNow([...T.home, ...T.homeExpress, ...T.appCargada])) return true;
  if (await isVisibleNow(T.iniciarSesion) && !(await isVisibleNow(T.home))) return false;
  await openMenu();
  const logged = await isVisibleNow(T.usuarioLogueado);
  await closeMenu();
  sessionState = logged ? 'logueado' : 'anonimo';
  return logged;
}

export async function fillLogin() {
  await typeInto(await findInput(T.usuario[0]), USER.email);
  await typeInto(await findInput(T.password[0]), USER.password);
  // En Android hideKeyboard puede mandar BACK y cerrar la pantalla: sólo en iOS
  if (driver.isIOS) await driver.hideKeyboard().catch(() => {});
  await tapButton(T.ingresar[0]);
  // Login OK cuando se ve la app (con enableMultiWindows la pantalla de login puede seguir en el árbol)
  await driver.waitUntil(async () =>
    await isVisibleText([...T.home, ...T.homeExpress, ...T.descartarAlInicio], 1_000) || !(await isVisibleText(T.password, 1_000)), {
    timeout: 30_000, timeoutMsg: 'El login no avanzó (¿credenciales o captcha?)',
  });
  await waitForLoading();
  // Después del login prod puede pedir verificar el email
  if (await tapTextIfVisible(T.descartarAlInicio, 5_000)) await waitForLoading();
  sessionState = 'logueado';
}

export async function login() {
  if (!(await isVisibleText(T.password, 1_000))) {
    if (!(await isVisibleText(T.iniciarSesion, 2_000))) await openMenu();
    await tapText(T.iniciarSesion);
  }
  await fillLogin();
}

export async function logout() {
  await openMenu();
  for (let i = 0; i < 6 && !(await isVisibleText(T.cerrarSesion, 1_000)); i++) await swipe('up');
  await tapText(T.cerrarSesion);
  await tapTextIfVisible(['Sí', 'Aceptar', ...T.cerrarSesion], 3_000);
  await waitForLoading();
  sessionState = 'anonimo';
}

// --- Búsqueda / productos ---

export async function search(term: string) {
  await typeInto(await findInput(), term, true);
  await waitForLoading();
  await driver.pause(1_000);
  ctx.lastSearch = term;
}

/** "+" de la primera tarjeta de producto visible. */
export async function firstPlus() {
  const sel = driver.isAndroid ? 'android=new UiSelector().text("+")' : `-ios predicate string:label == '+' OR name == '+'`;
  const el = await $(sel);
  await el.waitForDisplayed({ timeoutMsg: 'No hay tarjetas de producto con "+"' });
  return el;
}

export async function firstMinus() {
  const sel = driver.isAndroid ? 'android=new UiSelector().text("-")' : `-ios predicate string:label == '-' OR name == '-'`;
  const el = await $(sel);
  await el.waitForDisplayed({ timeoutMsg: 'La tarjeta no muestra el selector "-"' });
  return el;
}

/**
 * Abre el detalle tocando la imagen de la tarjeta. Si el producto ya está en el carrito, sobre la imagen
 * hay chips ("1,0 kg", "Aprox 5 unidades", recompra) que capturan el toque: se toca el ImageView de la foto
 * (el hijo del "Var Product Image") en lugar del centro del contenedor.
 */
export async function openDetailFromImage(container: WebdriverIO.Element) {
  const photo = container.$(driver.isAndroid ? 'android=new UiSelector().className("android.widget.ImageView")' : '-ios class chain:**/XCUIElementTypeImage');
  if (await photo.isExisting().catch(() => false)) await photo.click();
  else await container.click();
  await waitForLoading();
}

// --- Mundos ---

/** Abre el selector de mundos (logo del header) y elige uno por posición. */
export async function selectWorld(world: typeof T.mundos[number]) {
  await (await headerButton('mundo')).click();
  await chooseWorldInSelector(world);
}

/** Elige un mundo en el selector ya abierto (desde el logo del header o el que aparece al abrir la app). */
export async function chooseWorldInSelector(world: typeof T.mundos[number]) {
  const sel = driver.isAndroid ? 'android=new UiSelector().description("image")' : `-ios predicate string:label == 'image' OR name == 'image'`;
  await $(sel).waitForDisplayed({ timeout: 10_000, timeoutMsg: 'No se abrió el selector de mundos' });
  const { height } = await driver.getWindowSize();
  const tiles: { el: WebdriverIO.Element; x: number; y: number }[] = [];
  for (const el of await $$(sel)) {
    const { x, y } = await el.getLocation();
    if (y < height * 0.5 && await el.isDisplayed()) tiles.push({ el, x, y });
  }
  tiles.sort((a, b) => a.y - b.y || a.x - b.x);
  // Super y Express son los dos primeros tiles en todos los ambientes (prod agrega un banner en el medio)
  const idx = T.mundos.indexOf(world);
  if (idx > 1) throw new Error(`El selector de mundos sólo se automatiza para Super y Express (pedido: ${world})`);
  if (!tiles[idx]) throw new Error(`El selector de mundos tiene ${tiles.length} opciones, no encontré "${world}"`);
  await tiles[idx].el.click();
  await waitForLoading();
  await chooseAddressForWorld(world);
}

/** Si el mundo pide domicilio, elige el primero que tenga ese canal. */
async function chooseAddressForWorld(world: string) {
  // Variante prod: "Seleccionar" con Envío a domicilio / Retiro en sucursal y el domicilio ya marcado
  if (await isVisibleText(['Retiro en sucursal'], 3_000) && await isVisibleText(T.continuar, 1_000)) {
    await tapButton(T.continuar[0]);
    await waitForLoading();
    return;
  }
  if (!(await isVisibleText(T.direccionDeEntrega, 3_000))) return;
  const channels = await findAllByText(`Channel Name ${world}`);
  if (!channels.length) throw new Error(`Ningún domicilio del usuario tiene cobertura ${world}`);
  const addresses = await findAllByText(T.direccionDeEntrega);
  const address = addresses.filter(a => a.y < channels[0].y).pop() ?? addresses[0];
  await address.el.click();
  await waitForLoading();
  await tapTextIfVisible(T.continuar, 3_000);
  await waitForLoading();
}

// --- Pedidos ---

export async function openMisPedidos() {
  await openMenu();
  await tapText(T.menuMisPedidos);
  await waitForLoading();
  await findByText(['Pedido N'], 30_000);
}

/** Scrollea Mis pedidos hasta ver el pedido. Devuelve su y. */
export async function scrollToOrder(orderNumber: string, maxSwipes = 30) {
  for (let i = 0; i < maxSwipes; i++) {
    const [hit] = await findAllByText(orderNumber);
    if (hit) return hit.y;
    await swipe('up', 0.7);
  }
  throw new Error(`No encontré el pedido ${orderNumber} en Mis pedidos`);
}

/** Completa el diálogo "Cancelar Pedido Nº X" (motivo + confirmar). */
export async function confirmCancelDialog() {
  await findByText(T.motivoCancelacion, 10_000);
  await typeInto(await findInput(T.motivoCancelacion[0]), 'Smoke automatizado');
  // En Android hideKeyboard puede mandar BACK y cerrar la pantalla: sólo en iOS
  if (driver.isIOS) await driver.hideKeyboard().catch(() => {});
  await tapButton(T.cancelarPedido[0]);
  await waitForLoading();
}

export async function cancelOrder(orderNumber: string) {
  const y = await scrollToOrder(orderNumber);
  const { height } = await driver.getWindowSize();
  if (y > height * 0.6) { await swipe('up', 0.3); }
  const orderY = await scrollToOrder(orderNumber, 1);
  const nextOrderY = (await findAllByText('Pedido N')).map(o => o.y).find(oy => oy > orderY + 10) ?? Infinity;
  const cancel = (await findAllByText(T.cancelarPedido)).find(c => c.y > orderY && c.y < nextOrderY);
  if (!cancel) throw new Error(`El pedido ${orderNumber} no tiene botón "Cancelar Pedido"`);
  await cancel.el.click();
  await confirmCancelDialog();
}

/** Estado (PENDIENTE, ANULADO, ...) que muestra la tarjeta del pedido. */
export async function orderStatus(orderNumber: string) {
  const orderY = await scrollToOrder(orderNumber);
  const row = await px(80);
  for (const el of await $$(regexSelector('^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ -]{3,}$'))) {
    const { y } = await el.getLocation();
    if (Math.abs(y - orderY) < row) return (await el.getText()).trim();
  }
  return '';
}

const today = () => {
  const d = new Date();
  return [d.getDate(), d.getMonth() + 1, d.getFullYear() % 100].map(n => String(n).padStart(2, '0')).join('/');
};
const toKey = (ddmmyy: string) => ddmmyy.split('/').reverse().join(''); // yymmdd, comparable

/**
 * Cancela los pedidos PENDIENTES realizados HOY (los que dejó el smoke en corridas anteriores).
 * No toca pedidos de otros días: el usuario de prueba se comparte con otras pruebas.
 * La lista viene ordenada por fecha descendente (en trunk hay pedidos con fechas futuras arriba).
 */
export async function cancelAllPendingOrders(maxSwipes = 25) {
  const todayStr = today();
  let cancelled = 0;
  for (let i = 0; i < maxSwipes && cancelled < 10; i++) {
    const dates = await findAllByText(['Fecha ']);
    const dateAt = async (y: number) => {
      const above = dates.filter(d => d.y < y).pop();
      return above ? ((await above.el.getAttribute(descAttr())) ?? '').replace('Fecha ', '').trim() : '';
    };
    let acted = false;
    for (const btn of await findAllByText(T.cancelarPedido)) {
      if (await dateAt(btn.y) !== todayStr) continue;
      await btn.el.click();
      await confirmCancelDialog();
      cancelled++;
      acted = true;
      break;
    }
    if (acted) continue;
    // Si ya aparecen pedidos de días anteriores a hoy, no hay más pendientes de hoy
    const keys = await Promise.all(dates.map(d => d.el.getAttribute(descAttr())));
    if (keys.some(k => k && toKey(k.replace('Fecha ', '').trim()) < toKey(todayStr))) break;
    const before = await driver.getPageSource();
    await swipe('up', 0.7);
    if (before === await driver.getPageSource()) break; // fin de la lista
  }
  return cancelled;
}
