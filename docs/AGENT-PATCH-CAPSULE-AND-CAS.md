# FLIXO Durable Patch Capsules and CAS Publication

## Purpose

A moving `execution` HEAD must invalidate old verification evidence without deleting useful agent work.

This protocol separates:

- **Evidence:** valid only for the exact SHA that was tested.
- **Work product:** a portable Patch Capsule that can be reconciled onto a newer `execution` HEAD.
- **Publication:** one deterministic controller lane that publishes only a fast-forward update to `execution`.

No third branch is required.

## Contract

~~~text
agent / external worker
    |
    | candidate on source SHA
    v
Patch Capsule
    |
    | durable persistence in flix_controller_push_queue
    v
Controller
    |
    | 3-way reconcile
    | fresh typecheck/lint/core/build verification
    | verify parent == live HEAD
    v
CAS fast-forward push
    |
    v
new execution SHA
~~~

### Patch Capsule identity

The persisted record contains:

- repository = `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- branch = `execution`
- `sourceSha`
- `parentSha` and `candidateSha`
- binary-safe `patchText`
- `patchSha256`
- changed `paths`
- task/work-package identity
- reconciliation history

The queue also records:

- `reconciled_patch_text`
- `reconciled_patch_sha256`
- `reconciled_from_sha`
- `reconciliation_count`
- `reconciled_at`
- `consolidated_commit_sha`

The queue is a work-product store. It is not certification evidence.

## Reconciliation rules

1. A stale candidate is never certified merely because its old tests passed.
2. The original Patch Capsule is retained when `execution` moves.
3. Reconciliation uses Git three-way application against the latest `execution` HEAD.
4. Overlapping edits fail closed as `CONFLICT`; the durable capsule remains intact.
5. Every reconciled candidate gets fresh verification on the new base.
6. The candidate parent must equal the exact live `execution` SHA immediately before publication.
7. Publication uses a normal non-force fast-forward push.
8. If another writer moves `execution` first, the push is rejected and the controller retries reconciliation from the preserved capsule.
9. No force-push and no temporary branch are used.
10. The final consolidated queue record binds `candidate_sha`, `parent_sha`, and `consolidated_commit_sha` to the commit actually published.

## Controller authority

Agents and external workers:

- may produce Patch Capsules;
- may not directly push;
- may not merge to `main`;
- may not certify;
- may not alter promotion state.

The deterministic `assistantController` lane is the only publisher for this protocol. Its scope is limited to `execution`, and it is guarded by:

- controller identity;
- GitHub Actions execution context;
- repository/branch allowlist;
- fresh current-head read;
- three-way reconciliation;
- `npm test`;
- `npm run build`;
- path-scope enforcement;
- candidate-parent equality;
- non-force `git push`;
- post-push exact-head verification.

## Durable persistence

`public.flix_controller_push_queue` is the durable store.

Its RLS posture denies `anon` and `authenticated`. The RPCs require `service_role` and reject other callers.

The persistence API is:

- `flix_controller_push_queue_enqueue`
- `flix_controller_push_queue_reconcile`
- `flix_controller_push_queue_mark_conflict`
- `flix_controller_push_queue_controller_decide`
- `flix_controller_push_queue_mark_consolidated`

## Operational usage

Capture a candidate:

~~~bash
node scripts/ci/patch-capsule.mjs capture \
  --source <source-sha> \
  --candidate <candidate-sha> \
  --out capsule.json
~~~

Verify a capsule:

~~~bash
node scripts/ci/patch-capsule.mjs verify --file capsule.json
~~~

Persist a capsule through the trusted server-side persistence boundary:

~~~bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... \
node scripts/ci/patch-capsule.mjs persist \
  --file capsule.json \
  --task <task-id> \
  --work-package <work-package-id>
~~~

The deterministic controller is available as:

~~~bash
node scripts/ci/controller-reconcile-and-publish.mjs --queue-id <queue-id>
~~~

The repository workflow is:

`.github/workflows/patch-capsule-controller.yml`

It can be manually dispatched against `execution` or run periodically after the workflow itself is promoted to `main`.

## Failure semantics

| Condition | Result |
|---|---|
| SHA/patch hash mismatch | BLOCKED |
| Wrong repository/branch | BLOCKED |
| Candidate parent is not source | BLOCKED |
| Three-way application conflict | `CONFLICT`, capsule retained |
| Fresh verification fails | BLOCKED, capsule retained |
| `execution` moves before push | CAS conflict, capsule retained |
| Non-fast-forward push | BLOCKED/CAS conflict, no overwrite |
| Post-push SHA mismatch | BLOCKED |
| Successful publication | `CONSOLIDATED` |

## Critical invariant

`Latest execution SHA is the only authoritative repository state.`

A Patch Capsule survives stale-run cancellation because it is a **portable work product**, not stale verification evidence.

The sequence is therefore:

~~~text
old SHA
  -> durable patch
  -> execution moves
  -> reconcile onto new SHA
  -> fresh verification
  -> CAS publication
  -> new authoritative SHA
~~~

No old evidence is reused, and no agent addition is silently discarded.
