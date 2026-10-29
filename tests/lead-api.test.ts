// Envío del alta a Supabase (src/lib/lead-api.ts). Las respuestas simuladas reproducen las de PostgREST:
// una función que devuelve boolean responde 200 con el cuerpo `true` o `false`; un check que falla, 400 con un JSON de error.
import { describe, expect, it, vi } from 'vitest';
import {
  LeadConfigError,
  LeadRejectedError,
  LeadServiceError,
  SUBMIT_LEAD_PATH,
  readSupabaseConfig,
  submitLead,
  type SupabaseConfig,
} from '../src/lib/lead-api';
import type { LeadPayload } from '../src/lib/lead';

const CONFIG: SupabaseConfig = { url: 'https://abc123.supabase.co', anonKey: 'sb_publishable_test' };
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
const CHECK_VIOLATION_BODY = JSON.stringify({
  code: '23514',
  message: 'new row for relation "leads" violates check constraint "leads_city_check"',
});

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

describe('submitLead', () => {
  it('devuelve "created" cuando la función responde true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('true'));
    await expect(submitLead(PAYLOAD, CONFIG, fetchMock)).resolves.toBe('created');
  });

  it('devuelve "duplicate" cuando ese WhatsApp ya estaba anotado (false)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('false'));
    await expect(submitLead(PAYLOAD, CONFIG, fetchMock)).resolves.toBe('duplicate');
  });

  it('hace un POST a la función con la clave en apikey (sin Authorization) y los parámetros como JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('true'));
    await submitLead(PAYLOAD, CONFIG, fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://abc123.supabase.co${SUBMIT_LEAD_PATH}`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ apikey: CONFIG.anonKey, 'content-type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD);
  });

  it('un 400 es LeadRejectedError y conserva el detalle de Supabase', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CHECK_VIOLATION_BODY, 400));
    const attempt = submitLead(PAYLOAD, CONFIG, fetchMock);
    await expect(attempt).rejects.toBeInstanceOf(LeadRejectedError);
    await expect(attempt).rejects.toThrow('leads_city_check');
  });

  it.each([401, 404, 500, 503])('un %i es LeadServiceError', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('{}', status));
    await expect(submitLead(PAYLOAD, CONFIG, fetchMock)).rejects.toBeInstanceOf(LeadServiceError);
  });

  it('sin conexión es LeadServiceError y conserva la causa', async () => {
    const cause = new TypeError('Failed to fetch');
    const fetchMock = vi.fn().mockRejectedValue(cause);
    const error = await submitLead(PAYLOAD, CONFIG, fetchMock).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LeadServiceError);
    expect((error as LeadServiceError).cause).toBe(cause);
  });

  it.each([
    ['un objeto', '{"ok":true}'],
    ['un texto', '"true"'],
    ['un cuerpo vacío', ''],
    ['HTML de un proxy', '<html>Bad gateway</html>'],
  ])('si el cuerpo es %s, es LeadServiceError (no se cuenta como alta)', async (_label, body) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    await expect(submitLead(PAYLOAD, CONFIG, fetchMock)).rejects.toBeInstanceOf(LeadServiceError);
  });
});

describe('readSupabaseConfig', () => {
  it('devuelve la URL sin barra final y la clave sin espacios', () => {
    expect(readSupabaseConfig({ PUBLIC_SUPABASE_URL: ' https://abc123.supabase.co/ ', PUBLIC_SUPABASE_ANON_KEY: ' key ' })).toEqual({
      url: 'https://abc123.supabase.co',
      anonKey: 'key',
    });
  });

  it.each([
    ['no hay nada', {}],
    ['falta la clave', { PUBLIC_SUPABASE_URL: 'https://abc123.supabase.co' }],
    ['falta la URL', { PUBLIC_SUPABASE_ANON_KEY: 'key' }],
    ['están vacías', { PUBLIC_SUPABASE_URL: '  ', PUBLIC_SUPABASE_ANON_KEY: '' }],
  ])('si %s, es LeadConfigError', (_label, env) => {
    expect(() => readSupabaseConfig(env)).toThrow(LeadConfigError);
  });
});
