// La validación del navegador (src/lib/lead.ts) y la de la base (supabase/migrations/0001_leads.sql) tienen que decir lo
// mismo: si cambia un límite, una opción o un parámetro en un lado, este test avisa que falta el otro.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CURRENT_METHODS,
  LEAD_LIMITS,
  WEEKLY_APPOINTMENTS,
  toLeadPayload,
  type LeadForm,
} from '../src/lib/lead';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'supabase', 'migrations');
const SQL = readFileSync(join(MIGRATIONS_DIR, '0001_leads.sql'), 'utf8');
const RATE_LIMIT_SQL = readFileSync(join(MIGRATIONS_DIR, '0002_lead_rate_limit.sql'), 'utf8');
// Límites por hora de 0002; el 429 que devuelve la base es lo que api/lead.ts traduce a "rate_limited"
const MAX_ATTEMPTS_PER_IP = 5;
const MAX_ATTEMPTS_TOTAL = 100;
const SUBMIT_LEAD_SIGNATURE = 'public.submit_lead(text, text, text, text, text, text, text, text, text, text)';

function columnLine(column: string): string {
  const line = SQL.split('\n').find((candidate) => candidate.trim().startsWith(`${column} `));
  if (!line) throw new Error(`No hay una columna ${column} en la migración`);
  return line;
}

function lengthLimits(column: string): { min: number; max: number } {
  const match = columnLine(column).match(/between (\d+) and (\d+)/);
  if (!match) throw new Error(`La columna ${column} no tiene límite de largo`);
  return { min: Number(match[1]), max: Number(match[2]) };
}

function allowedValues(column: string): string[] {
  const match = columnLine(column).match(/in \(([^)]*)\)/);
  if (!match) throw new Error(`La columna ${column} no tiene lista de valores`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((value) => value[1]);
}

describe('migración de leads', () => {
  it.each([
    ['business_name', LEAD_LIMITS.businessName],
    ['business_type', LEAD_LIMITS.businessType],
    ['city', LEAD_LIMITS.city],
    ['owner_name', LEAD_LIMITS.ownerName],
  ])('el largo de %s es el mismo que el del formulario', (column, limits) => {
    expect(lengthLimits(column)).toEqual(limits);
  });

  it('los turnos por semana y las formas de avisar son las mismas opciones', () => {
    expect(allowedValues('weekly_appointments')).toEqual(WEEKLY_APPOINTMENTS.map((option) => option.value));
    expect(allowedValues('current_method')).toEqual(CURRENT_METHODS.map((option) => option.value));
  });

  it('los parámetros de submit_lead son los del payload, en el mismo orden, más el hash de la IP', () => {
    const signature = RATE_LIMIT_SQL.match(/create function public\.submit_lead\(([\s\S]*?)\) returns boolean/)?.[1] ?? '';
    const sqlParams = [...signature.matchAll(/(p_\w+) text/g)].map((param) => param[1]);

    const form: LeadForm = {
      businessName: 'Barbería Ribera',
      businessType: 'Barbería',
      city: 'Concordia',
      weeklyAppointments: '1-10',
      currentMethod: 'llamadas',
      ownerName: 'Lucía Pérez',
      ownerWhatsapp: '11 5555 0142',
      businessWhatsapp: '3445 12 3456',
      consent: true,
    };
    expect(sqlParams).toEqual([...Object.keys(toLeadPayload(form, 'v1')), 'p_ip_hash']);
  });

  it('la tabla queda cerrada: RLS prendido, sin permisos para anon y sin políticas', () => {
    expect(SQL).toContain('alter table public.leads enable row level security');
    expect(SQL).toContain('revoke all on public.leads from anon, authenticated');
    expect(SQL).not.toMatch(/create policy/i);
    expect(RATE_LIMIT_SQL).not.toMatch(/create policy/i);
  });

  it('la función corre con search_path vacío (security definer segura) y no repite el WhatsApp', () => {
    expect(RATE_LIMIT_SQL).toContain('security definer');
    expect(RATE_LIMIT_SQL).toContain("set search_path = ''");
    expect(SQL).toContain('unique (owner_whatsapp)');
    expect(RATE_LIMIT_SQL).toContain('on conflict (owner_whatsapp) do nothing');
  });
});

describe('migración de límite de envíos', () => {
  it('reemplaza la función de 0001 (la que anon podía ejecutar) en vez de dejarla viva', () => {
    expect(RATE_LIMIT_SQL).toContain('drop function public.submit_lead(text, text, text, text, text, text, text, text, text);');
  });

  it('solo el servidor puede ejecutar submit_lead: se le quita a public, anon y authenticated', () => {
    expect(RATE_LIMIT_SQL).toContain(`revoke all on function ${SUBMIT_LEAD_SIGNATURE} from public, anon, authenticated;`);
    expect(RATE_LIMIT_SQL).toContain(`grant execute on function ${SUBMIT_LEAD_SIGNATURE} to service_role;`);
    expect(RATE_LIMIT_SQL).not.toMatch(/grant execute[^;]*\bto anon\b/);
  });

  it('la tabla de intentos queda cerrada y solo guarda el hash de la IP', () => {
    expect(RATE_LIMIT_SQL).toContain('alter table public.lead_attempts enable row level security');
    expect(RATE_LIMIT_SQL).toContain('revoke all on public.lead_attempts from anon, authenticated');
    expect(RATE_LIMIT_SQL).toContain("check (ip_hash ~ '^[0-9a-f]{64}$')");
    expect(RATE_LIMIT_SQL).not.toMatch(/\bip\s+(text|inet)/i);
  });

  it('corta por IP y en total, con el código PT429 que PostgREST devuelve como HTTP 429', () => {
    expect(RATE_LIMIT_SQL).toContain(`c_max_per_ip constant integer := ${MAX_ATTEMPTS_PER_IP};`);
    expect(RATE_LIMIT_SQL).toContain(`c_max_total constant integer := ${MAX_ATTEMPTS_TOTAL};`);
    expect(RATE_LIMIT_SQL).toContain("using errcode = 'PT429'");
    expect(RATE_LIMIT_SQL).toContain("interval '1 hour'");
  });

  it('el límite se comprueba antes de anotar el intento y de guardar el alta', () => {
    const check = RATE_LIMIT_SQL.indexOf("raise exception 'rate_limited'");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(RATE_LIMIT_SQL.indexOf('insert into public.lead_attempts'));
    expect(check).toBeLessThan(RATE_LIMIT_SQL.indexOf('insert into public.leads'));
  });

  it('los intentos viejos se borran solos', () => {
    expect(RATE_LIMIT_SQL).toContain("delete from public.lead_attempts where created_at < now() - interval '1 day'");
  });
});
