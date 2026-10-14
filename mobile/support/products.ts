/**
 * Lectura de tarjetas de producto desde el page source (Android).
 * Una tarjeta = nombre (content-desc "Product Name Camel <nombre>") + precio ("$ 328", "U$S 429")
 * en la misma columna, debajo del nombre.
 */

interface Node { text: string; desc: string; x1: number; y1: number; x2: number; y2: number }

function parseNodes(src: string): Node[] {
  const nodes: Node[] = [];
  for (const m of src.matchAll(/<[\w.]+ [^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*>/g)) {
    const tag = m[0];
    const attr = (k: string) => (tag.match(new RegExp(`${k}="([^"]*)"`)) ?? [])[1] ?? '';
    nodes.push({ text: decode(attr('text')), desc: decode(attr('content-desc')), x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] });
  }
  return nodes;
}

function decode(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;/g, ' ');
}

const PRICE = /^\s*(\$|U\$S)\s*[\d.,]+\s*$/;

export interface Card { name: string; price?: string; x1: number; y1: number; x2: number; y2: number }

/** Tarjetas de producto completamente visibles en pantalla, con su precio (si lo tiene). */
export async function visibleCards(region?: { yMin: number; yMax: number }): Promise<Card[]> {
  const { width, height } = await driver.getWindowSize();
  const nodes = parseNodes(await driver.getPageSource());
  const prices = nodes.filter(n => PRICE.test(n.text));
  const cards: Card[] = [];
  for (const n of nodes) {
    const m = n.desc.match(/^Product Name Camel (.+)$/);
    if (!m) continue;
    // Sólo tarjetas enteras dentro de la pantalla (las cortadas en el borde no tienen el precio visible)
    if (n.x1 < 0 || n.x2 > width - 5 || n.y1 < 0 || n.y2 > height * 0.92) continue;
    if (n.x2 - n.x1 < 150) continue;
    if (region && (n.y1 < region.yMin || n.y1 > region.yMax)) continue;
    const price = prices.find(p => p.x1 >= n.x1 - 20 && p.x1 < n.x2 && p.y1 >= n.y1 && p.y1 <= n.y1 + 500);
    // Tarjeta pegada al borde de abajo: el precio puede quedar fuera de pantalla, no se puede evaluar
    if (!price && n.y2 > height * 0.75) continue;
    cards.push({ name: m[1].trim(), price: price?.text.trim(), x1: n.x1, y1: n.y1, x2: n.x2, y2: n.y2 });
  }
  // Sin duplicados (algunas tarjetas aparecen dos veces en el árbol con enableMultiWindows)
  return cards.filter((c, i) => cards.findIndex(o => o.name === c.name && Math.abs(o.y1 - c.y1) < 10) === i);
}

/** Títulos de carruseles visibles ("Prod List Title ¡Imperdibles de la Semana!") con su posición. */
export async function visibleCarousels(): Promise<{ title: string; y: number }[]> {
  const { height } = await driver.getWindowSize();
  return parseNodes(await driver.getPageSource())
    .map(n => ({ m: n.desc.match(/^Prod List Title (.+)$/), y: n.y1 }))
    .filter(n => n.m && n.y > 150 && n.y < height * 0.6)
    .map(n => ({ title: n.m![1].trim(), y: n.y }))
    .filter((c, i, all) => all.findIndex(o => o.title === c.title) === i);
}

/** Montos del resumen de "Confirmar Pedido": [{ label, amount }] en orden. */
export async function orderSummary(): Promise<{ label: string; amount: number }[]> {
  const nodes = parseNodes(await driver.getPageSource()).filter(n => n.text);
  const lines: { label: string; amount: number }[] = [];
  for (const label of nodes.filter(n => /^(SubTotal|Total|Gastos de .+|Descuento.*|Cupón.*|Bonificación.*)$/i.test(n.text.trim()))) {
    // El monto está en la misma fila, a la derecha del label
    const amount = nodes.find(n => n !== label && Math.abs(n.y1 - label.y1) < 40 && n.x1 > label.x1 && /[\d]/.test(n.text) && /\$/.test(n.text));
    if (!amount) continue;
    const negative = /^\s*-/.test(amount.text);
    const value = parseFloat(amount.text.replace(/[^\d,]/g, '').replace(',', '.'));
    lines.push({ label: label.text.trim(), amount: negative ? -value : value });
  }
  return lines.filter((l, i) => lines.findIndex(o => o.label === l.label) === i);
}
