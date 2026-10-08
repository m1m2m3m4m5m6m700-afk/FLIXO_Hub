# FLIXO Hub — Vercel Sandbox Execution Adapter

STATUS: IMPLEMENTED / PROVIDER-BLOCKED

## Implemented boundary

- `execution-provider.ts` defines the provider-neutral execution lifecycle.
- `vercel-sandbox-adapter.ts` enforces source SHA identity, ephemeral sessions, network policy mapping, CPU/memory compatibility, timeout bounds, cancellation, and output evidence.
- `vercel-sandbox-client-factory.ts` injects an authenticated provider SDK without placing the vendor SDK or credentials in the browser bundle.
- contract tests use a fake sandbox client and prove fail-closed boundaries.

Vercel Sandbox is an isolated microVM execution primitive for untrusted code with configurable network policy, resources, and command execution.

## Provider connection

The repository deliberately does not add the vendor SDK to the browser application's dependency graph.

A trusted server/runtime must load a reviewed, pinned `@vercel/sandbox` dependency, construct the client with `createVercelSandboxClient(...)`, run `evaluatePlatformExecution(...)` against the live execution SHA, and persist exact-SHA evidence.

## Current external blocker

On 2026-10-08 the connected Vercel team `FLIXO-AI-TOOLS` exposed no existing project and automatic sandbox-project creation was rejected by Vercel account permissions/billing constraints. No project or production deployment was created as a workaround.

## Security posture

- The adapter never receives raw secret values from the browser.
- Default network mode is deny-all.
- Allowlisted network access is translated to a Vercel custom network policy.
- `source.revision` must equal `sourceSha`.
- Mock execution is never release evidence.