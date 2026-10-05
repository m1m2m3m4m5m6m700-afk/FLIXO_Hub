# FLIXO Hub — P0 Baseline
Date: 2026-10-06
Status: OBSERVED / NOT CERTIFIED

## Truth line
- BASE_SHA: 263827228cbe5f4851470297fde5f2858ff844de
- RECOVERY_SHA: b8ce1e4721c9ec71972aa1c669505c232a6e2070
- BASE_REF: main
- RECOVERY_REF: recovery/current-architecture-20261006
- MVP_SCOPE_SOURCE: docs/MVP-SCOPE-DECISION.md
- REGISTRY_SOURCE: src/config/registry.ts
- EXECUTION_AUTHORITY: src/lib/execution/canonical-executor.ts
- OUTPUT_CONTRACT_AUTHORITY: src/lib/contracts/tool-output-contracts.ts
- VERIFIER_AUTHORITY: per-capability verifier bound from src/config/manual-capability-definition.ts

## Scope lock
The executable MVP remains exactly these ten capabilities:
background-remover; image-upscaler; image-cropper; image-compressor; image-converter; image-effects; video-trimmer; video-cropper; video-resizer; video-compressor.

The broader ready-tool catalog is not treated as executable MVP scope.

## Recovery lineage after BASE_SHA
aea438c2dd378574d03dd7a0dee51e346f7db7f2 — canonical MVP executor
d66ced386db4c9bcf14d5f7de96a2ad2b819a294 — bounded guided runtime
1d37be78bd2b6f375f50b459f1ca2b5e48d4a8b7 — output contract parity
831cd49e94a996087356bdc8b9899baa72f79260 — execution boundary tests
cf6a9ef62f347f7c49be62721c7bc4458a32a871 — guided runtime tests
7641a4c541bf41f2e98c6658dd4514d1fca85621 — registry/contract tests
b835066e6f03271a8a8bc0ee1dad2f6a4f4e527e — core suite wiring
0f43eea1a73385e2d47fd23ffd416bf28846727f — intent alignment
4b7f5a3255618d5425eafecb7b1989fe6b20e332 — intent candidate narrowing
b8ce1e4721c9ec71972aa1c669505c232a6e2070 — recovery mapping

## P0 evidence facts
- Current HEAD is exactly b8ce1e4721c9ec71972aa1c669505c232a6e2070.
- origin/main resolves to 263827228cbe5f4851470297fde5f2858ff844de.
- Current HEAD tracks origin/recovery/current-architecture-20261006.
- Current HEAD contains 1,011 tracked files.
- Visible Git history contains 10,417 commits across refs.

## Evidence invalidation
Any repository mutation after b8ce1e4721c9ec71972aa1c669505c232a6e2070 invalidates this baseline's exact-SHA claims. New evidence must bind to the new candidate SHA.
