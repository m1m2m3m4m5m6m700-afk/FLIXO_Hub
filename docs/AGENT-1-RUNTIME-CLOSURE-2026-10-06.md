# Agent 1 Runtime Closure — 2026-10-06

## Scope

This record covers the Agent 1 runtime/control-plane scope for the ten-tool MVP:

- background-remover
- image-upscaler
- image-cropper
- image-compressor
- image-converter
- image-effects
- video-trimmer
- video-cropper
- video-resizer
- video-compressor

## Canonical authority

The execution authority is single-path:

`MVP_EXECUTABLE_TOOL_IDS` / `CAPABILITY_DEFINITIONS`
→ `TOOL_REGISTRY` / `TOOL_CATALOG`
→ `executeCanonicalTool()`
→ output-contract assertion
→ capability verifier
→ verified artifact

Planner/agent code may propose and confirm plans, but it invokes the canonical chain and cannot select an unadmitted capability.

## Runtime invariants

- Unknown and non-executable capabilities fail closed.
- Executable tools require canonical executor and output-contract bindings equal to their tool IDs.
- MVP execution is LOCAL and network-free.
- Input size, decoded pixel budget, media signatures, and video metadata are bounded before execution.
- Parameters are validated with strict Zod schemas before execution.
- Output MIME, signature, filename, byte bounds, and dimensions are checked through the canonical output contract.
- The capability-specific verifier must accept the artifact before success is returned.
- Chain execution is limited to 1–4 canonical MVP steps.
- Agent confirmation is required for agent-originated execution.
- Retry is bounded to the capability recovery policy, capped at three attempts, uses the same admitted tool/parameters, and never replans on failure.
- Abort/cancellation is terminal for the retry loop.
- Video inputs/outputs use the local blob-source adapter with deterministic cleanup.
- Legacy `src/lib/video/video-tool-executors.ts` is not a runtime authority.

## Retry semantics

`executeCanonicalTool()` performs canonical admission and preflight once, then executes/validates the same capability through a bounded retry helper. A retry can recover a transient execution or verification failure, but it cannot introduce a new tool, capability, executor, or plan.

## Evidence

The implementation branch is `agent-1/core-runtime-20261006`, based on the current `execution` integration line.

Repository-native validation is required on the exact candidate SHA before declaring Agent 1 completion:

- `npm test`
- `npm run build`
- `npm run test:e2e -- --project=chromium`
- `npm audit --omit=dev --audit-level=high`
- canonical execution boundary tests
- canonical verifier tests
- red-team and branch-policy gates

Local container execution is unavailable because outbound GitHub DNS/network access is blocked in this environment; CI must therefore provide the fresh executable evidence for the candidate SHA.

## Completion rule

This document does not itself certify the candidate. Agent 1 is COMPLETE only after the exact candidate SHA has fresh green evidence for the applicable repository gates and the final source/documentation state is rechecked.
