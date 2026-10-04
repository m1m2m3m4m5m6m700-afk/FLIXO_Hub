# FLIXO AGENT-2 — RED TEAM / QA REPORT

Date: 2026-10-04
Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
Base under test: `execution`
Base SHA: `23279af9ca7c4e696d0ac8d6ea929e8652b712af`
QA branch: `agent-2/red-team-qa-20261004`
Current QA SHA: `04515cedc7dd2a15036a5b030c993c0024041e46`
PR: #1003

## Certification decision

**NO-GO**

The target release gate is not satisfied. A green result from the pre-existing suite is insufficient because the current execution tree is a manual/browser-first product surface without the canonical Agent runtime needed for the requested Natural Language -> Planner -> Selection -> Plan -> Confirmation -> Executor -> Verifier flow.

## Findings

### RT-001 — HIGH — Canonical execution-authority bypass
Status: **FIXED**

File: `src/lib/tool-chain-runner.ts`
Location: `runStoredToolChain()`

Reproduction:
1. Persist `image-rotate` in `flixo:tool-chain:v1`.
2. Open `/en/image-rotate`.
3. Upload an image.
4. Run the stored chain.

Before fix, the runner validated MIME compatibility and adapter existence but did not require the capability to be canonical `EXECUTABLE`. The direct adapter path could therefore execute a capability whose canonical state was only `PLANNABLE`.

Exploit path:
localStorage persisted plan -> tool-chain panel -> `runStoredToolChain` -> direct adapter -> image engine, bypassing canonical capability state.

Fix:
The runner now requires:
- canonical registration;
- `capability.state === EXECUTABLE`;
- local/no-network execution;
- matching canonical executor binding;
- output-contract binding;
- Blob input and non-empty plan.

Regression:
- `tests/red-team-canonical-boundary.test.ts`
- `tests/official/red-team-canonical-boundary.spec.ts`

Verification:
The mutation is present on QA SHA `04515c...`. The prior CI run for its immediate fix ancestor `db440ac5195166ead717351d475a02372a594e50` completed typecheck/lint/core/build successfully. The latest QA SHA has a newly triggered CI run; certification waits for its final result.

### RT-002 — CRITICAL — Canonical Agent runtime/execution surface absent
Status: **OPEN / RELEASE BLOCKER**

Expected files are absent on the current execution tree:
- `packages/agent-runtime/*`
- `src/lib/agent/*`
- `api/flixo-agent.ts`
- canonical execution/confirmation/verifier pipeline

Impact:
The requested Agent security chain cannot execute or be certified. There is no trustworthy surface on this SHA for:
- agent-originated confirmation;
- executor authorization;
- locked-layer mutation checks;
- stale-plan/task-revision binding;
- verifier-before-complete;
- cancellation side-effect suppression;
- bounded agent retry;
- natural-language agent workflow execution.

This is not reported as a skipped test. It is a hard release blocker.

### RT-003 — HIGH — False-green architecture/test coverage
Status: **FIXED AS A QA GATE**

The existing architecture verification required `packages/contracts` but did not require the Agent runtime. Existing `npm test` could therefore remain green while the required Agent surface was absent.

Fix:
Added fail-closed release tests:
- `tests/red-team-agent-runtime-presence.test.ts`
- `tests/red-team-20-tool-gate.test.ts`

These are now part of `test:core`. The suite must go red rather than falsely certifying the missing Agent/20-tool surface.

### RT-004 — HIGH — 20-tool target is not 20 canonical executable capabilities
Status: **OPEN / RELEASE BLOCKER**

Target capability state observed from the current registry:
- EXECUTABLE: background remover, upscaler, cropper, compressor, converter, effects.
- PLANNABLE/non-executable: resize, rotate/flip, brightness/contrast, saturation/hue, sharpen, blur, filters, watermark.
- Missing canonical capabilities: exposure, highlights, shadows, duotone, text overlay, draw/annotate, redaction.

Therefore the requested 20/20 Agent workflow gate is not achievable on this SHA.

