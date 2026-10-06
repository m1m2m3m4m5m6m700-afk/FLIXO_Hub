# FLIXO Red Team Certification Record

STATUS: NOT READY

This is the current Red Team evidence record for FLIXO Hub. Historical Red Team results are not reusable as certification evidence for a new execution SHA.

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

Prompt 17 has not yet been certified on a frozen clean-clone candidate. Therefore no RED_TEAM_PASS claim is valid yet.
