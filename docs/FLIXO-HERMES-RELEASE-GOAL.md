# FLIXO Hub — Hermes Official Release Goal

**Mission ID:** EXEC-LEAD-OFFICIAL-RELEASE-CERTIFICATION-001  
**Execution task:** EXEC-HERMES-PUBLISHABLE-MVP-001  
**Integration target:** `execution` through a reviewed pull request  
**Production target:** protected `main`, only after required review and exact-SHA gates  
**Release posture:** fail-closed

## Goal

Produce a publicly releasable FLIXO Hub MVP, deploy it through the repository-approved production path, and preserve an auditable certificate of the exact source SHA and deployed artifact. A clean local test, a pushed branch, or an open pull request is not release completion.

Hermes owns implementation, repairs, and evidence collection. Hermes must not self-approve, self-merge, self-promote, bypass governance, or issue a certificate outside the repository's independent certification authority.

## Required release outcomes

1. **Git and candidate integrity:** no unresolved rebase/merge, conflict markers, duplicate active task IDs, or unexplained changes; the canonical task ledger and generated Hermes prompt queue agree; final local and remote branch names and SHAs are recorded.
2. **CELL attribution and governance:** the unchanged attribution baseline and policy pass on the candidate. Any historical attribution disposition must be append-only, evidence-backed, explicitly authorized by the repository owner/governance authority, and independently reviewed. No invented Task IDs, rewritten history, hidden exceptions, or baseline bypasses.
3. **Model admission:** `npm run test:model-license` and `npm run test:model-license:release` both pass on the candidate. The production manifest must contain at least one genuinely evidenced model with immutable version/artifact SHA-256, source, actual license terms, provenance, compatibility/security/evaluation evidence, and required human approval. Never populate the manifest with synthetic entries merely to turn the gate green.
4. **Code quality and build:** dependency installation, the full `npm test` matrix, typecheck, full lint, production dependency audit, and `npm run build` succeed. Record exact command, exit code, and SHA.
5. **Security:** secret scanning, CodeQL, dependency/security checks, Agent Watchdog, sensitive-path assurance, and Red Team regressions pass. Every finding is classified with evidence. Any exception is narrow, justified, and policy-compliant; any real credential is handled through revocation/rotation. A suppression alone does not prove a credential is safe.
6. **Runtime and browser evidence:** required Hub Stage 1 contract, exact-SHA coverage, and Chromium Playwright acceptance pass against the same candidate SHA. No mandatory job may be skipped, stale, cancelled, neutral, or unverified and still count as passing.
7. **Legal and external launch readiness:** owner/legal approval of the exact code-license and proposed attribution terms is recorded; a real support contact and tested private security reporting are configured; deployment/account/domain and applicable analytics/Search Console/consent requirements are verified. Repository documentation is not a substitute for external approval or account evidence.
8. **Independent release proof:** required Code Owner and independent reviews are complete; the protected PR and required checks pass; the deployment is reachable and immutable provenance binds the deployed artifact to the approved commit. The official certificate identifies repository, PR, source SHA, build/workflow run IDs, security/browser evidence, deployment identity/URL, approval records, and final merge SHA when merged.

## Required verification sequence

`PREFLIGHT → RECONCILE GIT → FIX → TARGETED TESTS → FULL REGRESSION → DIFF REVIEW → NORMAL PUSH → VERIFY REMOTE SHA → EXACT-SHA CI/SECURITY/BUILD/BROWSER → EXTERNAL READINESS → INDEPENDENT REVIEW → CERTIFICATION → APPROVED PROMOTION/DEPLOYMENT → VERIFY LIVE ARTIFACT`

After any source or configuration mutation, rerun all affected exact-SHA checks. Do not mix evidence from different candidate SHAs.

## Blocked-state contract

If a required technical gate fails, report `BLOCKED / TECHNICAL` with first failing evidence, root-cause hypothesis, repair-attempt count, and next bounded action.

If a required legal, governance, credential, or external-account action is unavailable, report `BLOCKED / WAITING FOR AUTHORITY`, identify the responsible decision-maker/action and required evidence, and continue independent work that does not depend on it.

A blocked gate is not waived by unrelated passing checks. Do not close the task while any release criterion remains unresolved.

## Final acceptance record

The final report must include exact published candidate SHA; final remote branch; changed paths; command outputs and exit codes; CI run IDs and conclusions; security-finding dispositions; browser and deployment evidence; legal/external approvals; independent review; and official certificate reference. Use only `BLOCKED`, `CERTIFICATION-READY`, or `CERTIFIED` as appropriate. `CERTIFIED` is valid only after the independent certification authority actually issues it.
