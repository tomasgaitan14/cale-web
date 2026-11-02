// Colores del diseño y contraste de WCAG 2.x, compartidos por los tests de contraste y de marca.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const tokens = readFileSync(join(import.meta.dirname, '..', '..', 'src', 'styles', 'tokens.css'), 'utf8');

export function token(name: string): string {
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

export function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}
