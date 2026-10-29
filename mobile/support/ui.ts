/**
 * Helpers cross-platform. La app es GeneXus Smart Devices: los controles no
 * siempre exponen resource-id / accessibility id, así que la estrategia base
 * es buscar por texto visible (text/content-desc en Android, label/name/value en iOS).
 */

const isAndroid = () => driver.isAndroid;

let size: { width: number; height: number } | undefined;
/** Tamaño de la pantalla (no cambia durante la corrida; en el iPhone cada consulta tarda ~1,6 s). */
export async function windowSize() {
  size ??= await driver.getWindowSize();
  return size;
}

let scale: number | undefined;
/**
 * Las distancias fijas (márgenes, alturas de fila) se calibraron en píxeles del emulador Android
 * (1080 de ancho). En iOS las coordenadas van en puntos: se escalan por el ancho de la pantalla.
 */
export async function px(n: number) {
  if (isAndroid()) return n;
  scale ??= (await windowSize()).width / 1080;
  return n * scale;
}

/**
 * Escapa texto para usarlo como regex dentro de un UiSelector.
 * El parser de Appium NO des-escapa el string literal: la barra va una sola vez ("\d", no "\\d").
 */
function escapeRegex(s: string) {
  return s
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/"/g, '\\"');
}

function escapePredicate(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Condición iOS para un texto. En Android el content-desc junta nombre del control y dato
 * ("Menu Title Mis pedidos", "Product Name Camel Leche ..."); en iOS vienen separados: name/label = "Menu Title",
 * value = "Mis pedidos". Además del texto entero, se prueba cada corte "nombre" + "dato".
 */
function iosTextCond(text: string, op: 'CONTAINS' | 'BEGINSWITH' = 'CONTAINS'): string {
  const t = escapePredicate(text);
  const conds = [`label ${op}[c] '${t}'`, `name ${op}[c] '${t}'`, `value ${op}[c] '${t}'`];
  const words = text.trim().split(/\s+/);
  for (let i = 1; i < words.length && i <= 5; i++) {
    const [ctrl, rest] = [words.slice(0, i).join(' '), words.slice(i).join(' ')].map(escapePredicate);
    conds.push(`(name ==[c] '${ctrl}' AND value ${op}[c] '${rest}')`);
  }
  return conds.join(' OR ');
}

/** Selector por texto visible (contiene, case-insensitive). */
export function textSelector(text: string): string {
  if (isAndroid()) {
    return `android=new UiSelector().textMatches("(?is).*${escapeRegex(text)}.*")`;
  }
  return `-ios predicate string:${iosTextCond(text)}`;
}

/** Selector por texto exacto (para controles cortos como "+", "-", "2"). */
export function exactSelector(text: string): string {
  if (isAndroid()) {
    return `android=new UiSelector().textMatches("^\\s*${escapeRegex(text)}\\s*$")`;
  }
  const t = escapePredicate(text);
  return `-ios predicate string:label == '${t}' OR name == '${t}'`;
}

/**
 * iOS: filtra por visibilidad dentro del predicado. Preguntar isDisplayed elemento por elemento cuesta ~1,3 s cada
 * uno en el iPhone (el menú tiene ~17 "Menu Title"); en el predicado, después de las condiciones de texto, iOS
 * sólo lo calcula para los que coinciden. (Ojo: `visible` sobre todo el árbol, sin otra condición antes, tarda >1 min.)
 */
async function iosVisible(sel: string) {
  const p = '-ios predicate string:';
  if (!sel.startsWith(p)) return sel;
  // Las imágenes de GeneXus dicen visible=false aunque estén en pantalla: para ellas vale estar dentro de la pantalla
  const { height } = await windowSize();
  const onScreen = `(type == 'XCUIElementTypeImage' AND rect.y >= 0 AND rect.y < ${Math.round(height)})`;
  return `${p}(${sel.slice(p.length)}) AND (visible == 1 OR ${onScreen})`;
}

/** Elementos visibles que matchean el selector (en iOS sin un isDisplayed por elemento). */
async function displayed(sel: string) {
  if (!isAndroid()) return [...await $$(await iosVisible(sel))];
  const out: WebdriverIO.Element[] = [];
  for (const el of await $$(sel)) if (await el.isDisplayed().catch(() => false)) out.push(el);
  return out;
}

/** Primer elemento visible con texto exacto. */
export async function findExact(texts: string | string[], timeout = 10_000) {
  const list = Array.isArray(texts) ? texts : [texts];
  let found: WebdriverIO.Element | undefined;
  await driver.waitUntil(async () => {
    for (const t of list) {
      [found] = await displayed(exactSelector(t));
      if (found) return true;
    }
    return false;
  }, { timeout, timeoutMsg: `No se encontró ningún elemento con texto exacto: ${list.join(' | ')}` });
  return found!;
}

/** Texto completo que matchea la regex (textMatches en Android, MATCHES de NSPredicate en iOS). Sin barras invertidas. */
export function regexSelector(pattern: string): string {
  return isAndroid()
    ? `android=new UiSelector().textMatches("${pattern.replace(/"/g, '\\"')}")`
    : `-ios predicate string:label MATCHES '${escapePredicate(pattern)}'`;
}

/** Nombre del control que empieza con el prefijo ("Product Name Camel X", "txt Amount 1,0 kg"). */
export function descPrefixSelector(prefix: string): string {
  if (isAndroid()) return `android=new UiSelector().descriptionStartsWith("${prefix.replace(/"/g, '\\"')}")`;
  return `-ios predicate string:${iosTextCond(prefix, 'BEGINSWITH')}`;
}

/**
 * Descripción del elemento con el formato de Android ("Fecha 19/10/26", "txt Amount 1,0 kg"): el content-desc,
 * o en iOS el nombre del control + su valor.
 */
export async function descOf(el: WebdriverIO.Element): Promise<string> {
  if (isAndroid()) return (await el.getAttribute('content-desc')) ?? '';
  const [name, value] = await Promise.all([el.getAttribute('name'), el.getAttribute('value')]);
  return value && value !== name ? `${name ?? ''} ${value}`.trim() : name ?? '';
}

/** Contenedores scrolleables (listas, grillas, carruseles). */
export const scrollableSelector = () => isAndroid()
  ? 'android=new UiSelector().scrollable(true)'
  : "-ios predicate string:type IN {'XCUIElementTypeScrollView', 'XCUIElementTypeCollectionView', 'XCUIElementTypeTable'}";

/** Selector por content-desc (Android) / accessibility label (iOS). */
export function descSelector(text: string): string {
  if (isAndroid()) {
    return `android=new UiSelector().descriptionMatches("(?is).*${escapeRegex(text)}.*")`;
  }
  return textSelector(text);
}

/** Selectores que combinan todas las alternativas en una sola consulta por estrategia (texto y content-desc). */
function combinedSelectors(list: string[]): string[] {
  if (isAndroid()) {
    const alt = list.map(escapeRegex).join('|');
    return [
      `android=new UiSelector().textMatches("(?is).*(${alt}).*")`,
      `android=new UiSelector().descriptionMatches("(?is).*(${alt}).*")`,
    ];
  }
  const cond = list.map(t => iosTextCond(t)).join(' OR ');
  return [`-ios predicate string:${cond}`];
}

/** Una pasada (sin esperar): el primer elemento visible que matchee, o undefined. */
async function findOnce(selectors: string[]) {
  for (const sel of selectors) {
    if (!isAndroid()) {
      const [el] = await displayed(sel);
      if (el) return el;
      continue;
    }
    for (const el of await $$(sel)) {
      if (await el.isDisplayed().catch(() => false)) return el;
    }
  }
  return undefined;
}

/** Primer elemento visible que matchee alguno de los textos (texto o descripción). */
export async function findByText(texts: string | string[], timeout = 20_000) {
  const list = Array.isArray(texts) ? texts : [texts];
  const selectors = combinedSelectors(list);
  let found: WebdriverIO.Element | undefined;
  await driver.waitUntil(async () => !!(found = await findOnce(selectors)),
    { timeout, interval: 300, timeoutMsg: `No se encontró ningún elemento con texto: ${list.join(' | ')}` });
  return found!;
}

/** Chequeo instantáneo (una sola pasada, sin esperar): para preguntar "¿estoy en tal pantalla?". */
export async function isVisibleNow(texts: string | string[]) {
  return !!(await findOnce(combinedSelectors(Array.isArray(texts) ? texts : [texts])));
}

export async function isVisibleText(texts: string | string[], timeout = 3_000) {
  return findByText(texts, timeout).then(() => true, () => false);
}

export async function tapText(texts: string | string[], timeout = 20_000) {
  await (await findByText(texts, timeout)).click();
}

export async function tapTextIfVisible(texts: string | string[], timeout = 3_000) {
  if (!(await isVisibleText(texts, timeout))) return false;
  await tapText(texts);
  return true;
}

/** Primer campo de texto editable visible (o el que tenga ese hint/placeholder). */
export async function findInput(hint?: string) {
  let sel: string;
  if (isAndroid()) {
    // GeneXus usa AutoCompleteTextView (no EditText) y el hint aparece como text
    const cls = 'classNameMatches(".*(EditText|AutoCompleteTextView)")';
    sel = hint
      ? `android=new UiSelector().${cls}.textMatches("(?is).*${escapeRegex(hint)}.*")`
      : `android=new UiSelector().${cls}`;
  } else {
    const fields = "(type == 'XCUIElementTypeTextField' OR type == 'XCUIElementTypeSearchField' OR type == 'XCUIElementTypeSecureTextField')";
    sel = hint
      ? `-ios predicate string:${fields} AND (placeholderValue CONTAINS[c] '${escapePredicate(hint)}' OR value CONTAINS[c] '${escapePredicate(hint)}')`
      : `-ios predicate string:${fields}`;
  }
  const el = await $(sel);
  await el.waitForDisplayed();
  return el;
}

export async function typeInto(el: WebdriverIO.Element, text: string, submit = false) {
  await el.click();
  await el.clearValue().catch(() => {});
  await el.setValue(text);
  if (!submit) return;
  if (isAndroid()) await driver.pressKeyCode(66); // ENTER
  else await el.addValue('\n');
}

/** Precio en pesos o dólares: "$ 50", "U$S 429". */
export const PRICE_RE = /(\$|U\$S)\s*\d/;

/** Todos los elementos visibles que matchean el texto, ordenados de arriba hacia abajo. */
export async function findAllByText(texts: string | string[]) {
  const list = Array.isArray(texts) ? texts : [texts];
  const selectors = list.flatMap(t => isAndroid() ? [textSelector(t), descSelector(t)] : [textSelector(t)]);
  const found: { el: WebdriverIO.Element; y: number }[] = [];
  for (const sel of selectors) {
    for (const el of await displayed(sel)) found.push({ el, y: (await el.getLocation()).y });
  }
  return found.sort((a, b) => a.y - b.y);
}

/** Tap en coordenadas relativas a la pantalla (0..1). */
export async function tapAt(xRatio: number, yRatio: number) {
  const { width, height } = await windowSize();
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(width * xRatio), y: Math.round(height * yRatio) }).down().pause(80).up().perform();
  await driver.pause(500);
}

