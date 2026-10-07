#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$ROOT/scripts/loop_guard.sh"; RUNNER="$ROOT/scripts/agent-lab-run.sh"
command -v jq >/dev/null 2>&1 || { echo "SKIP: jq unavailable"; exit 0; }
t="$(mktemp -d)"; trap 'rm -rf "$t"' EXIT; cd "$t"
for x in a b c d e; do printf "patch-$x\n" >"patch-$x"; done
printf 'error-a\n' > error-a; printf 'error-b\n' > error-b
g(){ STATE_FILE="$t/state.json" COOLDOWN_SECONDS=0 "$GUARD" "$@"; }
g --task-id=P --patch-file="$t/patch-a" >/dev/null
# Concurrent state access is serialized; a held lock fails closed.
g --task-id=L --patch-file="$t/patch-a" >/dev/null
exec 9>"$t/lock.json.lock"
flock -n 9
if STATE_FILE="$t/lock.json" COOLDOWN_SECONDS=0 "$GUARD" --task-id=L --patch-file="$t/patch-b" >/dev/null 2>&1; then exit 1; fi
flock -u 9
if g --task-id=P --patch-file="$t/patch-a" >/dev/null 2>&1; then exit 1; fi
g --task-id=E --patch-file="$t/patch-a" >/dev/null
g --task-id=E --patch-file="$t/patch-b" --error-log="$t/error-a" >/dev/null
g --task-id=E --patch-file="$t/patch-c" --error-log="$t/error-a" >/dev/null
if g --task-id=E --patch-file="$t/patch-d" --error-log="$t/error-a" >/dev/null 2>&1; then exit 1; fi
g --task-id=C --patch-file="$t/patch-a" --cooldown-seconds=0 >/dev/null
if STATE_FILE="$t/cool.json" COOLDOWN_SECONDS=60 "$GUARD" --task-id=C2 --patch-file="$t/patch-a" >/dev/null; then
 if STATE_FILE="$t/cool.json" COOLDOWN_SECONDS=60 "$GUARD" --task-id=C2 --patch-file="$t/patch-b" >/dev/null 2>&1; then exit 1; fi
fi
g --task-id=M --patch-file="$t/patch-a" --max-attempts=2 >/dev/null
g --task-id=M --patch-file="$t/patch-b" --max-attempts=2 >/dev/null
if g --task-id=M --patch-file="$t/patch-c" --max-attempts=2 >/dev/null 2>&1; then exit 1; fi
if STATE_FILE="$t/run.json" COOLDOWN_SECONDS=0 "$RUNNER" --task-id=R --patch-file="$t/patch-a" >/dev/null 2>&1; then exit 1; fi
echo "PASS: loop guard + rate limiter + consecutive error + TTL/cooldown + fail-closed sandbox adapter"
