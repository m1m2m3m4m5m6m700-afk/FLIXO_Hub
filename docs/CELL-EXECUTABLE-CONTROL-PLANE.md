# CELL — EXECUTABLE CONTROL-PLANE CONTRACT

Status: IMPLEMENTED REFERENCE CONTRACT
Version: 1.0.0

هذه الوثيقة تربط مبادئ `الخلية.md` بمرجع تنفيذي deterministic قابل للاختبار.

## Canonical implementation

`packages/contracts/src/cell-control-plane.ts`

لا ينشئ هذا الملف Registry أو Executor أو Certification Authority ثانية؛ هو عقد مشترك للـstate/invariant checks ويمكن للـruntime القانوني استخدامه.

## Invariants

| Invariant | Executable check | Negative proof |
|---|---|---|
| PASS ≠ CERTIFIED ≠ PROMOTED | `canPromote()` | يفشل بدون certification أو exact SHA |
| SHA drift invalidates evidence | `classifyEvidence()` | يحول evidence إلى STALE |
| No blind retry | `decideRetry()` | يرفض نفس failure fingerprint |
| Lease must be live and owned | `assertLeaseOwner()` | يرفض stale/mismatched lease |
| Agent continuity | `guardianDecision()` | يحدد WAKE فقط |
| Knowledge ≠ authority | `isMemoryActionable()` | stale/unproven memory غير actionable |
| Frontier is quantitative | `scoreFrontier()` | deterministic cost/risk penalty |
| State machine integrity | `assertTransition()` | illegal transitions fail closed |

## State machines

### Task
`PLANNED → READY → CLAIMED → RUNNING → CHECKPOINTED → VERIFYING → VERIFIED → PROMOTABLE → PROMOTED`

### Candidate
`CREATED → PROMISING/NEEDS_EVIDENCE → SELECTED → CERTIFIED → PROMOTED`

### Agent
`BOOTING → READY ↔ WORKING/IDLE`

Stuck/lost states require recovery; guardians emit only `WAKE/OBSERVE`.

## Crash/concurrency boundary

Pure contracts cannot supply durable storage. Durable atomicity remains the runtime state-store responsibility.

Required runtime integration:
1. atomic Task/Agent/Candidate transitions;
2. compare-and-swap/idempotent lease acquisition;
3. checkpoint persistence before recovery;
4. idempotency keys for task execution;
5. evidence invalidation on SHA drift at write/read boundaries;
6. server-side promotion rejection before merge/deploy mutation.

## Behavioral campaign seeds

`agent loss`, `hang`, `duplicate wake`, `stale lease`, `partial write`, `scheduler restart`, `false green`, `conflicting memory`, `certification disagreement`.

## Ownership

Architecture: `الخلية.md`
Runtime contracts: this document + `packages/contracts/src/cell-control-plane.ts`
Repository policy: `AGENTS.md`, `المهام.md`, `CONTRIBUTING.md`
Evidence authority: existing Evidence Fabric
Promotion authority: existing repository governance/certification
