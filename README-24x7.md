# FLIXO 24x7 Agent Watchdog Operations

This document records operational behavior only. It is not a dispatch ledger and does not replace repository governance.

The Agent Runner executes bounded agent work and reports liveness and progress to the Watchdog. The Watchdog consumes authenticated heartbeats and checkpoints, tracks sequence/progress state, and treats stale or contradictory state as a failure condition.

The intended control loop is:

agent → bounded runner → watchdog → bounded GitHub workflow action

Heartbeats provide liveness. Checkpoints bind meaningful progress to a candidate state. Redispatch is permitted only when the recorded failure condition and current candidate identity satisfy the bounded workflow contract. Repeated or unsafe failures trip the breaker rather than expanding authority.

Operational observability is exact-SHA bound. Evidence records the repository, candidate commit, workflow run identity, and relevant checkpoint or heartbeat outcome. A newer execution SHA supersedes older evidence for current verification.

Failure handling is fail-closed: unknown agents, stale sequence numbers, unexpected repository or ref identity, untrusted workflow inputs, missing verification, or out-of-scope mutation stop the operation rather than widening permissions.

GitHub production protection, branch rules, external rulesets, credentials, and provider secrets are controlled outside this document. No token or secret value is recorded here.
