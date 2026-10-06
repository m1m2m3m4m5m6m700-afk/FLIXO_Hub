# FLIXO Prompt 02 — Canonical MVP Scope Closure

STATUS: IN_PROGRESS
PROMPT_ID: 02
START_SHA: 8831489f1e66cd5467f65a5ab6167e764fcf598a
END_SHA: PENDING
MUTATED: true

## Scope contract
The canonical executable MVP is exactly ten browser-local capabilities:

- background-remover
- image-upscaler
- image-cropper
- image-compressor
- image-converter
- image-effects
- video-trimmer
- video-cropper
- video-resizer
- video-compressor

## Implementation findings
- `src/config/manual-capability-definition.ts` defines the ten executable MVP IDs.
- `src/config/registry.ts` is the canonical registry and derives `TOOL_REGISTRY` from the canonical definitions.
- Each admitted MVP capability is bound to an executor ID and output contract ID matching the capability ID.
- MVP execution mode is LOCAL and network=false.
- Parameter schemas, safety limits, recovery policy, and independent verifiers are present.
- `tests/mvp-scope-contradiction.test.ts` was strengthened to enforce parity between the manual capability set, capability definitions, and canonical registry executable set, plus public-scope documentation alignment.
- A documentation contradiction in `docs/FLIXO-PUBLIC-CLAIMS-ALLOWLIST.md` was repaired: launch claims now align with the current ten-capability MVP instead of the historical six-image subset.

## Validation
Validation is exact-SHA and remains pending until the current candidate CI/test gates complete after this documentation mutation.

Required evidence:
- canonical scope/registry parity test
- typecheck
- lint
- core tests
- production build
- exact-SHA browser evidence
- exact-SHA security evidence

This record is evidence metadata only. Runtime authority remains the canonical capability definitions and registry.
