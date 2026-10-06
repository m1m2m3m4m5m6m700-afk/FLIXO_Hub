#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const LEDGER = 'المهام.md';
const ACTIVE_MARKER = '# ACTIVE DISPATCH QUEUE';
const ACTIVE_END_MARKER = '# END ACTIVE DISPATCH QUEUE';

export const REQUIRED_FIELDS = Object.freeze([
  'TASK_ID', 'TYPE', 'PRIORITY', 'OWNER', 'STATUS', 'PR', 'SCOPE',
  'DEPENDS_ON', 'SOURCE', 'EVIDENCE', 'ACCEPTANCE', 'NEXT_ACTION', 'COLLISION_KEY',
]);

export const ALLOWED = Object.freeze({
  TYPE: new Set(['IMPLEMENT', 'VERIFY', 'INTEGRATE', 'GOVERNANCE', 'RELEASE', 'AUDIT']),
  PRIORITY: new Set(['P0', 'P1', 'P2', 'P3']),
  STATUS: new Set(['QUEUED', 'IN_PROGRESS', 'BLOCKED', 'OWNER_ACTION', 'VERIFYING']),
});

const TASK_HEADING = /^### (EXEC-[A-Z0-9-]+)\s*(?:—.*)?$/gmu;

function activeSection(source) {
  const start = source.indexOf(ACTIVE_MARKER);
  if (start < 0) throw new Error('LEDGER_ACTIVE_QUEUE_MISSING');
  const end = source.indexOf(ACTIVE_END_MARKER, start);
  if (end < 0) throw new Error('LEDGER_ACTIVE_QUEUE_END_MISSING');
  return source.slice(start + ACTIVE_MARKER.length, end);
}

function closedTaskIds(source) {
  const start = source.indexOf('## CLOSED TASK REGISTER');
  if (start < 0) return new Set();
  const end = source.indexOf('# ACTIVE DISPATCH QUEUE', start + 1);
  const section = end < 0 ? source.slice(start) : source.slice(start, end);
  return new Set([...section.matchAll(/\b(EXEC-[A-Z0-9-]+)\b/gu)].map((m) => m[1]));
}

export function parseActiveTasks(source) {
  const section = activeSection(source);
  const matches = [...section.matchAll(TASK_HEADING)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : section.length;
    const block = section.slice(start, end);
    const fields = new Map();
    for (const field of REQUIRED_FIELDS) {
      const found = block.match(new RegExp('^- \\*\\*' + field + ':\\*\\*\\s*(.*)$', 'mu'));
      fields.set(field, found?.[1]?.trim() ?? '');
    }
    return { id: match[1], block, fields };
  });
}

const dependencyIds = (value) => value === 'none' ? [] : value.split(',').map((item) => item.trim()).filter(Boolean);

export function lintLedger(source) {
  const tasks = parseActiveTasks(source);
  const failures = [];
  const ids = new Set(tasks.map((task) => task.id));
  const closed = closedTaskIds(source);

  if (tasks.length === 0) failures.push('ACTIVE_QUEUE_EMPTY_OR_UNPARSEABLE');
  if (ids.size !== tasks.length) failures.push('DUPLICATE_TASK_ID');

  for (const task of tasks) {

    let previousPosition = -1;
    for (const field of REQUIRED_FIELDS) {
      const token = '- **' + field + ':**';
      const position = task.block.indexOf(token);
      if (position < 0) failures.push(task.id + ':MISSING_FIELD:' + field);
      else if (position < previousPosition) failures.push(task.id + ':FIELD_ORDER:' + field);
      else previousPosition = position;
    }

    if (task.fields.get('TASK_ID') !== task.id) failures.push(task.id + ':TASK_ID_MISMATCH');

    for (const field of ['TYPE', 'PRIORITY', 'STATUS']) {
      if (!ALLOWED[field].has(task.fields.get(field))) failures.push(task.id + ':INVALID_' + field + ':' + task.fields.get(field));
    }

    for (const field of REQUIRED_FIELDS) {
      if (!task.fields.get(field)) failures.push(task.id + ':EMPTY_FIELD:' + field);
    }

    const pr = task.fields.get('PR');
    if (!/^(?:none|n\/a|#[0-9]+|https?:\/\/\S+)$/u.test(pr)) failures.push(task.id + ':INVALID_PR:' + pr);
    if (task.fields.get('STATUS') === 'OWNER_ACTION' && pr !== 'n/a') failures.push(task.id + ':OWNER_ACTION_PR_MUST_BE_NA');

    for (const dependency of dependencyIds(task.fields.get('DEPENDS_ON'))) {
      if (!/^EXEC-[A-Z0-9-]+$/u.test(dependency)) failures.push(task.id + ':INVALID_DEPENDENCY_TOKEN:' + dependency);
      else if (!ids.has(dependency) && !closed.has(dependency)) failures.push(task.id + ':MISSING_DEPENDENCY:' + dependency);
    }

    if (/\b(?:VERIFIED|CERTIFIED)\b/iu.test(task.fields.get('STATUS'))) failures.push(task.id + ':TERMINAL_STATUS_FORBIDDEN');
    if (/\b(?:NOTE|COMMENT)\b/iu.test(task.block)) failures.push(task.id + ':NON_CONTRACT_METADATA_IN_CARD');
  }

  const declared = source.match(/\*\*ACTIVE TASK COUNT:\*\*\s*(\d+)/u);
  if (!declared) failures.push('ACTIVE_TASK_COUNT_MISSING');
  else if (Number(declared[1]) !== tasks.length) failures.push('ACTIVE_TASK_COUNT_MISMATCH:declared=' + declared[1] + ':actual=' + tasks.length);

  const inProgress = tasks.filter((task) => task.fields.get('STATUS') === 'IN_PROGRESS');
  const collisions = new Map();
  for (const task of inProgress) {
    const key = task.fields.get('COLLISION_KEY');
    const prior = collisions.get(key);
    if (prior) failures.push('IN_PROGRESS_COLLISION:' + key + ':' + prior + ':' + task.id);
    else collisions.set(key, task.id);
  }

  const graph = new Map(tasks.map((task) => [task.id, dependencyIds(task.fields.get('DEPENDS_ON')).filter((id) => ids.has(id))]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { failures.push('DEPENDENCY_CYCLE:' + id); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of graph.get(id) ?? []) visit(dep);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id);

  return { pass: failures.length === 0, failures, taskCount: tasks.length, inProgressCount: inProgress.length };
}

function main() {
  const result = lintLedger(readFileSync(LEDGER, 'utf8'));
  if (!result.pass) {
    console.error('LEDGER_LINT=FAIL');
    for (const failure of result.failures) console.error(failure);
    process.exit(1);
  }
  console.log('LEDGER_LINT=PASS');
  console.log('ACTIVE_TASKS=' + result.taskCount);
  console.log('IN_PROGRESS=' + result.inProgressCount);
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/'))) main();
