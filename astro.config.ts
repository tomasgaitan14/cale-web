import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/config';

export default defineConfig({
  site: SITE_URL,
  // URLs sin barra final: /privacidad, no /privacidad/
  trailingSlash: 'never',
  build: {
    // privacidad.html en vez de privacidad/index.html; Vercel la sirve en /privacidad con cleanUrls
    format: 'file',
    // CSS siempre en archivos externos, para poder usar una CSP sin 'unsafe-inline'
    inlineStylesheets: 'never',
  },
});
