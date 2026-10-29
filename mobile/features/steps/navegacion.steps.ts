import { When, Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { T } from '../../support/texts';
import { descPrefixSelector, findAllByText, findByText, isVisibleNow, isVisibleText, px, scrollableContaining, swipe, swipeElement, tapText, waitForLoading, screenshot, windowSize } from '../../support/ui';
import { closeOverlay, isExpressHome, openDetailFromImage, scrollHomeToTop, tapElement } from '../../support/flows';
import { screenNodes, visibleCards, visibleCarousels, type Card } from '../../support/products';
import { ctx } from '../../support/context';

const MAX_CAROUSELS = Number(process.env.MAX_CAROUSELS || 3);

/** Carruseles relevados en el escenario: título, tarjetas antes y después de deslizar. */
type CarouselCheck = { title: string; before: Card[]; after: Card[] };
const nav: { carousels: CarouselCheck[] } = { carousels: [] };

function describe(cards: Card[]) {
  return cards.map(c => `${c.name} (${c.price ?? 'SIN PRECIO'})`).join(' | ');
}

/** Tarjetas del carrusel cuyo título está en y (las tarjetas están debajo del título). */
async function carouselCards(titleY: number) {
  return visibleCards({ yMin: titleY + await px(50), yMax: titleY + await px(700) });
}

When('recorro los carruseles de la home', async () => {
  nav.carousels = [];
  const { height } = await windowSize();
  for (let i = 0; i < 15 && nav.carousels.length < MAX_CAROUSELS; i++) {
    for (const c of await visibleCarousels()) {
      if (nav.carousels.some(o => o.title === c.title)) continue;
      // Llevar el carrusel a la parte de arriba para que se vean las tarjetas completas
      if (c.y > height * 0.35) break;
      const before = await carouselCards(c.y);
      if (!before.length) continue;
      // Deslizar el carrusel: swipe sobre el scrollable que contiene su primer producto
      const row = await scrollableContaining(descPrefixSelector(`Product Name Camel ${before[0].name}`));
      if (!row) throw new Error(`No encontré el contenedor deslizable del carrusel "${c.title}"`);
      await swipeElement(row, 'left');
      // Las tarjetas que entran al deslizar cargan el precio un momento después: esperar hasta 5 s
      let after: Card[] = [];
      await driver.waitUntil(async () => {
        const [again] = (await visibleCarousels()).filter(o => o.title === c.title);
        after = again ? await carouselCards(again.y) : [];
        return after.length > 0 && after.every(p => p.price);
      }, { timeout: 5_000, interval: 700 }).catch(() => {});
      nav.carousels.push({ title: c.title, before, after });
      console.log(`Carrusel "${c.title}": ${describe(before)}  →  después de deslizar: ${describe(after)}`);
      await screenshot(`carrusel-${nav.carousels.length}`);
      if (nav.carousels.length >= MAX_CAROUSELS) break;
    }
    await swipe('up', 0.4);
    await waitForLoading(3_000);
  }
  expect(nav.carousels.length).toBeGreaterThan(0);
});

Then('cada carrusel muestra productos con nombre y precio', async () => {
  for (const c of nav.carousels) {
    const sinPrecio = c.before.filter(p => !p.price);
    expect(c.before.length).toBeGreaterThan(0);
    if (sinPrecio.length) throw new Error(`El carrusel "${c.title}" tiene productos sin precio: ${describe(sinPrecio)}`);
  }
});

Then('los carruseles se deslizan mostrando productos nuevos', async () => {
  for (const c of nav.carousels) {
    const nuevos = c.after.filter(a => !c.before.some(b => b.name === a.name));
    if (!nuevos.length) throw new Error(`El carrusel "${c.title}" no mostró productos nuevos al deslizar`);
    const sinPrecio = nuevos.filter(p => !p.price);
    if (sinPrecio.length) throw new Error(`Al deslizar "${c.title}" aparecieron productos sin precio: ${describe(sinPrecio)}`);
  }
});

When('abro {string} del primer carrusel de la home', async (button: string) => {
  for (let i = 0; i < 6 && !(await visibleCarousels()).length; i++) await swipe('up', 0.4);
  const [first] = await visibleCarousels();
  if (!first) throw new Error('No encontré carruseles en la home');
  ctx.screenBefore = [first.title];
  const ver = (await findAllByText([button])).find(b => Math.abs(b.y - first.y) < 80);
  if (!ver) throw new Error(`No encontré "${button}" en el carrusel "${first.title}"`);
  console.log(`Abriendo "${button}" de "${first.title}"`);
  await (ver.el).click();
  await waitForLoading();
  await driver.pause(2_000);
});

Then('veo al menos {int} productos con nombre y precio', async (min: number) => {
  await waitForLoading();
  // Esperar a que la grilla termine de cargar (al principio se ve vacía y oscurecida)
  let cards: Card[] = [];
  const want = Math.min(min, 4);
  await driver.waitUntil(async () => (cards = await visibleCards()).length >= Math.min(want, 2), { timeout: 30_000, interval: 1_500 }).catch(() => {});
  // Pantalla chica (iPhone 8: grilla de 2 columnas, entran 2 tarjetas completas): bajar juntando tarjetas y volver
  let swipes = 0;
  for (; swipes < 3 && cards.length && cards.length < want; swipes++) {
    await swipe('up', 0.4);
    for (const c of await visibleCards()) if (!cards.some(o => o.name === c.name)) cards.push(c);
  }
  for (let i = 0; i < swipes; i++) await swipe('down', 0.4);
  console.log(`Productos: ${describe(cards)}`);
  expect(cards.length).toBeGreaterThanOrEqual(Math.min(min, 4));
  const sinPrecio = cards.filter(c => !c.price);
  if (sinPrecio.length) throw new Error(`Productos sin precio: ${describe(sinPrecio)}`);
});

Then('puedo volver a la home', async () => {
  await closeOverlay();
  // La home vuelve scrolleada (la barra de domicilio puede quedar fuera de pantalla)
  await findByText([...T.home, ...T.homeExpress, 'Prod List Title', ...T.appCargada], 20_000);
  expect(await isVisibleText(T.imagenDetalle, 1_000)).toBe(false);
  // Vuelve a la home del mismo mundo (no a la del otro: la home vuelve scrolleada, se sube para ver la franja de Express)
  if (ctx.world) {
    await scrollHomeToTop();
    const enExpress = await isExpressHome();
    if (enExpress !== (ctx.world === 'Express')) throw new Error(`Al volver desde ${ctx.world} la app quedó en la home de ${enExpress ? 'Express' : 'Super'}`);
  }
});

When('entro al detalle de un producto de un carrusel de la home', async () => {
  for (let i = 0; i < 8; i++) {
    const maxY = await px(900);
    const [c] = (await visibleCarousels()).filter(o => o.y < maxY);
    if (c) {
      const [card] = await carouselCards(c.y);
      if (card) {
        console.log(`Detalle de "${card.name}" (${card.price}) del carrusel "${c.title}"`);
        ctx.lastSearch = undefined;
        (ctx as any).detailName = card.name;
        (ctx as any).detailPrice = card.price;
        // Imagen de la tarjeta: el "Var Product Image" de la misma columna, justo arriba del nombre
        // (con el carrusel deslizado hay tarjetas cortadas a los costados: se busca la de la misma columna)
        let image: WebdriverIO.Element | undefined;
        const [above, column] = [await px(450), await px(120)];
        for (const i of (await findAllByText(T.imagenEnGrilla)).filter(i => i.y < card.y1 && i.y > card.y1 - above)) {
          if (Math.abs((await i.el.getLocation()).x - card.x1) < column) { image = i.el; break; }
        }
        if (image) {
          await openDetailFromImage(image);
          if (await isVisibleText(T.imagenDetalle, 8_000)) return;
        }
      }
    }
    await swipe('up', 0.4);
  }
  throw new Error('No pude abrir el detalle de ningún producto de los carruseles');
});

Then('el detalle muestra imagen, nombre, código de caja, EAN, precio y agregar al carrito', async () => {
  await findByText(T.imagenDetalle, 15_000);
  const checks: [string, RegExp][] = [
    ['nombre', /^desc:Product Name Camel /m],
    ['código de caja', /^text:Código de Caja: \d+$/m],
    ['EAN', /^text:EAN: \d+$/m],
    ['precio', /^text:(\$|U\$S)\s*[\d.,]+$/m],
    // "Agregar al carrito" o, si ya está en el carrito, el selector de cantidad ("1 ud." / "1,0 kg"; iOS "1.0 kg")
    ['agregar al carrito', /^text:(Agregar al carrito|\d+ ud\.|[\d.,]+ kg)$/m],
  ];
  // El detalle carga por partes (el precio aparece después, con un ícono de recarga mientras tanto)
  let texts = '';
  let faltantes: string[] = [];
  await driver.waitUntil(async () => {
    // Una línea por texto / nombre de control (el XML del page source es distinto en Android y en iOS)
    texts = (await screenNodes()).flatMap(n => [`desc:${n.desc}`, `text:${n.text}`]).join('\n');
    faltantes = checks.filter(([, re]) => !re.test(texts)).map(([n]) => n);
    return !faltantes.length;
  }, { timeout: 15_000, interval: 1_000 }).catch(() => {});
  if (faltantes.length) throw new Error(`Al detalle del producto le falta: ${faltantes.join(', ')}`);
  // El precio del detalle coincide con el de la tarjeta (si veníamos de un carrusel)
  const cardPrice = (ctx as any).detailPrice as string | undefined;
  if (cardPrice) {
    const amount = cardPrice.replace(/\s+/g, ' ');
    expect(texts.split('\n').includes(`text:${amount}`)).toBe(true);
  }
});

const RELACIONADOS = ['Otros clientes también vieron', 'también compraron', 'Relacionados'];

Then('el detalle muestra productos relacionados con precio', async () => {
  // Los relacionados están al final del detalle (debajo de descripción, info nutricional y especificaciones)
  for (let i = 0; i < 10 && !(await isVisibleNow(RELACIONADOS)); i++) {
    if (!(await swipe('up', 0.6))) break;
  }
  const header = await findByText(RELACIONADOS, 15_000);
  // Subir el carrusel de relacionados para que las tarjetas se vean enteras
  const { height } = await windowSize();
  if ((await header.getLocation()).y > height * 0.4) await swipe('up', 0.3);
  await driver.pause(1_000);
  const cards = await visibleCards();
  console.log(`Relacionados: ${describe(cards)}`);
  expect(cards.length).toBeGreaterThan(0);
  const sinPrecio = cards.filter(c => !c.price);
  if (sinPrecio.length) throw new Error(`Productos relacionados sin precio: ${describe(sinPrecio)}`);
});

When('scrolleo la búsqueda {int} veces', async (times: number) => {
  const pages: Card[][] = [await visibleCards()];
  for (let i = 0; i < times; i++) {
    await swipe('up', 0.6);
    await waitForLoading(10_000);
    await driver.pause(1_000);
    pages.push(await visibleCards());
  }
  (ctx as any).pages = pages;
});

Then('en cada scroll aparecen productos nuevos con precio', async () => {
  const pages = (ctx as any).pages as Card[][];
  const seen = new Set(pages[0].map(c => c.name));
  pages.slice(1).forEach((page, i) => {
    const nuevos = page.filter(c => !seen.has(c.name));
    console.log(`Scroll ${i + 1}: ${nuevos.length} productos nuevos — ${describe(nuevos)}`);
    if (!nuevos.length) throw new Error(`En el scroll ${i + 1} no aparecieron productos nuevos`);
    const sinPrecio = nuevos.filter(c => !c.price);
    if (sinPrecio.length) throw new Error(`En el scroll ${i + 1} hay productos sin precio: ${describe(sinPrecio)}`);
    page.forEach(c => seen.add(c.name));
  });
});

// --- Filtros ---

async function openFilters() {
  await tapText(['Filtrar']);
  // El panel abre vacío y carga las opciones después
  await findByText(['Categorías', 'Marcas'], 20_000);
}

/**
 * La X flotante cierra el panel de filtros. No tiene id ni accessibility: es el FrameLayout clickeable
 * hermano del contenido que tiene el título "Filtros".
 */
const CLOSE_FILTERS_XPATH = "//*[.//*[@text='Filtros']]/following-sibling::*/android.widget.FrameLayout[@clickable='true'][.//android.widget.ImageView]";

/**
 * iOS: la X es un botón flotante abajo al centro del panel (imagen sin nombre de ~90x90, relevado en iPhone 8),
 * no un hermano del título como en Android.
 */
async function iosCloseFiltersButtons() {
  if (!(await isVisibleNow(['Filtros']))) return [];
  const { width } = await windowSize();
  const found: WebdriverIO.Element[] = [];
  for (const el of await $$("-ios predicate string:type == 'XCUIElementTypeImage' AND rect.width > 60 AND rect.width < 120 AND rect.height > 60 AND rect.height < 120")) {
    const r = await driver.getElementRect(el.elementId);
    if (Math.abs(r.x + r.width / 2 - width / 2) < width * 0.15) found.push(el);
  }
  return found;
}

async function closeFilters() {
  // Mientras el panel recarga (diálogo con el ↻) la X no está accesible
  let close: WebdriverIO.ElementArray | WebdriverIO.Element[] = [];
  const find = async () => driver.isAndroid ? $$(CLOSE_FILTERS_XPATH) : iosCloseFiltersButtons();
  await driver.waitUntil(async () => (close = await find()).length > 0, { timeout: 20_000, interval: 500 }).catch(() => {});
  if (!close.length) throw new Error('No encontré la X para cerrar el panel de filtros');
  await tapElement(close[close.length - 1]);
  await findByText(['Filtrar'], 15_000);
  await waitForCards();
}

/**
 * Espera a que la grilla muestre tarjetas (después de buscar / filtrar se ve vacía y oscurecida un rato).
 * No se usa waitForLoading: el panel de filtros deja un ProgressBar que no desaparece y se comía 30 s.
 */
async function waitForCards(timeout = 30_000) {
  let cards: Card[] = [];
  await driver.waitUntil(async () => (cards = await visibleCards()).length > 0, { timeout, interval: 1_000 }).catch(() => {});
  return cards;
}

When('filtro por la marca {string}', async (brand: string) => {
  await openFilters();
  for (let i = 0; i < 6 && !(await isVisibleText([`Brand Description ${brand}`], 1_500)); i++) await swipe('up', 0.4);
  await tapText([`Brand Description ${brand}`]);
  await waitForLoading(5_000);
  await screenshot('filtro-marca');
  await closeFilters();
});

Then('todos los productos de los resultados son de la marca {string}', async (brand: string) => {
  const re = new RegExp(brand, 'i');
  for (let i = 0; i < 3; i++) {
    const cards = await visibleCards();
    console.log(`Filtrado por ${brand} (pantalla ${i + 1}): ${describe(cards)}`);
    expect(cards.length).toBeGreaterThan(0);
    const otras = cards.filter(c => !re.test(c.name));
    if (otras.length) throw new Error(`Con el filtro "${brand}" aparecen productos de otras marcas: ${describe(otras)}`);
    const sinPrecio = cards.filter(c => !c.price);
    if (sinPrecio.length) throw new Error(`Productos sin precio: ${describe(sinPrecio)}`);
    await swipe('up', 0.6);
    await waitForLoading(10_000);
  }
});

When('quito los filtros', async () => {
  // Volver arriba hasta ver "Filtrar" (o hasta que no se pueda subir más)
  for (let i = 0; i < 6 && !(await isVisibleNow(['Filtrar'])); i++) {
    await swipe('down', 0.7);
  }
  await openFilters();
  await tapText(['Quitar Filtros']);
  await waitForLoading(5_000);
  await closeFilters();
});

Then('hay productos de otras marcas además de {string}', async (brand: string) => {
  const re = new RegExp(brand, 'i');
  for (let i = 0; i < 4; i++) {
    const cards = await visibleCards();
    if (cards.some(c => !re.test(c.name))) return;
    await swipe('up', 0.6);
  }
  throw new Error(`Después de quitar los filtros sólo se ven productos "${brand}"`);
});

When('filtro por la categoría {string}', async (category: string) => {
  (ctx as any).beforeFilter = (await waitForCards()).map(c => c.name);
  await openFilters();
  // La categoría dentro del panel (debajo de "Categorías"), no el chip de los resultados que queda detrás
  const [header] = await findAllByText(['Categorías']);
  const option = (await findAllByText([category])).find(o => o.y > header.y);
  if (!option) throw new Error(`No encontré la categoría "${category}" en los filtros`);
  await tapElement(option.el);
  await waitForLoading(5_000);
  await screenshot('filtro-categoria');
  await closeFilters();
});

Then('la búsqueda muestra sólo la categoría {string} con productos con precio', async (category: string) => {
  // Con la categoría aplicada, el chip de esa categoría queda como único chip (o el primero)
  const chips = (await findAllByText(['Text '])).map(c => c.y);
  console.log(`Chips de categoría visibles: ${chips.length}`);
  const cards = await waitForCards();
  console.log(`Filtrado por ${category}: ${describe(cards)}`);
  expect(cards.length).toBeGreaterThan(0);
  const sinPrecio = cards.filter(c => !c.price);
  if (sinPrecio.length) throw new Error(`Productos sin precio: ${describe(sinPrecio)}`);
  // Al filtrar, los chips pasan a ser subcategorías: se valida que el resultado cambió y tiene precio. Si los primeros
  // productos ya eran de esa categoría (ej. "leche" en Frescos; en el iPhone 8 entran sólo 2 tarjetas) la grilla
  // puede no cambiar: entonces se confirma en el panel que el filtro quedó aplicado
  const before = (ctx as any).beforeFilter as string[];
  if (cards.map(c => c.name).join('|') === before.join('|')) {
    await openFilters();
    const aplicado = await isVisibleText(['Resultados filtrados por'], 5_000);
    const [header] = await findAllByText(['Resultados filtrados por']);
    const enFiltro = header && (await findAllByText([category])).some(o => o.y > header.y);
    await closeFilters();
    if (!aplicado || !enFiltro) throw new Error(`El filtro por "${category}" no quedó aplicado (la grilla no cambió y el panel no lo muestra)`);
    console.log(`La grilla no cambió (los primeros ya eran de ${category}); el panel muestra el filtro aplicado`);
  }
});
