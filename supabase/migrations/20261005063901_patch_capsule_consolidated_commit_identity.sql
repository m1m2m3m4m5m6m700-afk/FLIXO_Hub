-- Keep the consolidated queue record bound to the commit actually published.
create or replace function public.flix_controller_push_queue_mark_consolidated(
  p_queue_ids uuid[],
  p_controller_agent text,
  p_current_sha text,
  p_consolidated_commit_sha text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  count_updated integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'CONTROLLER_PUSH_QUEUE_SERVICE_ROLE_REQUIRED';
  end if;
  if p_controller_agent <> 'assistantController' then
    raise exception 'CONTROLLER_PUSH_CONSOLIDATION_CONTROLLER_ONLY';
  end if;
  if p_current_sha !~ '^[0-9a-f]{40}$' or p_consolidated_commit_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'CONTROLLER_PUSH_CONSOLIDATION_SHA_INVALID';
  end if;

  update public.flix_controller_push_queue
     set status='CONSOLIDATED',
         parent_sha=p_current_sha,
         candidate_sha=p_consolidated_commit_sha,
         consolidated_commit_sha=p_consolidated_commit_sha,
         updated_at=now()
   where queue_id = any(p_queue_ids)
     and status='ACCEPTED'
     and target_sha=p_current_sha;

  get diagnostics count_updated = row_count;
  if count_updated <> coalesce(array_length(p_queue_ids,1),0) then
    raise exception 'CONTROLLER_PUSH_CONSOLIDATION_SET_MISMATCH';
  end if;

  return jsonb_build_object(
    'consolidated',true,
    'count',count_updated,
    'commitSha',p_consolidated_commit_sha,
    'currentSha',p_current_sha
  );
end;
$function$;

revoke execute on function public.flix_controller_push_queue_mark_consolidated(uuid[],text,text,text) from public, anon, authenticated;
grant execute on function public.flix_controller_push_queue_mark_consolidated(uuid[],text,text,text) to service_role;
