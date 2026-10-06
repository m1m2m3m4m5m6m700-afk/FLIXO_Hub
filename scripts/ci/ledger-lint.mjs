#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const LEDGER = 'المهام.md';
const ACTIVE_MARKER = '# ACTIVE DISPATCH QUEUE';

export const REQUIRED_FIELDS = [
  'TYPE',
  'PRIORITY',
  'OWNER',
  'STATUS',
  'SCOPE',
  'DEPENDS_ON',
  'SOURCE',
  'ACCEPTANCE',
  'EVIDENCE',
  'NEXT_ACTION',
  'COLLISION_KEY',
];

export const ALLOWED = Object.freeze({
  TYPE: new Set(['IMPLEMENT', 'VERIFY', 'INTEGRATE', 'GOVERNANCE', 'RELEASE', 'AUDIT', 'REPAIR']),
  PRIORITY: new Set(['P0', 'P1', 'P2', 'P3']),
  STATUS: new Set(['QUEUED', 'IN_PROGRESS', 'BLOCKED', 'OWNER_ACTION', 'VERIFYING']),
});

function activeSection(source) {
  const start = source.indexOf(ACTIVE_MARKER);
  if (start < 0) throw new Error('LEDGER_ACTIVE_QUEUE_MISSING');
  const rest = source.slice(start + ACTIVE_MARKER.length);
  const next = rest.search(/^# (?!#)/mu);
  return next >= 0 ? rest.slice(0, next) : rest;
}

export function parseActiveTasks(source) {
  const section = activeSection(source);
  const matches = [...section.matchAll(/^#### (EXEC-[A-Z0-9-]+)\s*(?:—.*)?$/gmu)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : section.length;
    const block = section.slice(start, end);
    const fields = new Map();
    for (const field of REQUIRED_FIELDS) {
      const re = new RegExp('^- \\*\\*' + field + ':\\*\\*\\s*(.*)$', 'mu');
      const found = block.match(re);
      fields.set(field, found?.[1]?.trim() ?? '');
    }
    return { id: match[1], block, fields };
  });
}

export function lintLedger(source) {
  const tasks = parseActiveTasks(source);
  const failures = [];
  const ids = new Set();

  if (tasks.length === 0) failures.push('ACTIVE_QUEUE_EMPTY_OR_UNPARSEABLE');

  for (const task of tasks) {
    if (ids.has(task.id)) failures.push('DUPLICATE_TASK_ID:' + task.id);
    ids.add(task.id);

    const positions = [];
    let searchFrom = 0;
    for (const field of REQUIRED_FIELDS) {
      const token = '- **' + field + ':**';
      const position = task.block.indexOf(token, searchFrom);
      if (position < 0) {
        failures.push(task.id + ':MISSING_FIELD:' + field);
      } else {
        positions.push({ field, position });
        searchFrom = position + token.length;
      }
    }
    for (let i = 1; i < positions.length; i += 1) {
      if (positions[i].position < positions[i - 1].position) {
        failures.push(task.id + ':FIELD_ORDER:' + REQUIRED_FIELDS[i - 1] + '>' + REQUIRED_FIELDS[i]);
        break;
      }
    }

    for (const field of ['TYPE', 'PRIORITY', 'STATUS']) {
      const value = task.fields.get(field);
      if (!ALLOWED[field].has(value)) failures.push(task.id + ':INVALID_' + field + ':' + value);
    }

    for (const field of REQUIRED_FIELDS) {
      if (!task.fields.get(field)) failures.push(task.id + ':EMPTY_FIELD:' + field);
    }
  }

  const inProgress = tasks.filter((task) => task.fields.get('STATUS') === 'IN_PROGRESS');
  const collisionKeys = new Map();
  for (const task of inProgress) {
    const key = task.fields.get('COLLISION_KEY');
    const prior = collisionKeys.get(key);
    if (prior) failures.push('IN_PROGRESS_COLLISION:' + key + ':' + prior + ':' + task.id);
    else collisionKeys.set(key, task.id);
  }

  const declaredCountMatch = source.match(/ACTIVE TASK COUNT\s*=\s*(\d+)/u);
  const declaredCount = declaredCountMatch ? Number(declaredCountMatch[1]) : null;
  if (declaredCount !== null && declaredCount !== tasks.length) {
    failures.push('ACTIVE_TASK_COUNT_MISMATCH:declared=' + declaredCount + ':actual=' + tasks.length);
  }

  return {
    pass: failures.length === 0,
    failures,
    taskCount: tasks.length,
    inProgressCount: inProgress.length,
  };
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

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\\\', '/'))) {
  main();
}
