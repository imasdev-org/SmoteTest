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
import { dominantColor } from './color';
import {
  descOf, findAllByText, findByText, findExact, findInput, isVisibleNow, isVisibleText, px, quickSwipe, regexSelector, swipe, swipeElement,
  tapText, tapTextIfVisible, textSelector, typeInto, waitForLoading, windowSize,
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

/**
 * Toque en el centro del elemento. En iOS element.click() sobre controles de GeneXus que XCUITest considera
 * invisibles (logo, imágenes) no hace nada o toca otra cosa: se toca por coordenadas.
 */
export async function tapElement(el: WebdriverIO.Element) {
  if (driver.isAndroid) return el.click();
  const r = await driver.getElementRect(el.elementId);
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }).down().pause(80).up().perform();
}

// --- Header ---
//
// Los íconos del header (menú, selector de mundo, carrito) no tienen id ni content-desc. Se ubican por
// estructura del árbol: el contenedor del header es el padre directo de los FrameLayout clickeables y del
// bloque con el logo ("Channel Logo") o el buscador (EditText). Se tocan con element.click(), sin coordenadas.

const HEADER_XPATH = "//*[android.widget.FrameLayout[@clickable='true']][*[.//*[@content-desc='Channel Logo'] or .//android.widget.EditText]]";

// iOS: XCUITest no expone "clickable". Los íconos del header (menú, carrito y, en la home, el escáner) son
// contenedores de 44x44 puntos con una imagen adentro. Relevado en iPhone 8 / iOS 16.7, prod 38.1086.
// Ojo: filtrar por `visible` o `accessible` en el predicado obliga a iOS a calcularlo en todo el árbol
// (~1100 elementos): esa búsqueda tardaba 73 s en el iPhone; por tamaño tarda ~5 s.
const iosHeaderSel = (maxY: number, extra = '') => `-ios predicate string:type == 'XCUIElementTypeOther' AND rect.width == 44 AND rect.height == 44 AND rect.y < ${Math.round(maxY)}${extra}`;

