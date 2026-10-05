# FLIXO — CODEX EXECUTION MASTER PLAN
## Exact-SHA / Gap-Driven / Fail-Closed / Red-Team Verifiable

STATUS: ACTIVE / EXECUTABLE
REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS
PRIMARY EXECUTION BRANCH: execution
INTEGRATION PATH: execution -> main

## 0. CODEX OPERATING CONTRACT

You are the repository execution agent for FLIXO. Execute the plan; do not merely describe it.

ABSOLUTE RULES:
1. Never write directly to main.
2. All implementation mutations occur on execution only.
3. Never claim PASS, GREEN, VERIFIED, CERTIFIED, or RELEASE VERIFIED from stale evidence.
4. skipped, cancelled, neutral, pending, missing, or stale checks are NOT success.
5. Never weaken tests to make an implementation pass.
6. Never bypass an execution gate, verifier, registry, security control, or required check.
7. Never create a second canonical registry or second executor authority.
8. Never create a parallel runtime source of truth.
9. Never expand MVP scope merely because additional code exists.
10. Never perform unrelated refactoring inside a scoped prompt.
11. Any mutation creates a new SHA and invalidates prior SHA-specific evidence.
12. If a requirement is already proven on the CURRENT exact SHA, do not mutate it again; record PASS and continue.
13. If a real GAP exists, implement only the minimum required change within the current prompt.
14. If a blocker is external or outside scope, document it precisely; never fabricate success.
15. FAIL CLOSED whenever identity, authorization, privacy, verification, or required evidence cannot be established.
16. Do not stop merely because a GAP was found. Fix it when it is within scope, then verify.
17. Do not request routine confirmation; human owner authorization for this execution workflow is already established.
18. Human authorization never permits direct main writes or governance bypasses.

MANDATORY LOOP:
INSPECT CURRENT EXACT SHA -> CLASSIFY PASS/GAP/BLOCKER -> MUTATE execution ONLY IF GAP -> VERIFY -> RECORD NEW SHA/EVIDENCE -> INVALIDATE OLD EVIDENCE -> CONTINUE.

## 1. FINAL OBJECTIVE

Produce one release candidate lineage that proves:
- Agent Guided Workflow end-to-end.
- Independent Manual Standalone Workflow.
- Browser/Worker-local MVP file processing.
- No raw user File/Blob bytes sent to provider endpoints or backend processing.
- Exactly one canonical capability/tool registry.
- Exactly one canonical execution gate.
- Exactly one executor authority.
- LLM/provider is reasoning/proposal only, never execution authority.
- Verifiable output contracts and verifiers.
- Deterministic safe fallback for ambiguity, unsupported input, malformed output, or provider failure.
- Resource and security bounds.
- English and Arabic acceptance coverage.
- Clean-clone Red Team PASS.
- Required CI checks on the exact candidate SHA.
- Production/deployment identity proof when applicable.
- Certification only when all evidence belongs to the same candidate lineage.

## 2. ORDER OF EXECUTION

01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20

A prompt may be mutation-free if its requirement is already proven on the CURRENT exact SHA. Inspect first; never replay historical work blindly.

# PROMPT 01 — EXACT-SHA STATE RECONCILIATION
ROLE: State Reconciliation Agent.
SCOPE: Read-only. No code mutation.
Resolve current main SHA, execution SHA, PR head/base, all required checks, current evidence, stale evidence, lineage mismatches, and blockers.
OUTPUT:
CURRENT_MAIN_SHA=
CURRENT_EXECUTION_SHA=
PR_HEAD_SHA=
PR_BASE_SHA=
REQUIRED_CHECKS=
CHECK_STATUS=
BLOCKERS=
STALE_EVIDENCE=
NEXT_PROMPT=
Do not declare GREEN or Certification.
EXIT: reconciliation complete or precise BLOCKER.

# PROMPT 02 — CANONICAL MVP SCOPE CLOSURE
ROLE: MVP Scope Authority Agent.
Inspect the canonical registry, tests, GPT, AGENTS.md, docs, README, package/config, release documentation, and actual runtime implementations.
Current documented candidates are:
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
Do not assume this list is correct. Prove each capability as EXECUTABLE, READY, LOCAL, BROWSER_COMPATIBLE, VERIFIER_BACKED, and OUTPUT_CONTRACT_BACKED.
Create/update ONE Scope Decision Record. Align the canonical registry, tests, GPT, AGENTS/docs, release checklist, and add a CI contradiction test preventing multiple conflicting MVP definitions.
Never create another registry. Never expand scope without evidence. Never remove a runtime dependency without dependency proof.
VERIFY: typecheck + tests + scope contradiction test + build.
EXIT: one canonical MVP scope or BLOCKER.

