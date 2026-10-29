// Envío del alta a /api/lead (api/lead.ts): la función verifica el captcha y guarda el alta en Supabase.
// El navegador no habla con Supabase ni lleva ninguna clave suya; solo conoce la clave pública del captcha.
import type { LeadPayload } from './lead';

export const LEAD_ENDPOINT = '/api/lead';
const REQUEST_TIMEOUT_MS = 20_000;
const HTTP = {
  ok: 200,
  badRequest: 400,
  forbidden: 403,
  tooLarge: 413,
  tooManyRequests: 429,
} as const;

export type LeadResult = 'created' | 'duplicate';

// Falta la clave pública del captcha en el build
export class LeadConfigError extends Error {
  constructor() {
    super('Falta PUBLIC_TURNSTILE_SITE_KEY');
    this.name = 'LeadConfigError';
  }
}

// El servidor rechazó los datos (no cumplen las reglas de la tabla o el pedido es inválido)
export class LeadRejectedError extends Error {
  constructor(status: number) {
    super(`Alta rechazada (HTTP ${status})`);
    this.name = 'LeadRejectedError';
  }
}

// El captcha no pasó: hay que resolverlo de nuevo
export class LeadCaptchaError extends Error {
  constructor() {
    super('El captcha no pasó la verificación');
    this.name = 'LeadCaptchaError';
  }
}

// Se pasó el límite de envíos por hora
export class LeadRateLimitError extends Error {
  constructor() {
    super('Demasiados intentos');
    this.name = 'LeadRateLimitError';
  }
}

// No se pudo hablar con el servidor (sin red, tiempo agotado, error del servidor o respuesta inesperada)
export class LeadServiceError extends Error {
  constructor(detail: string, options?: ErrorOptions) {
    super(`No se pudo guardar el alta: ${detail}`, options);
    this.name = 'LeadServiceError';
  }
}

export function readTurnstileSiteKey(env: { PUBLIC_TURNSTILE_SITE_KEY?: string }): string {
  const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (!siteKey) throw new LeadConfigError();
  return siteKey;
}

export async function submitLead(payload: LeadPayload, captchaToken: string, fetchImpl: typeof fetch = fetch): Promise<LeadResult> {
  let response: Response;
  try {
    response = await fetchImpl(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: captchaToken, lead: payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LeadServiceError('sin conexión o tiempo agotado', { cause: error });
  }

  if (response.status === HTTP.forbidden) throw new LeadCaptchaError();
  if (response.status === HTTP.tooManyRequests) throw new LeadRateLimitError();
  if (response.status === HTTP.badRequest || response.status === HTTP.tooLarge) throw new LeadRejectedError(response.status);
  if (!response.ok) throw new LeadServiceError(`respuesta ${response.status}`);

  const body: unknown = await response.json().catch(() => undefined);
  const result = typeof body === 'object' && body !== null ? (body as { result?: unknown }).result : undefined;
  if (result !== 'created' && result !== 'duplicate') throw new LeadServiceError('respuesta inesperada');
  return result;
}
