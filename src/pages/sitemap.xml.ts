// sitemap.xml: las páginas indexables (ROUTES, sin la 404) con su URL canónica. Los textos legales llevan su fecha de
// vigencia; la portada no lleva fecha (cambia sin una fecha que la represente). Se genera en el build.
import type { APIRoute } from 'astro';
import { LEGAL_LAST_UPDATED, ROUTES } from '../config';
import { canonicalUrl } from '../lib/url';

const LEGAL_ROUTES: ReadonlySet<string> = new Set([ROUTES.privacy, ROUTES.terms, ROUTES.dataDeletion]);

function urlEntry(route: string): string {
  const lastmod = LEGAL_ROUTES.has(route) ? `<lastmod>${LEGAL_LAST_UPDATED}</lastmod>` : '';
  return `  <url><loc>${canonicalUrl(route)}</loc>${lastmod}</url>`;
}

export const GET: APIRoute = () =>
  new Response(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...Object.values(ROUTES).map(urlEntry),
      '</urlset>',
      '',
    ].join('\n'),
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