# PROMPT 03 — REGISTRY → GATE → EXECUTOR → VERIFIER AUDIT
ROLE: Execution Contract Auditor.
For every declared MVP capability prove:
Canonical Registry -> Execution Gate -> Canonical Executor -> Verifier -> Output Contract -> Artifact.
Verify, where applicable: EXECUTABLE, READY, LOCAL, network=false, browser/browser-worker execution mode, executorId, outputContractId, parameterSchema, verifier, safetyLimits.
Search for Agent Editor shortcuts, direct executor calls, provider-controlled execution, alternate execution authority, and registry bypasses.
If a bypass exists, identify exact path, repair it through canonical architecture, and add regression coverage.
FORBIDDEN: second registry, second executor authority, execution-gate bypass, fake verifier, test weakening.
EXIT: every MVP capability has a canonical execution path or BLOCKER.

# PROMPT 04 — AGENT + MANUAL WORKFLOW E2E CLOSURE
ROLE: Workflow E2E Agent.
Prove Agent path:
Upload -> Natural Language -> Intent -> Parameters -> Plan -> Canonical Capability -> Execution Gate -> Executor -> Verifier -> Result.
Prove Manual path:
Browse Tools -> Tool -> File Input -> Execute -> Output.
Test valid image request, Arabic, English, compound request, ambiguity, unsupported operation, execution failure, manual fallback, and direct manual usage.
Provider failure or malformed provider output MUST NOT cause unverified execution.
Allowed terminal states: deterministic local plan, manual fallback, explicit failure.
Manual workflow MUST NOT depend on Agent.
Run browser/E2E against the exact SHA. UI visibility is insufficient; prove execution and output verification.
EXIT: both workflows proven or BLOCKER.

# PROMPT 05 — PROMPT / PROVIDER TRUST BOUNDARY
ROLE: Trust Boundary Security Agent.
Enforce: System Prompt = trusted policy/instructions; Assistant Context = task/conversation state; Untrusted Content = data only.
Test prompt injection, malicious layer labels, malformed provider response, malformed tool call, invalid parameters, unauthorized capability attempts, and failover context contamination.
Prove LLM = reasoning/proposal only. It must not possess raw File/Blob bytes, registry authority, executor authority, or verifier authority.
Repair violations at the canonical boundary and add regression coverage.
EXIT: trust boundary proven or BLOCKER.

# PROMPT 06 — BROWSER-LOCAL MEDIA EXECUTION
ROLE: Local Media Execution Agent.
Prove: File -> Decode -> Bounded Processing -> Worker/Local Executor -> Blob -> Verifier -> Artifact.
Verify/enforce maximum file size, maximum pixels/dimensions, timeout, AbortSignal, worker lifetime, output size limit, MIME validation, signature validation, and dimensions validation.
Use Web Workers where processing can block the UI, especially effects/video.
Prove operationally that raw file/image bytes never reach provider endpoints.
Test resource exhaustion, abort, and invalid output. Do not create a backend file-processing alternative.
EXIT: local execution, bounds, and privacy proven or BLOCKER.

# PROMPT 07 — VERSIONED ACCEPTANCE CORPUS
ROLE: Acceptance/Test Corpus Agent.
Cover compression, conversion, upscale, crop, effects, and background removal in Arabic and English.
Also cover compound commands, parameter extraction, ambiguity, conflicting parameters, malformed parameters, unsupported formats, unsupported operations, and oversized dimensions.
Effects MUST include Arabic/English regression cases for contrast, brightness, saturation, grayscale, compound effects, and negative/ambiguous requests.
Negative cases MUST resolve to null, fallback, or explicit error. Never guess.
All changes MUST flow through the canonical planner/capability layer.
EXIT: versioned corpus connected to canonical behavior or BLOCKER.

