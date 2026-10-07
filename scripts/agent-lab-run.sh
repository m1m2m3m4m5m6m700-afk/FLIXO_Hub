#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARD="$SCRIPT_DIR/loop_guard.sh"
TASK_ID=""; PATCH_FILE=""; ERROR_LOG=""; SANDBOX_CMD=""
die(){ echo "[agent-lab] $*" >&2; exit 47; }
while [[ $# -gt 0 ]]; do
 case "$1" in
  --task-id=*) TASK_ID="${1#*=}"; shift;;
  --patch-file=*) PATCH_FILE="${1#*=}"; shift;;
  --error-log=*) ERROR_LOG="${1#*=}"; shift;;
  --sandbox-cmd=*) SANDBOX_CMD="${1#*=}"; shift;;
  -h|--help) echo "agent-lab-run --task-id=ID --patch-file=PATH [--error-log=PATH] [--sandbox-cmd=CMD]"; exit 0;;
  *) die "unknown option: $1";;
 esac
done
[[ -n "$TASK_ID" ]] || die "--task-id is required"
[[ -n "$PATCH_FILE" && -f "$PATCH_FILE" ]] || die "--patch-file must point to a file"
if [[ -z "$SANDBOX_CMD" ]]; then
 if [[ -x "$SCRIPT_DIR/sandbox.sh" ]]; then SANDBOX_CMD="$SCRIPT_DIR/sandbox.sh --dry-run-pr --patch=\"$PATCH_FILE\" -q"
 elif [[ -f "$SCRIPT_DIR/sandbox.sh" ]]; then SANDBOX_CMD="bash \"$SCRIPT_DIR/sandbox.sh\" --dry-run-pr --patch=\"$PATCH_FILE\" -q"
 else die "sandbox command unavailable; refusing bypass"; fi
fi
[[ -x "$GUARD" ]] || die "loop guard unavailable; refusing bypass"
args=( "--task-id=$TASK_ID" "--patch-file=$PATCH_FILE" ); [[ -n "$ERROR_LOG" ]] && args+=( "--error-log=$ERROR_LOG" )
set +e; "$GUARD" "${args[@]}"; rc=$?; set -e
(( rc==0 )) || { echo "[agent-lab] blocked by loop guard rc=$rc" >&2; exit "$rc"; }
out="$(mktemp)"; trap 'rm -f "$out"' EXIT
set +e; bash -lc "$SANDBOX_CMD" >"$out" 2>&1; rc=$?; set -e
if (( rc!=0 )); then [[ -n "$ERROR_LOG" ]] && cp "$out" "$ERROR_LOG" || cat "$out" >&2; exit "$rc"; fi
if command -v jq >/dev/null 2>&1 && jq -e . >/dev/null 2>&1 <"$out" && [[ "$(jq -r '.success//true' "$out")" == "false" ]]; then
 [[ -n "$ERROR_LOG" ]] && jq -r '.output//.error//.message//.' "$out" >"$ERROR_LOG"; exit 1
fi
[[ -z "$ERROR_LOG" ]] || rm -f "$ERROR_LOG"
cat "$out"
