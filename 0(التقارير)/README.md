# FLIXO Repository Knowledge Reports

This directory is owned by the **FLIXO Repository Knowledge Agent**.

Purpose:
- persistent read/recon reports for downstream agents;
- exact-SHA-bound repository maps;
- component/dependency relationships;
- test/CI/security/documentation discovery;
- task/plan discovery observations.

Canonical report format:

`<EXACT-40-CHAR-SHA>.md`

Rules:
- Reports are knowledge artifacts, not task authority.
- `المهام.md` remains the only canonical task/planning source.
- The knowledge agent may write only inside this directory.
- Reports from different SHAs must never be merged into one current-state report.
- Never treat a report as certification evidence unless a separate certification process explicitly validates it.