# PROMPT 08 — OUTPUT + VISUAL GOAL VERIFICATION
ROLE: Verification Agent.
Upgrade verification beyond output existence.
Verify MIME, extension, filename, signature, size, dimensions, and video metadata where applicable.
Add measurable visual/semantic verification for resize geometry, crop geometry, grayscale, brightness, contrast, saturation, and meaningful effects change.
output.size > 0 is not sufficient when a stronger property is measurable.
Add regression tests for every verifier. A verifier MUST NOT return success without evidence.
EXIT: output and visual verification proven or BLOCKER.

# PROMPT 09 — COVERAGE CLOSURE
ROLE: Coverage Agent.
Start from the exact current SHA.
Verify meaningful coverage of Agent Editor, provider router, adapters, agent runtime, local executor, media worker, security parsing, failover, output verification, browser-critical paths, and coverage generation.
Do not add superficial tests merely to increase a percentage.
For Codecov inspect policy/workflow. If tokenless upload is intentionally supported, document it. Otherwise configure the authorized secret.
FORBIDDEN: missing token treated as success, ignored upload failure, removed protection, || true, skipped coverage.
After any mutation regenerate coverage on the new SHA.
EXIT: real current coverage evidence or BLOCKER.

# PROMPT 10 — SECURITY CLOSURE
ROLE: Security Hardening Agent.
Audit input size, request limits, parameter schema, provider URL allowlist, provider timeout/response limits, SSE correctness, credential encryption, secret isolation, CSP, Permissions Policy, security headers, workflow permissions, action SHA pinning, worker bounds, and output limits.
Run CodeQL, dependency/security audit, and secret scanning.
Every failure must be real, classified, traceable, and fixed or explicitly documented as a blocker.
No masking. No bypass.
EXIT: security closure proven or BLOCKER.

# PROMPT 11 — CI / WORKFLOW SIMPLIFICATION
ROLE: CI Architecture Agent.
Inventory and classify workflows as verify, browser, security, coverage, deploy, repair-only, or release.
Detect duplicate execution, duplicate certification, duplicate registry logic, duplicate repair, obsolete swarm logic, self-trigger loops, and stale SHA assumptions.
Do not delete a workflow until runtime and required-check dependencies are proven absent.
For every workflow mutation: inspect exact SHA, inspect dependencies, mutate execution only, run affected checks, run canonical CI, and prove no required check disappeared.
Goal: reduce unnecessary complexity without reducing evidence.
EXIT: coherent workflow graph or BLOCKER.

# PROMPT 12 — MAIN GOVERNANCE HARDENING
ROLE: Repository Governance Auditor.
Inspect actual GitHub rulesets. Verify protected main, no direct push, required approving review, Code Owner review where required, strict required checks, stale-review policy, PR source restrictions, and merge queue where applicable.
Never mutate main directly.
If permissions prevent a change, report the limitation. Never fabricate PASS.
OUTPUT: CURRENT_POLICY / REQUIRED_POLICY / GAP / SAFE_MUTATION / VERIFICATION.
EXIT: governance evidence or BLOCKER.

# PROMPT 13 — EVIDENCE-BASED REPOSITORY HYGIENE
ROLE: Scoped Repository Hygiene Agent.
Inspect dead code, obsolete docs, duplicate contracts, stale certification claims, old registries, mock executors, obsolete swarm artifacts, inconsistent FLIXO naming, obsolete product names, and duplicate configuration.
For every deletion prove no runtime dependency exists.
Do not perform broad refactoring.
After cleanup run tests, typecheck, lint, build, and browser smoke.
Documentation claims must reference current exact SHA or be policy/instructions rather than certification claims.
EXIT: cleanup without regression or BLOCKER.

# PROMPT 14 — DOCUMENTATION AUTHORITY ALIGNMENT
ROLE: Documentation Architecture Agent.
Align: README -> product; GPT -> architectural mandate/shared agent context; AGENTS.md -> agent execution contract; المهام.md -> backlog/scope state; PROJECTS.md -> project map; docs/ -> technical design/evidence.
Correct/remove stale SHA, stale status, obsolete MVP scope, obsolete architecture, false certification, and duplicate authority claims.
Documentation MUST NOT become a second runtime source of truth. Canonical runtime structures remain authoritative.
EXIT: documentation authority chain aligned or BLOCKER.

