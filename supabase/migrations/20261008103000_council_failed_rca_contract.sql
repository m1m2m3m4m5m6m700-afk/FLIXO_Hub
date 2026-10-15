-- EXEC-GOV-COUNCIL-RCA-001
-- Failed Council dispatches retain a durable RCA/error field without creating a second dispatch authority.

alter table if exists public.flix_council_dispatches
  add column if not exists last_error text;

create or replace function public.flixo_council_failed_rca_guard()
returns trigger
language plpgsql
security definer
set search_path to pg_catalog, public, pg_temp
as $function$
begin
  if new.status = 'FAILED' then
    new.last_error = coalesce(
      nullif(trim(coalesce(new.last_error, '')), ''),
      nullif(trim(coalesce(new.payload->>'error', '')), ''),
      nullif(trim(coalesce(new.payload->>'message', '')), ''),
      'COUNCIL_DISPATCH_FAILED'
    );
  end if;
  return new;
end;
$function$;

revoke execute on function public.flixo_council_failed_rca_guard() from public, anon, authenticated;
grant execute on function public.flixo_council_failed_rca_guard() to service_role;

drop trigger if exists flixo_council_failed_rca_guard on public.flix_council_dispatches;
create trigger flixo_council_failed_rca_guard
before insert or update on public.flix_council_dispatches
for each row execute function public.flixo_council_failed_rca_guard();

create index if not exists flix_council_dispatches_last_error_idx
  on public.flix_council_dispatches (status, updated_at desc)
  where status = 'FAILED';