/** Tap dentro de un elemento, en coordenadas relativas a su tamaño (0..1). */
export async function tapInside(el: WebdriverIO.Element, xRatio: number, yRatio: number) {
  const { x, y } = await el.getLocation();
  const { width, height } = await el.getSize();
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(x + width * xRatio), y: Math.round(y + height * yRatio) }).down().pause(80).up().perform();
  await driver.pause(500);
}

/** Swipe horizontal en una franja (yRatio relativo a la pantalla). 'left' = el contenido avanza. */
export async function swipeHorizontal(direction: 'left' | 'right', yRatio: number) {
  const { width, height } = await windowSize();
  const y = Math.round(height * yRatio);
  const [from, to] = direction === 'left' ? [width * 0.85, width * 0.1] : [width * 0.1, width * 0.85];
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(from), y }).down().pause(100)
    .move({ x: Math.round(to), y, duration: 300 }).up().perform();
  await driver.pause(500);
}

/** El contenedor scrolleable más grande de la pantalla (lista, grilla, home). */
export async function mainScrollable() {
  // iOS: la home tiene ~48 scrollables (cada carrusel es uno) y recorrerlos tardaba ~3 min en el iPhone:
  // los gestos de iOS van por coordenadas de pantalla
  if (!isAndroid()) return undefined;
  let best: { el: WebdriverIO.Element; area: number } | undefined;
  for (const el of await $$(scrollableSelector())) {
    const { width, height } = await el.getSize().catch(() => ({ width: 0, height: 0 }));
    if (width * height > (best?.area ?? 0)) best = { el, area: width * height };
  }
  return best?.el;
}

