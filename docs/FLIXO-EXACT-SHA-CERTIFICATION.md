# FLIXO Exact-SHA Certification Record

STATUS: LAST-VERIFIED-CANDIDATE / BLOCKED_ON_GOVERNANCE
UPDATED: 2026-10-06
REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
EXECUTION_BRANCH: execution
INTEGRATION_PR: RESOLVE_LIVE_ACTIVE_PR_AT_VERIFICATION_TIME
MAIN_SHA: 263827228cbe5f4851470297fde5f2858ff844de
LAST_VERIFIED_CANDIDATE_SHA: a44958a97126b2e050746010947aef2cfa286729

## Prompt 17 exact-candidate evidence

The clean-clone Prompt 17 gate completed successfully on candidate `a44958a97126b2e050746010947aef2cfa286729`.

Run evidence:
- FLIXO Final Clean-Clone Red Team (push) run 239: SUCCESS (workflow run 37437187406).
- Prompt 17 job: SUCCESS.
- Typecheck: PASS.
- Lint: PASS.
- Core and contract regression: PASS.
- Adversarial control-plane regression: PASS.
- Production dependency audit: PASS.
- Production build: PASS.
- Exact-SHA build artifact identity: PASS.
- Exact-SHA coverage: PASS.
- Browser E2E: PASS.
- Exact-SHA CodeQL dependency gate: PASS.
- Secret Scan: PASS.
- Structural scope/artifact evidence: PASS.

Additional exact-candidate execution evidence:
- TestSprite Live E2E evidence is not required by the canonical certification gate and is retained as supplemental evidence.
- FLIXO CI build/typecheck/core job on the candidate lineage: PASS.
- Internal Red Team adversarial regression: PASS.

## Current release identities

CURRENT_SHA=PENDING — resolve live execution HEAD at verification time
TESTED_SHA=a44958a97126b2e050746010947aef2cfa286729
BUILT_SHA=a44958a97126b2e050746010947aef2cfa286729
BROWSER_VERIFIED_SHA=a44958a97126b2e050746010947aef2cfa286729
SECURITY_VERIFIED_SHA=a44958a97126b2e050746010947aef2cfa286729
COVERAGE_VERIFIED_SHA=a44958a97126b2e050746010947aef2cfa286729
RED_TEAM_VERIFIED_SHA=a44958a97126b2e050746010947aef2cfa286729
CERTIFIED_SHA=NOT_YET_CERTIFIED
DEPLOYED_SHA=NOT_YET_VERIFIED

## Scope

The canonical executable MVP remains exactly ten browser-local capabilities:
background-remover, image-upscaler, image-cropper, image-compressor, image-converter, image-effects, video-trimmer, video-cropper, video-resizer, video-compressor.

## Governance blocker

GitHub ruleset `FLIXO-MAIN-PROTECTION` (ID 23854302) is active but does not satisfy the repository's Prompt 12 policy contract:
- required approving reviews: 0 (required 1)
- dismiss stale reviews on push: false (required true)
- require code owner review: false (required true)
- require last push approval: false (required true)
- required review thread resolution: false (required true)
- strict required status checks: false (required true)

No fixed PR number is authoritative. Any historical PR review state must not be reused as current evidence.

The connected execution environment exposes ruleset state read-only; no ruleset mutation action is available. No governance bypass, self-approval, or weakened verifier is permitted.

## Certification state

Prompt 17 = PASS on historical candidate `a44958a97126b2e050746010947aef2cfa286729`; this is archival evidence only. any documentation mutation after this point creates a new SHA and invalidates that evidence.
Prompt 18 = BLOCKED by live main-governance policy; exact-SHA evidence is required again on the post-rollover head.
Prompt 19 = NOT READY — governance blocker remains.
Prompt 20 = NOT READY — requires legitimate owner approval and protected promotion.

Therefore:
PLAN = NOT COMPLETE
IMPLEMENTATION = COMPLETE FOR CURRENT MVP SCOPE
TESTING = REQUIRES REGENERATION ON CURRENT SHA
SECURITY = REQUIRES REGENERATION ON CURRENT SHA
RED TEAM = REQUIRES REGENERATION ON CURRENT SHA
INTEGRATION = BLOCKED BY GOVERNANCE
CERTIFICATION = BLOCKED
SCORE = NOT 100/100

## Rule

Any mutation creates a new candidate SHA. Current evidence must be regenerated on that exact head before certification.
