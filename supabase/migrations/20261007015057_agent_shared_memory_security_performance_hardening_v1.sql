-- Harden shared-memory database functions and vector extension placement.
alter extension vector set schema extensions;

create index if not exists flixo_agent_shared_memory_previous_memory_idx
  on public.flixo_agent_shared_memory (previous_memory_id);
create index if not exists flixo_agent_shared_memory_source_learning_idx
  on public.flixo_agent_shared_memory (source_learning_id);

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
