# FLIXO Hub Architecture

FLIXO Hub is a React 19 + Vite + TypeScript browser-first application. The production static/runtime boundary is Cloudflare Workers assets.

```text
Browser
  |
  +-- TanStack Router
  |     +-- localized home/tool routes
  |     +-- /agent guided workflow
  |
  +-- src/config
  |     +-- canonical capability definitions
  |     +-- TOOL_REGISTRY / TOOL_CATALOG
  |
  +-- src/lib
  |     +-- intent/planning contracts
  |     +-- canonical execution boundary
  |     +-- output contracts + verifiers
  |     +-- file-safety and persistence boundaries
  |
  +-- src/tools
  |     +-- manual tool UIs
  |     +-- local browser engines
  |
  +-- src/worker.ts
        +-- static asset delivery
        +-- security headers
        +-- production identity endpoint
        +-- fail-closed /api/* boundary
```

## Runtime authority

1. `src/config/manual-capability-definition.ts` owns canonical capability state, parameter schemas, safety limits, intents, verifier bindings, and the executable MVP set.
2. `src/config/registry.ts` exposes the single canonical `TOOL_REGISTRY` / `TOOL_CATALOG`.
3. `src/lib/contracts/ai-plan.ts` validates bounded plans against the current catalog fingerprint.
4. `src/lib/execution/canonical-executor.ts` is the single canonical execution authority for MVP operations.
5. `src/lib/contracts/tool-output-contracts.ts` and capability verifiers independently validate produced artifacts.

Agents and provider/model outputs are untrusted proposal data. They do not own execution authority.

## Supported product workflows

The MVP supports two independent workflows:

- Agent Guided Workflow: prompt + local File/Blob -> deterministic local intent/parameter resolution -> confirmation receipt -> canonical executor -> verifier -> downloadable artifact.
- Manual Standalone Workflow: tool route -> local file input -> canonical executor -> verifier -> downloadable artifact.

The Manual workflow does not depend on the Agent workflow.

## Browser-local privacy boundary

The MVP editing path executes in the browser. Raw user File/Blob bytes are not placed in an agent/provider request contract and are not sent to provider endpoints or backend file-processing services.

The static production Worker deliberately returns a fail-closed 404 for `/api/*`; current MVP editing does not require a backend processing API.

## Persistence boundary

Supabase and other persistence configuration may exist for non-MVP product surfaces, but the ten-tool MVP editing path is intentionally persistence-independent.

## Verification boundary

Required verification is exact-SHA driven. Typecheck, lint, core contracts, browser E2E, security checks, Red Team evidence, and deployment identity are release gates rather than documentation claims.

This document describes the current repository architecture and contains no certification authority.