async function headerButtons() {
  const buttons: { el: WebdriverIO.Element; x: number; y: number }[] = [];
  if (driver.isAndroid) {
    for (const el of await $$(`${HEADER_XPATH}/*[@clickable='true']`)) {
      const { x, y } = await el.getLocation();
      buttons.push({ el, x, y });
    }
  } else {
    const { height } = await windowSize();
    for (const el of await $$(iosHeaderSel(height * 0.2))) {
      const { x, y } = await el.getLocation();
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
    // iOS: el logo mismo (desc "Channel Logo"). Hay dos en el árbol (header y menú lateral): el del header está
    // arriba, al centro
    const { width, height } = await windowSize();
    const logo = await $(`-ios predicate string:name == 'Channel Logo' AND rect.y < ${Math.round(height * 0.15)} AND rect.x > ${Math.round(width * 0.2)}`);
    if (!(await logo.isExisting())) throw new Error('No encontré el logo / selector de mundo en el header');
    return logo;
  }
  if (which === 'mundo') {
    // El contenedor clickeable del logo puede estar un nivel más adentro: se toma el más interno
    const logos = await $$(`${HEADER_XPATH}//*[@clickable='true'][.//*[@content-desc='Channel Logo']]`);
    if (!logos.length) throw new Error('No encontré el logo / selector de mundo en el header');
    return logos[logos.length - 1];
  }
  if (!driver.isAndroid) {
    // Una sola búsqueda: el menú es el ícono de la izquierda y el carrito el de la derecha en la primera fila
    // (el escáner de la home está debajo del carrito). Cada consulta de posición cuesta ~1,3 s en el iPhone
    const { width, height } = await windowSize();
    const el = await $(iosHeaderSel(height * 0.15, which === 'menu' ? ` AND rect.x < ${Math.round(width / 4)}` : ` AND rect.x > ${Math.round(width * 3 / 4)}`));
    if (await el.isExisting()) return el;
    // Resultados de búsqueda / detalle: el carrito es un contenedor de 42x42 arriba a la derecha
    if (which === 'carrito') {
      const cart = await $(`-ios predicate string:type == 'XCUIElementTypeOther' AND rect.width >= 40 AND rect.width <= 48 AND rect.height >= 40 AND rect.height <= 48 AND rect.y < ${Math.round(height * 0.15)} AND rect.x > ${Math.round(width * 3 / 4)}`);
      if (await cart.isExisting()) return cart;
    }
    // Pantallas del menú (Mis pedidos...): barra de navegación nativa con "nav menu icon" y "tiendaios7 ico cart ..."
    const nav = await $(`-ios predicate string:type == 'XCUIElementTypeButton' AND name ${which === 'menu' ? "== 'nav menu icon'" : "CONTAINS 'cart'"}`);
    if (await nav.isExisting()) return nav;
    throw new Error('No encontré el header de la app (menú / carrito)');
  }
  const row = await headerButtons();
  return which === 'menu' ? row[0].el : row[row.length - 1].el;
}

export async function openMenu() {
  // El tap se pierde si llega mientras la home recarga o el drawer se está cerrando
  for (let i = 0; i < 3; i++) {
    await (await headerButton('menu')).click();
    // En el iPhone cada búsqueda tarda ~5 s y la primera, con el menú animándose, no lo ve: con 4 s de espera se
    // volvía a tocar el menú mientras abría
    if (await isVisibleText([...T.usuarioLogueado, ...T.menuMisPedidos, ...T.iniciarSesion], driver.isAndroid ? 4_000 : 20_000)) return;
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
 * iOS no tiene botón atrás del sistema. Las pantallas de GeneXus (detalle, "Ver todos") tienen su propia flecha "<":
 * un contenedor de 48x48 arriba a la izquierda (relevado en el detalle, iPhone 8). Si no está, el "atrás" de una
 * barra de navegación nativa y, por último, el gesto desde el borde izquierdo.
 */
async function iosBack() {
  const arrow = await $("-ios predicate string:type == 'XCUIElementTypeOther' AND rect.width == 48 AND rect.height == 48 AND rect.x < 30 AND rect.y < 60");
  if (await arrow.isExisting()) {
    const r = await driver.getElementRect(arrow.elementId);
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }).down().pause(80).up().perform();
    return;
  }
  // (El primer botón de la barra nativa de "Mis pedidos" es el menú, no un "atrás")
  const navBack = await $("-ios predicate string:type == 'XCUIElementTypeButton' AND name != 'nav menu icon' AND NOT (name CONTAINS 'cart') AND rect.x < 60 AND rect.y < 70");
  if (await navBack.isExisting()) return navBack.click();
  const { width, height } = await windowSize();
  const y = Math.round(height / 2);
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: 2, y }).down().move({ x: Math.round(width * 0.7), y, duration: 300 }).up().perform();
}

/** Vuelve de una pantalla abierta desde el menú (Mis pedidos...): la app regresa con el drawer abierto. */
export async function backToHome() {
  if (!driver.isAndroid) {
    // iOS: las pantallas del menú (Mis pedidos...) son de primer nivel, sin "atrás": se vuelve con menú → Inicio
    await openMenu();
    await tapElement(await findExact(['Inicio'], 10_000)); // en iOS el ítem se llama "Inicio" (no "Menu Title Inicio")
    await findByText(T.appCargada, 15_000);
    return;
  }
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

/**
 * ¿La app está en la home de Express? Android: la franja de entrega de Express (T.homeExpress).
 * iOS: la home de Express no tiene ningún texto ni nombre de control propio; el ícono del menú es rojo en Express
 * y azul en Super (medido en el iPhone 8: rojo 238/96/96, azul 75/121/184).
 */
export async function isExpressHome() {
  if (driver.isAndroid) return isVisibleNow(T.homeExpress);
  const menu = await headerButton('menu').catch(() => undefined);
  if (!menu) return false;
  const { r, b, n } = await dominantColor(menu).catch(() => ({ r: 0, b: 0, n: 0 }));
  return n > 50 && r > b + 60;
}

/** Espera la home de Express (o alguno de los textos de `orTexts`). Devuelve false si no aparece. */
export async function waitForExpressHome(timeout: number, orTexts: string[] = []) {
  return driver.waitUntil(async () => await isExpressHome() || (orTexts.length > 0 && await isVisibleNow(orTexts)),
    { timeout, interval: 1_000 }).then(() => true, () => false);
}

export async function expectExpressHome(timeout = 60_000) {
  if (!(await waitForExpressHome(timeout))) throw new Error('No cargó la home de Express');
}

/** Cierra un drawer haciendo swipe sobre un elemento del propio drawer (no sobre el fondo). */
async function swipeDrawer(anchorTexts: string[], direction: 'left' | 'right') {
  const anchor = await findByText(anchorTexts, 5_000);
  await swipeElement(anchor, direction, 0.9);
  await driver.pause(300);
}

/** Cierra el menú lateral (swipe a la izquierda sobre el menú). */
export async function closeMenu() {
  if (!driver.isAndroid) {
    // iOS: el menú ocupa ~3/4 de la pantalla desde la izquierda. Buscar un texto del menú para deslizar sobre él
    // costaba ~20 s en el iPhone; se desliza por coordenadas dentro del menú
    const { width, height } = await windowSize();
    const y = Math.round(height / 2);
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(width * 0.6), y }).down().move({ x: Math.round(width * 0.05), y, duration: 250 }).up().perform();
    await driver.pause(500);
    return;
  }
  await swipeDrawer([...T.menuMisPedidos, ...T.usuarioLogueado, 'Menu Title'], 'left');
}

