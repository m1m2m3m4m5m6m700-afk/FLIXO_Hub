export const EXPERIENCE_LIFECYCLE = Object.freeze([
  'START',
  'MEMORY-PREFLIGHT',
  'OBSERVE',
  'ACT',
  'VERIFY',
  'LEARN-PROPOSE',
  'HANDOFF',
]);

const SHA_RE = /^[0-9a-f]{40}$/i;
const FORBIDDEN_KEYS = /^(?:chain[-_ ]?of[-_ ]?thought|scratchpad|private[-_ ]?reasoning|reasoning[-_ ]?trace|hidden[-_ ]?thoughts?)$/iu;

function assertSha(value, field) {
  if (!SHA_RE.test(String(value ?? ''))) throw new Error(field + ' must be an exact 40-character git SHA');
  return String(value).toLowerCase();
}

function scanForbiddenKeys(value, path = 'experience', seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, path + '[' + index + ']', seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error('experience contains forbidden private reasoning field: ' + path + '.' + key);
    scanForbiddenKeys(child, path + '.' + key, seen);
  }
}

export function validateExperienceLifecycle(events) {
  if (!Array.isArray(events) || events.length === 0) throw new Error('experience lifecycle events are required');
  const names = events.map(event => typeof event === 'string' ? event : event?.eventType);
  let cursor = -1;
  for (const name of names) {
    const index = EXPERIENCE_LIFECYCLE.indexOf(name);
    if (index < 0) throw new Error('unknown experience lifecycle event: ' + name);
    if (index < cursor) throw new Error('experience lifecycle is out of order');
    cursor = index;
  }
  if (names[0] !== 'START') throw new Error('experience lifecycle must start with START');
  if (names[names.length - 1] !== 'HANDOFF') throw new Error('experience lifecycle must end with HANDOFF');
  for (const required of EXPERIENCE_LIFECYCLE) if (!names.includes(required)) throw new Error('experience lifecycle missing: ' + required);
  return true;
}

export function buildExperienceObject({
  experienceId, agentId, taskId = 'UNBOUND', testedSha, objective, actionSummary, result,
  evidence = [], failure = null, rca = null, lesson = null, counterexample = null,
  nextAction = null, lifecycle = EXPERIENCE_LIFECYCLE, metadata = {},
} = {}) {
  const exactSha = assertSha(testedSha, 'testedSha');
  if (typeof experienceId !== 'string' || !experienceId.trim()) throw new Error('experienceId is required');
  if (typeof agentId !== 'string' || !agentId.trim()) throw new Error('agentId is required');
  if (typeof taskId !== 'string' || !taskId.trim()) throw new Error('taskId is required');
  if (typeof objective !== 'string' || !objective.trim()) throw new Error('objective is required');
  if (typeof actionSummary !== 'string' || !actionSummary.trim()) throw new Error('actionSummary is required');
  if (typeof result !== 'string' || !result.trim()) throw new Error('result is required');
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error('experience evidence is required');
  validateExperienceLifecycle(lifecycle);
  const object = {
    experience_id: experienceId, agent_id: agentId, task_id: taskId, tested_sha: exactSha,
    objective: objective.trim(), action_summary: actionSummary.trim(), result: result.trim(),
    evidence: [...evidence], failure, RCA: rca, lesson, counterexample, next_action: nextAction,
    lifecycle: [...lifecycle], metadata: { ...metadata }, status: 'CANDIDATE',
  };
  scanForbiddenKeys(object);
  return object;
}

export function validateExperience(experience) {
  if (!experience || typeof experience !== 'object') throw new Error('experience object required');
  const required = ['experience_id','agent_id','task_id','tested_sha','objective','action_summary','result','evidence','failure','RCA','lesson','counterexample','next_action','lifecycle'];
  for (const key of required) if (!(key in experience)) throw new Error('experience field missing: ' + key);
  assertSha(experience.tested_sha, 'experience.tested_sha');
  if (!Array.isArray(experience.evidence) || experience.evidence.length === 0) throw new Error('experience.evidence is required');
  validateExperienceLifecycle(experience.lifecycle);
  scanForbiddenKeys(experience);
  return true;
}
