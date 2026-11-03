// Cabeceras de seguridad del hosting en Vercel (vercel.json). Equivalen a las de la CloudFront Function de
// infra/site.yaml, con dos excepciones: la portada admite su propio script (las animaciones) y /empezar, el suyo más el
// captcha de Cloudflare Turnstile.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HUBSPOT_SCRIPT_URL, ROUTES, START_ROUTE } from '../src/config';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const VERCEL_CONFIG = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'vercel.json'), 'utf8')) as { headers: HeaderRule[] };
// Textos legales: solo los scripts de HubSpot. La portada (ROUTES.home) lleva además el script del propio sitio. La 404 no
// lleva ninguno.
const LEGAL_PAGES = Object.values(ROUTES).filter((route) => route !== ROUTES.home);
const STRICT_PAGES = ['/404'];
const SITE_PAGES = [...LEGAL_PAGES, ...STRICT_PAGES];
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
// El seguimiento, el aviso de cookies y el chat. La captura de formularios (hscollectedforms) que trae el código de HubSpot
// queda afuera a propósito.
const HUBSPOT_SCRIPT_ORIGINS = [
  new URL(HUBSPOT_SCRIPT_URL).origin,
  'https://js.hs-analytics.net',
  'https://js.hs-banner.com',
  'https://js.usemessages.com',
];
const HUBSPOT_CONNECT_ORIGINS = ['https://api.hubspot.com'];
// El chat se muestra en un iframe de HubSpot
const HUBSPOT_FRAME_ORIGINS = ['https://app.hubspot.com'];
const HUBSPOT_BLOCKED_ORIGINS = ['hscollectedforms', 'hsforms', 'hubapi'];

// Los `source` de vercel.json son patrones tipo path-to-regexp; los que usa este archivo son expresiones regulares válidas
function rulesFor(path: string, key: string): HeaderRule[] {
  return VERCEL_CONFIG.headers.filter(
    (rule) => new RegExp(`^${rule.source}$`).test(path) && rule.headers.some((header) => header.key === key),
  );
}

function headerValue(rule: HeaderRule, key: string): string {
  return rule.headers.find((header) => header.key === key)?.value ?? '';
}

