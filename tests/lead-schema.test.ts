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

const SQL = readFileSync(join(import.meta.dirname, '..', 'supabase', 'migrations', '0001_leads.sql'), 'utf8');

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

  it('los parámetros de submit_lead son los del payload, en el mismo orden', () => {
    const signature = SQL.match(/create function public\.submit_lead\(([\s\S]*?)\) returns boolean/)?.[1] ?? '';
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
    expect(sqlParams).toEqual(Object.keys(toLeadPayload(form, 'v1')));
  });

  it('la tabla queda cerrada: RLS prendido, sin permisos para anon y solo la función se puede ejecutar', () => {
    expect(SQL).toContain('alter table public.leads enable row level security');
    expect(SQL).toContain('revoke all on public.leads from anon, authenticated');
    expect(SQL).toMatch(/grant execute on function public\.submit_lead\([^)]*\) to anon/);
    expect(SQL).toMatch(/revoke all on function public\.submit_lead\([^)]*\) from public/);
    expect(SQL).not.toMatch(/create policy/i);
  });

  it('la función corre con search_path vacío (security definer segura) y no repite el WhatsApp', () => {
    expect(SQL).toContain('security definer');
    expect(SQL).toContain("set search_path = ''");
    expect(SQL).toContain('unique (owner_whatsapp)');
    expect(SQL).toContain('on conflict (owner_whatsapp) do nothing');
  });
});
