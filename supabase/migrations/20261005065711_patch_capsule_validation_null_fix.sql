-- Accept the explicit JSON null decision used by validation-only reconciliation.
-- SQL NULL and JSON null are distinct; validation requires a JSON null decision field.

create or replace function public.flix_controller_push_queue_reconcile(
  p_queue_id uuid,
  p_controller_agent text,
  p_current_sha text,
  p_reconciled_candidate_sha text,
  p_reconciled_patch_sha256 text,
  p_reconciled_patch_text text,
  p_validation_report jsonb,
  p_reconciled_from_sha text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  row public.flix_controller_push_queue;
  current_report jsonb := coalesce(p_validation_report, '{}'::jsonb);
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'CONTROLLER_PUSH_QUEUE_SERVICE_ROLE_REQUIRED'; end if;
  if p_controller_agent <> 'assistantController' then raise exception 'CONTROLLER_PUSH_RECONCILE_CONTROLLER_ONLY'; end if;
  if p_current_sha !~ '^[0-9a-f]{40}$' or p_reconciled_candidate_sha !~ '^[0-9a-f]{40}$' or p_reconciled_from_sha !~ '^[0-9a-f]{40}$' then raise exception 'CONTROLLER_PUSH_RECONCILE_SHA_INVALID'; end if;
  if p_reconciled_patch_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'CONTROLLER_PUSH_RECONCILE_PATCH_SHA_INVALID'; end if;
  if encode(digest(coalesce(p_reconciled_patch_text,''), 'sha256'), 'hex') <> p_reconciled_patch_sha256 then raise exception 'CONTROLLER_PUSH_RECONCILE_PATCH_HASH_MISMATCH'; end if;
  if jsonb_typeof(current_report) <> 'object'
     or current_report ->> 'authority' <> 'VALIDATION_ONLY'
     or current_report ->> 'validationStatus' <> 'PASS'
     or current_report ->> 'candidateParentSha' <> p_current_sha
     or current_report ->> 'liveExecutionSha' <> p_current_sha
     or not (current_report ? 'decision')
     or jsonb_typeof(current_report -> 'decision') <> 'null' then raise exception 'CONTROLLER_PUSH_RECONCILE_REQUIRES_CURRENT_HEAD_VALIDATION'; end if;

  select * into row from public.flix_controller_push_queue where queue_id=p_queue_id for update;
  if not found then raise exception 'CONTROLLER_PUSH_QUEUE_NOT_FOUND'; end if;
  if row.branch <> 'execution' then raise exception 'CONTROLLER_PUSH_QUEUE_BRANCH_INVALID'; end if;
  if row.status not in ('PENDING_CONTROLLER_REVIEW','CONTROLLER_REVIEWING','STALE','CONFLICT','ACCEPTED') then raise exception 'CONTROLLER_PUSH_RECONCILE_STATUS_INVALID'; end if;
  if row.repository <> 'm1m2m3m4m5m6m700-afk/FLIXO_Hub' then raise exception 'CONTROLLER_PUSH_QUEUE_REPOSITORY_INVALID'; end if;
  if p_reconciled_from_sha <> row.target_sha then raise exception 'CONTROLLER_PUSH_RECONCILE_SOURCE_MISMATCH'; end if;

  update public.flix_controller_push_queue
     set target_sha=p_current_sha, parent_sha=p_current_sha, candidate_sha=p_reconciled_candidate_sha,
         reconciled_patch_sha256=p_reconciled_patch_sha256, reconciled_patch_text=p_reconciled_patch_text,
         reconciliation_count=reconciliation_count+1, reconciled_from_sha=p_reconciled_from_sha, reconciled_at=now(),
         validation_report=current_report, status='PENDING_CONTROLLER_REVIEW', controller_decision_reason=null,
         controller_decision_at=null, updated_at=now()
   where queue_id=row.queue_id returning * into row;

  return jsonb_build_object('reconciled',true,'queueId',row.queue_id,'proposalId',row.proposal_id,'status',row.status,
    'previousSha',p_reconciled_from_sha,'currentSha',row.target_sha,'candidateSha',row.candidate_sha,
    'reconciliationCount',row.reconciliation_count,'patchSha256',row.reconciled_patch_sha256);
end;
$function$;

revoke execute on function public.flix_controller_push_queue_reconcile(uuid,text,text,text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.flix_controller_push_queue_reconcile(uuid,text,text,text,text,text,jsonb,text) to service_role;
