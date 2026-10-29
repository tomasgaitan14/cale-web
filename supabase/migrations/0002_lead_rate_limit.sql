-- Límite de envíos y submit_lead solo para el servidor.
-- Corrida después de 0001. La llama únicamente la función de Vercel (api/lead.ts) con la clave de servicio, después de
-- verificar el captcha: anon ya no puede ejecutarla.

-- Intentos de alta por IP. Se guarda un hash con clave, nunca la IP. Se vacía solo (ver submit_lead).
create table public.lead_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index lead_attempts_ip_hash_created_at_idx on public.lead_attempts (ip_hash, created_at);

alter table public.lead_attempts enable row level security;
revoke all on public.lead_attempts from anon, authenticated;

-- Cambia la firma (suma p_ip_hash): se reemplaza la función de 0001
drop function public.submit_lead(text, text, text, text, text, text, text, text, text);

-- Devuelve true si anotó al cliente y false si ese WhatsApp ya estaba anotado.
-- Falla con el código PT429 (PostgREST responde HTTP 429) si se pasó alguno de los dos límites por hora:
-- 5 intentos por IP y 100 en total (corta una tanda masiva aunque venga de muchas IP).
create function public.submit_lead(
  p_business_name text,
  p_business_type text,
  p_city text,
  p_weekly_appointments text,
  p_current_method text,
  p_owner_name text,
  p_owner_whatsapp text,
  p_business_phone text,
  p_consent_version text,
  p_ip_hash text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_per_ip constant integer := 5;
  c_max_total constant integer := 100;
  v_inserted integer;
begin
  delete from public.lead_attempts where created_at < now() - interval '1 day';

  if (select count(*) from public.lead_attempts where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= c_max_per_ip
    or (select count(*) from public.lead_attempts where created_at > now() - interval '1 hour') >= c_max_total then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;

  insert into public.lead_attempts (ip_hash) values (p_ip_hash);

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

-- Supabase da EXECUTE a anon y authenticated por defecto en funciones nuevas: se quita explícitamente
revoke all on function public.submit_lead(text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_lead(text, text, text, text, text, text, text, text, text, text) to service_role;
