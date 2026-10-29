// Cliente de /api/lead (src/lib/lead-api.ts). Las respuestas simuladas son las que devuelve api/lead.ts de verdad:
// JSON `{ result }` en el éxito y `{ error }` con el estado HTTP correspondiente en los fallos.
import { describe, expect, it, vi } from 'vitest';
import {
  LEAD_ENDPOINT,
  LeadCaptchaError,
  LeadConfigError,
  LeadRateLimitError,
  LeadRejectedError,
  LeadServiceError,
  readTurnstileSiteKey,
  submitLead,
} from '../src/lib/lead-api';
import type { LeadPayload } from '../src/lib/lead';

const CAPTCHA_TOKEN = 'token-del-captcha';
const PAYLOAD: LeadPayload = {
  p_business_name: 'Barbería Ribera',
  p_business_type: 'Barbería',
  p_city: 'Concordia',
  p_weekly_appointments: '1-10',
  p_current_method: 'llamadas',
  p_owner_name: 'Lucía Pérez',
  p_owner_whatsapp: '5491155550142',
  p_business_phone: '5493445123456',
  p_consent_version: '2026-10-29',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

describe('submitLead', () => {
  it('devuelve "created" cuando la función responde { result: "created" }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: 'created' }));
    await expect(submitLead(PAYLOAD, CAPTCHA_TOKEN, fetchMock)).resolves.toBe('created');
  });

  it('devuelve "duplicate" cuando ese WhatsApp ya estaba anotado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: 'duplicate' }));
    await expect(submitLead(PAYLOAD, CAPTCHA_TOKEN, fetchMock)).resolves.toBe('duplicate');
  });

  it('hace un POST a /api/lead con el token y los datos, sin ninguna clave', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: 'created' }));
    await submitLead(PAYLOAD, CAPTCHA_TOKEN, fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(LEAD_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ token: CAPTCHA_TOKEN, lead: PAYLOAD });
  });

  it.each([
    [403, LeadCaptchaError],
    [429, LeadRateLimitError],
    [400, LeadRejectedError],
    [413, LeadRejectedError],
    [500, LeadServiceError],
    [502, LeadServiceError],
  ])('un %i es %o', async (status, ErrorType) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'x' }, status));
    await expect(submitLead(PAYLOAD, CAPTCHA_TOKEN, fetchMock)).rejects.toBeInstanceOf(ErrorType);
  });

  it('sin conexión es LeadServiceError y conserva la causa', async () => {
    const cause = new TypeError('Failed to fetch');
    const fetchMock = vi.fn().mockRejectedValue(cause);
    const error = await submitLead(PAYLOAD, CAPTCHA_TOKEN, fetchMock).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LeadServiceError);
    expect((error as LeadServiceError).cause).toBe(cause);
  });

  it.each([
    ['un resultado inventado', { result: 'otro' }],
    ['sin resultado', {}],
    ['un texto', '"created"'],
    ['un cuerpo vacío', ''],
    ['HTML de un proxy', '<html>Bad gateway</html>'],
  ])('si el cuerpo es %s, es LeadServiceError (no se cuenta como alta)', async (_label, body) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    await expect(submitLead(PAYLOAD, CAPTCHA_TOKEN, fetchMock)).rejects.toBeInstanceOf(LeadServiceError);
  });
});

describe('readTurnstileSiteKey', () => {
  it('devuelve la clave sin espacios', () => {
    expect(readTurnstileSiteKey({ PUBLIC_TURNSTILE_SITE_KEY: ' 0x4AAAA ' })).toBe('0x4AAAA');
  });

  it.each([
    ['no hay nada', {}],
    ['está vacía', { PUBLIC_TURNSTILE_SITE_KEY: '  ' }],
  ])('si %s, es LeadConfigError', (_label, env) => {
    expect(() => readTurnstileSiteKey(env)).toThrow(LeadConfigError);
  });
});
