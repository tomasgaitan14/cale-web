// Cabeceras de seguridad del hosting en Vercel (vercel.json). Equivalen a las de la CloudFront Function de
// infra/site.yaml, con una excepción: /empezar admite su propio script y el captcha de Cloudflare Turnstile.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTES, START_ROUTE } from '../src/config';

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const VERCEL_CONFIG = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'vercel.json'), 'utf8')) as { headers: HeaderRule[] };
const SITE_PAGES = [...Object.values(ROUTES), '/404'];
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

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
  it.each(SITE_PAGES)('%s recibe una sola CSP, la estricta: sin scripts ni conexiones', (path) => {
    const rules = rulesFor(path, 'Content-Security-Policy');
    expect(rules).toHaveLength(1);
    const csp = headerValue(rules[0], 'Content-Security-Policy');
    expect(directive(csp, 'script-src')).toEqual(["'none'"]);
    expect(directive(csp, 'connect-src')).toEqual(["'none'"]);
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
  });

  it.each(SITE_PAGES)('%s no admite el captcha: no lo usa', (path) => {
    expect(headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy')).not.toContain('cloudflare');
  });

  it.each([START_ROUTE, ...SITE_PAGES])('%s mantiene lo demás de la CSP cerrado', (path) => {
    const csp = headerValue(rulesFor(path, 'Content-Security-Policy')[0], 'Content-Security-Policy');
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'form-action')).toEqual(["'none'"]);
    expect(directive(csp, 'style-src')).toEqual(["'self'"]);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
  });
});

describe('demás cabeceras', () => {
  it.each([START_ROUTE, ...SITE_PAGES])('%s lleva HSTS, nosniff, DENY, referrer y permisos', (path) => {
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
