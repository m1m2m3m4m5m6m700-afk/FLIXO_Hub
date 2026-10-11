# English Documentation and Path Migration Plan

**Status:** Migration plan only. Do not interpret this file as authorization to bulk-rewrite the repository.

## Objective

Make engineering documentation, agent instructions, task metadata, and directory navigation consistently readable in English while preserving runtime behavior, task authority, historical evidence, and product localization.

## Non-negotiable exclusions

- Do not translate intentional user-facing Arabic, Urdu, or other locale resources under `src/`, SEO locale modules, or UI fixtures that verify localized behavior.
- Do not translate code identifiers, enum values, schema keys, API fields, CLI syntax, URLs, hashes, task IDs, filenames used as runtime contracts, or machine-parsed metadata unless the migration explicitly updates every consumer.
- Do not delete original files or history as a translation shortcut.
- Do not run `translate.py` in its current form. It contains a `delete_original_files()` routine and broad deterministic substitutions that can corrupt mixed-language sentences and machine-parsed content. It has not been run during this pass.
- Do not treat similarly named English files as valid translations just because the filenames are English. Some current English-named companions retain substantial Arabic or mixed-language content.

## Phased migration

### Phase 0 — Inventory and authority map
- [x] Inventory file count, extensions, Arabic filenames, and sampled Arabic-content locations.
- [x] Document canonical task, agent-registry, and CELL authorities.
- [x] Preserve the existing execution-plan snapshot in `docs/archive/`.
- [x] Add English execution lifecycle and repository structure guides.
- [ ] Classify tracked versus untracked and generated artifacts before cleanup.
- [ ] Record all machine references to each Arabic path before any rename.

### Phase 1 — Engineering documentation
- [ ] Translate and review the canonical task ledger in small sections, preserving its exact task-card schema and machine-readable headings.
- [ ] Translate the canonical agent registry and all operational agent contracts.
- [ ] Translate the canonical tools/capability guide and engineering ledger.
- [ ] Translate CELL architecture and lead-agent governance prose without changing runtime contracts or CURRENT/TARGET/HISTORICAL claims.
- [ ] Translate README files, contribution/security docs, workflow descriptions, and report templates.
- [ ] For every change, compare original and translated content and verify IDs, links, code spans, and acceptance criteria.

### Phase 2 — English paths, compatibility, and reference migration
- [ ] Propose an English path for each canonical Arabic-named file.
- [ ] Search and update source code, tests, scripts, workflows, agent profiles, documentation links, ignore rules, and generated artifacts.
- [ ] If a path is part of a hard-control contract, update the contract and tests in the same task; do not leave dual authorities.
- [ ] Keep a compatibility redirect/stub only where tooling permits and where it does not create a second source of truth.
- [ ] Validate case sensitivity and Unicode normalization on Windows and Linux CI.

### Phase 3 — Validation and cutover
- [ ] Run exact-reference checks for old paths and intentional locale strings.
- [ ] Run typecheck, lint, core tests, security/contract tests, build, and required browser tests.
- [ ] Review diffs for accidental changes to code, schemas, secrets, evidence, or task status.
- [ ] Bind the verification record to the resulting SHA.
- [ ] Remove old path aliases only after every required gate passes and canonical authority is explicitly migrated.

## Completion criteria

The migration is complete only when all engineering documentation intended for maintainers and agents is in English, canonical paths are consistent, all consumers have been updated, tests/gates pass on the same resulting SHA, and intentional product localization remains functional. A count of filenames translated is not sufficient evidence.
