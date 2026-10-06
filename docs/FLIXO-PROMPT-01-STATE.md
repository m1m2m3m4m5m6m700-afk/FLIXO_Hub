# FLIXO Prompt 01 — Current State Reconciliation

STATUS: NOT_READY
PROMPT_ID: 01
SCOPE: READ_ONLY_STATE_RECORD
RECORDED_EXECUTION_SHA: b11d1e39339ff8da41fb192a591f8f03d311f9eb
CURRENT_MAIN_SHA_AT_RECONCILIATION: 263827228cbe5f4851470297fde5f2858ff844de
INTEGRATION_PR: #1002
PRIMARY_BRANCH: execution
INTEGRATION_PATH: execution -> main

## Required exact-SHA evidence

Required checks are:
- FLIXO CI
- trust-gate
- Exact-SHA promotion proof
- FLIXO CodeQL
- FLIXO Secret Scan
- browser evidence
- exact-SHA coverage evidence
- Red Team evidence

At reconciliation time these checks were not all green on one candidate SHA, so no certification claim is valid.

## Known blockers

1. GitHub main ruleset remains under-hardened relative to the active plan: one approving review, Code Owner review, stale-review dismissal, latest-push approval, thread resolution, and strict required checks are not all currently enforced.
2. A final frozen candidate has not yet completed Prompt 17–19 exact-SHA evidence.
3. Production identity evidence belongs to main after promotion and therefore cannot be claimed on execution.

## Stale evidence invalidated

Any older document referencing a different repository name, old PR number, literal shell placeholders such as `$sha`, or historical candidate SHA is not current certification evidence.

## Next

Continue the active execution plan from Prompt 02 onward. This record is state metadata only and is not a runtime authority.
