#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
GUARD="$ROOT/scripts/loop_guard.sh"; RUNNER="$ROOT/scripts/agent-lab-run.sh"
command -v jq >/dev/null 2>&1 || { echo "SKIP: jq unavailable"; exit 0; }
command -v flock >/dev/null 2>&1 || { echo "SKIP: flock unavailable"; exit 0; }
t="$(mktemp -d)"; trap 'rm -rf "$t"' EXIT; cd "$t"
for x in a b c d e f g h; do printf "patch-$x\n" >"patch-$x"; done
printf 'error-a\n' > error-a; printf 'error-b\n' > error-b
g(){ STATE_FILE="$t/state.json" COOLDOWN_SECONDS=0 "$GUARD" "$@"; }

# First acceptance and exact duplicate-patch rejection.
g --task-id=P --patch-file="$t/patch-a" >/dev/null
if g --task-id=P --patch-file="$t/patch-a" >/dev/null 2>&1; then exit 1; fi

# Concurrent state access is serialized; a held lock fails closed.
g --task-id=L --patch-file="$t/patch-a" >/dev/null
exec 9>"$t/lock.json.lock"
flock -n 9
if STATE_FILE="$t/lock.json" COOLDOWN_SECONDS=0 "$GUARD" --task-id=L --patch-file="$t/patch-b" >/dev/null 2>&1; then exit 1; fi
flock -u 9

# Error fingerprints are consecutive: same, same, different(reset), same, same, then third same blocks.
g --task-id=E --patch-file="$t/patch-a" >/dev/null
g --task-id=E --patch-file="$t/patch-b" --error-log="$t/error-a" >/dev/null
g --task-id=E --patch-file="$t/patch-c" --error-log="$t/error-a" >/dev/null
g --task-id=E --patch-file="$t/patch-d" --error-log="$t/error-b" >/dev/null
g --task-id=E --patch-file="$t/patch-e" --error-log="$t/error-a" >/dev/null
g --task-id=E --patch-file="$t/patch-f" --error-log="$t/error-a" >/dev/null
if g --task-id=E --patch-file="$t/patch-g" --error-log="$t/error-a" >/dev/null 2>&1; then exit 1; fi

# Cooldown blocks an immediate retry.
STATE_FILE="$t/cool.json" COOLDOWN_SECONDS=60 "$GUARD" --task-id=C2 --patch-file="$t/patch-a" >/dev/null
if STATE_FILE="$t/cool.json" COOLDOWN_SECONDS=60 "$GUARD" --task-id=C2 --patch-file="$t/patch-b" >/dev/null 2>&1; then exit 1; fi

# Max attempts blocks the third accepted attempt.
g --task-id=M --patch-file="$t/patch-a" --max-attempts=2 >/dev/null
g --task-id=M --patch-file="$t/patch-b" --max-attempts=2 >/dev/null
if g --task-id=M --patch-file="$t/patch-c" --max-attempts=2 >/dev/null 2>&1; then exit 1; fi

# TTL expires an otherwise eligible retry.
STATE_FILE="$t/ttl.json" COOLDOWN_SECONDS=0 "$GUARD" --task-id=T --patch-file="$t/patch-a" --ttl-seconds=1 >/dev/null
sleep 2
if STATE_FILE="$t/ttl.json" COOLDOWN_SECONDS=0 "$GUARD" --task-id=T --patch-file="$t/patch-b" --ttl-seconds=1 >/dev/null 2>&1; then exit 1; fi

# Runner fails closed when the repository has no sandbox implementation.
if STATE_FILE="$t/run.json" COOLDOWN_SECONDS=0 "$RUNNER" --task-id=R --patch-file="$t/patch-a" >/dev/null 2>&1; then exit 1; fi

# Runner integration clears stale failure evidence after a successful custom sandbox.
printf 'stale-error\n' > "$t/stale-error"
printf '{"success":true,"value":"ok"}\n' > "$t/success.json"
STATE_FILE="$t/success-state.json" COOLDOWN_SECONDS=0 "$RUNNER" --task-id=S --patch-file="$t/patch-h" --error-log="$t/stale-error" --sandbox-cmd="cat '$t/success.json'" >/dev/null
[[ ! -e "$t/stale-error" ]]

echo "PASS: loop guard + rate limiter + consecutive error + TTL/cooldown + locking + fail-closed sandbox adapter + stale-error cleanup"
