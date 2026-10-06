# FLIXO Project Map

## Current production line
- `main`: production truth.
- `execution`: controlled operational integration/release lane.
- Controlled agent work may use only `agent-1/*`, `agent-2/*`, or `agent-3/*` branches and must return to `execution` through a pull request.
- No fixed PR number is authoritative for the current release candidate; always resolve the live `execution` HEAD and the active integration PR before using SHA-specific evidence.
- PR #1002 is historical release-line evidence only and must not be treated as the current candidate.

## Active product line
- FLIXO Hub browser-first local media tools.
- Canonical MVP scope: ten executable capabilities.
- Agent Guided Workflow: confirmation-gated deterministic planning delegated to the canonical local executor.
- Manual Workflow: independently usable browser-local processing.

## Repository organization
- Repository ownership and directory roles are defined in `docs/REPOSITORY-STRUCTURE.md`.
- Runtime authority remains in the canonical registry, execution gate/executor, output contracts, and verifiers; documentation never overrides runtime state.

## Post-MVP
Large tool expansion, advanced local AI, OCR, advanced video/audio codecs, and retired Agent Editor systems are not part of the current executable MVP unless separately admitted with current evidence.
