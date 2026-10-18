# FLIXO Hub Initial Release Profile: Model-Free

**Decision date:** 2026-10-18  
**Decision source:** Explicit product-owner instruction in the project conversation: the first release will operate without a model.  
**Release mode:** `MODEL_FREE_INITIAL_RELEASE`

## Scope

The initial release is a static/browser-first product surface containing only deterministic, browser-local workflows that do not require inference. It does not ship or activate a model runtime, remote model inference, or model-backed agent execution. The active AI Image Generator route is explicitly unavailable in the initial release and its runtime must not call `/api/ai/image`. Model-dependent controls must be unavailable or clearly identified as unavailable; they must not appear to have passed acceptance by returning mocked model output.

## Release gates

- All normal build, typecheck, lint, security, dependency, browser, exact-SHA, governance, and deployment checks remain mandatory.
- The model-free profile is a product-scope decision, **not** model admission, a license exception, or a pass for any model.
- `docs/MODEL_LICENSE_MANIFEST.json` remains empty until a specific model is fully evidenced and approved.
- The CI profile gate validates an explicit model-free declaration. The separate strict model-backed gate `npm run test:model-license:release` must still fail when no model is registered.
- No model API secrets may be added, and no user content may be routed to an external inference provider under this profile.
- If a feature's core acceptance requires a model response, that feature is out of scope for the initial release until it is disabled or the model-backed release is properly admitted.

## Re-entry to model-backed release

A future model-backed release must replace this profile deliberately and provide an exact model/provider release identity, immutable artifact or provider evidence, exact license and applicable terms/AUP, provenance, security and task-evaluation evidence, required human approval, and successful strict admission on the exact candidate SHA. This document does not authorize a future model.

## Evidence boundary

A passing profile check proves that the release configuration explicitly declares the model-free scope. It does not, by itself, prove every UI path is disabled or that production has been deployed. Those claims require source-level tests, browser evidence, and post-deployment verification on the exact release SHA.
