// robots.txt: el sitio entero se puede rastrear (no hay áreas privadas: la app vive en app.cale.com.ar) y se indica el
// sitemap. Se genera en el build, con el dominio de config.ts.
import type { APIRoute } from 'astro';
import { canonicalUrl } from '../lib/url';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${canonicalUrl('/sitemap.xml')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
