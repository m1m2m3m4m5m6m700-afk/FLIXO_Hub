# FLIXO Hub

FLIXO Hub is a browser-first AI toolbox built with React 19, Vite, TypeScript, TanStack Router, and Cloudflare Workers assets.

## Repository structure

The repository is organized by responsibility rather than historical agent names. The authoritative directory map and ownership boundaries are in `docs/REPOSITORY-STRUCTURE.md`.

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
