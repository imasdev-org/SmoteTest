/**
 * Color dominante de un elemento (captura del elemento + PNG decodificado a mano, sin dependencias).
 * Se usa en iOS para saber en qué mundo está la app: la home de Express no tiene ningún texto ni nombre de
 * control que la distinga de la de Super, pero los íconos del header son rojos en Express y azules en Super.
 */
import { inflateSync } from 'node:zlib';

function decodePng(buf: Buffer) {
  let pos = 8, width = 0, height = 0, bpp = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      const [depth, colorType, , , interlace] = [data[8], data[9], data[10], data[11], data[12]];
      if (depth !== 8 || interlace !== 0 || ![2, 6].includes(colorType)) throw new Error(`PNG no soportado (depth ${depth}, color ${colorType})`);
      bpp = colorType === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      px[y * stride + x] = (line[x] + pred) & 0xff;
    }
  }
  return { width, height, bpp, px };
}

/** Promedio RGB de los píxeles "con color" del elemento (ignora fondo blanco / gris claro). */
export async function dominantColor(el: WebdriverIO.Element) {
  const { width, height, bpp, px } = decodePng(Buffer.from(await driver.takeElementScreenshot(el.elementId), 'base64'));
  let [r, g, b, n] = [0, 0, 0, 0];
  for (let i = 0; i < width * height; i++) {
    const [R, G, B] = [px[i * bpp], px[i * bpp + 1], px[i * bpp + 2]];
    if (Math.max(R, G, B) - Math.min(R, G, B) < 40) continue; // blancos, grises
    r += R; g += G; b += B; n++;
  }
  return n ? { r: r / n, g: g / n, b: b / n, n } : { r: 0, g: 0, b: 0, n: 0 };
}
