-- Red Team RT-01: fail-closed EXECUTE boundary for the privileged wake-retry RPC.
-- The pg_cron job must remain callable by its actual scheduler role only.

revoke execute on function public.flixo_retry_pending_assistant_wakes() from public;
revoke execute on function public.flixo_retry_pending_assistant_wakes() from anon;
revoke execute on function public.flixo_retry_pending_assistant_wakes() from authenticated;
revoke execute on function public.flixo_retry_pending_assistant_wakes() from service_role;

do $block$
declare
  scheduler_role name;
begin
  select username
    into scheduler_role
    from cron.job
   where jobname = 'flixo-assistant-wake-retry'
   order by jobid desc
   limit 1;

  if scheduler_role is null then
    raise exception 'RT-01 scheduler role not found for flixo-assistant-wake-retry';
  end if;

  execute format(
    'grant execute on function public.flixo_retry_pending_assistant_wakes() to %I',
    scheduler_role
  );
end;
$block$;