function directive(csp: string, name: string): string[] {
  const part = csp.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name} `));
  return part ? part.split(/\s+/).slice(1) : [];
}

describe('Content-Security-Policy', () => {
  it.each(STRICT_PAGES)('%s recibe una sola CSP, la estricta: sin scripts ni conexiones', (path) => {
    const rules = rulesFor(path, 'Content-Security-Policy');
    expect(rules).toHaveLength(1);
    const csp = headerValue(rules[0], 'Content-Security-Policy');
    expect(directive(csp, 'script-src')).toEqual(["'none'"]);
    expect(directive(csp, 'connect-src')).toEqual(["'none'"]);
    expect(csp).not.toContain('hubspot');
    expect(csp).not.toContain('hs-');
  });

  it.each(LEGAL_PAGES)('%s recibe una sola CSP: solo los scripts, la API y el iframe de HubSpot', (path) => {
    const rules = rulesFor(path, 'Content-Security-Policy');
    expect(rules).toHaveLength(1);
    const csp = headerValue(rules[0], 'Content-Security-Policy');
    expect(directive(csp, 'script-src')).toEqual(HUBSPOT_SCRIPT_ORIGINS);
    expect(directive(csp, 'connect-src')).toEqual(HUBSPOT_CONNECT_ORIGINS);
    expect(directive(csp, 'frame-src')).toEqual(HUBSPOT_FRAME_ORIGINS);
    expect(csp).not.toContain('cloudflare');
  });

  it('la portada recibe una sola CSP: su propio script y los de HubSpot, sin Cloudflare', () => {
    const rules = rulesFor(ROUTES.home, 'Content-Security-Policy');
    expect(rules).toHaveLength(1);
    const csp = headerValue(rules[0], 'Content-Security-Policy');
    expect(directive(csp, 'script-src')).toEqual(["'self'", ...HUBSPOT_SCRIPT_ORIGINS]);
    expect(directive(csp, 'connect-src')).toEqual(HUBSPOT_CONNECT_ORIGINS);
    expect(directive(csp, 'frame-src')).toEqual(HUBSPOT_FRAME_ORIGINS);
    expect(csp).not.toContain('cloudflare');
  });

  // El chat de HubSpot inyecta una hoja de estilos en la página: sin esto se pinta roto. Solo en estas páginas, y solo
  // para elementos <style>; los estilos de las demás páginas y los atributos siguen cerrados.
  it.each([ROUTES.home, ...LEGAL_PAGES])('%s admite estilos inline solo en elementos <style> (los del chat)', (path) => {
    const csp = headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy');
    expect(directive(csp, 'style-src')).toEqual(["'self'"]);
    expect(directive(csp, 'style-src-elem')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(csp, 'style-src-attr')).toEqual([]);
  });

  it.each([START_ROUTE, ...STRICT_PAGES])('%s no admite estilos inline ni el chat', (path) => {
    const csp = headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy');
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('usemessages');
    expect(csp).not.toContain('app.hubspot.com');
  });

  it.each([ROUTES.home, ...LEGAL_PAGES])('%s admite las imágenes de seguimiento de HubSpot y nada más de afuera', (path) => {
    const csp = headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy');
    expect(directive(csp, 'img-src')).toEqual(["'self'", 'data:', 'https://track.hubspot.com']);
  });

  it.each([ROUTES.home, ...LEGAL_PAGES])('%s no admite la captura de formularios de HubSpot', (path) => {
    const csp = headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy');
    for (const origin of HUBSPOT_BLOCKED_ORIGINS) expect(csp).not.toContain(origin);
  });

  it('el formulario recibe una sola CSP: su script, el captcha de Cloudflare y nada de Supabase en el navegador', () => {
    const rules = rulesFor(START_ROUTE, 'Content-Security-Policy');
    expect(rules).toHaveLength(1);
    const csp = headerValue(rules[0], 'Content-Security-Policy');
    expect(directive(csp, 'script-src')).toEqual(["'self'", TURNSTILE_ORIGIN]);
    expect(directive(csp, 'frame-src')).toEqual([TURNSTILE_ORIGIN]);
    // El formulario habla solo con /api/lead, del propio sitio
    expect(directive(csp, 'connect-src')).toEqual(["'self'"]);
    expect(csp).not.toContain('supabase');
    // El formulario no lleva el seguimiento de HubSpot: podría capturar lo que se escribe
    expect(csp).not.toContain('hs-');
    expect(csp).not.toContain('hubspot');
  });

  it.each(SITE_PAGES)('%s no admite el captcha: no lo usa', (path) => {
    expect(headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy')).not.toContain('cloudflare');
  });

  it.each([ROUTES.home, START_ROUTE, ...SITE_PAGES])('%s mantiene lo demás de la CSP cerrado', (path) => {
    const csp = headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy');
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'form-action')).toEqual(["'none'"]);
    expect(directive(csp, 'style-src')).toEqual(["'self'"]);
    // Los estilos inline solo los admiten la portada y los legales, en style-src-elem (lo cubre otro test)
    expect(csp.replace(/style-src-elem [^;]*/, '')).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(csp).not.toMatch(/unsafe-eval|\*/);
  });
});

describe('demás cabeceras', () => {
  it.each([ROUTES.home, START_ROUTE, ...SITE_PAGES])('%s lleva HSTS, nosniff, DENY, referrer y permisos', (path) => {
    const values = Object.fromEntries(
      VERCEL_CONFIG.headers
        .filter((rule) => new RegExp(`^${rule.source}$`).test(path))
        .flatMap((rule) => rule.headers.map((header) => [header.key, header.value])),
    );
    expect(values['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(values['X-Content-Type-Options']).toBe('nosniff');
    expect(values['X-Frame-Options']).toBe('DENY');
    expect(values['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(values['Permissions-Policy']).toContain('camera=()');
  });

  it('los archivos con hash de /_astro se cachean para siempre', () => {
    expect(headerValue(rulesFor('/_astro/empezar.abc123.js', 'Cache-Control')[0], 'Cache-Control')).toContain('immutable');
  });
});
