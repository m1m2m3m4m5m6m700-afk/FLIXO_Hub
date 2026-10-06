# FLIXO Repository Red-Team Certification Record

Status: HISTORICAL / NOT CURRENT

This document preserves a prior Red-Team record for audit history only. Its findings and PASS language are not evidence for the current PR #1002 candidate.

## Current requirement
The active Red-Team target is the exact live PR #1002 head on `execution`.

Prompt 17 must run from a clean checkout and must test:
- Agent and Manual workflows;
- privacy and raw File/Blob egress;
- prompt injection and malformed provider/tool data;
- invalid parameters and unsupported capabilities;
- resource exhaustion and abort;
- output corruption;
- stale-SHA and release-evidence integrity;
- security and browser gates.

Any current finding becomes a repair task. A current Red-Team PASS must be generated on the same candidate lineage later.
