-- FLIXO Level 3 + Level 4 security hardening.
-- Fix function-level search_path drift introduced by later function replacements.
-- Authority remains service_role-only.

alter function public.flixo_store_agent_memory_embedding(uuid, extensions.vector)
  set search_path = pg_catalog, public, extensions;

alter function public.flixo_search_agent_memory_semantic(extensions.vector,text,text,integer,boolean)
  set search_path = pg_catalog, public, extensions;

alter function public.flixo_reject_economy_ledger_mutation()
  set search_path = pg_catalog, public, extensions;

alter function public.flixo_economy_quote_task(smallint,numeric,numeric)
  set search_path = pg_catalog, public, extensions;

alter function public.flixo_economy_seed_wallet(text,text,numeric)
  set search_path = pg_catalog, public, extensions;

alter function public.flixo_economy_open_task(text,text,smallint,numeric,numeric)
  set search_path = pg_catalog, public, extensions;

alter function public.flixo_economy_claim_task(text,text,text)
  set search_path = pg_catalog, public, extensions;

alter function public.flixo_economy_settle_task(text,text,text,text,jsonb)
  set search_path = pg_catalog, public, extensions;
