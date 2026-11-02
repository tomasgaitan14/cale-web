// Marca de Cale: el isotipo (src/lib/brand.ts) tiene que ser el mismo en el encabezado, el favicon y los PNG,
// usar los colores del diseño y verse bien a tamaño chico y recortado en círculo (foto de perfil de WhatsApp).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import {
  BRAND_COLORS,
  LOCKUP_WIDTH,
  MARK_SIZE,
  MARK_STROKE,
  MARK_TICKS,
  OG_IMAGE,
  lockupSvg,
  markSvg,
  tickPath,
} from '../src/lib/brand';
import { BRAND_PNGS, FAVICON_PATH, LOCKUP_PATH, OG_IMAGE_PATH } from '../scripts/lib/brand-files';
import { renderMarkPng, renderOgPng } from '../scripts/lib/mark-png';
import { contrast, token } from './support/color';
import { PNG_COLOR_TYPE_RGB, differentPixelRatio, pngInfo } from './support/png';

const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const NON_TEXT_CONTRAST = 3;
// El tilde tenue (recordatorio enviado) es decorativo, pero tiene que distinguirse de la ficha
const FADED_TICK_CONTRAST = 2.5;
const MARK_CENTER = MARK_SIZE / 2;
// Los tildes tienen que entrar en el círculo inscrito con un margen del 12,5 %: WhatsApp recorta la foto en círculo
const CIRCLE_SAFE_RADIUS = MARK_CENTER * 0.875;
const CENTER_TOLERANCE = 0.5;
// Fracción de píxeles que puede diferir un PNG guardado del que sale hoy del código (suavizado de bordes entre máquinas)
const DIFFERENT_PIXELS_TOLERANCE = 0.005;
// Ancho sobre alto del lockup del encabezado (Brand.astro: isotipo de 34 px, 9 px de separación, texto de 24 px): unos 2,6.
// Si sale de este rango, cambió el dibujo, el espaciado o el trazo del nombre
const LOCKUP_RATIO = { min: 2.5, max: 2.7 };

const pages = (): string[] => readdirSync(DIST_DIR).filter((file) => file.endsWith('.html'));

function blend(foreground: string, background: string, opacity: number): string {
  const channels = [1, 3, 5].map((start) => {
    const fg = parseInt(foreground.slice(start, start + 2), 16);
    const bg = parseInt(background.slice(start, start + 2), 16);
    return Math.round(fg * opacity + bg * (1 - opacity));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

describe('colores de la marca', () => {
  it('brand.ts usa los mismos colores que los tokens del diseño', () => {
    expect(BRAND_COLORS.ink).toBe(token('ink').toLowerCase());
    expect(BRAND_COLORS.accent).toBe(token('accent').toLowerCase());
    expect(BRAND_COLORS.cream).toBe(token('bg').toLowerCase());
  });

  it('el tilde pleno se ve sobre la ficha (3:1) y el tenue se distingue de ella', () => {
    const faded = MARK_TICKS[0].opacity;
    expect(contrast(BRAND_COLORS.accent, BRAND_COLORS.ink)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    expect(contrast(blend(BRAND_COLORS.accent, BRAND_COLORS.ink, faded), BRAND_COLORS.ink)).toBeGreaterThanOrEqual(
      FADED_TICK_CONTRAST,
    );
  });

  it('el verde solo va sobre la ficha negra: sobre el fondo crema no llega a 3:1', () => {
    expect(contrast(BRAND_COLORS.accent, token('bg'))).toBeLessThan(NON_TEXT_CONTRAST);
  });
});

describe('geometría del isotipo', () => {
  const points = MARK_TICKS.flatMap((tick) => tick.points);

  it('son dos tildes: el primero tenue y el segundo pleno', () => {
    expect(MARK_TICKS).toHaveLength(2);
    expect(MARK_TICKS[0].opacity).toBeLessThan(1);
    expect(MARK_TICKS[1].opacity).toBe(1);
  });

  it('los tildes quedan centrados en la ficha', () => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - MARK_CENTER)).toBeLessThanOrEqual(CENTER_TOLERANCE);
    expect(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - MARK_CENTER)).toBeLessThanOrEqual(CENTER_TOLERANCE);
  });

  it('los tildes, con su grosor, entran en el círculo de la foto de perfil', () => {
    const farthest = Math.max(...points.map(([x, y]) => Math.hypot(x - MARK_CENTER, y - MARK_CENTER)));
    expect(farthest + MARK_STROKE / 2).toBeLessThanOrEqual(CIRCLE_SAFE_RADIUS);
  });

  it('tickPath arma el trazo con M y L en el orden de los puntos', () => {
    expect(tickPath([[1, 2], [3, 4.5], [5, 6]])).toBe('M1 2L3 4.5L5 6');
  });
});

