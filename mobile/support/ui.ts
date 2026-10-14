/**
 * Helpers cross-platform. La app es GeneXus Smart Devices: los controles no
 * siempre exponen resource-id / accessibility id, así que la estrategia base
 * es buscar por texto visible (text/content-desc en Android, label/name/value en iOS).
 */

const isAndroid = () => driver.isAndroid;

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

/** Selector por texto visible (contiene, case-insensitive). */
export function textSelector(text: string): string {
  if (isAndroid()) {
    return `android=new UiSelector().textMatches("(?is).*${escapeRegex(text)}.*")`;
  }
  const t = escapePredicate(text);
  return `-ios predicate string:label CONTAINS[c] '${t}' OR name CONTAINS[c] '${t}' OR value CONTAINS[c] '${t}'`;
}

/** Selector por texto exacto (para controles cortos como "+", "-", "2"). */
export function exactSelector(text: string): string {
  if (isAndroid()) {
    return `android=new UiSelector().textMatches("^\\s*${escapeRegex(text)}\\s*$")`;
  }
  const t = escapePredicate(text);
  return `-ios predicate string:label == '${t}' OR name == '${t}'`;
}

/** Primer elemento visible con texto exacto. */
export async function findExact(texts: string | string[], timeout = 10_000) {
  const list = Array.isArray(texts) ? texts : [texts];
  let found: WebdriverIO.Element | undefined;
  await driver.waitUntil(async () => {
    for (const t of list) {
      for (const el of await $$(exactSelector(t))) {
        if (await el.isDisplayed().catch(() => false)) { found = el; return true; }
      }
    }
    return false;
  }, { timeout, timeoutMsg: `No se encontró ningún elemento con texto exacto: ${list.join(' | ')}` });
  return found!;
}

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
  const cond = list.map(t => { const e = escapePredicate(t); return `label CONTAINS[c] '${e}' OR name CONTAINS[c] '${e}' OR value CONTAINS[c] '${e}'`; }).join(' OR ');
  return [`-ios predicate string:${cond}`];
}

/** Una pasada (sin esperar): el primer elemento visible que matchee, o undefined. */
async function findOnce(selectors: string[]) {
  for (const sel of selectors) {
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
    for (const el of await $$(sel)) {
      if (!(await el.isDisplayed().catch(() => false))) continue;
      found.push({ el, y: (await el.getLocation()).y });
    }
  }
  return found.sort((a, b) => a.y - b.y);
}

/** Tap en coordenadas relativas a la pantalla (0..1). */
export async function tapAt(xRatio: number, yRatio: number) {
  const { width, height } = await driver.getWindowSize();
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
  const { width, height } = await driver.getWindowSize();
  const y = Math.round(height * yRatio);
  const [from, to] = direction === 'left' ? [width * 0.85, width * 0.1] : [width * 0.1, width * 0.85];
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: Math.round(from), y }).down().pause(100)
    .move({ x: Math.round(to), y, duration: 300 }).up().perform();
  await driver.pause(500);
}

/** El contenedor scrolleable más grande de la pantalla (lista, grilla, home). */
export async function mainScrollable() {
  if (!isAndroid()) return undefined;
  let best: { el: WebdriverIO.Element; area: number } | undefined;
  for (const el of await $$('android=new UiSelector().scrollable(true)')) {
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
    const { width, height } = await driver.getWindowSize();
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
  const el = isAndroid() ? await mainScrollable() : undefined;
  if (!el) return swipe(direction, 0.7);
  const r = await driver.getElementRect(el.elementId);
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
  await driver.execute(isAndroid() ? 'mobile: swipeGesture' : 'mobile: swipe', isAndroid()
    ? { elementId: el.elementId, direction, percent }
    : { elementId: el.elementId, direction });
}

/** Contenedor horizontal scrolleable que contiene al elemento con ese content-desc / texto. */
export async function scrollableContaining(selector: string) {
  // No se usa un XPath "scrollable con este descendiente": con varias ventanas (enableMultiWindows)
  // UiAutomator2 a veces devuelve otro carrusel. Se busca el elemento y el scrollable más chico que lo contiene.
  const target = await $(selector);
  if (!(await target.isExisting())) return undefined;
  const t = await driver.getElementRect(target.elementId);
  const cx = t.x + t.width / 2, cy = t.y + t.height / 2;
  let best: { el: WebdriverIO.Element; area: number } | undefined;
  for (const el of await $$('android=new UiSelector().scrollable(true)')) {
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
  const re = isAndroid() ? /\btext="([^"]+)"/g : /\blabel="([^"]+)"/g;
  return [...src.matchAll(re)].map(m => decodeXml(m[1]));
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
