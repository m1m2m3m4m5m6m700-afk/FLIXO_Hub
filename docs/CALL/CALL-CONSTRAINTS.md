# FLIXO CALL Constraints

Version: 1.0.0

1. No objective -> no work.
2. No Solver + Opponent pair -> no task.
3. Solver cannot certify or adjudicate its own disputed claim.
4. Opponent must start independently before Solver-result disclosure.
5. Red Team is distinct from Opponent and attacks a frozen Candidate.
6. Verification is independent of Solver, Opponent, and Red Team.
7. Exact SHA binding is mandatory for admission, claims, evidence, candidate, verification, certification, promotion, and learning.
8. Policy is versioned and hashed. Agents and Master cannot negotiate it.
9. Policy exceptions require escalation and separate authorization. Active missions are not rewritten by policy revision.
10. No second executor, dispatcher, runtime registry, certification authority, or source of truth.
11. CALL never writes directly to main and never bypasses execution governance.
12. Memory is append-only. Updating knowledge creates a new entry that supersedes or invalidates an old one.
13. XP requires accepted evidence and a disposition reference.
14. XP never grants authority and never overrides correctness gates.
15. Budget exhaustion is a hard stop.
16. Repeated plan hashes are a plan-loop failure.
17. Failed Candidates are retained with disposition and provenance. They are not deleted.
18. Decision rationales reference operational evidence only, never hidden chain-of-thought.
19. Historical architecture cannot become CURRENT by documentation alone.
20. Production 10/10 requires independent governance evidence, not code assertions.