/**
 * Scroll vertical sobre el contenedor scrolleable (gesto sobre el elemento, no sobre coordenadas).
 * 'up' = el dedo sube = el contenido avanza hacia abajo. Devuelve false si ya no se puede seguir.
 */
export async function swipe(direction: 'up' | 'down', percent = 0.6): Promise<boolean> {
  if (!isAndroid()) {
    // iOS no tiene scrollGesture: arrastre sin inercia en el centro de la pantalla. Arranca debajo del header y
    // termina arriba de la barra de abajo
    const { width, height } = await windowSize();
    const x = Math.round(width / 2);
    const dist = height * 0.5 * Math.min(percent * 1.5, 1);
    const [from, to] = [height * 0.78, height * 0.78 - dist];
    const [y1, y2] = direction === 'up' ? [from, to] : [to, from];
    await iosDrag(x, y1, x, y2);
    return true;
  }
  const el = await mainScrollable();
  if (el) {
    // Gesto dentro de la zona central del scrollable: si arranca sobre el header o la barra fija de abajo
    // ("Agregar al carrito" del detalle) no se mueve nada
    const r = await driver.getElementRect(el.elementId);
    return driver.execute('mobile: scrollGesture', {
      left: Math.round(r.x + r.width * 0.1), top: Math.round(r.y + r.height * 0.2),
      width: Math.round(r.width * 0.8), height: Math.round(r.height * 0.55),
      direction: direction === 'up' ? 'down' : 'up', percent: Math.min(percent * 1.5, 1),
    }) as Promise<boolean>;
  }
  // Sin scrollable (o iOS): gesto sobre la zona central de la pantalla
  if (isAndroid()) {
    const { width, height } = await windowSize();
    return driver.execute('mobile: scrollGesture', {
      left: Math.round(width * 0.1), top: Math.round(height * 0.25), width: Math.round(width * 0.8), height: Math.round(height * 0.5),
      direction: direction === 'up' ? 'down' : 'up', percent: Math.min(percent * 1.5, 1),
    }) as Promise<boolean>;
  }
  await driver.execute('mobile: swipe', { direction: direction === 'up' ? 'up' : 'down' }).catch(() => {});
  return true;
}

