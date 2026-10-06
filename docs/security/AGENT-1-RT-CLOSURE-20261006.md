# Agent 1 — Sovereign Red Team Closure Evidence (RT-01 / RT-02 / RT-10 / RT-18)

## Authority

Branch: `agent-1/redteam-closure-20261006`  
Integration target: `execution`  
Production/main is not modified by this lane.

## Implementation source SHAs

- RT-01 migration: `5112ec3eee394597d5aff1f26c6e106ebf0d0333`
- RT-18 application/schema hardening: `d4d55bdef55644f45895557fb1861c3e458d7268`
- RT-10 distributed limiter: `9a17a6d5a53b486b2c0557b3fe1f3f4911b2f438`
- RT-02 source-of-truth/claim contract: `f14207035ccb950d7fd9b4a7946ff93ccf012717`

These SHAs are the exact implementation commits contained in this closure branch before the evidence harness commit.

## RT-01

The new migration revokes EXECUTE from PUBLIC, anon, authenticated, and service_role, then grants EXECUTE only to the username that owns the current pg_cron job `flixo-assistant-wake-retry`.

Required live proof:
- anon denied;
- authenticated denied;
- service_role denied;
- scheduler role allowed;
- recent pg_cron run history recorded.

## RT-02

The repository contains the complete Edge Function source and its auditable GitHub OIDC claim contract under `supabase/functions/`.

The function intentionally remains `verify_jwt=false` because authentication is custom. The source still performs JWT signature verification against GitHub's OIDC issuer/audience, exact repository/workflow/SHA checks, job-workflow SHA checks, and fail-closed event/ref context checks.

Supabase's current Management API exposes function metadata including `version`, `verify_jwt`, and `ezbr_sha256`; its function-body endpoint exposes the deployed body. The closure workflow records both and computes a body SHA. citeturn578698view0turn578698view1

Required live proof:
- deployed metadata/body captured;
- deployed source lineage compared with repository exact SHA;
- anonymous privileged request rejected.

## RT-10

The process-local `Map` limiter is removed. The replacement uses:
- salted SHA-256 key only;
- server-side Postgres storage;
- atomic `INSERT ... ON CONFLICT DO UPDATE`;
- bounded 50,000-key storage with cleanup;
- fail-closed API behavior on limiter outage/malformed response.

Required live proof:
- table exists with RLS;
- anon/authenticated EXECUTE denied;
- service_role EXECUTE allowed;
- transactional first/second attempt behavior recorded.

## RT-18

Evidence and audit integrity now include generated IDs and timestamps in the canonical hash payload. Generated values are created before hashing, persisted explicitly, checked on read-back, and verified again. The evidence/audit foreign-key link is restored in the database.

Targeted tests cover create/persist/read/recompute, tampered identifiers/timestamps/payload or metadata, and mismatched evidence/audit links.

## Evidence status

This document records the implementation boundary. Live database and deployed-function evidence must come from the exact-SHA closure workflow and is not inferred from source text.

No release certification is asserted here.
