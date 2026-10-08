# FLIXO Hub

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

FLIXO Hub is an open-source, browser-first AI toolbox and governed developer platform for privacy-preserving local workflows, deterministic file processing, and autonomous multi-agent development control.

[![CI](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/workflows/ci.yml)
[![Security](https://img.shields.io/badge/security-CodeQL%20%7C%20secret%20scan%20%7C%20red--team-informational)](SECURITY.md)

## What is FLIXO Hub?

FLIXO Hub combines two related surfaces:

- A browser-first toolbox for local file editing and media workflows.
- A governed developer platform for projects, workspaces, agents, verification, artifacts, collaboration, and evidence-bound delivery.

The project is designed around a simple principle: useful contributions should become reusable capabilities only after verification, while execution authority remains explicit and auditable.

## Why it is different

- **Privacy-first local processing:** the MVP editing path keeps raw user File/Blob bytes out of LLMs, providers, and backends.
- **Deterministic execution:** canonical executors, output contracts, and verifiers make admitted workflows testable and reproducible.
- **Governed agents:** CELL agents operate inside explicit capability, ownership, evidence, and promotion boundaries.
- **Exact-SHA delivery:** implementation, CI evidence, and promotion are bound to the same repository identity.
- **Developer-platform foundation:** `/developer` provides governed project/workspace and contribution primitives without pretending that an unavailable remote execution provider exists.

## Current status

FLIXO Hub is an active engineering project. The repository is public, development happens on `execution`, and production/reference promotion is `execution → main` through protected automation and required evidence gates.

## Quick start

```bash
git clone https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub.git
cd FLIXO_Hub
npm ci
npm run dev
```

Core checks:

```bash
npm test
npm run build
npm run test:e2e
```

## Who this is for

FLIXO Hub is aimed at developers building privacy-sensitive browser workflows, deterministic file-processing tools, multi-agent development systems, or evidence-driven CI/CD and repository governance.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md), then inspect the current repository contracts and CI gates before changing execution or governance code.

## Licensing

FLIXO Hub is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for the complete terms.

## Security

Security-sensitive findings belong in the private reporting path described in [SECURITY.md](SECURITY.md). Do not publish credentials or exploitable details in public issues.

## Discovery keywords

AI agents · autonomous agents · multi-agent systems · agent orchestration · developer platform · browser automation · privacy-first · local processing · deterministic execution · TypeScript · React · Vite · Cloudflare Workers

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


## Start contributing

For a small, scoped first contribution, start with the open [good first issues](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or [help wanted issues](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

For repository and contribution policy, read [CONTRIBUTING.md](CONTRIBUTING.md). For reusable projects, tools, agents, skills, verifiers, adapters, workflows, and templates, use the [Developer Contribution Center](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/tree/main/src/pages/developer-contributions.tsx) and [contribution contract](docs/CONTRIBUTIONS.md).

Support and accessibility guidance are available in [SUPPORT.md](SUPPORT.md) and [ACCESSIBILITY.md](ACCESSIBILITY.md). Citation metadata is provided through [CITATION.cff](CITATION.cff).
