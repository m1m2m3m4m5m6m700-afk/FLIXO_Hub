# FLIXO Architecture Lock

Baseline is bound to the execution stream and must be refreshed whenever canonical control-plane contracts change.

## Locked architecture

Human Authority -> deterministic Control Plane -> Planner / Executor / Verifier.
The manual tool path remains independent.

Governance is deterministic CI/repository policy, not an autonomous authority.

## Allowed authority roles

| Role | Authority |
|---|---|
| PLANNER | propose plan/intents only |
| EXECUTOR | invoke canonical registered execution only |
| VERIFIER | verify output/evidence only |
| GOVERNANCE | deterministic gates/policy only |

Advisory/helper profiles are role overlays. They do not constitute additional certification or promotion authority. Under the Human-authorized Open Agent Execution Mode, they may perform broad repository implementation work on the canonical `execution` lane through the established mutation mechanism, while remaining prohibited from certification, promotion, scope authority, or bypass of deterministic gates.

## Non-negotiable invariants

- No Agent directly changes Control Plane state outside the canonical mutation/execution interfaces.
- No Agent certifies.
- No Agent merges or promotes to main.
- No Agent changes MVP scope without explicit Human Authority approval.
- No Agent bypasses the canonical execution gate.
- Autonomous execution is bounded by attempts, time, mutations, and task scope.
- Evidence is valid only when bound to the exact SHA under verification.
- Infrastructure Green, Product Green, and MVP Certified are separate states.
- Manual execution remains functional without the Agent Router.
- Expanded implementation authority must not weaken required verification, security, or repository protection.

## Baseline agent seats

The runtime may contain many advisory profiles and execution workers, but authority remains concentrated in:
- Planner
- Executor
- Verifier
- Governance

External workers such as repair/review adapters may implement or persist work on the canonical `execution` lane when explicitly authorized, but they remain disposable role overlays and have no independent merge, promotion, certification, scope, or bypass authority.

## Change control

Human Authority may explicitly expand or contract implementation permissions without creating a new runtime authority seat. Adding a new certification authority, autonomous promotion path, competing registry/executor, or governance bypass remains prohibited.

## Approved execution publication lane

The canonical execution mutation mechanism remains the **Durable Patch Capsule + CAS** lane.

Under Open Agent Execution Mode:
- authorized agents/workers may produce and publish implementation changes broadly on `execution`;
- publication must remain non-force and race-safe;
- a moving head causes reconciliation/CAS retry, never overwrite;
- `main` remains PR-only and unchanged by the execution lane;
- live repository settings such as rulesets and branch protection remain governed externally and cannot be rewritten by source changes;
- Patch Capsules are work products, never certification evidence.
