#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BRANCH="${GOVERNANCE_BRANCH:-main}"
MODE="${GOVERNANCE_MODE:-strict}"

if [[ -n "${GOVERNANCE_MOCK_FILE:-}" ]]; then
  export GOVERNANCE_BRANCH="$BRANCH"
  export GOVERNANCE_MODE="$MODE"
  exec node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { evaluateMainGovernance } from './scripts/ci/verify-main-ruleset.mjs';

const mockPath = process.env.GOVERNANCE_MOCK_FILE;
const branch = process.env.GOVERNANCE_BRANCH || 'main';
const mode = process.env.GOVERNANCE_MODE || 'strict';
const rulesets = JSON.parse(readFileSync(mockPath, 'utf8'));
const result = evaluateMainGovernance(rulesets, branch, mode);

if (!result.pass) {
  console.error('MAIN_GOVERNANCE=FAIL');
  console.error('GOVERNANCE_SOURCE=MOCK');
  for (const failure of result.failures) console.error(failure);
  process.exit(1);
}

console.log('MAIN_GOVERNANCE=PASS');
console.log('GOVERNANCE_SOURCE=MOCK');
console.log(`GOVERNANCE_MODE=${mode}`);
console.log(`GOVERNANCE_BRANCH=${branch}`);
console.log(`APPLICABLE_RULESET_IDS=${result.applicableRulesetIds.join(',')}`);
NODE
fi

: "${GH_TOKEN:=${GITHUB_TOKEN:-}}"
: "${GITHUB_REPOSITORY:=}"

if [[ -z "$GH_TOKEN" || -z "$GITHUB_REPOSITORY" ]]; then
  echo "GOVERNANCE_EVIDENCE_UNAVAILABLE: set GH_TOKEN and GITHUB_REPOSITORY for live verification, or GOVERNANCE_MOCK_FILE for contract-only verification." >&2
  exit 2
fi

export GOVERNANCE_BRANCH="$BRANCH"
export GOVERNANCE_MODE="$MODE"
exec node "$SCRIPT_DIR/verify-main-ruleset.mjs"