/**
 * Swipe rápido (acciones W3C de 150 ms) dentro del scrollable principal. Cada `mobile: scrollGesture`
 * tarda ~2 s y sube poco; este tarda ~0,5 s y avanza más por la inercia. Para recorrer listas largas
 * (ej. volver la home al principio) sin precisión: no sirve para validar lo que aparece en cada paso.
 */
export async function quickSwipe(direction: 'up' | 'down') {
  const el = await mainScrollable();
  if (!el && isAndroid()) return swipe(direction, 0.7);
  // iOS: dentro de la zona central de la pantalla (debajo del header)
  const screen = await windowSize();
  const r = el ? await driver.getElementRect(el.elementId) : { x: 0, y: screen.height * 0.15, width: screen.width, height: screen.height * 0.7 };
  const x = Math.round(r.x + r.width / 2);
  const [from, to] = [Math.round(r.y + r.height * 0.25), Math.round(r.y + r.height * 0.8)];
  const [y1, y2] = direction === 'down' ? [from, to] : [to, from];
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x, y: y1 }).down().move({ x, y: y2, duration: 150 }).up().perform();
  await driver.pause(400);
  return true;
}

/** Swipe horizontal sobre un elemento (carrusel, días): 'left' = avanza. */
export async function swipeElement(el: WebdriverIO.Element, direction: 'left' | 'right', percent = 0.75) {
  if (isAndroid()) {
    await driver.execute('mobile: swipeGesture', { elementId: el.elementId, direction, percent });
    return;
  }
  // iOS: arrastre horizontal a la altura del elemento (en iOS `el` es el propio elemento, no su contenedor:
  // ver scrollableContaining). `mobile: swipe` sobre un elemento chico no mueve el carrusel
  const r = await driver.getElementRect(el.elementId);
  const { width } = await windowSize();
  const y = Math.round(r.y + r.height / 2);
  const [a, b] = [width * (0.5 + percent / 2), width * (0.5 - percent / 2)].map(Math.round);
  const [x1, x2] = direction === 'left' ? [a, b] : [b, a];
  await iosDrag(x1, y, x2, y);
}

