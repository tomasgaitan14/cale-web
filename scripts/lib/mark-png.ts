// Rasteriza el isotipo a un PNG cuadrado, opaco y a sangre. Lo usan scripts/brand-assets.ts y tests/brand.test.ts,
// para que el test compare los PNG guardados contra lo que genera el código de hoy.
import sharp from 'sharp';
import { BRAND_COLORS, MARK_SIZE, markSvg } from '../../src/lib/brand.ts';

const SVG_DPI = 72;

export async function renderMarkPng(size: number): Promise<Buffer> {
  // density alto: librsvg rasteriza el SVG ya al tamaño final, sin escalar un bitmap chico
  const density = (SVG_DPI * size) / MARK_SIZE;
  // flatten: sin canal alfa, que iOS y Meta piden opaco
  return sharp(Buffer.from(markSvg({ fullBleed: true })), { density })
    .resize(size, size)
    .flatten({ background: BRAND_COLORS.ink })
    .png()
    .toBuffer();
}