describe('favicon', () => {
  it('es exactamente el SVG que genera brand.ts (corré `npm run brand` si cambió el dibujo)', () => {
    expect(readFileSync(FAVICON_PATH, 'utf8')).toBe(markSvg());
  });
});

describe('PNG de marca', () => {
  it.each(Object.entries(BRAND_PNGS))('%s existe, es cuadrado, del tamaño que pide la plataforma y opaco', (_name, { path, size }) => {
    expect(existsSync(path)).toBe(true);
    expect(pngInfo(readFileSync(path))).toEqual({ width: size, height: size, colorType: PNG_COLOR_TYPE_RGB });
  });

  it.each(Object.entries(BRAND_PNGS))('%s coincide con el isotipo actual (corré `npm run brand` si cambió)', async (_name, { path, size }) => {
    expect(await differentPixelRatio(readFileSync(path), await renderMarkPng(size))).toBeLessThanOrEqual(
      DIFFERENT_PIXELS_TOLERANCE,
    );
  });
});

describe('lockup e imagen para compartir', () => {
  it('el lockup es exactamente el SVG que genera brand.ts (corré `npm run brand` si cambió)', () => {
    expect(readFileSync(LOCKUP_PATH, 'utf8')).toBe(lockupSvg());
  });

  it('el lockup lleva el isotipo y el nombre en trazos, sin texto que dependa de una tipografía', () => {
    const svg = lockupSvg();
    expect(svg).not.toMatch(/<text|font-family/);
    expect(svg).toContain(tickPath(MARK_TICKS[1].points));
    expect(svg.match(/<path/g)).toHaveLength(MARK_TICKS.length + 1);
  });

  it('el lockup conserva las proporciones del encabezado', () => {
    expect(LOCKUP_WIDTH / MARK_SIZE).toBeGreaterThanOrEqual(LOCKUP_RATIO.min);
    expect(LOCKUP_WIDTH / MARK_SIZE).toBeLessThanOrEqual(LOCKUP_RATIO.max);
  });

  it('la imagen para compartir mide 1200 × 630, es opaca y coincide con el código actual', async () => {
    const saved = readFileSync(OG_IMAGE_PATH);
    expect(pngInfo(saved)).toEqual({ width: OG_IMAGE.width, height: OG_IMAGE.height, colorType: PNG_COLOR_TYPE_RGB });
    expect(await differentPixelRatio(saved, await renderOgPng())).toBeLessThanOrEqual(DIFFERENT_PIXELS_TOLERANCE);
  });
});

describe('isotipo en el sitio (dist/)', () => {
  it.each(pages())('%s: el encabezado usa el isotipo actual, decorativo y con el nombre en el enlace', (file) => {
    const root = parse(readFileSync(join(DIST_DIR, file), 'utf8'));
    const mark = root.querySelector('.home-link svg.brand-mark');
    expect(mark, 'falta el isotipo en el encabezado').not.toBeNull();
    expect(mark!.getAttribute('aria-hidden')).toBe('true');
    expect(mark!.getAttribute('viewBox')).toBe(`0 0 ${MARK_SIZE} ${MARK_SIZE}`);
    expect(mark!.querySelectorAll('path').map((path) => path.getAttribute('d'))).toEqual(
      MARK_TICKS.map((tick) => tickPath(tick.points)),
    );
    expect(root.querySelector('.home-link')!.getAttribute('aria-label')).toMatch(/inicio$/);
  });

  it.each(pages())('%s: declara el favicon y el apple-touch-icon', (file) => {
    const root = parse(readFileSync(join(DIST_DIR, file), 'utf8'));
    expect(root.querySelector('link[rel="icon"]')!.getAttribute('href')).toBe('/favicon.svg');
    expect(root.querySelector('link[rel="apple-touch-icon"]')!.getAttribute('href')).toBe('/apple-touch-icon.png');
  });

  it.each(['favicon.svg', 'apple-touch-icon.png'])('%s se publica en la raíz', (file) => {
    expect(existsSync(join(DIST_DIR, file))).toBe(true);
  });

  // La marca anterior era un ícono de Phosphor (span.icon) dentro del cuadrado negro
  it('el encabezado ya no usa un ícono de Phosphor como marca', () => {
    const offenders = pages().filter((file) => parse(readFileSync(join(DIST_DIR, file), 'utf8')).querySelector('.home-link .icon'));
    expect(offenders).toEqual([]);
  });
});