/**
 * iOS: arrastre sin inercia (se frena antes de soltar). `mobile: dragFromToForDuration` tardaba ~8 s en el iPhone;
 * las acciones W3C, ~1,5 s.
 */
async function iosDrag(x1: number, y1: number, x2: number, y2: number) {
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(x1), y: Math.round(y1) }).down().pause(100)
    .move({ x: Math.round(x2), y: Math.round(y2), duration: 400 }).pause(200).up().perform();
  await driver.pause(300);
}

/** Contenedor horizontal scrolleable que contiene al elemento con ese content-desc / texto. */
export async function scrollableContaining(selector: string) {
  // No se usa un XPath "scrollable con este descendiente": con varias ventanas (enableMultiWindows)
  // UiAutomator2 a veces devuelve otro carrusel. Se busca el elemento y el scrollable más chico que lo contiene.
  const target = await $(selector);
  if (!(await target.isExisting())) return undefined;
  // iOS: recorrer los ~48 scrollables tarda minutos; swipeElement desliza a la altura del propio elemento
  if (!isAndroid()) return target;
  const t = await driver.getElementRect(target.elementId);
  const cx = t.x + t.width / 2, cy = t.y + t.height / 2;
  let best: { el: WebdriverIO.Element; area: number } | undefined;
  for (const el of await $$(scrollableSelector())) {
    const r = await driver.getElementRect(el.elementId).catch(() => undefined);
    if (!r || cx < r.x || cx > r.x + r.width || cy < r.y || cy > r.y + r.height) continue;
    if (!best || r.width * r.height < best.area) best = { el, area: r.width * r.height };
  }
  return best?.el;
}

/** Scrollea hasta que aparezca el texto (o falla luego de maxSwipes). */
export async function scrollToText(texts: string | string[], maxSwipes = 10) {
  for (let i = 0; i < maxSwipes; i++) {
    if (await isVisibleText(texts, 1_500)) return findByText(texts);
    await swipe('up');
  }
  return findByText(texts, 2_000);
}

function decodeXml(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");
}

/** Textos visibles de la pantalla actual. */
export async function visibleTexts(): Promise<string[]> {
  const src = await driver.getPageSource();
  if (isAndroid()) return [...src.matchAll(/\btext="([^"]+)"/g)].map(m => decodeXml(m[1]));
  // iOS: el texto está en value (si no, en label)
  return [...src.matchAll(/<XCUIElementType\w+ [^>]*>/g)]
    .map(m => (m[0].match(/ value="([^"]*)"/) ?? m[0].match(/ label="([^"]*)"/))?.[1] ?? '')
    .filter(Boolean).map(decodeXml);
}

/** Espera a que desaparezcan los indicadores de carga de GeneXus. */
export async function waitForLoading(timeout = 30_000) {
  const sel = isAndroid()
    ? 'android=new UiSelector().className("android.widget.ProgressBar")'
    : '-ios class chain:**/XCUIElementTypeActivityIndicator';
  await driver.pause(150);
  await driver.waitUntil(async () => {
    for (const el of await $$(sel)) if (await el.isDisplayed().catch(() => false)) return false;
    return true;
  }, { timeout, interval: 300 }).catch(() => {});
}

export async function screenshot(name: string) {
  await driver.saveScreenshot(`./test-results/${name}.png`).catch(() => {});
}
