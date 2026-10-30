// La CSP (vercel.json) no admite scripts inline: un script chico incrustado en el HTML se rompe en producción. Vite
// incrusta los de menos de 4 KB salvo que assetsInlineLimit sea 0. Visto el 30/10/2026 con el script de las animaciones.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFIG = readFileSync(join(import.meta.dirname, '..', 'astro.config.ts'), 'utf8');

describe('astro.config.ts', () => {
  it('no deja que Vite incruste scripts en el HTML (assetsInlineLimit: 0)', () => {
    expect(CONFIG).toMatch(/assetsInlineLimit:\s*0\b/);
  });

  it('mantiene los estilos siempre en archivos externos', () => {
    expect(CONFIG).toContain("inlineStylesheets: 'never'");
  });
});
