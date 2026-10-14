# Gitleaks Findings Reconciliation — Evidence-Aligned Draft

**Status:** TRIAGE IN PROGRESS — NOT A RELEASE CERTIFICATE  
**Assessment date:** 2026-10-13  
**Candidate SHA:** `6e8eb56c79afcf4af011ffa213175ac20bdd71b7`  
**CI run:** [38358221403](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38358221403)  
**Gitleaks job:** [115167044750](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/38358221403/job/115167044750)  
**Scanner version:** 8.24.3  
**Finding records:** 21

## Evidence rules

This inventory is derived from the Gitleaks job log for the exact run above. Secret values, signed URLs, and telemetry signatures are intentionally omitted. A scanner finding alone does not prove a credential is live. A historical path or test filename alone does not prove it is harmless.

The original local draft did not match this CI run: its snapshot paths did not match the log, its category counts were inconsistent, and it called unverified matches real secrets. This report replaces those unsupported classifications.

`.gitleaksignore` is for exact scanner finding fingerprints, not file paths or globs. It contains only three commit-scoped findings whose false-positive status is independently confirmed: D01, E01, and L01. The eight signed-URL findings and the two historical test-fixture candidates remain unsuppressed. No broad snapshot exclusion, history rewrite, or blanket allowlist is approved here.

## Findings inventory

The local IDs below are triage references, not Gitleaks fingerprints.

