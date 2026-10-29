// Todo lo que el código del navegador lee de `import.meta.env` termina en el JS público. Pasar el objeto entero
// (`import.meta.env`) incrusta TODAS las variables PUBLIC_ del build, y Vercel agrega las suyas (PUBLIC_VERCEL_*: mensaje
// del commit, autor, IDs de proyecto). Visto en producción el 29/10/2026. Se lee siempre una variable puntual.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(import.meta.dirname, '..', 'src');
// Variables públicas que el navegador puede leer a propósito
const ALLOWED_PUBLIC_VARIABLES = ['PUBLIC_TURNSTILE_SITE_KEY'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|astro)$/.test(name) ? [path] : [];
  });
}

const FILES = sourceFiles(SRC_DIR);

describe('import.meta.env en el código del sitio', () => {
  it('encuentra los archivos a revisar', () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it.each(FILES.map((file) => [file.slice(SRC_DIR.length + 1), file]))('%s no usa el objeto import.meta.env entero', (_name, file) => {
    const usages = [...readFileSync(file, 'utf8').matchAll(/import\.meta\.env(\.\w+)?/g)];
    for (const [usage, property] of usages) {
      expect(property, `${usage} pasa todo el entorno al JS público: leé una variable puntual`).toBeDefined();
    }
  });

  it.each(FILES.map((file) => [file.slice(SRC_DIR.length + 1), file]))('%s solo lee variables públicas permitidas', (_name, file) => {
    const properties = [...readFileSync(file, 'utf8').matchAll(/import\.meta\.env\.(\w+)/g)].map((match) => match[1]);
    for (const property of properties) {
      expect(ALLOWED_PUBLIC_VARIABLES, `${property} no está en la lista de variables públicas`).toContain(property);
    }
  });
});
