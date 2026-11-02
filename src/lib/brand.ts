// Isotipo de Cale: doble tilde sobre una ficha negra. El tilde tenue es el recordatorio enviado y el pleno es el
// cliente que confirmó. Esta es la fuente única del dibujo: Brand.astro lo pinta con los tokens, y
// scripts/brand-assets.ts genera de acá el favicon y los PNG (manual en docs/brand/manual-de-marca.md).

// Mismos valores que --ink y --accent de styles/tokens.css; tests/brand.test.ts controla que no se separen
export const BRAND_COLORS = {
  ink: '#15191c',
  accent: '#25d366',
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

interface MarkSvgOptions {
  // A sangre y sin esquinas redondeadas: para íconos que cada plataforma enmascara por su cuenta
  fullBleed?: boolean;
}

// SVG autónomo (colores fijos) para el favicon y los PNG; el encabezado del sitio usa Brand.astro
export function markSvg({ fullBleed = false }: MarkSvgOptions = {}): string {
  const { ink, accent } = BRAND_COLORS;
  const radius = fullBleed ? '' : ` rx="${MARK_RADIUS}"`;
  const ticks = MARK_TICKS.map(({ points, opacity }) => {
    const fade = opacity < 1 ? ` stroke-opacity="${opacity}"` : '';
    return `<path d="${tickPath(points)}"${fade}/>`;
  }).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_SIZE} ${MARK_SIZE}">` +
    `<rect width="${MARK_SIZE}" height="${MARK_SIZE}"${radius} fill="${ink}"/>` +
    `<g fill="none" stroke="${accent}" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round">${ticks}</g>` +
    `</svg>\n`
  );
}
