import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelConfig {
  cleanUrls: boolean;
  trailingSlash: boolean;
  headers: { source: string; headers: VercelHeader[] }[];
}

const config: VercelConfig = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'vercel.json'), 'utf8'));
const globalHeaders = config.headers.find((rule) => rule.source === '/(.*)')?.headers ?? [];

function headerValue(key: string): string | undefined {
  return globalHeaders.find((header) => header.key === key)?.value;
}

describe('vercel.json', () => {
  it('sirve las páginas sin .html y sin barra final', () => {
    expect(config.cleanUrls).toBe(true);
    expect(config.trailingSlash).toBe(false);
  });

  it('aplica una CSP que bloquea scripts, iframes externos y formularios', () => {
    const csp = headerValue('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).not.toContain('unsafe-inline');
  });

  it.each(['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options'])(
    'incluye el header %s',
    (key) => {
      expect(headerValue(key)).toBeTruthy();
    },
  );
});
