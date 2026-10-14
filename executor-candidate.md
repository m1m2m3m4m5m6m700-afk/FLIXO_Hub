# EXEC-HERMES-PUBLISHABLE-MVP-001 — Candidate Release Execution Register

## Reference state observed 2026-10-13

- Live remote `execution` ref, read with `git ls-remote origin refs/heads/execution`: `1d94a25dcec609b25598846be3dc57892796e766`.
- Existing PR #1291 is open and unmerged. The live PR metadata snapshot reports head branch `agent/EXEC-HERMES-PUBLISHABLE-MVP-001` at `11b12ff562637526c81203936598b8205264e316` and base SHA `452239da69b0e8adb3ab6660c903f66a40025286`. The direct remote `execution` ref is newer, so that PR snapshot does not represent the locally rebased candidate.
- Pre-reconciliation local tip `32520f01c9889dc215e506bf9a53579876ce52fd` is historical diagnostic evidence only. Its task ledger contained committed conflict markers and a duplicate active task ID; it must not be treated as a valid release candidate.
- The release branch is being reconciled without force-pushing or changing `main`. The resulting candidate SHA must be recorded from the pushed successor branch and its PR metadata, not guessed or embedded self-referentially in this file.

## Current release blockers

- The prior PR candidate's documented CI run `38270513087` reported both `bc186e08fa3d053e2cbbc9e4432422547cdef598:UNKNOWN_TASK_ID:EXEC-HERMES-PUBLISHABLE-MVP-001` and `755f958d4ccac15357c95f3e338dfa4fa7d509d7:MISSING_TASK_ID`.
- After reconciling the canonical ledger and removing the duplicated task card, a local diagnostic run no longer reported the `bc186...UNKNOWN_TASK_ID` failure. It still returned `755f958d4ccac15357c95f3e338dfa4fa7d509d7:MISSING_TASK_ID` with exit code 1. That diagnostic ran before these edits were committed, so it is not exact-SHA release evidence and must be rerun on the resulting commit.
- The remaining historical attribution failure is not resolved by a later commit. Do not rewrite history, add silent exceptions, weaken the gate, or treat unrelated successful checks as a substitute. Any historical reconciliation must use the repository's approved governance path.
- The release remains **BLOCKED / NOT CERTIFIED**. No production promotion or publication is claimed. Owner/legal and external launch prerequisites also remain unresolved.

## Candidate evidence protocol

1. Bind each verification result to the exact pushed candidate SHA and preserve its workflow/run reference.
2. Re-run every required CI, security, Red Team, browser, audit, build, and coverage gate after any relevant mutation.
3. Treat missing, queued, skipped, cancelled, neutral, stale, or unverifiable results as not passing.
4. Keep the promotion path `execution -> PR -> required checks/review -> main`. Never write directly to `main`, bypass governance, or claim certification from partial evidence.

## Next action

Publish the reconciled release work through a new non-force-pushed branch based on the live `execution` ref, open a successor PR to `execution`, then rerun the required gates on that exact candidate SHA. Keep this task open until attribution, all mandatory release gates, independent review, and owner/external prerequisites are evidenced.
