// Alta de interesados (Vercel Function). El navegador ya no habla con Supabase: manda el formulario y el token del
// captcha acá; se verifica el token con Cloudflare Turnstile y recién entonces se llama a submit_lead con la clave
// de servicio (supabase/migrations/0002_lead_rate_limit.sql: anon ya no puede ejecutarla).
// Sin imports de código del sitio: en un proyecto "type": "module" las funciones exigen extensiones en los imports.
import { createHmac } from 'node:crypto';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SUBMIT_LEAD_PATH = '/rest/v1/rpc/submit_lead';
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKEN_LENGTH = 2048;
const MAX_FIELD_LENGTH = 200;
const MAX_LEAD_FIELDS = 12;
const UNKNOWN_IP = 'unknown';
// Las claves JWT (formato anterior de Supabase) viajan también como Bearer; las nuevas (sb_secret_…) no son un JWT
const JWT_PREFIX = 'eyJ';

const HTTP = {
  ok: 200,
  badRequest: 400,
  forbidden: 403,
  tooLarge: 413,
  tooManyRequests: 429,
  serverError: 500,
  badGateway: 502,
} as const;

type ErrorCode =
  | 'invalid_request'
  | 'too_large'
  | 'captcha_failed'
  | 'captcha_unavailable'
  | 'rejected'
  | 'rate_limited'
  | 'service_unavailable'
  | 'not_configured';

interface LeadEnv {
  supabaseUrl: string;
  serviceKey: string;
  turnstileSecret: string;
}

interface LeadRequest {
  token: string;
  lead: Record<string, string>;
}

function respond(body: { result: 'created' | 'duplicate' } | { error: ErrorCode }, status: number): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

function fail(error: ErrorCode, status: number): Response {
  return respond({ error }, status);
}

function readEnv(): LeadEnv | undefined {
  const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
  return supabaseUrl && serviceKey && turnstileSecret ? { supabaseUrl, serviceKey, turnstileSecret } : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Forma mínima del pedido; las reglas de cada dato las aplica la base (check de la tabla)
function parseLeadRequest(raw: string): LeadRequest | undefined {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isPlainObject(data) || typeof data.token !== 'string' || !isPlainObject(data.lead)) return undefined;
  if (data.token.length === 0 || data.token.length > MAX_TOKEN_LENGTH) return undefined;

  const entries = Object.entries(data.lead);
  if (entries.length === 0 || entries.length > MAX_LEAD_FIELDS) return undefined;
  const lead: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value !== 'string' || value.length > MAX_FIELD_LENGTH) return undefined;
    lead[key] = value;
  }
  return { token: data.token, lead };
}

function supabaseHeaders(serviceKey: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: serviceKey, 'content-type': 'application/json' };
  if (serviceKey.startsWith(JWT_PREFIX)) headers.authorization = `Bearer ${serviceKey}`;
  return headers;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || UNKNOWN_IP;
}

// La IP no se guarda: se guarda un hash con clave (sirve para contar intentos y no se puede revertir a la IP)
function hashIp(ip: string, key: string): string {
  return createHmac('sha256', key).update(ip).digest('hex');
}

type CaptchaOutcome = 'passed' | 'failed' | 'unavailable';

async function verifyCaptcha(token: string, ip: string, secret: string): Promise<CaptchaOutcome> {
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== UNKNOWN_IP) form.set('remoteip', ip);
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) return 'unavailable';
    const result: unknown = await response.json();
    return isPlainObject(result) && result.success === true ? 'passed' : 'failed';
  } catch {
    return 'unavailable';
  }
}

async function saveLead(lead: Record<string, string>, ipHash: string, env: LeadEnv): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${env.supabaseUrl}${SUBMIT_LEAD_PATH}`, {
      method: 'POST',
      headers: supabaseHeaders(env.serviceKey),
      // El hash va al final: un p_ip_hash que mande el navegador nunca pisa el calculado acá
      body: JSON.stringify({ ...lead, p_ip_hash: ipHash }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return fail('service_unavailable', HTTP.badGateway);
  }

  if (response.status === HTTP.tooManyRequests) return fail('rate_limited', HTTP.tooManyRequests);
  if (response.status === HTTP.badRequest) return fail('rejected', HTTP.badRequest);
  if (!response.ok) return fail('service_unavailable', HTTP.badGateway);

  const created: unknown = await response.json().catch(() => undefined);
  if (typeof created !== 'boolean') return fail('service_unavailable', HTTP.badGateway);
  return respond({ result: created ? 'created' : 'duplicate' }, HTTP.ok);
}

export async function POST(request: Request): Promise<Response> {
  const env = readEnv();
  if (!env) return fail('not_configured', HTTP.serverError);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail('too_large', HTTP.tooLarge);
  const parsed = parseLeadRequest(raw);
  if (!parsed) return fail('invalid_request', HTTP.badRequest);

  const ip = clientIp(request);
  const captcha = await verifyCaptcha(parsed.token, ip, env.turnstileSecret);
  if (captcha === 'failed') return fail('captcha_failed', HTTP.forbidden);
  if (captcha === 'unavailable') return fail('captcha_unavailable', HTTP.badGateway);

  return saveLead(parsed.lead, hashIp(ip, env.turnstileSecret), env);
}
