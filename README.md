# FLIXO Hub

FLIXO Hub is a browser-first AI toolbox built with React 19, Vite, TypeScript, TanStack Router, and Cloudflare Workers assets.

## Architecture

- `src/config` — canonical capability definitions and the single `TOOL_REGISTRY` / `TOOL_CATALOG`.
- `src/lib` — intent planning, canonical local execution, output contracts, verifiers, security boundaries, routing, i18n, and product runtime.
- `src/tools` — isolated user-facing manual tools and local browser engines.
- `src/worker.ts` — production static Worker boundary, security headers, and exact-SHA identity verification.
- `supabase` — persistence configuration for non-MVP surfaces; the MVP editing path is persistence-independent.

## MVP workflows

The current MVP supports two independent workflows where admitted:

1. Agent Guided Workflow — local file + natural-language instruction -> deterministic plan -> explicit confirmation -> canonical local execution -> verifier -> artifact.
2. Manual Standalone Workflow — direct tool route -> local file input -> canonical local execution -> verifier -> artifact.

Raw user File/Blob bytes are never sent to an LLM/provider/backend as part of the MVP local editing path.

## Internationalization

The canonical locales are exactly:

`ar`, `en`, `es`, `fr`, `de`, `hi`, `id`, `it`, `ja`, `ko`, `ms`, `nl`, `pl`, `pt`, `ru`, `sv`, `th`, `tr`, `uk`, `vi`.

Arabic (`ar`) is the default locale.

## Core commands

```bash
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

The production build generates `robots.txt`, `sitemap.xml`, and physical SPA route entries.

## Deployment

`wrangler.jsonc` defines the canonical Cloudflare production deployment at `https://flixoai.m1m2m3m4m5m6m700.workers.dev`. The static Worker intentionally fails closed for `/api/*` on the canonical production origin.

Provider and database credentials remain server-side. Never expose secrets through `VITE_*` variables.

## Public launch

The launch program is tracked in `docs/FLIXO-PUBLIC-LAUNCH-EXECUTION-PLAN.md` and release truth is recorded in `docs/FLIXO-PUBLIC-RELEASE-MANIFEST.md`.

A public launch is not certified merely because the application builds. CI, security, Red Team, production identity, and browser evidence must bind to the same exact release SHA.


## FLIXO Hub local-processing boundary

The /hub and /en/hub surfaces are the first Stage 1 implementation of the 2026-10-08 FLIXO Hub contract. They provide a browser-local Worker demonstration, transferable ArrayBuffer messaging, OPFS with a session-memory fallback, browser capability detection, and a privacy page.

The Hub processing surface does not call network transport APIs and does not persist files or identifiers in browser storage. Runtime delivery is origin-only; third-party CDN bootstrap is not permitted.

Stage 1 currently contains no newly added runtime dependency. OCR remains deliberately blocked until self-hosted Tesseract worker/core/language assets are admitted and verified.


## General programming platform

FLIXO Hub now exposes a governed developer-platform foundation at `/developer` and `/en/developer`.

The platform contract unifies project/workspace state, repository identity, sandbox execution policy, verification, CELL agents, artifact evidence, collaboration, contributions, and evidence-based learning. It intentionally does not pretend that a remote code-execution provider is connected: until a real provider satisfies the execution contract, that surface remains a foundation state rather than a fake terminal.

The platform is designed as a mutual-value loop: people can build and reuse projects, tools, agents, skills, templates, and workflows; only verified contributions become publishable reusable capabilities; evidence remains bound to source identity and canonical governance.
