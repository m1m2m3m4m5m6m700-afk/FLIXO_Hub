# RT-02 — Council Runtime Source-of-Truth / Lineage

## Scope

Target function: `flixo-council-runtime`.

Repository source:
`supabase/functions/flixo-council-runtime/index.ts`

The function remains `verify_jwt=false` by design because it has a custom authentication boundary. The repository source delegates claim/context validation to the version-controlled contract at `src/lib/security/council-oidc.ts`, while JWT signature, issuer, and audience verification remains inside the Edge Function.

## Exact security contract

The runtime requires a bearer token and rejects malformed/missing tokens before JWT verification. It then verifies the GitHub OIDC token against:

- issuer: `https://token.actions.githubusercontent.com`;
- function-specific audience;
- exact repository claim;
- allowlisted workflow name;
- exact 40-hex workflow SHA;
- optional job workflow reference plus exact job workflow SHA;
- event/ref/workflow-reference context.

The external lease watcher is additionally bound to the repository's `main` workflow reference and requires job/workflow SHA equality.

## Repository evidence

The live `execution` branch contained the runtime source before this closure lane was created. Agent 1 did not discover another open PR changing this function path. This closure therefore adds the auditable shared contract and negative regression suite rather than creating a second runtime implementation.

## Deployment lineage

Supabase's Management API exposes a function record including `version` and `ezbr_sha256`, and a separate function-body endpoint. Both require Edge Functions read authorization. The current agent environment does not provide a Supabase Management API credential, so a live deployed-version/hash equality check could not be executed from this session.

Required production evidence path:

`GET /v1/projects/<project-ref>/functions/flixo-council-runtime`

then:

`GET /v1/projects/<project-ref>/functions/flixo-council-runtime/body`

The deployed `ezbr_sha256` / version and body must be recorded against the exact repository commit that contains the runtime source before production certification.

This document intentionally does **not** claim that deployed runtime lineage has been live-verified.
