# FLIXO Hub Architecture Boundaries

## Current application boundary

- `src/` is the primary Vite application and current public product runtime.
- The certified MVP Agent UI is `src/routes/agent.tsx` and its deterministic local runtime is `src/lib/agent-guided-runtime.ts`.
- Manual tools remain under `src/tools/` and are independently executable through the canonical execution authority.
- The current release candidate does not use `apps/agent-editor/` or `packages/agent-runtime/` as runtime authorities. Historical migration text must not be treated as a current import contract.

## Canonical dependency direction

```text
UI/routes -> canonical contracts/config -> canonical executor -> local tool engines
                       \
                        -> output contracts/verifiers
```

Prohibited edges:

- UI -> provider-controlled media execution
- UI -> direct tool-engine invocation that bypasses the canonical executor
- Agent/LLM output -> executor without canonical plan validation and explicit confirmation
- Provider/backend -> raw user File/Blob bytes for MVP processing
- Secondary registry -> canonical runtime decisions

## Agent boundary

The Agent is a proposal/planning surface only.

`src/lib/agent-guided-runtime.ts`:
- resolves requests only against the ten admitted MVP executable IDs;
- validates parameters against canonical schemas;
- binds plans to the current catalog fingerprint;
- requires a per-file, per-plan confirmation receipt;
- delegates actual work to `executeCanonicalTool`.

No Agent module may become a second executor or registry.

## Manual boundary

Manual tool routes call the canonical execution boundary directly. They must remain usable when the Agent route is unavailable.

## Media boundary

MVP media processing is browser-local. Input validation occurs before expensive processing. The canonical executor enforces file-size, pixel/duration, MIME/container, timeout, abort, output-contract, and verifier gates.

Video rendering relies on browser media APIs; where those APIs do not permit safe worker execution, the renderer remains bounded and explicitly fail-closed rather than creating a second execution path.

## Persistence boundary

The MVP media-editing path must not require Supabase or another persistence service. Persistence may exist outside the local-editing path, but importing or calling persistence from the canonical MVP execution surface is prohibited.

## Documentation rule

Architecture documents are descriptive contracts. They do not authorize a runtime path, registry, executor, merge, or certification state. The current source code and exact-SHA verification evidence are authoritative for what actually exists.

A migration task is complete only when affected typecheck/lint/tests/build/browser checks pass on the same candidate SHA.
