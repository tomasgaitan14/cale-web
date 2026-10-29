// Envío del alta a Supabase: llama a la función submit_lead (supabase/migrations/0001_leads.sql) por la API REST.
// La clave pública (anon/publishable) va en el navegador a propósito; la tabla no se puede leer ni escribir directo.
import type { LeadPayload } from './lead';

export const SUBMIT_LEAD_PATH = '/rest/v1/rpc/submit_lead';
const REQUEST_TIMEOUT_MS = 15_000;
const HTTP_BAD_REQUEST = 400;

export type LeadResult = 'created' | 'duplicate';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Falta la URL o la clave del proyecto en el build
export class LeadConfigError extends Error {
  constructor() {
    super('Falta PUBLIC_SUPABASE_URL o PUBLIC_SUPABASE_ANON_KEY');
    this.name = 'LeadConfigError';
  }
}

// Supabase rechazó los datos (HTTP 400: no cumplen las reglas de la tabla)
export class LeadRejectedError extends Error {
  constructor(detail: string) {
    super(`Alta rechazada: ${detail}`);
    this.name = 'LeadRejectedError';
  }
}

// No se pudo hablar con Supabase (sin red, tiempo agotado, error del servidor o respuesta inesperada)
export class LeadServiceError extends Error {
  constructor(detail: string, options?: ErrorOptions) {
    super(`No se pudo guardar el alta: ${detail}`, options);
    this.name = 'LeadServiceError';
  }
}

export function readSupabaseConfig(env: { PUBLIC_SUPABASE_URL?: string; PUBLIC_SUPABASE_ANON_KEY?: string }): SupabaseConfig {
  const url = env.PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = env.PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new LeadConfigError();
  return { url, anonKey };
}

export async function submitLead(
  payload: LeadPayload,
  config: SupabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<LeadResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${config.url}${SUBMIT_LEAD_PATH}`, {
      method: 'POST',
      // Solo `apikey`: las claves nuevas (sb_publishable_…) no son un JWT y no van en Authorization
      headers: { apikey: config.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new LeadServiceError('sin conexión o tiempo agotado', { cause: error });
  }

  if (response.status === HTTP_BAD_REQUEST) throw new LeadRejectedError(await response.text());
  if (!response.ok) throw new LeadServiceError(`respuesta ${response.status}`);

  const created: unknown = await response.json().catch(() => undefined);
  if (typeof created !== 'boolean') throw new LeadServiceError('respuesta inesperada');
  return created ? 'created' : 'duplicate';
}
