-- Tabla de clientes interesados. Nadie del navegador la toca directo: solo entra por submit_lead.
-- Los límites y las opciones espejan src/lib/lead.ts (tests/lead-schema.test.ts lo controla).
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_name text not null check (char_length(business_name) between 2 and 80),
  business_type text not null check (char_length(business_type) between 2 and 60),
  city text not null check (char_length(city) between 2 and 60),
  weekly_appointments text not null check (weekly_appointments in ('1-10', '11-30', '31-60', '61+')),
  current_method text not null check (current_method in ('whatsapp_manual', 'llamadas', 'agenda_papel', 'otro')),
  owner_name text not null check (char_length(owner_name) between 2 and 80),
  owner_whatsapp text not null check (owner_whatsapp ~ '^[0-9]{10,15}$'),
  business_phone text not null check (business_phone ~ '^[0-9]{10,15}$'),
  consent_version text not null check (char_length(consent_version) between 1 and 20),
  consent_at timestamptz not null default now(),
  constraint leads_owner_whatsapp_key unique (owner_whatsapp)
);

-- RLS prendido y sin políticas: anon y authenticated no pueden leer ni escribir
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;

-- Única puerta de entrada: valida (por los check de la tabla) e inserta.
-- Devuelve true si anotó al cliente y false si ese WhatsApp ya estaba anotado.
create function public.submit_lead(
  p_business_name text,
  p_business_type text,
  p_city text,
  p_weekly_appointments text,
  p_current_method text,
  p_owner_name text,
  p_owner_whatsapp text,
  p_business_phone text,
  p_consent_version text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.leads (
    business_name, business_type, city, weekly_appointments, current_method,
    owner_name, owner_whatsapp, business_phone, consent_version
  ) values (
    btrim(p_business_name), btrim(p_business_type), btrim(p_city), p_weekly_appointments, p_current_method,
    btrim(p_owner_name), p_owner_whatsapp, p_business_phone, p_consent_version
  )
  on conflict (owner_whatsapp) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

revoke all on function public.submit_lead(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_lead(text, text, text, text, text, text, text, text, text) to anon;