/** Cierra el panel del carrito (swipe a la derecha sobre el panel). */
export async function closeCart() {
  if (!driver.isAndroid) {
    // iOS: el panel no se cierra deslizando. Con el panel abierto el header de la home queda corrido a la izquierda
    // y su ícono del carrito (44x44, x≈41) sigue a la vista: tocarlo cierra el panel
    const { width } = await windowSize();
    const cart = await $(iosHeaderSel(60, ` AND rect.x >= 0 AND rect.x < ${Math.round(width / 2)}`));
    if (await cart.isExisting()) await tapElement(cart);
    await driver.pause(800);
    return;
  }
  await swipeDrawer([...T.vaciarCarrito, 'Product Name Camel', ...T.pagar], 'right');
}

export async function openCart() {
  await (await headerButton('carrito')).click();
  await waitForLoading();
}

/** Número del badge del carrito (0 si no hay badge). */
export async function cartCount(): Promise<number> {
  const { width, height } = await windowSize();
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

/**
 * iOS: tiles del selector (imágenes "image" altas en la mitad de arriba; Super y Express miden 171x220 en el iPhone 8).
 * Las imágenes de GeneXus dicen visible=false, así que no se puede esperar con waitForDisplayed. Los banners de la
 * home también se llaman "image" pero son más bajos (~133).
 */
async function iosWorldTiles() {
  const { height } = await windowSize();
  const tiles: { el: WebdriverIO.Element; x: number; y: number }[] = [];
  for (const el of await $$(`-ios predicate string:name == 'image' AND rect.height > 180 AND rect.y >= 0 AND rect.y < ${Math.round(height * 0.5)}`)) {
    const { x, y } = await el.getLocation();
    tiles.push({ el, x, y });
  }
  return tiles.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** El selector de mundos son tiles con desc "image" (sin la barra de domicilio de la home). */
export async function isWorldSelectorOpen() {
  // Una home scrolleada no muestra la barra de domicilio pero sí carruseles, y sus banners también
  // tienen desc "image": no confundirla con el selector
  if (await isVisibleText(T.home, 1_000) || await isVisibleNow([...T.homeExpress, 'Prod List Title'])) return false;
  if (!driver.isAndroid) return (await iosWorldTiles()).length >= 2;
  return (await $$(worldTileSel())).length >= 2;
}

/** Elige el primer tile del selector (Super / "Tienda Inglesa", igual en trunk y prod). */
export async function enterSuperFromSelector() {
  const tiles: { el: WebdriverIO.Element; x: number; y: number }[] = driver.isAndroid ? [] : await iosWorldTiles();
  for (const el of driver.isAndroid ? await $$(worldTileSel()) : []) {
    const { x, y } = await el.getLocation();
    tiles.push({ el, x, y });
  }
  tiles.sort((a, b) => a.y - b.y || a.x - b.x);
  await tapElement(tiles[0].el);
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
  await acceptDialog(['Sí', 'Aceptar', ...T.cerrarSesion], 3_000);
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

/** El elemento de más arriba (y, a igual fila, el de más a la izquierda). */
async function topLeft(els: WebdriverIO.Element[]) {
  if (els.length <= 1) return els[0];
  const withPos = await Promise.all(els.map(async el => ({ el, ...(await el.getLocation()) })));
  const row = await px(60);
  return withPos.sort((a, b) => (Math.abs(a.y - b.y) < row ? a.x - b.x : a.y - b.y))[0].el;
}

/** "+" de la primera tarjeta de producto visible. */
export async function firstPlus() {
  if (!driver.isAndroid) {
    // iOS: el "+" es el control "txt In Cart Caption" con value="+"
    let el: WebdriverIO.Element | undefined;
    // El primero en pantalla (arriba a la izquierda): el orden del árbol de iOS no es el visual
    await driver.waitUntil(async () => !!(el = await topLeft([...await $$("-ios predicate string:(value == '+' OR label == '+' OR name == '+') AND visible == 1")])),
      { timeout: 20_000, interval: 500, timeoutMsg: 'No hay tarjetas de producto con "+"' });
    return el!;
  }
  const el = await $('android=new UiSelector().text("+")');
  await el.waitForDisplayed({ timeoutMsg: 'No hay tarjetas de producto con "+"' });
  return el;
}

export async function firstMinus() {
  if (!driver.isAndroid) {
    // iOS: el "-" es el control "txt In Cart Caption" con value="-"
    let el: WebdriverIO.Element | undefined;
    // El primero en pantalla (arriba a la izquierda): el orden del árbol de iOS no es el visual
    await driver.waitUntil(async () => !!(el = await topLeft([...await $$("-ios predicate string:(value == '-' OR label == '-' OR name == '-') AND visible == 1")])),
      { timeout: 20_000, interval: 500, timeoutMsg: 'La tarjeta no muestra el selector "-"' });
    return el!;
  }
  const el = await $('android=new UiSelector().text("-")');
  await el.waitForDisplayed({ timeoutMsg: 'La tarjeta no muestra el selector "-"' });
  return el;
}

/**
 * Abre el detalle tocando la imagen de la tarjeta. Si el producto ya está en el carrito, sobre la imagen
 * hay chips ("1,0 kg", "Aprox 5 unidades", recompra) que capturan el toque: se toca el ImageView de la foto
 * (el hijo del "Var Product Image") en lugar del centro del contenedor.
 */
export async function openDetailFromImage(container: WebdriverIO.Element) {
  if (!driver.isAndroid) {
    // iOS: las imágenes de GeneXus dicen visible=false y element.click() no abre el detalle (el toque cae en otro
    // lado y la home vuelve arriba). Tap por coordenadas en el centro de la imagen
    const r = await driver.getElementRect(container.elementId);
    await driver.action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }).down().pause(80).up().perform();
    await waitForLoading();
    return;
  }
  const photo = container.$(driver.isAndroid ? 'android=new UiSelector().className("android.widget.ImageView")' : '-ios class chain:**/XCUIElementTypeImage');
  if (await photo.isExisting().catch(() => false)) await photo.click();
  else await container.click();
  await waitForLoading();
}

// --- Mundos ---

/** Abre el selector de mundos (logo del header) y elige uno por posición. */
export async function selectWorld(world: typeof T.mundos[number]) {
  await tapElement(await headerButton('mundo'));
  await chooseWorldInSelector(world);
}

/** Elige un mundo en el selector ya abierto (desde el logo del header o el que aparece al abrir la app). */
export async function chooseWorldInSelector(world: typeof T.mundos[number]) {
  let tiles: { el: WebdriverIO.Element; x: number; y: number }[] = [];
  if (driver.isAndroid) {
    const sel = worldTileSel();
    await $(sel).waitForDisplayed({ timeout: 10_000, timeoutMsg: 'No se abrió el selector de mundos' });
    const { height } = await windowSize();
    for (const el of await $$(sel)) {
      const { x, y } = await el.getLocation();
      if (y < height * 0.5 && await el.isDisplayed()) tiles.push({ el, x, y });
    }
    tiles.sort((a, b) => a.y - b.y || a.x - b.x);
  } else {
    await driver.waitUntil(async () => (tiles = await iosWorldTiles()).length >= 2,
      { timeout: 15_000, interval: 500, timeoutMsg: 'No se abrió el selector de mundos' });
  }
  // Super y Express son los dos primeros tiles en todos los ambientes (prod agrega un banner en el medio)
  const idx = T.mundos.indexOf(world);
  if (idx > 1) throw new Error(`El selector de mundos sólo se automatiza para Super y Express (pedido: ${world})`);
  if (!tiles[idx]) throw new Error(`El selector de mundos tiene ${tiles.length} opciones, no encontré "${world}"`);
  await tapElement(tiles[idx].el);
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
/**
 * Acepta un diálogo de confirmación. Android: toca el botón por texto. iOS: es una alerta nativa (ej. "¿Confirma
 * vaciar el carrito?" con "Cancelar" / "Si"): se toca el botón que no cancela. Devuelve false si no apareció.
 */
export async function acceptDialog(texts: string[], timeout = 3_000) {
  if (driver.isAndroid) return tapTextIfVisible(texts, timeout);
  const shown = await driver.waitUntil(async () => (await driver.getAlertText().catch(() => null)) !== null, { timeout, interval: 500 })
    .then(() => true, () => false);
  if (!shown) return false;
  const buttons = await driver.execute('mobile: alert', { action: 'getButtons' }) as string[];
  const yes = buttons.find(b => !/^(cancelar|no|cerrar)$/i.test(b.trim())) ?? buttons[buttons.length - 1];
  await driver.execute('mobile: alert', { action: 'accept', buttonLabel: yes });
  return true;
}

export async function confirmCancelDialog() {
  if (driver.isIOS) {
    // El motivo es un TextView ("Reason String") con placeholder, que iOS no expone como texto. Detrás del modal
    // sigue la tarjeta del pedido con otro "Cancelar Pedido": se toca el que está debajo del motivo.
    const reason = await $("-ios predicate string:type == 'XCUIElementTypeTextView' AND name == 'Reason String'");
    await reason.waitForExist({ timeout: 15_000 });
    await reason.click();
    await reason.setValue('Smoke automatizado');
    await driver.hideKeyboard().catch(() => {});
    const r = await driver.getElementRect(reason.elementId);
    const buttons = await $$(`-ios predicate string:type == 'XCUIElementTypeButton' AND name == '${T.cancelarPedido[0]}'`);
    // El teclado no se cierra y sube los botones: el del diálogo es el primero debajo del motivo (el de la tarjeta
    // de atrás queda justo debajo del "Volver" del diálogo)
    let target: WebdriverIO.Element | undefined, targetY = Infinity;
    for (const b of buttons) {
      const { y } = await b.getLocation();
      if (y > r.y + r.height && y < targetY) [target, targetY] = [b, y];
    }
    if (!target) throw new Error('No encontré el botón "Cancelar Pedido" del diálogo');
    await tapElement(target);
    await waitForLoading();
    return;
  }
  await findByText(T.motivoCancelacion, 10_000);
  await typeInto(await findInput(T.motivoCancelacion[0]), 'Smoke automatizado');
  // En Android hideKeyboard puede mandar BACK y cerrar la pantalla: sólo en iOS
  if (driver.isIOS) await driver.hideKeyboard().catch(() => {});
  await tapButton(T.cancelarPedido[0]);
  await waitForLoading();
}

export async function cancelOrder(orderNumber: string) {
  const y = await scrollToOrder(orderNumber);
  const { height } = await windowSize();
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
      return above ? (await descOf(above.el)).replace('Fecha ', '').trim() : '';
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
    const keys = await Promise.all(dates.map(d => descOf(d.el)));
    if (keys.some(k => k && toKey(k.replace('Fecha ', '').trim()) < toKey(todayStr))) break;
    const before = await driver.getPageSource();
    await swipe('up', 0.7);
    if (before === await driver.getPageSource()) break; // fin de la lista
  }
  return cancelled;
}