### RT-005 — MEDIUM — Tool-chain contracts are incomplete relative to available adapters
Status: **OPEN**

`src/lib/tool-chain-compatibility.ts` declares contracts for only a subset of local adapters. This creates a governance mismatch between adapter availability and declared chain compatibility.

Decision: keep open until canonical executor/capability migration is complete; do not close as PASS.

### RT-006 — MEDIUM — Plan identity is catalog-bound but not task-revision-bound on current contract
Status: **OPEN**

`src/lib/contracts/ai-plan.ts` binds a plan to a catalog fingerprint and executable capabilities, but the current branch lacks the Agent task/execution runtime that should bind a plan to task revision/state before mutation. This remains a TOCTOU design gate for the restored runtime.

## 20-tool target matrix

Each target requires 20 adversarial scenarios:
valid, invalid, missing parameter, malformed parameter, unsupported MIME, corrupted image, zero/negative dimensions, enormous dimensions, oversized file, repeated execution, concurrency, cancellation, timeout, retry exhaustion, verifier failure, locked layer, confirmation required, confirmation denied, unknown tool, forged plan.

| Target | Canonical IDs | Current gate |
|---|---|---|
| background remover | background-remover | EXECUTABLE |
| upscaler | image-upscaler | EXECUTABLE |
| cropper | image-cropper | EXECUTABLE |
| compressor | image-compressor | EXECUTABLE |
| converter | image-converter | EXECUTABLE |
| effects | image-effects | EXECUTABLE |
| resize | image-resizer | PLANNABLE |
| rotate/flip | image-rotate, image-flip-horizontal, image-flip-vertical | PLANNABLE |
| brightness/contrast | image-brightness, image-contrast | PLANNABLE |
| saturation/hue | image-saturation, image-hue | PLANNABLE |
| exposure | image-exposure | MISSING |
| highlights/shadows | image-highlights, image-shadows | MISSING |
| sharpen | image-sharpen | PLANNABLE |
| blur | image-blur | PLANNABLE |
| grayscale/duotone | image-grayscale, image-duotone | PLANNABLE + MISSING |
| filters | filter-mask | PLANNABLE |
| watermark | watermark-adder | PLANNABLE |
| text overlay | text-overlay | MISSING |
| draw/annotate | draw-annotate | MISSING |
| redaction | redaction | MISSING |

**20/20 target gate: FAIL.**

## Browser verification

Verified coverage added:
- Chromium test rejects a persisted `PLANNABLE` tool before processing.
- The browser regression test asserts no output artifact is produced.
- The regression test also asserts no unexpected external POST/network side effect during the rejected execution.

Existing baseline CI for SHA `23279...` had successful core/typecheck/build, Chromium smoke, Secret Scan, and CodeQL, but that was not a 20-tool Agent certification.

Latest QA browser/CI evidence is still pending for SHA `04515c...`; no browser PASS is claimed until that run is completed.

## Remaining risks

1. Restore the canonical Agent runtime and bind it to the current registry/executor/verifier authority.
2. Promote the full 20 requested image capabilities to canonical executable status only when real local executors + parameter schemas + output contracts + verifiers exist.
3. Add task revision/plan identity binding and locked-layer authorization at the execution boundary.
4. Add bounded timeout/cancellation/retry semantics and prove no side effects after cancellation.
5. Add full 20 x 20 runtime adversarial execution evidence, not merely structural registry assertions.
6. Add 20/20 Manual and 20/20 Agent browser workflows, including Arabic RTL/mobile, result rendering, download/export, confirmations, and locked layers.

## Handoff to AGENT-3

Final tested QA SHA: **`04515cedc7dd2a15036a5b030c993c0024041e46`**

Current decision: **NO-GO**

PR: #1003

Blocking findings: **RT-002 CRITICAL, RT-004 HIGH**

Fixed findings: **RT-001 HIGH, RT-003 HIGH**

No tests were deleted, weakened, skipped, or masked to obtain the current result.
