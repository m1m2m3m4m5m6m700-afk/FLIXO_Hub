# FLIXO Shared Architectural Mandate

FLIXO is a browser-first media tooling system with a canonical capability registry and canonical local execution boundary.

## Shared model
- Intent interpretation may propose a plan.
- Canonical capability definitions determine what is executable.
- The execution gate validates capability, parameters, file safety, limits, and contracts.
- The canonical executor performs admitted local work.
- Output contracts and independent verifiers decide whether an artifact is valid.
- Documentation and agent reports never override runtime authority.

## MVP
The executable MVP is the ten-capability set recorded in `docs/MVP-SCOPE-DECISION.md`.
Additional ready/plannable capabilities are not executable MVP scope unless deliberately admitted through the same canonical process.

## Privacy
MVP File/Blob bytes remain browser-local. Model/provider paths may reason about structured metadata or proposals, but they do not receive raw user file bytes and do not own execution authority.

## Evidence
Every certification claim must bind CURRENT_SHA, TESTED_SHA, BUILT_SHA, BROWSER_VERIFIED_SHA, SECURITY_VERIFIED_SHA, COVERAGE_VERIFIED_SHA, and deployment identity where applicable to one lineage.