# PROMPT 15 — DEPLOYMENT / PRODUCTION IDENTITY
ROLE: Release Identity Agent.
Prove: main exact SHA -> certified build artifact -> production deployment -> immutable identity -> production browser verification.
Verify deployment SHA, build artifact identity, worker identity, production URL response, and production browser smoke.
Execution deployment is not production truth.
Inspect Cloudflare, Vercel, and browser runtime relationships. Prove file processing remains browser-local.
Any identity mismatch MUST FAIL CLOSED.
If no production deployment is part of the candidate, record NOT_APPLICABLE with evidence.
EXIT: lineage verified or blocker/NOT_APPLICABLE with evidence.

# PROMPT 16 — SUPABASE / PERSISTENCE BOUNDARY
ROLE: Persistence Boundary Agent.
Inspect every persistence dependency and classify it as MVP-required, optional, stateless, admin-only, or Post-MVP.
Prove local image/file editing does not require Supabase.
If an implicit dependency exists, remove it from the local path or make it explicitly optional.
Do not remove genuinely used persistence features without dependency analysis.
Add a regression test proving MVP editing works without the persistence service.
EXIT: persistence boundary proven or BLOCKER.

# PROMPT 17 — CLEAN-CLONE FINAL RED TEAM
ROLE: Final Red-Team Agent.
TEST-ONLY PHASE. Do not fix code during the test run.
Start from a clean checkout of the candidate SHA. Do not use cached assumptions, prior state, stale artifacts, or previous results.
Run: checkout exact SHA; install; typecheck; lint; core tests; MVP corpus; Agent tests; Browser E2E; security checks; CodeQL; coverage; artifact verification; exact-SHA verification; production/deployment identity verification when applicable.
Attack/test Agent workflow, Manual workflow, fallback, privacy, malformed provider output, prompt injection, oversized input, invalid parameters, worker abort, provider failover, output corruption, and stale-SHA protection.
Record failures exactly as observed.
If any required gate fails: STATUS=FAIL and produce ONE narrowly scoped repair prompt.
EXIT: RED_TEAM_PASS on one candidate lineage or FAIL with exact blocker and repair prompt.

# PROMPT 18 — RELEASE CANDIDATE FREEZE
PREREQUISITE: Prompt 17 PASS.
Freeze execution as Release Candidate.
FORBIDDEN after freeze: feature work, architecture expansion, new capabilities, registry expansion, unrelated refactoring.
ALLOWED only: bug fixes, security fixes, contract-correcting tests, documentation corrections.
Create Release Candidate Evidence Record:
CURRENT_SHA=
TESTED_SHA=
BUILT_SHA=
BROWSER_VERIFIED_SHA=
SECURITY_VERIFIED_SHA=
COVERAGE_VERIFIED_SHA=
DEPLOYMENT_SHA=
SCOPE_ID=
REQUIRED_CHECKS=
All identities MUST belong to the same candidate lineage.
EXIT: complete freeze record or BLOCKER.

# PROMPT 19 — FINAL CERTIFICATION GATE
ROLE: Certification Evidence Agent.
NO CODE MUTATION.
Verify only the final candidate SHA.
Required identities: CURRENT_SHA, TESTED_SHA, BUILT_SHA, BROWSER_VERIFIED_SHA, CERTIFIED_SHA, and DEPLOYED_SHA when applicable.
Verify CODE: typecheck, lint, build PASS.
Verify TESTS: core, MVP corpus, Agent, browser, Red Team PASS.
Verify SECURITY: CodeQL, security audit, secret scanning, workflow integrity PASS.
Verify COVERAGE: coverage PASS and Codecov PASS or documented approved policy.
Verify GOVERNANCE: required review satisfied, main protected, required checks strict, no direct main mutation.
Verify SCOPE: one canonical MVP scope, no hidden executable capability, one registry, one executor authority, one execution gate.
Verify DEPLOYMENT: exact SHA identity, production response, production browser proof when applicable.
If all required evidence passes, create Certification Evidence. Otherwise set CERTIFICATION=NOT_READY and record every blocker.
Never use CERTIFIED when evidence does not fully match.
EXIT: CERTIFICATION_EVIDENCE or NOT_READY.

