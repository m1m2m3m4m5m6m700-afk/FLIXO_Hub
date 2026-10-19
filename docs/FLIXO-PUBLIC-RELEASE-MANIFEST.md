# FLIXO Hub Public Release Manifest

Status: **BLOCKED_WITH_EVIDENCE / NOT CERTIFIED**

This manifest is an evidence ledger, not a certificate. It records only verifiable current facts; queued runs are not PASS.

## Candidate identity
- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Branch: `agent/phase0-remediation-20261019`
- Candidate SHA at manifest authoring: `657f00177ac3edc921c47a19c844f696788825ce`
- PR: [#1341](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/pull/1341), OPEN / NOT MERGED
- Production origin declared by project: https://flixoai.m1m2m3m4m5m6m700.workers.dev
- Release tag: NOT CREATED

## Security evidence
- Historical scan: [run 39220436779](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39220436779), FAIL with 24 findings.
- New scan on prior candidate: [run 39279252395](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39279252395), observed QUEUED; its SHA is stale relative to this manifest.
- Latest scan at manifest authoring: [run 39279928624](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39279928624), QUEUED on the candidate SHA. Not PASS.
- 23 narrow commit/path/regex allowlist entries were added for likely historical false positives. Their validity still requires the full-history scan to complete.
- One Cloudflare-related historical finding remains intentionally unallowlisted until credential revocation/rotation is verified. See [rotation log](SECURITY-ROTATION-LOG.md).
- Finding-by-finding triage: [SECURITY-FINDINGS-TRIAGE.md](SECURITY-FINDINGS-TRIAGE.md).

## Agent Blocked Channel
- Previous run: [39228726782](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39228726782); prior evidence showed missing labels `agent-blocked` and `agent-blocked-global`.
- A retry is queued; no successful conclusion is verified yet.
- Labels must be confirmed in repository configuration before this gate can be considered PASS.

## Build evidence
- Local build: **NOT RUN**. Desktop Commander devices were offline at last check.
- CI build: [FLIXO CI run 39279928569](https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/actions/runs/39279928569), QUEUED at manifest authoring; this is not yet a completed build.
- CI artifact: none available from the queried run at the time of inspection.
- Build output hash / identity file hash: NOT AVAILABLE.
- Added read-only verifier: [scripts/verify-build.mjs](../scripts/verify-build.mjs). It has not yet been run against a real `dist/` output.

## Remaining required gates
- [ ] Secret Scan PASS on the final candidate SHA
- [ ] Agent Blocked Channel PASS with both labels present
- [ ] CI build and artifact inventory PASS on the final candidate SHA
- [ ] Run `node scripts/verify-build.mjs dist` against the actual output and retain JSON output/hashes
- [ ] Verify Cloudflare credential rotation/revocation
- [ ] Rebind and re-check all required statuses after any commit or merge
- [ ] PR #1341 merged only after required security gates PASS
- [ ] Post-merge checks and production identity verification PASS
- [ ] Create `v1.0.0-rc.1` only after all release gates PASS on one final SHA

No tag has been created. No deployment certification is claimed.
