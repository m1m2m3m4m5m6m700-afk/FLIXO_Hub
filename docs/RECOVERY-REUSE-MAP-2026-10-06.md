# FLIXO Hub — Historical Recovery Reuse Map

Date: 2026-10-06

This document records the historical architecture that was selectively recovered for the current FLIXO Hub architecture. It is evidence/context only and is not a runtime source of truth.

## Current baseline

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Base branch: `main`
- Base SHA: `263827228cbe5f4851470297fde5f2858ff844de`
- Canonical MVP scope: 10 executable browser-local capabilities.
- Canonical runtime authorities remain the registry, execution boundary, output contracts, and capability verifiers.

## Recovered assets

### 1. Canonical execution boundary
Historical value retained:
- exact capability lookup before execution;
- executable/ready/local/network checks;
- bounded file-size and pixel preflight;
- cancellation and execution deadlines;
- output contract enforcement;
- independent capability verifier enforcement;
- bounded multi-step canonical chains.

Current placement:
`src/lib/execution/canonical-executor.ts`

This is the only execution entry point introduced by this recovery branch for the MVP capabilities.

### 2. Guided workflow semantics
Historical value retained:
- structured execution plans;
- canonical catalog fingerprint binding;
- explicit user confirmation;
- single-use confirmation receipts;
- stale/forged plan rejection;
- deterministic parameter extraction;
- reuse of the existing `ai-plan` and canonical capability contracts.

Current placement:
`src/lib/agent-guided-runtime.ts`

The guided runtime does not add a public provider gateway, cloud executor, second registry, or second execution authority.

### 3. Output-contract parity
Historical contract discipline retained:
- every currently ready tool must have one output contract;
- contract completeness is asserted;
- output verification is performed before capability verification succeeds.

Current placement:
`src/lib/contracts/tool-output-contracts.ts` plus `tests/release-registry-boundary.test.ts`.

### 4. Regression coverage
Recovered security/architecture properties are represented as current tests for:
- canonical executor resolution;
- unknown/non-executable capability rejection;
- bounded chain execution;
- one-time confirmation receipts;
- file binding of confirmation;
- catalog-fingerprint continuity;
- current MVP cardinality;
- output-contract parity.

## Deliberately not recovered

The following historical assets were rejected because they conflict with the current architecture or would create duplicate authority:

- the historical 20-tool MVP expansion;
- the removed public Agent API/provider gateway;
- historical Agent Editor runtime packages;
- cloud/provider execution authority;
- a second tool registry;
- a second executor registry;
- historical workflow receipt infrastructure that depended on the removed workflow subtree;
- removed learning persistence/model-fabric/provider-resilience subsystems;
- historical certification claims from older SHAs.

## Integration rule

Future recovery work must prefer extending the existing canonical contracts and engines. It must not create a parallel registry, executor authority, provider-controlled execution path, or alternate source of truth.

## Verification state

The branch is intentionally not certified by this document. Exact-head CI, security, build, browser, and deployment evidence must be observed on the final candidate SHA before promotion.
