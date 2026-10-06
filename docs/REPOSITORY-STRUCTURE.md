# FLIXO Repository Structure

## Purpose

This map defines the repository layout by responsibility. It is a documentation and ownership contract only; runtime authority remains in the canonical control-plane code.

## Root

- `README.md` — public repository overview and current architecture summary.
- `AGENTS.md` — agent execution contract and authority limits.
- `CONTRIBUTING.md` — contribution, branch, verification, and security rules.
- `GPT` — product release directive used as a mandate input.
- `GPT.md` — shared architectural mandate.
- `EXECUTION_PLAN.md` — long-running engineering roadmap and historical execution log.
- `المخطط التنفيذي.md` — current three-agent execution coordination and prompt matrix.
- `المهام.md` — current MVP task/status record.
- `PROJECTS.md` — concise project map.
- `SECURITY.md` — repository security policy.
- Root build/package configuration remains at the repository root because tooling resolves it from there.
- `GPT` and `GPT.md` intentionally have different roles: `GPT` is the product/release directive; `GPT.md` is the shared architectural mandate. Do not collapse them without updating their consumers.

## Governance and automation

### `.github/`

- `.github/agents/` — executable agent profile definitions. This is the canonical profile location.
- `.github/workflows/` — CI, security, browser, coverage, release, and publication workflows.
- `.github/CODEOWNERS` — ownership enforcement for security-sensitive paths.
- `.github/dependabot.yml`, `.github/release-drafter.yml` — repository automation configuration.

### `scripts/`

- `scripts/ci/` — deterministic repository-control scripts, Patch Capsule publication helpers, branch policy, main-ruleset verification, and exact-SHA workflow contracts.
- top-level `scripts/` — build, route, locale, model-admission, and public-launch utilities.
- Scripts must not become a second runtime execution authority.

## Documentation

### `docs/`

- Architecture and authority: `ARCHITECTURE.md`, `ARCHITECTURE_LOCK.md`, `architecture/BOUNDARIES.md`.
- Execution and evidence: `FLIXO-MVP-EXECUTION-AND-CERTIFICATION-PLAN.md`, `FLIXO-EXACT-SHA-CERTIFICATION.md`, `FLIXO-PROMPT-01-STATE.md`, `RELEASE-CHECKLIST.md`.
- Release and launch: final certification, attestation, public-release manifest, launch runbooks, and templates.
- Security, trust, resilience, model-admission, and recovery records.
- `docs/agents/` — coordination documentation only; executable profiles live in `.github/agents/`.
- Recovery-era files stay under `docs/` as historical archaeology/evidence context and never become current runtime authority.

Do not create a competing `docs/security.md` or another active agent-profile directory.

## Runtime

### `src/`

- `src/config/` — canonical capability definitions, registry, manifests, and platform metadata.
- `src/lib/contracts/` — schemas and contracts for plans, files, outputs, evidence, limits, scope, and boundaries.
- `src/lib/execution/` — canonical execution authority.
- `src/lib/video/` and `src/image-core/` — local media execution primitives.
- `src/tools/<tool>/` — tool UI and local engine implementation; executable MVP capabilities must bind through the canonical runtime.
- `src/routes/` and `src/components/` — product routing and UI.
- `src/lib/agent-guided-runtime.ts` — Agent Guided Workflow orchestration surface; it validates and delegates to the canonical executor.
- `src/lib/i18n/`, `src/lib/seo/`, `src/lib/routing/` — product infrastructure.
- `src/lib/admin/` and `src/server/admin/` — administrative/control-plane server surfaces, separate from MVP media execution.

## API, persistence, and packages

- `api/admin/` — server-side administrative HTTP surfaces.
- `supabase/` — persistence configuration and migrations for non-MVP surfaces; no raw MVP media processing.
- `packages/contracts/` — shareable contract package; it must remain consistent with canonical source contracts.
- `public/` — static runtime assets and Worker-served public resources.

## Tests

- `tests/official/` — release-critical browser and acceptance coverage.
- `tests/e2e/` — general end-to-end browser coverage.
- `tests/helpers/` and `tests/fixtures/` — reusable test support and deterministic fixtures.
- `tests/red-team-control-plane.test.ts` — adversarial runtime/control-plane regression.
- `tests/release-*.test.ts` — release/governance/documentation integrity gates.
- Remaining `tests/*.spec.ts` / `tests/*.test.ts` files cover tool-specific or historical/post-MVP behavior; existence alone does not grant release authority.

## Ownership rule

Physical location follows responsibility. Do not move or rename runtime files solely to make the tree look cleaner; first prove imports, workflow references, test references, and deployment dependencies. Historical documents remain under `docs/` rather than being promoted to current authority.

## Branch rule

- Operational lines: `main`, `execution`.
- Controlled agent coordination: `agent-1/*`, `agent-2/*`, `agent-3/*`.
- No other branch prefix is approved by repository policy.

## Automated organization guard

Run `npm run verify:structure` to validate required responsibility directories, the canonical agent-profile location, the single npm lockfile, absence of generated artifacts in Git, and absence of retired runtime authority paths. `npm test` and CI execute this guard.
