# FLIXO Hub — Residual Red Team Closure Record

> REMEDIATION / EVIDENCE RECORD — NOT RELEASE CERTIFICATION

Scope intentionally excludes RT-17, RT-19, and RT-20.

## Current technical residuals addressed

### RT3-001 / RT3-002

The legacy Agent Editor topology named in Red Team issue #920 no longer exists on the current `execution` tree: `apps/agent-editor/` and `packages/agent-runtime/` are absent.

Historical remediation commits already implemented the required controls before the topology was removed:
- `78028b3b719b271fbf22e106339a82429ddca0df` — confirmation-required executor boundary and locked-target rejection.
- `0b76d08e7f5de6fad3349776b678ac957182cd3b` — regression coverage for confirmation and locked-layer enforcement.

The current canonical runtime instead exposes `planAgentRequest` / `confirmAgentPlan` and the Red Team suite asserts confirmation non-transplantability/replay resistance.

Disposition: CLOSED_BY_CURRENT_TOPOLOGY_AND_CURRENT_REGRESSION.

### RT3-003

The vulnerable Agent Editor Vitest 3.2.4 workspace is absent from the current repository topology. The current root package has no Agent Editor workspace and the current lockfile contains no Vitest 3.2.4 entry.

Historical hardening commits:
- `facf63f1e920a3a1d3e039a5dc1977c4632e301f` — upgrade Vitest to hardened 5.0.2.
- `b7ef5cce20f90f21813361a58230e7db50d4f1f5` — lockfile refresh.

Disposition: CLOSED_BY_CURRENT_TOOLCHAIN_REBASE_AND_REGRESSION.

## SEC-SWEEP-001

The live Supabase database contains the five privileged Council dispatch RPCs, all owned by `postgres`, marked SECURITY DEFINER with a pinned `search_path=pg_catalog, public, pg_temp`, and executable only by `service_role`.

The repository previously lacked authoritative DDL for those runtime RPCs. A new source-controlled migration was added:

`supabase/migrations/20261006183000_red_team_source_controlled_council_rpcs.sql`

The same migration was applied to the Supabase project. The resulting migration history contains:

`20261006154133 red_team_source_controlled_council_rpcs`

Current runtime RPCs are source-controlled and security-bounded.

Disposition: CLOSED_PENDING_EXACT_CI_CONFIRMATION.

## SEC-SWEEP-002

The historical `repository-security-baseline.yml` workflow and validator path are absent from the current repository tree.

A current residual regression scans every active workflow and rejects any `uses:` reference that is not pinned to a 40-character commit SHA.

Current workflow inventory inspected:
- ci.yml
- codeql.yml
- final-red-team.yml
- patch-capsule-controller.yml
- release-drafter.yml
- secret-scan.yml
- testsprite-execution.yml
- video-assurance.yml

All active third-party Action references observed in the current tree are commit-SHA pinned.

Disposition: CLOSED_PENDING_EXACT_CI_CONFIRMATION.

## SEC-SWEEP-003

The historical `council-wake-push-relay.yml` workflow is absent from the current repository tree.

The obsolete `FLIXO Council Wake Push Relay` trust branch was removed from the live `flixo-council-runtime` OIDC allow-list so a retired workflow cannot regain implicit trust.

The remaining Master Agent activation path is explicitly allow-listed.

Disposition: CLOSED_PENDING_EXACT_CI_CONFIRMATION.

## Residual security regression

Added:

`tests/red-team-residual-sweep.test.ts`

It verifies:
- immutable Action references;
- retired topology absence;
- source-controlled privileged Council RPC coverage;
- pinned SECURITY DEFINER search_path;
- service_role-only execute grants;
- absence of the obsolete wake relay trust path;
- current agent identity checks;
- absence of the vulnerable Vitest 3.2.4 Agent Editor workspace;
- current Red Team fail-closed controls.

The regression is wired into both `npm test` and `npm run test:core`.

## Supabase verification

The live database was queried after the migration and returned all five required functions with:
- SECURITY DEFINER;
- pinned search_path;
- `proacl={postgres=X/postgres,service_role=X/postgres}`.

Supabase security advisors were also queried after the migration. The remaining notices are INFO-level `rls_enabled_no_policy` notices for five internal-looking control tables; they are not one of the confirmed Red Team findings addressed by this record.

## Exact disposition

| Finding | Disposition | Exact current remediation branch |
|---|---|---|
| RT3-001 | CLOSED_BY_CURRENT_TOPOLOGY_AND_CURRENT_REGRESSION | `agent-residual/redteam-closure-20261006` |
| RT3-002 | CLOSED_BY_CURRENT_TOPOLOGY_AND_CURRENT_REGRESSION | `agent-residual/redteam-closure-20261006` |
| RT3-003 | CLOSED_BY_CURRENT_TOOLCHAIN_REBASE_AND_REGRESSION | `agent-residual/redteam-closure-20261006` |
| SEC-SWEEP-001 | CLOSED_PENDING_EXACT_CI_CONFIRMATION | `agent-residual/redteam-closure-20261006` |
| SEC-SWEEP-002 | CLOSED_PENDING_EXACT_CI_CONFIRMATION | `agent-residual/redteam-closure-20261006` |
| SEC-SWEEP-003 | CLOSED_PENDING_EXACT_CI_CONFIRMATION | `agent-residual/redteam-closure-20261006` |

No release certification is issued.

Fresh exact-SHA Red Team, security, build, and browser evidence is still required on the final integrated SHA.

## Required next verification

`execution -> PR -> exact-SHA CI -> fresh Red Team -> security -> build -> browser`

This record does not certify `main`, production, or release readiness.