| ID | Rule | Historical file and line | Commit | Current triage |
|---|---|---|---|---|
| S01 | `jwt` | `.agent-intelligence/snapshots/snap-20261011T082418575122Z-26ed84629c54cd2b.raw:46` | `22803fbfb34b2c289691661584fcd49c67cb7b27` | Potentially live Supabase Storage signed URL; owner/support review required |
| S02 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261011T082417623298Z-6c333177c5a8c3ed.raw:291` | `22803fbfb34b2c289691661584fcd49c67cb7b27` | Repeated browser-delivered GitHub telemetry HMAC; likely false positive, validate narrowly |
| S03 | `jwt` | `.agent-intelligence/snapshots/snap-20261011T072103080190Z-f2651c8711530f9b.raw:46` | `7fe2ddda73d86d2a2f520c8eb8492be505ef7bea` | Same signed URL as S01; one unique token repeated |
| S04 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261011T072102257271Z-c7d769e7591b4def.raw:291` | `7fe2ddda73d86d2a2f520c8eb8492be505ef7bea` | Same GitHub telemetry HMAC as S02; one repeated value |
| S05 | `jwt` | `.agent-intelligence/snapshots/snap-20261008T081451844708Z-1c2a43ab506560f0.raw:46` | `a69ae8296541d64d31e32af472fdbd68cf745092` | Same signed URL as S01; one unique token repeated |
| S06 | `jwt` | `.agent-intelligence/snapshots/snap-20261008T080826962747Z-1c2a43ab506560f0.raw:46` | `1f3cf3639a7ea33ec9fa0b51a4f2b070f3e3a6fb` | Same signed URL as S01; one unique token repeated |
| S07 | `jwt` | `.agent-intelligence/snapshots/snap-20261007T211848104231Z-f4a3e6fed48fa5bd.raw:46` | `e184f1fd3c0a627748181b5d3f5b4450dffd6fe6` | Same signed URL as S01; one unique token repeated |
| S08 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261008T081451283223Z-9266a477fa16baf3.raw:291` | `a69ae8296541d64d31e32af472fdbd68cf745092` | Same GitHub telemetry HMAC as S02; one repeated value |
| S09 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261008T080825664757Z-a315600dfe8285bf.raw:291` | `1f3cf3639a7ea33ec9fa0b51a4f2b070f3e3a6fb` | Same GitHub telemetry HMAC as S02; one repeated value |
| S10 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261007T211847075160Z-b4428f2b76ee1153.raw:291` | `e184f1fd3c0a627748181b5d3f5b4450dffd6fe6` | Same GitHub telemetry HMAC as S02; one repeated value |
| S11 | `jwt` | `.agent-intelligence/snapshots/snap-20261007T054700585464Z-82830ecb6dcd500e.raw:46` | `24b9e2197b68f62076cd8d16be83b9cfe9fb1ff2` | Same signed URL as S01; one unique token repeated |
| S12 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261007T054659727323Z-5cd4a3fcacf87b17.raw:291` | `24b9e2197b68f62076cd8d16be83b9cfe9fb1ff2` | Same GitHub telemetry HMAC as S02; one repeated value |
| S13 | `jwt` | `.agent-intelligence/snapshots/snap-20261007T054437818957Z-82830ecb6dcd500e.raw:46` | `397d114aa3d2003cc86fc5c9797c65d873e6ca60` | Same signed URL as S01; one unique token repeated |
| S14 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261007T054437361425Z-cebbdf8315977995.raw:291` | `397d114aa3d2003cc86fc5c9797c65d873e6ca60` | Same GitHub telemetry HMAC as S02; one repeated value |
| S15 | `jwt` | `.agent-intelligence/snapshots/snap-20261007T054338433788Z-e6913b6950195f34.raw:46` | `ef02b027b68338c10504ce529e918366eb5e1b6f` | Same signed URL as S01; one unique token repeated |
| S16 | `generic-api-key` | `.agent-intelligence/snapshots/snap-20261007T054337769456Z-80e37c9c24a66d9f.raw:291` | `ef02b027b68338c10504ce529e918366eb5e1b6f` | Same GitHub telemetry HMAC as S02; one repeated value |
| D01 | `generic-api-key` | `docs/CELL-HARD-CONTROL-CONTRACT.md:112` | `a3ae8f4ff039cf5d3e9bb702a34d03042b28411b` | Confirmed false positive: policy DSL directive, not a credential |
| T01 | `generic-api-key` | `scripts/ci/test-chair1-central-lease-adversarial.mjs:18` | `a4d85af76b8dc19116ebb1043fb1cafeb36fbe54` | Historical test-fixture candidate; synthetic status not independently cleared |
| T02 | `generic-api-key` | `scripts/ci/test-auto-repair-chair1-audit.mjs:93` | `9ed9a5f1a518defb915f1391a0c03f7e6d925a44` | Historical test-fixture candidate; synthetic status not independently cleared |
| E01 | `generic-api-key` | `.env.example:70` | `d034d5a06bdedf2c924bfd86a700d00461b46ca0` | Confirmed false positive: `FLIXO_USER_COMMAND_SIGNING_KEY=` had a blank value |
| L01 | `cloudflare-api-key` | `المهام.md:27` | `112bc0d8d4d104a4ade23aef8daf69a09379a9cc` | Confirmed false positive: matched value resolves to a Git commit SHA |

## Classification totals

- **8 signed-URL detections:** all eight are the same token, not eight unique credentials. Its decoded expiry is **2027-03-21 17:18:14 UTC**, so it had not expired on the assessment date. It is a Supabase Storage signed-URL format associated with a Supabase project reference that is not found elsewhere in the candidate repository outside snapshots. The available evidence does not establish whether the object is public by design or whether the URL was revoked.
- **8 GitHub telemetry HMAC detections:** the same 64-character hexadecimal value appears in the same browser-delivered `auth_hydro_click_hmac` field in eight snapshots. It appears to be public-page telemetry, not a repository credential. Use a narrow suppression only after verifying the exact finding fingerprints and config behavior.
- **2 historical test-fixture candidates:** T01 and T02; verify the values are test-only and not shared with any active credential.
- **3 confirmed false positives:** D01 policy DSL, E01 blank environment variable, and L01 commit SHA.

These categories total 21 records. Only the signed URL remains a potential active bearer URL; the other snapshot group is a likely telemetry false positive pending exact-fingerprint validation.

## Exact false-positive suppressions in this patch

The root .gitleaksignore contains only three commit-scoped entries in commit:path:rule-id:start-line format:

- D01: the matched text is a policy DSL directive, not a credential.
- E01: the .env.example value is blank.
- L01: the matched value is an immutable Git commit SHA.

No signed-URL finding, snapshot telemetry HMAC, or T01/T02 test-fixture candidate is suppressed by this patch. Those findings remain visible until their individual evidence supports a decision.
## Signed URL containment

The signed URL is from the external Supabase project host seen in a historical crawled page, not the configured FLIXO Supabase project. The candidate repository has no reference to that host outside the historical snapshots. Do not access, replay, or publish the signed URL.

If the object is not intentionally public, the owner of that Supabase project should contact Supabase Support to revoke signed URLs and establish the object's intended visibility. Supabase documentation states signed URLs remain valid until expiry regardless of Auth JWT signing-key changes, and revocation requires Supabase Support: https://supabase.com/docs/guides/storage/serving/downloads. Do not rotate FLIXO's own Auth JWT key as a substitute; this finding is tied to a separate project.

No access to the third-party Supabase project or evidence of revocation is available in this session. Therefore this item remains `BLOCKED / WAITING FOR AUTHORITY` for owner/support confirmation. No token or signed URL value is included in this report.

## Required remediation

1. Review the SARIF artifact from the linked job and correlate all 21 records. Keep matched values out of logs and comments.
2. For the signed URL, have the responsible owner confirm whether the asset was intentionally public. If private or uncertain, request revocation from Supabase Support for the external project and retain non-secret confirmation evidence. Do not claim the token has been revoked.
3. Validate T01 and T02 as synthetic, non-production test fixtures. Do not whitelist based on filename alone.
4. Reproduce the scanner results with Gitleaks 8.24.3 and use exact fingerprints from the actual report. Suppress only findings proven harmless, narrowly and audibly. Do not exclude entire snapshots or weaken full-history scanning.
5. For D01, E01 and L01, add only narrowly scoped false-positive handling after reproducing the exact scan and confirming config semantics. The existing `.gitleaks.toml` was not changed by this document.
6. Preserve history. Do not use deletion, baseline changes, or broad allowlists to manufacture a green gate.
7. Re-run Gitleaks against the exact release candidate and record the new run ID, SHA, remaining findings, and conclusion.

## Other release blockers remain

- CELL attribution still fails on `755f958d4ccac15357c95f3e338dfa4fa7d509d7:MISSING_TASK_ID`. PR #1300 is a proposal only; no self-approval or baseline shift is authorized.
- `docs/MODEL_LICENSE_MANIFEST.json` has zero admitted production models on the inspected candidate.
- Run 38358221403 skipped the rest of the primary job after attribution failure, including npm test, production audit, and build; Chromium browser smoke and production exact-SHA deployment were also skipped. Skipped is not pass.
- `trust-gate` and `Exact-SHA promotion proof` failed.

**Current decision:** `NOT RELEASE READY`. This document is a corrected triage record, not evidence that Gitleaks or any release gate has passed.
