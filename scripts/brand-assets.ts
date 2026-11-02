// Genera los archivos de marca desde src/lib/brand.ts: `npm run brand`.
// Van a public/ (se publican) el favicon, el apple-touch-icon y la imagen para compartir; a docs/brand/ (no se
// publican), el lockup y los PNG para Meta.
import { mkdirSync, writeFileSync } from 'node:fs';
import { lockupSvg, markSvg } from '../src/lib/brand.ts';
import { BRAND_DOCS_DIR, BRAND_PNGS, FAVICON_PATH, LOCKUP_PATH, OG_IMAGE_PATH } from './lib/brand-files.ts';
import { renderMarkPng, renderOgPng } from './lib/mark-png.ts';

mkdirSync(BRAND_DOCS_DIR, { recursive: true });
writeFileSync(FAVICON_PATH, markSvg());
writeFileSync(LOCKUP_PATH, lockupSvg());
writeFileSync(OG_IMAGE_PATH, await renderOgPng());
for (const { path, size } of Object.values(BRAND_PNGS)) {
  writeFileSync(path, await renderMarkPng(size));
}
console.log('Archivos de marca generados.');
