// Isotipo de Cale: doble tilde sobre una ficha negra. El tilde tenue es el recordatorio enviado y el pleno es el
// cliente que confirmó. Esta es la fuente única del dibujo: Brand.astro lo pinta con los tokens, y
// scripts/brand-assets.ts genera de acá el favicon, el lockup y los PNG (manual en docs/brand/manual-de-marca.md).
import {
  WORDMARK_BASELINE_BELOW_CENTER,
  WORDMARK_EM,
  WORDMARK_PATH,
  WORDMARK_RIGHT_EDGE,
} from './wordmark.ts';

// Mismos valores que --ink, --accent y --bg de styles/tokens.css; tests/brand.test.ts controla que no se separen
export const BRAND_COLORS = {
  ink: '#15191c',
  accent: '#25d366',
  cream: '#f7f4ee',
} as const;

// Cuadrícula del isotipo: ficha de 64 × 64 con esquinas del 28 %
export const MARK_SIZE = 64;
export const MARK_RADIUS = 18;
export const MARK_STROKE = 6.5;

export type MarkPoint = readonly [x: number, y: number];

export interface MarkTick {
  points: readonly [MarkPoint, MarkPoint, MarkPoint];
  opacity: number;
}

export const MARK_TICKS: readonly [MarkTick, MarkTick] = [
  {
    points: [
      [11, 33],
      [21, 43],
      [40, 21.5],
    ],
    opacity: 0.45,
  },
  {
    points: [
      [24, 33],
      [34, 43],
      [53, 21.5],
    ],
    opacity: 1,
  },
];

export function tickPath(points: MarkTick['points']): string {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join('');
}

// Ícono de pantalla de inicio de iOS (a sangre): también es el logo de los datos estructurados
export const APPLE_TOUCH_ICON = { path: '/apple-touch-icon.png', size: 180 } as const;

const SVG_NAMESPACE ='xmlns="http://www.w3.org/2000/svg"';
const SVG_DECIMALS = 2;

const round = (value: number): number => Number(value.toFixed(SVG_DECIMALS));

// La ficha y los tildes, con colores fijos. A sangre = sin esquinas redondeadas: para íconos que cada plataforma
// enmascara por su cuenta
function markShapes(fullBleed: boolean): string {
  const { ink, accent } = BRAND_COLORS;
  const radius = fullBleed ? '' : ` rx="${MARK_RADIUS}"`;
  const ticks = MARK_TICKS.map(({ points, opacity }) => {
    const fade = opacity < 1 ? ` stroke-opacity="${opacity}"` : '';
    return `<path d="${tickPath(points)}"${fade}/>`;
  }).join('');
  return (
    `<rect width="${MARK_SIZE}" height="${MARK_SIZE}"${radius} fill="${ink}"/>` +
    `<g fill="none" stroke="${accent}" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round">${ticks}</g>`
  );
}

interface MarkSvgOptions {
  fullBleed?: boolean;
}

// SVG autónomo para el favicon y los PNG; el encabezado del sitio usa Brand.astro
export function markSvg({ fullBleed = false }: MarkSvgOptions = {}): string {
  return `<svg ${SVG_NAMESPACE} viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}">${markShapes(fullBleed)}</svg>\n`;
}

// Lockup horizontal (isotipo + nombre): las proporciones del encabezado del sitio (Brand.astro), con el isotipo de
// 34 px, el texto de 24 px y 9 px de separación
const LOCKUP_MARK_PX = 34;
const LOCKUP_TEXT_PX = 24;
const LOCKUP_GAP_PX = 9;
const LOCKUP_TEXT_EM = (MARK_SIZE * LOCKUP_TEXT_PX) / LOCKUP_MARK_PX;
const LOCKUP_GAP = (MARK_SIZE * LOCKUP_GAP_PX) / LOCKUP_MARK_PX;
const LOCKUP_TEXT_SCALE = LOCKUP_TEXT_EM / WORDMARK_EM;

export const LOCKUP_WIDTH = round(MARK_SIZE + LOCKUP_GAP + WORDMARK_RIGHT_EDGE * LOCKUP_TEXT_SCALE);

function lockupShapes(): string {
  const baselineY = MARK_SIZE / 2 + WORDMARK_BASELINE_BELOW_CENTER * LOCKUP_TEXT_EM;
  const transform = `translate(${round(MARK_SIZE + LOCKUP_GAP)} ${round(baselineY)}) scale(${round(LOCKUP_TEXT_SCALE * 1000) / 1000})`;
  return `${markShapes(false)}<path transform="${transform}" fill="${BRAND_COLORS.ink}" d="${WORDMARK_PATH}"/>`;
}

// Archivo suelto para usar el logo fuera del sitio, con el nombre en trazos: fondo transparente, para fondos claros
export function lockupSvg(): string {
  return `<svg ${SVG_NAMESPACE} viewBox="0 0 ${LOCKUP_WIDTH} ${MARK_SIZE}">${lockupShapes()}</svg>\n`;
}

// Imagen para compartir el enlace (Open Graph): 1200 × 630, el lockup centrado sobre el crema del sitio
export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630, alt: 'Cale, recordatorios de turnos por WhatsApp' } as const;
const OG_LOCKUP_WIDTH_RATIO = 0.6;

export function ogImageSvg(): string {
  const scale = (OG_IMAGE.width * OG_LOCKUP_WIDTH_RATIO) / LOCKUP_WIDTH;
  const x = (OG_IMAGE.width - LOCKUP_WIDTH * scale) / 2;
  const y = (OG_IMAGE.height - MARK_SIZE * scale) / 2;
  return (
    `<svg ${SVG_NAMESPACE} viewBox="0 0 ${OG_IMAGE.width} ${OG_IMAGE.height}">` +
    `<rect width="${OG_IMAGE.width}" height="${OG_IMAGE.height}" fill="${BRAND_COLORS.cream}"/>` +
    `<g transform="translate(${round(x)} ${round(y)}) scale(${round(scale)})">${lockupShapes()}</g>` +
    `</svg>\n`
  );
}
