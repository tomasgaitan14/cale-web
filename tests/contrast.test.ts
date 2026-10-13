// Público mayor: todo texto del sitio tiene contraste AAA (7:1 o más) sobre su fondo. Lee los colores de global.css.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AAA_RATIO = 7;
const css = readFileSync(join(import.meta.dirname, '..', 'src', 'styles', 'global.css'), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (!match?.[1]) throw new Error(`Falta el color --${name} en global.css`);
  return match[1];
}

// Luminancia relativa y contraste de WCAG 2.x
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

describe('contraste AAA', () => {
  it('el cálculo coincide con WCAG (negro sobre blanco es 21:1)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it.each([
    ['tinta sobre papel', 'color-ink', 'color-paper'],
    ['grafito sobre papel', 'color-graphite', 'color-paper'],
    ['"sin Cale" sobre su fondo', 'color-without', 'color-without-bg'],
    ['"con Cale" sobre su fondo', 'color-with', 'color-with-bg'],
    ['encabezado "sin Cale" sobre papel', 'color-without', 'color-paper'],
    ['encabezado "con Cale" sobre papel', 'color-with', 'color-paper'],
  ])('%s llega a 7:1', (_label, foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(AAA_RATIO);
  });
});
