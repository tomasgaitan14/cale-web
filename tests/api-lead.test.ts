// Función de Vercel api/lead.ts: verifica el captcha de Turnstile y guarda el alta con la clave de servicio.
// Las respuestas simuladas reproducen las reales: Turnstile responde JSON con `success`; PostgREST, 200 con `true`/`false`,
// 400 con un JSON de error (check de la tabla) y 429 cuando la función falla con el código PT429.
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../api/lead';

const SUPABASE_URL = 'https://abc123.supabase.co';
// Clave con forma de JWT (formato anterior de Supabase) y clave nueva (sb_secret_…), que no es un JWT
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.firma-de-prueba';
const NEW_STYLE_SERVICE_KEY = 'sb_secret_de_prueba';
const TURNSTILE_SECRET = 'turnstile-secret-de-prueba';
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SUBMIT_URL = `${SUPABASE_URL}/rest/v1/rpc/submit_lead`;
const CLIENT_IP = '203.0.113.9';

const LEAD = {
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
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function leadRequest(body: unknown, headers: Record<string, string> = { 'x-forwarded-for': `${CLIENT_IP}, 10.0.0.1` }): Request {
  return new Request('https://cale-turnos.vercel.app/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBody = { token: 'token-del-captcha', lead: LEAD };

// Un destino por URL, como la red real: se puede cambiar la respuesta de cada uno por test
let turnstileReply: () => Promise<Response>;
let supabaseReply: () => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;

function callsTo(url: string): [string, RequestInit][] {
  return (fetchMock.mock.calls as [string, RequestInit][]).filter(([called]) => called === url);
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  vi.stubEnv('TURNSTILE_SECRET_KEY', TURNSTILE_SECRET);
  turnstileReply = async () => jsonResponse({ success: true, 'error-codes': [] });
  supabaseReply = async () => jsonResponse(true);
  fetchMock = vi.fn(async (url: string) => {
    if (url === TURNSTILE_URL) return turnstileReply();
    if (url === SUBMIT_URL) return supabaseReply();
    throw new Error(`Llamada inesperada a ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/lead: camino feliz', () => {
  it('con captcha válido guarda el alta y responde "created"', async () => {
    const response = await POST(leadRequest(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'created' });
  });

  it('responde "duplicate" si ese WhatsApp ya estaba anotado', async () => {
    supabaseReply = async () => jsonResponse(false);
    expect(await (await POST(leadRequest(validBody))).json()).toEqual({ result: 'duplicate' });
  });

  it('le manda a Cloudflare el secreto, el token y la IP del visitante (la primera de x-forwarded-for)', async () => {
    await POST(leadRequest(validBody));
    const [[, init]] = callsTo(TURNSTILE_URL);
    const sent = new URLSearchParams(init.body as URLSearchParams);
    expect(sent.get('secret')).toBe(TURNSTILE_SECRET);
    expect(sent.get('response')).toBe(validBody.token);
    expect(sent.get('remoteip')).toBe(CLIENT_IP);
  });

  it('le manda a Supabase los datos con la clave JWT en apikey y en Authorization, y el hash de la IP', async () => {
    await POST(leadRequest(validBody));
    const [[, init]] = callsTo(SUBMIT_URL);
    // Con una clave JWT, PostgREST toma el rol de Authorization: sin él la llamada entra como anon y da 401
    expect(init.headers).toEqual({
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    });
    const sent = JSON.parse(init.body as string) as Record<string, string>;
    expect(sent).toEqual({ ...LEAD, p_ip_hash: createHmac('sha256', TURNSTILE_SECRET).update(CLIENT_IP).digest('hex') });
    // Nunca la IP en claro
    expect(init.body as string).not.toContain(CLIENT_IP);
  });

  it('con una clave nueva (sb_secret_…), que no es un JWT, va solo en apikey', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', NEW_STYLE_SERVICE_KEY);
    await POST(leadRequest(validBody));
    expect(callsTo(SUBMIT_URL)[0][1].headers).toEqual({ apikey: NEW_STYLE_SERVICE_KEY, 'content-type': 'application/json' });
  });

  it('un p_ip_hash mandado por el navegador no pisa el calculado en el servidor', async () => {
    await POST(leadRequest({ ...validBody, lead: { ...LEAD, p_ip_hash: 'a'.repeat(64) } }));
    const sent = JSON.parse(callsTo(SUBMIT_URL)[0][1].body as string) as Record<string, string>;
    expect(sent.p_ip_hash).toBe(createHmac('sha256', TURNSTILE_SECRET).update(CLIENT_IP).digest('hex'));
  });

  it('sin IP en los encabezados igual funciona y no se la manda a Cloudflare', async () => {
    const response = await POST(leadRequest(validBody, {}));
    expect(response.status).toBe(200);
    const sent = new URLSearchParams(callsTo(TURNSTILE_URL)[0][1].body as URLSearchParams);
    expect(sent.has('remoteip')).toBe(false);
  });

  it('IP distintas dan hashes distintos (el límite es por IP)', async () => {
    await POST(leadRequest(validBody, { 'x-forwarded-for': '203.0.113.1' }));
    await POST(leadRequest(validBody, { 'x-forwarded-for': '203.0.113.2' }));
    const hashes = callsTo(SUBMIT_URL).map(([, init]) => (JSON.parse(init.body as string) as Record<string, string>).p_ip_hash);
    expect(new Set(hashes).size).toBe(2);
  });
});

describe('POST /api/lead: captcha', () => {
  it('con captcha inválido responde 403 y NO llama a Supabase', async () => {
    turnstileReply = async () => jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] });
    const response = await POST(leadRequest(validBody));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'captcha_failed' });
    expect(callsTo(SUBMIT_URL)).toHaveLength(0);
  });

  it.each([
    ['success con otro tipo', { success: 'true' }],
    ['sin success', { 'error-codes': [] }],
    ['un texto', 'ok'],
  ])('un success que no es exactamente true (%s) no pasa', async (_label, body) => {
    turnstileReply = async () => jsonResponse(body);
    expect((await POST(leadRequest(validBody))).status).toBe(403);
    expect(callsTo(SUBMIT_URL)).toHaveLength(0);
  });

  it('si Cloudflare no responde, es 502 y no se guarda nada (no se deja pasar sin verificar)', async () => {
    turnstileReply = async () => {
      throw new TypeError('fetch failed');
    };
    const response = await POST(leadRequest(validBody));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'captcha_unavailable' });
    expect(callsTo(SUBMIT_URL)).toHaveLength(0);
  });

  it('si Cloudflare responde con error del servidor, es 502 y no se guarda nada', async () => {
    turnstileReply = async () => jsonResponse({}, 500);
    expect((await POST(leadRequest(validBody))).status).toBe(502);
    expect(callsTo(SUBMIT_URL)).toHaveLength(0);
  });
});

describe('POST /api/lead: pedido inválido (no se llama a nadie)', () => {
  it.each([
    ['JSON roto', '{no es json'],
    ['un arreglo', '[]'],
    ['sin token', JSON.stringify({ lead: LEAD })],
    ['token vacío', JSON.stringify({ token: '', lead: LEAD })],
    ['token que no es texto', JSON.stringify({ token: 5, lead: LEAD })],
    ['token larguísimo', JSON.stringify({ token: 'x'.repeat(2049), lead: LEAD })],
    ['sin lead', JSON.stringify({ token: 't' })],
    ['lead vacío', JSON.stringify({ token: 't', lead: {} })],
    ['lead con un valor que no es texto', JSON.stringify({ token: 't', lead: { ...LEAD, p_city: 5 } })],
    ['lead con un campo larguísimo', JSON.stringify({ token: 't', lead: { ...LEAD, p_city: 'x'.repeat(201) } })],
    ['lead con demasiados campos', JSON.stringify({ token: 't', lead: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`p_${i}`, 'x'])) })],
  ])('%s -> 400', async (_label, body) => {
    const response = await POST(leadRequest(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un cuerpo de más de 8 KB -> 413', async () => {
    const response = await POST(leadRequest(JSON.stringify({ token: 't', lead: LEAD, relleno: 'x'.repeat(9000) })));
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/lead: respuestas de Supabase', () => {
  it('un check que falla (400) es "rejected" y no filtra el detalle de la base', async () => {
    supabaseReply = async () =>
      jsonResponse({ code: '23514', message: 'new row for relation "leads" violates check constraint "leads_city_check"' }, 400);
    const response = await POST(leadRequest(validBody));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'rejected' });
  });

  it('el límite de envíos (429 de PT429) es "rate_limited"', async () => {
    supabaseReply = async () => jsonResponse({ code: 'PT429', message: 'rate_limited' }, 429);
    const response = await POST(leadRequest(validBody));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'rate_limited' });
  });

  it.each([401, 404, 500, 503])('un %i de Supabase es 502 "service_unavailable"', async (status) => {
    supabaseReply = async () => jsonResponse({ message: 'error' }, status);
    const response = await POST(leadRequest(validBody));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'service_unavailable' });
  });

  it.each([
    ['un objeto', { ok: true }],
    ['un texto', 'true'],
  ])('si Supabase responde %s en vez de un booleano, no se cuenta como alta', async (_label, body) => {
    supabaseReply = async () => jsonResponse(body);
    expect((await POST(leadRequest(validBody))).status).toBe(502);
  });

  it('si Supabase no responde, es 502', async () => {
    supabaseReply = async () => {
      throw new TypeError('fetch failed');
    };
    expect((await POST(leadRequest(validBody))).status).toBe(502);
  });
});

describe('POST /api/lead: configuración y secretos', () => {
  it.each(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TURNSTILE_SECRET_KEY'])('sin %s responde 500 y no llama a nadie', async (name) => {
    vi.stubEnv(name, '');
    const response = await POST(leadRequest(validBody));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ninguna respuesta, de éxito o de error, contiene las claves ni el token', async () => {
    const bodies: string[] = [];
    bodies.push(await (await POST(leadRequest(validBody))).text());
    turnstileReply = async () => jsonResponse({ success: false });
    bodies.push(await (await POST(leadRequest(validBody))).text());
    supabaseReply = async () => jsonResponse({ message: SERVICE_KEY }, 500);
    turnstileReply = async () => jsonResponse({ success: true });
    bodies.push(await (await POST(leadRequest(validBody))).text());
    for (const body of bodies) {
      for (const secret of [SERVICE_KEY, TURNSTILE_SECRET, validBody.token]) expect(body).not.toContain(secret);
    }
  });

  it('las respuestas no se guardan en caché', async () => {
    expect((await POST(leadRequest(validBody))).headers.get('cache-control')).toBe('no-store');
  });
});
