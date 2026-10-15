# FLIXO Shared Operational Memory

## Semantic memory

Observed source SHA: `64587c0a20075a352ff2617785f6739009f413ee`

- Shared memory preserves provenance, evidence, status, utility, usage, and tested SHA.
- Semantic retrieval uses a 384-dimensional embedding with hybrid semantic and lexical ranking.
- Only `PROMOTED` memory bound to the current exact SHA is executable knowledge.
- Episodic recall is scoped to task ID and exact SHA.
- The embedding writer and semantic retrieval RPC are service-role-only.
- `flixo-memory-embed` uses the hosted `gte-small` embedding model.
- Semantic retrieval can fall back to lexical retrieval unless strict semantic mode is enabled.

## Economy

- Wallets use internal credits only.
- Pricing combines task difficulty and open demand.
- Solver stake is 25% of the quoted reward.
- Successful settlement returns stake and pays 2x the quoted reward minus a 10% knowledge tax.
- Failed settlement burns the locked stake and reduces reputation.
- Solver and verifier identities must differ.
- Settlement is exact-SHA bound.
- The economy ledger is append-only and SHA-256 linked.
- Economy mutation RPCs are service-role-only and do not grant repository authority.

## Learning rule

Memory and economic signals are advisory substrates. Canonical execution remains governed by the repository control plane, exact-SHA checks, independent verification, and promotion gates.


## Imported protected-main governance memory (historical snapshot 2026-10-08)

This record is historical evidence, not current authority. Re-read live GitHub policy and current refs before making release claims.

## Canonical Governance Memory

### Authority
- Agent identity: FLIXO-Lead-Agent.
- Contract version: 1.4.1.
- Current state: BOOTSTRAP / POST-MERGE SYNC.
- Active execution authority: NOT ESTABLISHED.
- Approval evidence: NOT VERIFIED.
- Source: merged v1.4.1 governance contract and current STATE.md.

### Repository
- Repository: m1m2m3m4m5m6m700-afk/FLIXO_Hub.
- Production truth branch: main.
- Historical main SHA observed 2026-10-08: 508b5f9f9314deb7cbfd6d6592450b7d5f39141e.
- Bootstrap implementation PR: #1257.
- PR #1257 merge commit: 508b5f9f9314deb7cbfd6d6592450b7d5f39141e.
- Source: GitHub metadata observed 2026-10-08.

### Ownership
- CODEOWNERS lists @m1m2m3m4m5m6m700-afk as owner.
- Owner and PR author are the same GitHub account.
- No GitHub APPROVE review is recorded on PR #1257.
- Source: .github/CODEOWNERS and PR review metadata.

### Implemented Governance
- Admission Gate: .github/workflows/agent-governance-admission.yml.
- Admission implementation: scripts/ci/admission-gate.mjs.
- Downgrade telemetry: scripts/ci/agent-governance-metrics.mjs.
- Blocked-channel verifier: scripts/ci/check-agent-blocked-channel.mjs.
- Governance Contract: .github/workflows/governance-contract.yml.
- Admission remains execution-only, read-only, and exact-SHA bound.
- Automatic downgrade enforcement begins only after the 10-completed-PR floor.

### CI Topology
- Worker/implementation PRs do not execute the canonical execution -> main release-only verify/browser/coverage topology.
- On pre-merge head ea868bd303b01977400dd692ef6271f62bbf2b87, FLIXO CI passed with trust-gate=PASS_WORKER_PR and promotion proof explicitly not applicable to worker PRs.
- This pre-merge evidence is historical and must not be treated as evidence for the current main SHA unless independently rerun.

### Post-merge status
- PR #1257 is merged.
- main pointed to `508b5f9f9314deb7cbfd6d6592450b7d5f39141e` as observed on 2026-10-08.
- Merge status does not imply ACTIVE.
- The verified GitHub signature on 508b5f9f9314deb7cbfd6d6592450b7d5f39141e does not substitute for a PR APPROVE review or other accepted owner-approval evidence.
- Strict main governance remains authority-controlled as documented in Issue #1125.
- Live agent-blocked label enforcement remains to be proven by the live verifier.

### Evidence discipline
- Any mutation changes the target SHA and invalidates evidence tied to the prior SHA.
- Before claiming GREEN/ACTIVE/certification/production, re-read current main HEAD and attach evidence to that exact SHA.
