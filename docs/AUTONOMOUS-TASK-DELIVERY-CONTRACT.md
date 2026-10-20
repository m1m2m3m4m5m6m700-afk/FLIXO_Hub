# FLIXO Autonomous Task Delivery Contract

STATUS: CANONICAL / EXECUTION-BINDING

PROMPT -> TASK -> ADMITTED -> WORKING -> IMPLEMENTED -> PUBLISHED -> VERIFIED -> DONE

An accepted execution task must continue until DONE, BLOCKED_EXTERNAL, or BLOCKED_SAFETY. Human approval, OWNER_ACTION, WAITING_FOR_HUMAN, and REVIEW_REQUIRED are never execution stop states.

Required identity: TASK_ID, AGENT_ID, SESSION_ID, MISSION_ID, START_SHA, CURRENT_SHA, ACCEPTANCE_DIGEST.

DONE requires an implementation, publication on execution, exact published/verified/live SHA equality, and presence of all required changed paths. A local patch, commit object, or agent message is not completion evidence.

When execution moves, the agent must use CAS-style reconciliation: refresh -> reconcile -> retest -> republish. Never force-push or overwrite a newer execution head.

Transient failures remain repairable. Retryable external failures are bounded. Safety failures become BLOCKED_SAFETY. Lost agent/session becomes RECOVERING and another authorized agent continues the same TASK_ID.

Out-of-scope work becomes a new task. The active task objective and acceptance conditions are not silently expanded.

Merge remains execution -> protected PR -> automated required checks -> main. No direct main ref mutation. Human review is not a merge prerequisite.

The executable contract is packages/contracts/src/cell-autonomous-delivery.ts and its regression suite is tests/security/ci/cell-autonomous-delivery.test.ts.
