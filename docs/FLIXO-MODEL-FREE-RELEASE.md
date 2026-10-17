# Model-Free Release Contract

Status: PROPOSED / NOT CERTIFIED
Owner lane: `execution`
Production lane: `main` (protected; no direct writes)
Scope: public browser-first FLIXO Hub release with hosted-model integrations disabled.

## Decision

The release candidate may omit hosted LLM/model dependencies only if the shipped product explicitly operates in a supported model-free mode. An empty `docs/MODEL_LICENSE_MANIFEST.json` means no model is admitted; it is not evidence that a model was deleted, licensed, or approved. Do not add placeholder model entries or weaken the strict model-admission gate.

Model-free operation does not resolve the separate repository-code, dependency, asset, font, media, trademark, or third-party service rights. This contract cannot authorize public distribution while those applicable rights remain unresolved.

## Required runtime behavior

- Hosted model providers are disabled for the candidate; no API key, provider endpoint, or model name is required to boot and use the supported local-first MVP.
- The app does not silently call an unadmitted provider or switch to a hosted fallback.
- Any AI-only operation is visibly unavailable or returns a deterministic, actionable unsupported-capability result. It must not report a fabricated success.
- Browser-local file processing remains local and network-free for raw user file bytes.
- The canonical capability registry, executor, output contracts, verifier, and artifact-evidence chain remain the only execution authority.
- Production secrets and external model credentials are not added to the client bundle.

## Acceptance evidence required on one exact candidate SHA

1. Unit/contract tests prove hosted-provider calls are disabled when model-free mode is selected.
2. Browser tests cover the core local-first user journeys and every model-dependent feature's unavailable state.
3. Network assertions show no requests to model-provider domains during model-free journeys and no raw user-file bytes leave the browser.
4. Static bundle scan shows no embedded provider credentials.
5. `npm test`, `npm run build`, security scans, and browser E2E all pass on the same candidate SHA.
6. Deployment evidence identifies that exact SHA, the immutable production deployment, and successful post-deploy identity and smoke checks.
7. A separate rights review resolves the repository code license and all applicable third-party/dependency/asset terms before any public distribution or OSS claim.

## Release gate interpretation

- Model admission: `NOT APPLICABLE ONLY WHEN MODEL-FREE MODE IS EXPLICITLY SELECTED AND TESTED`; it must not be reported as `PASS`.
- Repository and third-party rights: independently required for the intended distribution model.
- Production deployment: not proven until exact-SHA deployment and post-deploy evidence exist.
- Certificate: remains `NOT CERTIFIED` until every applicable gate is evidenced.

## Current known state

The current model manifest has `entries: []`. Existing CI has passed on a reviewed SHA, but the strict production model-admission and exact-SHA production-deployment jobs were skipped in the previously inspected run. The public launch readiness verifier also intentionally blocks while the repository code license remains unselected. No claims in this document override those facts.
