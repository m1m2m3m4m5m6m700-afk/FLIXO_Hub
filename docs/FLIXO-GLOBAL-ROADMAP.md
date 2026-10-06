# FLIXO Global — G0 → G4 Execution Roadmap

STATUS: POLICY / DISPATCH-DERIVATION-SOURCE
AUTHORITY: `المهام.md`
BASELINE_EXECUTION_SHA: `c13a6d649925c6d4eb5fac66a10c5a28750a7f52`
LAST_REVIEWED_UTC: 2026-10-06T23:07Z

## Goal

FLIXO evolves from a release-controlled browser-local MVP into a globally operated platform with capability contracts, localization, regional performance evidence, privacy/security governance, external evidence, and auditable certification.

The quality rule is:

> Global breadth is earned by measurable quality depth.

No capability expansion is dispatchable merely because this document requests it. New capability waves are derived into `المهام.md`, capped at five capabilities per wave, and must pass the previous gate.

## G0 — Stabilize & Promote

Exit conditions:
- exact-SHA technical/security/browser evidence is fresh;
- repository governance checks are green;
- live GitHub governance has been independently verified;
- one RC lineage is selected;
- promotion proof and trust-gate pass;
- production deployment identity and post-deploy smoke evidence are fresh;
- rollback procedure is documented and testable.

## G1 — Global Baseline

Measure at least four operating regions:
Europe, North America, Middle East, and Asia-Pacific.

Measure:
- p50/p95 latency;
- error rate;
- build/deployment identity;
- browser responsiveness where applicable;
- network behavior;
- file-upload boundary;
- privacy/consent behavior;
- WCAG 2.2 AA evidence.

The baseline must be exact-SHA bound. Missing regional measurements are FAIL, not UNKNOWN-to-GREEN.

## G2 — Global Productization

Deliver:
- canonical locale contract;
- RTL/LTR correctness;
- hreflang and localized metadata;
- region-aware configuration boundaries;
- capability-contract admission gates;
- first expansion wave of at most five capabilities.

Runtime translation generation is not permitted for user-visible release strings.

## G3 — External Evidence Fabric

Preserve one dispatch authority while allowing external evidence from GitHub and cloud providers.

The evidence chain is:

`source SHA → build → artifact → attestation → deployment → environment evidence`

External evidence is proof only. It is not a second ledger or dispatch source.

## G4 — International Trust & Certification

Certification program candidates:
- ISO/IEC 27001:2022 for the information security management system;
- ISO/IEC 27701:2025 for privacy information management;
- WCAG 2.2 AA conformance evidence;
- regional legal/privacy matrix, including GDPR where applicable.

Legal applicability is assessed per market. A provider compliance claim is not a FLIXO certification.

## Release ordering

G0 → G1 → G2 → G3 → G4.

A later stage may be implemented in isolated preparation work, but its release gate cannot be declared passed before the preceding stage is passed.
