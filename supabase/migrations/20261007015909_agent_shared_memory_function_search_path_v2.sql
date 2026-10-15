-- Reapply function-level search_path hardening after all shared-memory function replacements.
alter function public.flixo_require_agent_learning_service_role()
  set search_path = pg_catalog, public, extensions;
alter function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb)
  set search_path = pg_catalog, public, extensions;
alter function public.flixo_review_agent_memory(uuid,text,text,text,jsonb,boolean,text)
  set search_path = pg_catalog, public, extensions;
alter function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text)
  set search_path = pg_catalog, public, extensions;
alter function public.flixo_reconcile_agent_memory(uuid,text)
  set search_path = pg_catalog, public, extensions;
alter function public.flixo_search_agent_memory(text,text,integer,boolean)
  set search_path = pg_catalog, public, extensions;

revoke all on function public.flixo_require_agent_learning_service_role() from public,anon,authenticated;
revoke all on function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.flixo_review_agent_memory(uuid,text,text,text,jsonb,boolean,text) from public,anon,authenticated;
revoke all on function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.flixo_reconcile_agent_memory(uuid,text) from public,anon,authenticated;
revoke all on function public.flixo_search_agent_memory(text,text,integer,boolean) from public,anon,authenticated;

grant execute on function public.flixo_require_agent_learning_service_role() to service_role;
grant execute on function public.flixo_submit_agent_memory(text,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.flixo_review_agent_memory(uuid,text,text,text,jsonb,boolean,text) to service_role;
grant execute on function public.flixo_record_agent_memory_usage(uuid,text,text,text,text,jsonb,text) to service_role;
grant execute on function public.flixo_reconcile_agent_memory(uuid,text) to service_role;
grant execute on function public.flixo_search_agent_memory(text,text,integer,boolean) to service_role;
