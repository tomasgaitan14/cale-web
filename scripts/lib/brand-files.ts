// Archivos de marca que genera scripts/brand-assets.ts, con el tamaño que pide cada plataforma:
// iOS (pantalla de inicio), Meta (ícono de la app) y WhatsApp (foto de perfil).
import { join } from 'node:path';
import { APPLE_TOUCH_ICON } from '../../src/lib/brand.ts';

const ROOT = join(import.meta.dirname, '..', '..');

export const FAVICON_PATH = join(ROOT, 'public', 'favicon.svg');
export const OG_IMAGE_PATH = join(ROOT, 'public', 'og-image.png');
export const BRAND_DOCS_DIR = join(ROOT, 'docs', 'brand');
export const LOCKUP_PATH = join(BRAND_DOCS_DIR, 'cale-lockup.svg');

export const BRAND_PNGS = {
  appleTouchIcon: { path: join(ROOT, 'public', APPLE_TOUCH_ICON.path), size: APPLE_TOUCH_ICON.size },
  metaAppIcon: { path: join(BRAND_DOCS_DIR, 'cale-app-icon-1024.png'), size: 1024 },
  whatsappProfile: { path: join(BRAND_DOCS_DIR, 'cale-whatsapp-profile-640.png'), size: 640 },
} as const;
