# agent-lab Governance

Branches: main (production), base (integration), lab (experimental), agent/<role>/<card>-<slug> (isolated work).
Agents never push to main. Lab candidates flow lab -> base -> main through repository governance.

Invariants:
- INV-01 objective is explicit and machine-readable.
- INV-02 every assignment has Solver + Opponent.
- INV-03 Opponent starts independently before Solver disclosure.
- INV-04 exact SHA binds assignment and evidence.
- INV-05 Candidate requires Red Team.
- INV-06 verification is independent.
- INV-07 no agent is a certification authority.
- INV-08 no second executor or dispatcher.
- INV-09 budget and termination are hard controls.
- INV-10 ledgers are append-only.
- INV-11 XP requires evidence and disposition.
- INV-12 failed artifacts are retained, not deleted.
- INV-13 CI consumes trusted policy from the target branch.
- INV-14 untrusted changes cannot override gate policy.

Gates: G-TEST, G-BASE, G-MAIN. A gate failure is fail-closed. Branch protection and live governance remain external controls.