# FLIXO Red Team Certification Record

STATUS: LAST-VERIFIED-CANDIDATE RECORD — NOT READY

This is the current Red Team evidence record for FLIXO Hub. Historical Red Team results are not reusable as certification evidence for a new execution SHA.

Last fully verified candidate before documentation rollover:
- SHA: `a44958a97126b2e050746010947aef2cfa286729`
- Prompt 17 clean-clone: PASS (workflow run 37437187406 / run #239)

Current lane:
- Repository: m1m2m3m4m5m6m700-afk/FLIXO_Hub
- Candidate branch: execution
- Integration PR: #1002

Current adversarial coverage implemented in-repository:
- canonical executor rejects unknown and non-admitted capabilities;
- prompt-injection-shaped and oversized requests fail closed;
- confirmation receipts cannot be replayed or transplanted to another file;
- catalog fingerprint tampering is rejected;
- filename traversal, MIME/signature spoofing, extension mismatch and ZIP-bomb ratios fail closed;
- browser E2E covers Agent confirmation and Manual execution across the ten-tool MVP.

The dedicated adversarial suite is `tests/red-team-control-plane.test.ts` and is required to pass on the final frozen candidate SHA.

Prompt 17 passed on the last verified candidate above. This documentation rollover creates a new execution SHA, so the new head must regenerate Prompt 17 evidence before any final RED_TEAM_PASS claim for the current candidate.
