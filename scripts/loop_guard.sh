#!/usr/bin/env bash
set -euo pipefail
STATE_FILE="${STATE_FILE:-.agent_state.json}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-5}"
MAX_SAME_PATCH="${MAX_SAME_PATCH:-1}"
MAX_SAME_ERROR="${MAX_SAME_ERROR:-2}"
COOLDOWN_SECONDS="${COOLDOWN_SECONDS:-30}"
TASK_TTL_SECONDS="${TASK_TTL_SECONDS:-900}"
TASK_ID=""; PATCH_FILE=""; ERROR_LOG=""
die(){ echo "[loop-guard] $*" >&2; exit 46; }
while [[ $# -gt 0 ]]; do
 case "$1" in
  --task-id=*) TASK_ID="${1#*=}"; shift;;
  --patch-file=*) PATCH_FILE="${1#*=}"; shift;;
  --error-log=*) ERROR_LOG="${1#*=}"; shift;;
  --max-attempts=*) MAX_ATTEMPTS="${1#*=}"; shift;;
  --max-same-patch=*) MAX_SAME_PATCH="${1#*=}"; shift;;
  --max-same-error=*) MAX_SAME_ERROR="${1#*=}"; shift;;
  --cooldown-seconds=*) COOLDOWN_SECONDS="${1#*=}"; shift;;
  --ttl-seconds=*) TASK_TTL_SECONDS="${1#*=}"; shift;;
  --reset) rm -f "$STATE_FILE"; echo "[loop-guard] state reset: $STATE_FILE"; exit 0;;
  -h|--help) echo "Agent-Lab loop guard"; exit 0;;
  *) die "unknown option: $1";;
 esac
done
[[ -n "$TASK_ID" ]] || die "--task-id is required"
[[ -n "$PATCH_FILE" && -f "$PATCH_FILE" ]] || die "--patch-file must point to a file"
[[ "$MAX_ATTEMPTS" =~ ^[0-9]+$ && "$MAX_ATTEMPTS" -gt 0 ]] || die "invalid max attempts"
[[ "$MAX_SAME_PATCH" =~ ^[0-9]+$ ]] || die "invalid max same patch"
[[ "$MAX_SAME_ERROR" =~ ^[0-9]+$ ]] || die "invalid max same error"
[[ "$COOLDOWN_SECONDS" =~ ^[0-9]+$ ]] || die "invalid cooldown"
[[ "$TASK_TTL_SECONDS" =~ ^[0-9]+$ && "$TASK_TTL_SECONDS" -gt 0 ]] || die "invalid ttl"
command -v jq >/dev/null 2>&1 || die "jq is required; refusing to bypass loop protection"
[[ -z "$ERROR_LOG" || -f "$ERROR_LOG" ]] || die "error log not found: $ERROR_LOG"
mkdir -p "$(dirname "$STATE_FILE")"
[[ -f "$STATE_FILE" ]] || printf '{}\n' > "$STATE_FILE"
jq -e 'type=="object"' "$STATE_FILE" >/dev/null 2>&1 || die "invalid JSON state"
now="$(date +%s)"
patch_hash="$(sha256sum "$PATCH_FILE"|awk '{print $1}')"
error_hash="none"; [[ -n "$ERROR_LOG" ]] && error_hash="$(sha256sum "$ERROR_LOG"|awk '{print $1}')"
attempts="$(jq -r --arg t "$TASK_ID" '.[$t].attempts//0' "$STATE_FILE")"
started_at="$(jq -r --arg t "$TASK_ID" '.[$t].started_at//0' "$STATE_FILE")"
expires_at="$(jq -r --arg t "$TASK_ID" '.[$t].expires_at//0' "$STATE_FILE")"
last_attempt_at="$(jq -r --arg t "$TASK_ID" '.[$t].last_attempt_at//0' "$STATE_FILE")"
prev_patch="$(jq -r --arg t "$TASK_ID" --arg h "$patch_hash" '.[$t].patches[$h]//0' "$STATE_FILE")"
last_error_hash="$(jq -r --arg t "$TASK_ID" '.[$t].last_error_hash//"none"' "$STATE_FILE")"
same_error_streak="$(jq -r --arg t "$TASK_ID" '.[$t].same_error_streak//0' "$STATE_FILE")"
(( started_at>0 && expires_at>0 && now>=expires_at )) && { echo "[LOOP GUARD BLOCKED] TTL expired." >&2; exit 45; }
(( attempts>=MAX_ATTEMPTS )) && { echo "[LOOP GUARD BLOCKED] max attempts exceeded." >&2; exit 42; }
(( prev_patch>=MAX_SAME_PATCH )) && { echo "[LOOP GUARD BLOCKED] duplicate patch: ${patch_hash:0:12}." >&2; exit 43; }
if [[ "$error_hash" != "none" && "$last_error_hash" == "$error_hash" && "$same_error_streak" -ge "$MAX_SAME_ERROR" ]]; then
 echo "[LOOP GUARD BLOCKED] repeated identical error streak=$same_error_streak: ${error_hash:0:12}." >&2; exit 44
fi
(( last_attempt_at>0 && now<last_attempt_at+COOLDOWN_SECONDS )) && { echo "[LOOP GUARD BLOCKED] cooldown active." >&2; exit 45; }
if (( started_at==0 )); then started_at="$now"; expires_at=$((started_at+TASK_TTL_SECONDS)); fi
if [[ "$error_hash" == "none" ]]; then next_error_hash="none"; next_error_streak=0
elif [[ "$error_hash" == "$last_error_hash" ]]; then next_error_hash="$error_hash"; next_error_streak=$((same_error_streak+1))
else next_error_hash="$error_hash"; next_error_streak=1; fi
next_attempts=$((attempts+1)); updated="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
tmp_state="$(mktemp "${STATE_FILE}.tmp.XXXXXX")"; trap 'rm -f "$tmp_state"' EXIT
jq --arg t "$TASK_ID" --arg ph "$patch_hash" --arg eh "$next_error_hash" --arg u "$updated" \
 --argjson a "$next_attempts" --argjson s "$started_at" --argjson x "$expires_at" \
 --argjson l "$now" --argjson e "$next_error_streak" \
 '.[$t]=(.[$t]//{})|.[$t].attempts=$a|.[$t].started_at=$s|.[$t].expires_at=$x|.[$t].last_attempt_at=$l|.[$t].last_updated=$u|.[$t].last_error_hash=$eh|.[$t].same_error_streak=$e|.[$t].patches=(.[$t].patches//{})|.[$t].patches[$ph]=((.[$t].patches[$ph]//0)+1)' "$STATE_FILE" > "$tmp_state"
mv "$tmp_state" "$STATE_FILE"; trap - EXIT
echo "[loop-guard] ALLOW task='$TASK_ID' attempt=$next_attempts/$MAX_ATTEMPTS"
