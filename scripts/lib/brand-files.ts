// Archivos de marca que genera scripts/brand-assets.ts, con el tamaño que pide cada plataforma:
// iOS (pantalla de inicio), Meta (ícono de la app) y WhatsApp (foto de perfil).
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

export const FAVICON_PATH = join(ROOT, 'public', 'favicon.svg');
export const BRAND_DOCS_DIR = join(ROOT, 'docs', 'brand');

export const BRAND_PNGS = {
  appleTouchIcon: { path: join(ROOT, 'public', 'apple-touch-icon.png'), size: 180 },
  metaAppIcon: { path: join(BRAND_DOCS_DIR, 'cale-app-icon-1024.png'), size: 1024 },
  whatsappProfile: { path: join(BRAND_DOCS_DIR, 'cale-whatsapp-profile-640.png'), size: 640 },
} as const;
