// Contraste de los tokens del diseño (cale-app: docs/DISENO.md): AAA (7:1) en el texto principal, AA (4,5:1) en el resto
// del texto y 3:1 en los bordes de los campos (WCAG 1.4.11). Lee los colores de tokens.css.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AAA = 7;
const AA = 4.5;
const NON_TEXT = 3;
const SRC_DIR = join(import.meta.dirname, '..', 'src');
const tokens = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');

function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (!match?.[1]) throw new Error(`Falta el color --${name} en tokens.css`);
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

// Todos los archivos de estilos del sitio: global.css y los <style> de páginas, layouts y componentes
function styleSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return styleSources(path);
    return /\.(css|astro)$/.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
  });
}

describe('contraste de los tokens', () => {
  it('el cálculo coincide con WCAG (negro sobre blanco es 21:1)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it.each([
    ['texto sobre el fondo crema', 'text', 'bg', AAA],
    ['texto sobre blanco', 'text', 'surface', AAA],
    ['texto sobre negro', 'on-ink', 'ink', AAA],
    ['texto en avisos', 'text', 'callout', AAA],
    ['texto sobre el verde claro (burbujas de la clienta)', 'text', 'tint', AAA],
    ['secundario sobre el fondo crema', 'muted', 'bg', AA],
    ['secundario sobre blanco', 'muted', 'surface', AA],
    ['secundario en avisos', 'muted', 'callout', AA],
    ['secundario sobre negro', 'ink-muted', 'ink', AA],
    ['texto sobre el verde (botón)', 'on-accent', 'accent', AA],
    ['enlaces sobre el fondo crema', 'link', 'bg', AA],
    ['enlaces sobre blanco', 'link', 'surface', AA],
    ['verde oscuro sobre verde claro (íconos, pasos)', 'link', 'tint', AA],
    ['estado conectado', 'ok', 'ok-bg', AA],
    ['estado pendiente', 'pend', 'pend-bg', AA],
    ['estado requiere atención', 'warn', 'warn-bg', AA],
    ['estado activo', 'act', 'act-bg', AA],
    ['borde de campos sobre blanco', 'field-border', 'surface', NON_TEXT],
  ])('%s llega a %s:1', (_label, foreground, background, minimum) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(minimum);
  });

  // El verde WhatsApp no llega a 3:1 sobre blanco ni sobre crema: solo va de fondo o sobre negro
  it('el verde de acento nunca es color de texto', () => {
    const offenders = styleSources(SRC_DIR).flatMap((source) =>
      [...source.matchAll(/(?<![-\w])color:\s*var\(--accent\)/g)].map((match) => match[0]),
    );
    expect(offenders).toEqual([]);
  });
});
