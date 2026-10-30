import { defineConfig } from 'astro/config';
import { SITE_URL } from './src/config';

export default defineConfig({
  site: SITE_URL,
  // URLs sin barra final: /privacidad, no /privacidad/
  trailingSlash: 'never',
  build: {
    // privacidad.html en vez de privacidad/index.html; la función de URLs de CloudFront la sirve en /privacidad
    format: 'file',
    // CSS siempre en archivos externos, para poder usar una CSP sin 'unsafe-inline'
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Vite incrusta en el HTML los scripts de menos de 4 KB (assetsInlineLimit) y la CSP los bloquea: siempre archivos externos
      assetsInlineLimit: 0,
    },
  },
});