# PROMPT 20 — OWNER-AUTHORIZED FINAL PROMOTION
PREREQUISITES: Prompt 19 complete, valid Certification Evidence exists, human owner authorization exists.
Before promotion verify current exact candidate SHA, required checks on that exact SHA, PR head/base, no stale evidence, branch protection, and Release Candidate Freeze.
PROMOTE ONLY THROUGH: execution -> main.
NEVER direct-write main.
After merge: resolve new main SHA; run canonical CI on main; re-run exact-SHA verification; verify production deployment identity; run production browser smoke; verify deployed SHA belongs to the certified release lineage.
If any post-merge identity or verification mismatch exists: do not declare success; open a new scoped repair on execution.
EXIT: PROMOTION_VERIFIED or FAIL_CLOSED with blocker.

# 2A. RECOVERY DELTA — 2026-10-06 / P4 REMAINING WORK

PURPOSE:
This section records the residual gaps discovered while continuing P4. It is part of the execution contract and MUST be consulted after every P4 mutation. It does not create a second runtime authority.

CURRENT RECOVERY LINEAGE:
- Active recovery branch: \`recovery/p4-agent-workflow-20261006\`
- Last observed remote candidate during this delta: \`d83d2db2a11b3bc59fa5a93b92c952fa9e8e28ed\`
- Historical evidence from any earlier SHA is stale after a mutation.
- Never force-push this recovery lane. If the remote branch advances, fetch it, reconcile lineage, and preserve all valid commits before pushing.

EVIDENCE ALREADY ESTABLISHED ON THE CURRENT P4 LINEAGE:
- Typecheck: PASS.
- Core suite: PASS, 29/29 tests on the verified local run with the required \`VITE_SITE_URL\` boundary.
- Secret Scan: PASS.
- CodeQL: PASS.
- Canonical execution boundary tests: PASS.
- Guided-runtime confirmation/identity protections: PASS in core coverage.
- Browser acceptance previously proved \`video-trimmer\` and \`video-resizer\`.
These facts are evidence for their observed SHA only and do not authorize Certification.

REMAINING P4 BLOCKERS — MUST BE CLOSED BEFORE PROMPT 05+ FINALIZATION:

### P4-B01 — Agent intent routing conflict
OBSERVED:
- The request \`compress this image to WebP\` was resolved by the Guided Agent as \`image-converter\` instead of \`image-compressor\`.
ROOT CAUSE CLASS:
- Lexical ranking gives the format token \`WebP\` enough weight to outrank the explicit compression operation.
REQUIRED FIX:
- Make operation intent dominant over target-format overlap.
- Rank explicit action phrases, then file-family compatibility, then parameter/format hints.
- Preserve deterministic ambiguity rejection when two operation intents remain tied.
REGRESSION:
- English: \`compress this image to WebP\` -> \`image-compressor\`.
- Arabic equivalent -> \`image-compressor\`.
- \`convert this image to WebP\` -> \`image-converter\`.
- Compression without a format remains compressor.
EXIT:
- Agent plan exposes the expected canonical tool ID for all four cases and core/E2E tests pass.

### P4-B02 — Guided Agent workspace browser stability
OBSERVED:
- Chromium CI intermittently reported \`Agent Guided MVP\` not visible on \`/en\` and \`/ar\`, even though the component is wired into \`OfficialHome\`.
REQUIRED FIX:
- Prove the workspace mounts deterministically on both routes under the official Vite/preview path.
- Verify no route, locale initialization, hydration, or CSS/layout condition suppresses the region.
- Keep the test scoped to the real rendered region; do not replace it with a source-code existence assertion.
REGRESSION:
- Full Chromium run must pass the English and Arabic Guided Agent workflows on the same SHA.
EXIT:
- No missing-region failure and no runtime/page/console failure for those tests.

### P4-B03 — Video cropper / compressor verifier closure
OBSERVED:
- On the current P4 candidate, \`video-trimmer\` and \`video-resizer\` passed browser acceptance.
- \`video-cropper\` and \`video-compressor\` still failed closed with \`Execution failed closed: verifier rejected artifact\`.
- A verifier-side change already exists in history to tolerate non-finite WebM duration for non-trim operations while keeping duration mandatory for trim comparisons.
REQUIRED FIX:
- Diagnose the exact cropper/compressor output metadata/size mismatch on the current SHA.
- Keep fail-closed verification.
- For cropper: prove dimensions match requested output and output is decodable WebM.
- For compressor: prove output remains valid WebM and satisfies the measurable compression contract without relying on a false size assumption.
- Do not add a second video executor or weaken verification to bypass the failure.
REGRESSION:
- Individual Chromium acceptance for all four video capabilities: trimmer, cropper, resizer, compressor.
EXIT:
- 4/4 video acceptance tests PASS on one exact SHA.

### P4-B04 — Full localization closure exposed by Chromium
OBSERVED:
- G4 detected a French home-page H1 fallback: \`/fr must not reuse English H1\`.
- Other locale/runtime checks can expose race-sensitive visibility failures.
REQUIRED FIX:
- Close French home-page H1 first, then rerun the complete public-route localization/SEO contract.
- Audit every locale for title, description, H1, authoritative tool name, accessible UI, and runtime/console cleanliness.
- Do not weaken \`g4-localization-runtime.spec.ts\` to accept English fallback.
REGRESSION:
- Full G4 route matrix on Chromium, exact SHA only.
EXIT:
- No English H1/meta/UI leakage except explicitly allowlisted technical/shared terms.

### P4-B05 — Local verification reproducibility
OBSERVED:
- Local Chromium E2E from the recovery workstation timed out at the Playwright \`webServer\` startup boundary after 120s; the test itself did not reach the application.
- Core tests require the official \`VITE_SITE_URL\`/\`SITE_URL\` contract outside approved CI/Vercel contexts.
REQUIRED FIX:
- Document and/or codify the minimum local verification environment so a local runner can distinguish application failure from runner startup failure.
- Preserve the fail-closed origin requirement; never weaken it just to make tests runnable.
- CI remains authoritative for exact-SHA browser evidence when the local runner cannot reproduce the approved environment.
REGRESSION:
- Local \`typecheck\`, \`test:core\`, and targeted E2E produce explicit pass/fail logs with no silent environment ambiguity.
EXIT:
- Environment failures are classified as environment BLOCKER, not misreported as application PASS/FAIL.

### P4-B06 — Plan authority / branch-state alignment
OBSERVED:
- The master plan describes the normal integration path as \`execution -> main\`, while the active recovery lane is a dedicated \`recovery/*\` branch.
REQUIRED FIX:
- Treat the recovery branch as an isolated execution lane until the candidate is intentionally promoted to \`execution\`.
- Every state record must include both the active recovery SHA and the eventual integration target.
- Do not call recovery PASS evidence equivalent to main certification before exact-SHA promotion and post-merge verification.
EXIT:
- No ambiguity exists about which SHA is being tested, certified, or promoted.

### P4-B07 — Concurrent branch-drift protection
OBSERVED:
- A push was rejected because another execution session advanced the same recovery branch from \`8fb068d…\` to \`d83d2db2…\`.
REQUIRED FIX:
- Before every write: fetch the remote target and compare exact head.
- On drift: reconcile with rebase/merge while preserving all valid commits; never force-push.
- After reconciliation: rerun all affected checks because the candidate SHA changed.
REGRESSION:
- State record captures START_SHA, REMOTE_HEAD_SHA, END_SHA, and stale evidence invalidation.
EXIT:
- No mutation is pushed against an unknown remote head.

### P4-B08 — Do not duplicate the WebM remediation
DECISION:
- A temporary local experiment added \`fix-webm-duration@1.0.6\` to patch missing WebM duration metadata.
- That experiment was reverted after confirming the recovery branch already contained a verifier-side correction suitable for the current architecture.
RULE:
- Do not reintroduce the dependency unless a current-SHA test proves the verifier-side correction is insufficient and the new dependency is justified, reviewed, and covered.
- Prefer one canonical media path and the smallest architecture-consistent correction.
EXIT:
- No duplicate WebM-duration repair path exists.

### P4-B09 — Guided Agent acceptance matrix must match canonical planner behavior
REQUIRED TEST MATRIX:
1. English image compression to WebP.
2. Arabic image compression to WebP.
3. English image conversion to WebP.
4. Arabic image conversion to WebP.
5. Unsupported operation -> deterministic manual fallback.
6. Confirmation required before execution.
7. Confirmation is bound to the exact plan and file.
8. Receipt is single-use.
9. Result is produced by the canonical executor and passes output verification.
EXIT:
- All cases pass without direct engine invocation from the Agent UI.

### P4-B10 — Required CI revalidation after P4 closure
SEQUENCE:
- Fix one blocker at a time.
- Record new END_SHA.
- Rerun targeted regression.
- Rerun \`npm test\` and build.
- Rerun Chromium browser smoke/acceptance.
- Rerun Secret Scan and CodeQL when code/security changes apply.
- Recheck trust-gate and exact-SHA promotion proof.
- Invalidate all evidence from earlier SHAs.
EXIT:
- One exact candidate SHA owns all required passing evidence.

P4 EXIT CONDITION:
Do NOT advance to final certification merely because the core suite is green.
P4 is CLOSED only when P4-B01 through P4-B10 are either PASS with current-SHA evidence or explicitly classified as external BLOCKER with exact evidence. Then continue sequentially through Prompts 05–20.

# 3. REQUIRED STATE RECORD
For every prompt record:
PROMPT_ID=
START_SHA=
END_SHA=
STATUS=PASS|GAP|BLOCKER|NOT_READY
MUTATED=true|false
TESTS=
REQUIRED_CHECKS=
EVIDENCE=
STALE_EVIDENCE_INVALIDATED=
BLOCKERS=
NEXT_PROMPT=
This is evidence/state metadata only. It MUST NOT become a runtime source of truth.

# 4. ANTI-INFLATION RULES
IMPLEMENTED != VERIFIED
VERIFIED_ON_OLD_SHA != VERIFIED_ON_CURRENT_SHA
SINGLE_CI_JOB_PASS != GLOBAL_GREEN
SKIPPED != PASS
CANCELLED != PASS
UI_VISIBLE != EXECUTION_PROVEN
OUTPUT_EXISTS != OUTPUT_VERIFIED
PROVIDER_RESPONSE != EXECUTION_AUTHORITY
DOCUMENTATION_CLAIM != RUNTIME_EVIDENCE
DEPLOYMENT_EXISTS != PRODUCTION_CERTIFIED
HISTORICAL_BASELINE != CURRENT_STATE

# 5. AUTHORITY MODEL
RUNTIME AUTHORITY:
- canonical capability/tool definitions
- canonical capability registry
- execution gate
- canonical executor
- output contract
- verifier
LLM / AGENT:
- reasoning
- proposal
- intent interpretation
- plan proposal
The LLM/Agent does NOT own execution authority.
EXTERNAL WORKERS: implementation/review/evidence support only; no independent certification authority and no governance bypass.
CERTIFICATION: evidence gate only; no runtime authority.

# 6. DEFINITION OF DONE
The plan is NOT complete until:
1. Prompts 01–19 have valid evidence on the final candidate lineage.
2. Final Red Team PASS exists.
3. Release Candidate Freeze exists.
4. Final Certification Gate PASS exists.
5. Owner-authorized promotion occurs through execution -> main.
6. Post-merge canonical CI passes on the new main SHA.
7. Production identity matches certified release lineage when applicable.
8. No stale certification claims remain.
9. No hidden executable MVP capability exists outside canonical scope.
10. No second registry exists.
11. No second executor authority exists.
12. No direct main mutation occurred.

FINAL STATES ARE LIMITED TO:
RELEASE VERIFIED
OR
NOT READY — BLOCKERS ENUMERATED
There is no intermediate state called GREEN or CERTIFIED.

# 7. CODEX START DIRECTIVE
START NOW.
1. Read this plan.
2. Execute PROMPT 01 first.
3. Establish the CURRENT exact SHA.
4. Ignore stale historical evidence for certification purposes.
5. Determine PASS/GAP/BLOCKER.
6. Continue sequentially through PROMPT 20.
7. Mutate only when a real GAP exists.
8. Keep all mutations on execution.
9. Verify every mutation.
10. Invalidate stale evidence after every SHA change.
11. Do not stop for routine confirmation.
12. Do not declare completion early.
13. Do not broaden scope.
14. Do not fabricate evidence.
15. Do not bypass failures.
16. Continue until the plan reaches RELEASE VERIFIED or NOT READY — BLOCKERS ENUMERATED.
The repository state, exact SHA, executable contracts, tests, GitHub checks, and current evidence are the source of truth.
BEGIN WITH PROMPT 01.