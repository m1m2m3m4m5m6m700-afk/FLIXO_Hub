-- Durable Patch Capsule reconciliation on the sole execution line.
-- Work-product persistence is not certification evidence and never grants agents
-- direct push/merge/certification authority.

alter table public.flix_controller_push_queue
  alter column repository set default 'm1m2m3m4m5m6m700-afk/FLIXO_Hub';

alter table public.flix_controller_push_queue
  add column if not exists reconciled_patch_sha256 text,
  add column if not exists reconciled_patch_text text,
  add column if not exists reconciliation_count integer not null default 0,
  add column if not exists reconciled_from_sha text,
  add column if not exists reconciled_at timestamptz;

alter table public.flix_controller_push_queue
  drop constraint if exists flix_controller_push_queue_reconciliation_count_check;
alter table public.flix_controller_push_queue
  add constraint flix_controller_push_queue_reconciliation_count_check
  check (reconciliation_count >= 0 and reconciliation_count <= 1000);

alter table public.flix_controller_push_queue
  drop constraint if exists flix_controller_push_queue_reconciled_patch_sha256_check;
alter table public.flix_controller_push_queue
  add constraint flix_controller_push_queue_reconciled_patch_sha256_check
  check (reconciled_patch_sha256 is null or reconciled_patch_sha256 ~ '^[0-9a-f]{64}$');

alter table public.flix_controller_push_queue
  drop constraint if exists flix_controller_push_queue_reconciled_from_sha_check;
alter table public.flix_controller_push_queue
  add constraint flix_controller_push_queue_reconciled_from_sha_check
  check (reconciled_from_sha is null or reconciled_from_sha ~ '^[0-9a-f]{40}$');

create or replace function public.flix_controller_push_queue_enqueue(
  p_proposal_id text,
  p_repository text,
  p_branch text,
  p_task_id text,
  p_work_package_id text,
  p_target_sha text,
  p_parent_sha text,
  p_candidate_sha text,
  p_patch_sha256 text,
  p_paths jsonb,
  p_patch_text text,
  p_push_manifest jsonb,
  p_validation_report jsonb,
  p_source_run_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  row public.flix_controller_push_queue;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'CONTROLLER_PUSH_QUEUE_SERVICE_ROLE_REQUIRED';
  end if;

  if p_proposal_id is null or length(trim(p_proposal_id)) = 0 then
    raise exception 'CONTROLLER_PUSH_QUEUE_PROPOSAL_ID_REQUIRED';
  end if;
  if p_repository is null or p_repository <> 'm1m2m3m4m5m6m700-afk/FLIXO_Hub' then
    raise exception 'CONTROLLER_PUSH_QUEUE_REPOSITORY_INVALID';
  end if;
  if p_branch <> 'execution' then
    raise exception 'CONTROLLER_PUSH_QUEUE_BRANCH_INVALID';
  end if;
  if p_target_sha !~ '^[0-9a-f]{40}$' or p_parent_sha !~ '^[0-9a-f]{40}$' or p_candidate_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'CONTROLLER_PUSH_QUEUE_SHA_INVALID';
  end if;
  if p_patch_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'CONTROLLER_PUSH_QUEUE_PATCH_SHA_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_paths,'[]'::jsonb)) <> 'array' then
    raise exception 'CONTROLLER_PUSH_QUEUE_PATHS_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_push_manifest,'{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_validation_report,'{}'::jsonb)) <> 'object' then
    raise exception 'CONTROLLER_PUSH_QUEUE_JSON_INVALID';
  end if;

  insert into public.flix_controller_push_queue (
    proposal_id, repository, branch, task_id, work_package_id, target_sha, parent_sha,
    candidate_sha, patch_sha256, paths, patch_text, push_manifest, validation_report,
    source_run_id, reconciled_patch_sha256, reconciled_patch_text, reconciliation_count,
    reconciled_from_sha, reconciled_at
  ) values (
    p_proposal_id, p_repository, p_branch, p_task_id, p_work_package_id, p_target_sha, p_parent_sha,
    p_candidate_sha, p_patch_sha256, p_paths, p_patch_text, p_push_manifest, p_validation_report,
    p_source_run_id, null, null, 0, null, null
  )
  on conflict (proposal_id) do update
    set repository = excluded.repository,
        target_sha = excluded.target_sha,
        parent_sha = excluded.parent_sha,
        candidate_sha = excluded.candidate_sha,
        patch_sha256 = excluded.patch_sha256,
        paths = excluded.paths,
        patch_text = excluded.patch_text,
        push_manifest = excluded.push_manifest,
        validation_report = excluded.validation_report,
        source_run_id = excluded.source_run_id,
        status = case
          when public.flix_controller_push_queue.status in ('CONSOLIDATED','ACCEPTED','REJECTED') then public.flix_controller_push_queue.status
          else 'PENDING_CONTROLLER_REVIEW'
        end,
        updated_at = now()
  returning * into row;

  return jsonb_build_object(
    'queued', true,
    'queueId', row.queue_id,
    'proposalId', row.proposal_id,
    'status', row.status,
    'targetSha', row.target_sha
  );
