# FLIXO execution rules

This repository uses one canonical tool registry: `src/config/registry.ts`.

All executable tools must be represented by the canonical capability definition and must route through their canonical executor. Do not create a parallel registry or invoke an unknown tool ID.

For browser-first image processing:
- input files remain local;
- raw File/Blob/ArrayBuffer values must not be sent to an LLM or remote provider;
- heavy work must use the existing local engine/worker path and bounded resource limits;
- executor selection must reject locked or unknown layers;
- agent-originated execution requiring confirmation must fail closed until the confirmation token is valid;
- cancellation and timeouts are real execution controls, not UI-only state;
- verifier failure is failure, never PASS.

Never write directly to `main`. Work from an execution branch and let CI certify the exact commit before promotion.
