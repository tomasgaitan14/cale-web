// Genera los archivos de marca desde src/lib/brand.ts: `npm run brand`.
// El favicon y el apple-touch-icon van a public/ (se publican); los PNG para Meta, a docs/brand/ (no se publican).
import { mkdirSync, writeFileSync } from 'node:fs';
import { markSvg } from '../src/lib/brand.ts';
import { BRAND_DOCS_DIR, BRAND_PNGS, FAVICON_PATH } from './lib/brand-files.ts';
import { renderMarkPng } from './lib/mark-png.ts';

mkdirSync(BRAND_DOCS_DIR, { recursive: true });
writeFileSync(FAVICON_PATH, markSvg());
for (const { path, size } of Object.values(BRAND_PNGS)) {
  writeFileSync(path, await renderMarkPng(size));
}
console.log('Archivos de marca generados.');