end;
$function$;

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
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'CONTROLLER_PUSH_QUEUE_SERVICE_ROLE_REQUIRED';
  end if;
  if p_controller_agent <> 'assistantController' then
    raise exception 'CONTROLLER_PUSH_RECONCILE_CONTROLLER_ONLY';
  end if;
  if p_current_sha !~ '^[0-9a-f]{40}$'
     or p_reconciled_candidate_sha !~ '^[0-9a-f]{40}$'
     or p_reconciled_from_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'CONTROLLER_PUSH_RECONCILE_SHA_INVALID';
  end if;
  if p_reconciled_patch_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'CONTROLLER_PUSH_RECONCILE_PATCH_SHA_INVALID';
  end if;
  if encode(digest(coalesce(p_reconciled_patch_text, ''), 'sha256'), 'hex') <> p_reconciled_patch_sha256 then
    raise exception 'CONTROLLER_PUSH_RECONCILE_PATCH_HASH_MISMATCH';
  end if;
  if jsonb_typeof(current_report) <> 'object'
     or current_report ->> 'authority' <> 'VALIDATION_ONLY'
     or current_report ->> 'validationStatus' <> 'PASS'
     or current_report ->> 'candidateParentSha' <> p_current_sha
     or current_report ->> 'liveExecutionSha' <> p_current_sha
     or current_report ? 'decision' then
    raise exception 'CONTROLLER_PUSH_RECONCILE_REQUIRES_CURRENT_HEAD_VALIDATION';
  end if;

  select * into row
    from public.flix_controller_push_queue
   where queue_id = p_queue_id
   for update;

  if not found then
    raise exception 'CONTROLLER_PUSH_QUEUE_NOT_FOUND';
  end if;
  if row.branch <> 'execution' then
    raise exception 'CONTROLLER_PUSH_QUEUE_BRANCH_INVALID';
  end if;
  if row.status not in ('PENDING_CONTROLLER_REVIEW','CONTROLLER_REVIEWING','STALE','CONFLICT') then
    raise exception 'CONTROLLER_PUSH_RECONCILE_STATUS_INVALID';
  end if;
  if row.repository <> 'm1m2m3m4m5m6m700-afk/FLIXO_Hub' then
    raise exception 'CONTROLLER_PUSH_QUEUE_REPOSITORY_INVALID';
  end if;
  if p_reconciled_from_sha <> row.target_sha then
    raise exception 'CONTROLLER_PUSH_RECONCILE_SOURCE_MISMATCH';
  end if;

  update public.flix_controller_push_queue
     set target_sha = p_current_sha,
         parent_sha = p_current_sha,
         candidate_sha = p_reconciled_candidate_sha,
         reconciled_patch_sha256 = p_reconciled_patch_sha256,
         reconciled_patch_text = p_reconciled_patch_text,
         reconciliation_count = reconciliation_count + 1,
         reconciled_from_sha = p_reconciled_from_sha,
         reconciled_at = now(),
         validation_report = current_report,
         status = 'PENDING_CONTROLLER_REVIEW',
         controller_decision_reason = null,
         controller_decision_at = null,
         updated_at = now()
   where queue_id = row.queue_id
   returning * into row;

  return jsonb_build_object(
    'reconciled', true,
    'queueId', row.queue_id,
    'proposalId', row.proposal_id,
    'status', row.status,
    'previousSha', p_reconciled_from_sha,
    'currentSha', row.target_sha,
    'candidateSha', row.candidate_sha,
    'reconciliationCount', row.reconciliation_count,
    'patchSha256', row.reconciled_patch_sha256
  );
end;
$function$;

create or replace function public.flix_controller_push_queue_mark_conflict(
  p_queue_id uuid,
  p_controller_agent text,
  p_current_sha text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  row public.flix_controller_push_queue;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'CONTROLLER_PUSH_QUEUE_SERVICE_ROLE_REQUIRED';
  end if;
  if p_controller_agent <> 'assistantController' then
    raise exception 'CONTROLLER_PUSH_CONFLICT_CONTROLLER_ONLY';
  end if;
  if p_current_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'CONTROLLER_PUSH_CONFLICT_SHA_INVALID';
  end if;

  select * into row
    from public.flix_controller_push_queue
   where queue_id = p_queue_id
   for update;
  if not found then
    raise exception 'CONTROLLER_PUSH_QUEUE_NOT_FOUND';
  end if;

  update public.flix_controller_push_queue
     set status = 'CONFLICT',
         controller_decision_reason = left(trim(coalesce(p_reason,'')), 2000),
         validation_report = jsonb_build_object(
           'authority','VALIDATION_ONLY',
           'validationStatus','CONFLICT',
           'liveExecutionSha',p_current_sha,
           'reason',left(trim(coalesce(p_reason,'')),2000)
         ),
         updated_at = now()
   where queue_id = row.queue_id
   returning * into row;

  return jsonb_build_object(
    'conflict', true,
    'queueId', row.queue_id,
    'proposalId', row.proposal_id,
    'status', row.status,
    'currentSha', p_current_sha
  );
end;
$function$;

revoke execute on function public.flix_controller_push_queue_enqueue(text,text,text,text,text,text,text,text,text,jsonb,text,jsonb,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.flix_controller_push_queue_enqueue(text,text,text,text,text,text,text,text,text,jsonb,text,jsonb,jsonb,bigint) to service_role;

revoke execute on function public.flix_controller_push_queue_reconcile(uuid,text,text,text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.flix_controller_push_queue_reconcile(uuid,text,text,text,text,text,jsonb,text) to service_role;

revoke execute on function public.flix_controller_push_queue_mark_conflict(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.flix_controller_push_queue_mark_conflict(uuid,text,text,text) to service_role;
