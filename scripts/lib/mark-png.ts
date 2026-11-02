// Rasteriza el isotipo y la imagen para compartir a PNG opacos. Lo usan scripts/brand-assets.ts y tests/brand.test.ts,
// para que el test compare los PNG guardados contra lo que genera el código de hoy.
import sharp from 'sharp';
import { BRAND_COLORS, MARK_SIZE, OG_IMAGE, markSvg, ogImageSvg } from '../../src/lib/brand.ts';

const SVG_DPI = 72;

// density alto: librsvg rasteriza el SVG ya al tamaño final, sin escalar un bitmap chico.
// flatten: sin canal alfa, que iOS, Meta y las vistas previas de enlaces piden opaco.
async function rasterize(svg: string, svgWidth: number, width: number, height: number): Promise<Buffer> {
  const density = (SVG_DPI * width) / svgWidth;
  return sharp(Buffer.from(svg), { density })
    .resize(width, height)
    .flatten({ background: BRAND_COLORS.ink })
    .png()
    .toBuffer();
}

// Cuadrado a sangre (sin esquinas redondeadas)
export function renderMarkPng(size: number): Promise<Buffer> {
  return rasterize(markSvg({ fullBleed: true }), MARK_SIZE, size, size);
}

export function renderOgPng(): Promise<Buffer> {
  return rasterize(ogImageSvg(), OG_IMAGE.width, OG_IMAGE.width, OG_IMAGE.height);
}
