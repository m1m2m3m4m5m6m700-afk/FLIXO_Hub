# FLIXO Hub — P2 Dependency Archaeology & Recovery Mapping
Date: 2026-10-06
Status: REVIEW COMPLETE / NO RUNTIME MUTATION

## 1. Execution plane
Historical execution architecture contained:
src/lib/workflows/canonical-local-execution.ts
src/lib/workflows/executable-tools.ts
src/lib/workflows/executor-registry.ts
src/lib/workflows/registry.ts
src/lib/workflows/pipeline-runner.ts
src/lib/workflows/pipeline-receipt.ts

Decision:
- canonical-local-execution.ts, executable-tools.ts, pipeline-receipt.ts -> EXTRACT.
- executor-registry.ts, registry.ts, pipeline-runner.ts, and their type authority -> REJECT as competing execution authority.

Current authority is src/lib/execution/canonical-executor.ts, created by recovery commit aea438c2dd378574d03dd7a0dee51e346f7db7f2. This current implementation resolves the canonical tool, validates parameters and file safety, executes local media work, enforces output contracts, and requires the independent capability verifier.

## 2. Agent guided semantics
Historical evidence for catalog identity and plan integrity:
- df47133701c2bab3bf492a09776fcf0753dd0b38 — bind execution plans to catalog identity.
- f5eba59c133c96fc819782969bfa43c3794e3e73 — enforce catalog identity before execution.
- 4c48692dbf7a8ef15496622d4afb703fcc9da214 — bind planner type to catalog identity.
- 0874a35c4299d2ec65aa9a84ac79db38b1af3adc — bind receipt chains to plan identity.
- 22b391aa77d2791f2bc5520d32ba253a367d991b — receipt chain integrity.
- 51e491f9037d14b0b6f65b5a61e0a84c4abed2c4 — validated one-time confirmation receipt.

Decision:
- EXTRACT/ADAPT the invariants, not the retired runtime.
- Current implementation is src/lib/agent-guided-runtime.ts, introduced by d66ced386db4c9bcf14d5f7de96a2ad2b819a294.
- It is bounded to one canonical MVP step, binds plan to current catalog fingerprint and exact file object, requires explicit confirmation, consumes the receipt once, and delegates execution to the canonical executor.

The historical public agent API, model fabric, provider routers, durable learning/runtime systems, and apps/agent-editor are REJECT for runtime recovery.

## 3. Registry authority
Historical tree contained multiple registries: workflow registry/executor registry, capability registry, agent-editor registry, developer/admin registries, and model registry.

Decision:
- Runtime registry implementations that would compete with src/config/registry.ts are REJECT.
- Historical registry invariants/tests are EXTRACT.
- Current source of truth remains TOOL_REGISTRY / TOOL_CATALOG.

## 4. Output contracts and verification
Historical output-contract implementations and contract tests are EXTRACT. The current recovery adapts the useful parity requirement in src/lib/contracts/tool-output-contracts.ts and verifies artifacts before capability verification succeeds.

Relevant recovery commits:
- 1d37be78bd2b6f375f50b459f1ca2b5e48d4a8b7 — output contract parity.
- 7641a4c541bf41f2e98c6658dd4514d1fca85621 — registry/output boundary test.

## 5. Tool-chain reconciliation
Historical tool-chain assets are ADAPT candidates:
src/lib/tool-chain.ts
src/lib/tool-chain-adapters.ts
src/lib/tool-chain-compatibility.ts
src/lib/tool-chain-runner.ts
and historical phase-3 chain tests.

Required direction: reconcile their IDs/contracts with the current canonical registry and ensure every chain step delegates to executeCanonicalTool. A second chain executor/adapter authority is not permitted.

No new chain runtime was introduced during P1/P2.

## 6. Media safety
Historical media/video assets are ADAPT/EXTRACT according to the inventory. Useful value is bounded processing, cancellation, metadata validation, and artifact integrity. Current recovery maps these semantics into the local canonical execution path instead of creating a separate worker authority.

## 7. Security
Historical security workflows, request boundaries, red-team tests, and hardening migrations are primarily EXTRACT. Each invariant must be re-proved on the current candidate SHA later.

Retired agent/provider security tests are preserved as regression-corpus candidates where the underlying invariant still applies.

## 8. Editor / Agent Editor
apps/agent-editor was explicitly removed by 244af2d7541d32dfcddc794451f744ccbddc9dc0, and the broader agent subsystem was removed by 7e4b0371a623355c520e932a9bc84187f32af862.

Decision:
- Editor runtime packages and public agent gateway: REJECT for current MVP recovery.
- Useful tests/invariants: EXTRACT.
- Low-level editor/media concepts can be reconsidered only when a current consumer exists and no parallel execution path is created.

## 9. i18n
Historical i18n implementation is ADAPT, not RESTORE. Useful Arabic/localization invariants should be mapped into current locale data/runtime rather than reviving the deleted src/lib/i18n tree.

## 10. CI / Release / Governance
Historical workflow swarms, watchdogs, repair loops, and agent orchestration remain PRESERVE AS HISTORICAL unless a specific evidence invariant is extracted.

Exact-SHA, build-identity, certification, security, and artifact checks are EXTRACT candidates. No historical certification claim is accepted for the current branch.

## 11. Persistence boundary
Historical agent persistence/runtime migrations are REJECT. Security hardening migrations are EXTRACT. The MVP media path remains browser-local; admin/evidence persistence is separate.

## 12. Scope result
The historical 20-tool / 1000-tool expansion is negative evidence against scope inflation. The only executable MVP remains the current ten-tool contract.

## 13. P2 conclusion
- No historical runtime subsystem qualifies for direct RESTORE at this stage.
- High-value assets are predominantly EXTRACT or ADAPT.
- Retired authority-producing systems are REJECT.
- Historical documentation and orchestration remain PRESERVE AS HISTORICAL.
- The next phase is P3 execution-plane verification against the current candidate, not historical runtime resurrection.
