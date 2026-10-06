-- Red Team RT-10: serverless-safe distributed admin login rate limiting.
-- Only a salted SHA-256 key is persisted; raw client IPs never enter the database.

create table if not exists public.flix_admin_login_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  attempts integer not null,
  updated_at timestamptz not null default now()
);

alter table public.flix_admin_login_rate_limits
  add constraint flix_admin_login_rate_key_hash_check
    check (key_hash ~ '^[0-9a-f]{64}$'),
  add constraint flix_admin_login_rate_attempts_check
    check (attempts between 1 and 11);

alter table public.flix_admin_login_rate_limits enable row level security;

revoke all on table public.flix_admin_login_rate_limits from public;
revoke all on table public.flix_admin_login_rate_limits from anon;
revoke all on table public.flix_admin_login_rate_limits from authenticated;
grant select, insert, update, delete on table public.flix_admin_login_rate_limits to service_role;

create or replace function public.flixo_admin_login_rate_check(p_key_hash text)
returns table (
  allowed boolean,
  attempts integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window timestamptz := date_trunc('minute', v_now);
  v_attempts integer;
  v_window_started_at timestamptz;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'ADMIN_LOGIN_RATE_KEY_INVALID';
  end if;

  delete from public.flix_admin_login_rate_limits
   where updated_at < v_window - interval '2 minutes';

  if (select count(*) from public.flix_admin_login_rate_limits) >= 50000 then
    delete from public.flix_admin_login_rate_limits
     where key_hash in (
       select key_hash
         from public.flix_admin_login_rate_limits
        order by updated_at asc
        limit 5000
     );
  end if;

  insert into public.flix_admin_login_rate_limits (
    key_hash, window_started_at, attempts, updated_at
  )
  values (p_key_hash, v_window, 1, v_now)
  on conflict (key_hash) do update
  set
    window_started_at = excluded.window_started_at,
    attempts = case
      when public.flix_admin_login_rate_limits.window_started_at < excluded.window_started_at then 1
      else least(public.flix_admin_login_rate_limits.attempts + 1, 11)
    end,
    updated_at = v_now
  returning
    public.flix_admin_login_rate_limits.attempts,
    public.flix_admin_login_rate_limits.window_started_at
  into v_attempts, v_window_started_at;

  return query
  select
    v_attempts <= 10,
    v_attempts,
    greatest(
      0,
      ceil(extract(epoch from ((v_window_started_at + interval '1 minute') - v_now)))
    )::integer;
end;
$function$;

revoke execute on function public.flixo_admin_login_rate_check(text) from public;
revoke execute on function public.flixo_admin_login_rate_check(text) from anon;
revoke execute on function public.flixo_admin_login_rate_check(text) from authenticated;
grant execute on function public.flixo_admin_login_rate_check(text) to service_role;
