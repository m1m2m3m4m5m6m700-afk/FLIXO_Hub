# FLIXO Hub Repository Structure

This guide helps Hermes and contributors locate the right files without creating competing sources of truth.

## Root-level governance and memory

| File | Role |
|---|---|
| `AGENTS.md` | Repository-wide agent policy, capabilities, boundaries, and execution rules |
| `STATE.md` | Current working state; reconcile against the live repository before relying on old SHAs |
| `DECISIONS.md` | Durable architectural and project decisions |
| `MEMORY.md` | Compact working memory; never an authority override |
| `README.md` | Public project overview and quick start |
| `CONTRIBUTING.md` | Contributor workflow and contribution constraints |
| `SECURITY.md` | Security reporting and handling policy |
| `EXECUTION.md` | English execution lifecycle and completion/removal protocol |

## Canonical task and CELL authorities

| Path | Role / rule |
|---|---|
| `المهام.md` | Canonical task dispatch ledger referenced by runtime scripts and tests. Keep its path stable until a fully tested migration is approved. |
| `docs/CELL-CANONICAL-ARCHITECTURE.md` | Canonical architecture contract; clearly separates CURRENT, TARGET, and HISTORICAL |
| `docs/FLIXO-LEAD-AGENT-WORKING-CONTRACT-v1.1.md` | Lead-agent operating contract |
| `cell.md` | Derived execution companion, not a second architecture authority |
| `الخلية.md` | Preserved architecture source with many live references; do not rename or rewrite casually |
| `FLIXO-Tasks.md`, `FLIXO-Agents.md`, `FLIXO-Tools.md`, `FLIXO-Cell.md` | English-named companion files; inspect content and authority declarations before treating them as translated or canonical |

## Code and executable controls

| Directory | Contents |
|---|---|
| `src/` | Application code, components, capability definitions, localization, and product UI |
| `packages/contracts/` | Shared contracts and hard-control types |
| `scripts/` | Repository tooling, agent control-plane scripts, checks, and verification |
| `tests/` | Unit, integration, contract, security, and browser tests |
| `.github/agents/` | Agent profile registration files |
| `.github/workflows/` | CI, governance, discovery, and automation workflows |
| `supabase/` | Supabase configuration, migrations, and related assets |
| `api/` | API entry points |
| `public/` | Static assets and public-facing pages |
| `.agent-intelligence/` | Governed agent-intelligence tooling, queues, and derived data |
| `.testsprite/` | TestSprite plans and integration artifacts |

## Agent packages and reports

The existing agent package and report trees include Arabic path components that are referenced by scripts, workflow globs, tests, and profile metadata. Do not rename them until a migration updates and validates every reference.

- `.github/agents/`: technical registration layer.
- `الوكلاء.md`: current canonical identity/count registry.
- `الوكلاء/`: agent contracts, packages, training references, and report directories.
- `الوكلاء/التقارير/`: canonical report surface for agents.
- `الوكلاء AI/`: derived discovery/report artifacts; inspect freshness and authority before use.
- `0(التقارير)/`: generated/report-like content; determine whether it is ignored, consumed, or stale before moving it.

## Localization rule

Arabic and other non-English strings under locale modules, for example `src/**/ar.ts`, are intentional product translations, not untranslated engineering documentation. Keep them. Tests may intentionally assert Arabic user-facing strings. Do not globally replace non-English text in source, tests, fixtures, or JSON.

## Generated and local artifacts

The current worktree includes items such as `dist/`, `playwright-report/`, `test-results/`, `results/`, `_arabic_dump.json`, `translate.py`, and a root-level `nul` path. Their presence alone does not establish whether they are tracked or safe to remove. Classify each item by Git status, ignore rules, references, and provenance before cleanup. No cleanup is performed by this guide.

## Safe navigation sequence for Hermes

1. Read `AGENTS.md`, `STATE.md`, `DECISIONS.md`, and `MEMORY.md`.
2. Read the relevant canonical task card from `المهام.md`.
3. Read the relevant architecture/working contract and source files.
4. Inspect `git status --short --branch` and `git rev-parse HEAD` before changes.
5. Search all references before changing paths.
6. Make a scoped change and run the task-specific tests plus required repository gates.
7. Report exact SHA, changed paths, commands, observed results, and remaining blockers.
