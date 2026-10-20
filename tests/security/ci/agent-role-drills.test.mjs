import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENTS } from '../../../scripts/agent-learning/self-learning-control-plane.mjs';
import { evaluateAgentDrill, evaluateAllAgents } from '../../../scripts/agent-learning/run-role-drills.mjs';

const SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('every principal agent has a role-specific intensive drill', () => {
  const results=evaluateAllAgents(SHA);
  assert.equal(results.length, AGENTS.length);
  assert.equal(results.length, 10);
  for (const result of results) {
    assert.equal(result.validScore, 100, result.name);
    assert.equal(result.validPassed, true, result.name);
    assert.equal(result.positiveRepeatPasses, 5, result.name);
    assert.equal(result.deterministic, true, result.name);
    assert.equal(result.negativeRejected, true, result.name);
    assert.ok(result.negativeCases >= 7, result.name);
    assert.equal(result.passed, true, result.name);
  }
});

test('the QA role passes its complete positive drill', () => {
  const result=evaluateAgentDrill('FLIXO QA Agent', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(result.passed, true);
});

test('all drills remain behavioral-evidence unproven until real agent runs exist', () => {
  for (const result of evaluateAllAgents(SHA)) assert.equal(result.behavioralEvidence,'UNPROVEN',result.name);
});
test('role drills are bound to repository-derived facts rather than placeholder identities', async () => {
  const { ROLE_DRILLS } = await import('../../../scripts/agent-learning/run-role-drills.mjs');
  assert.equal(Object.keys(ROLE_DRILLS).length, 10);
  assert.equal(ROLE_DRILLS['المطور AI'].valid('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').referenceSha.length, 40);
  assert.match(ROLE_DRILLS['المطور AI'].valid('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').referenceSha, /^[0-9a-f]{40}$/i);
  assert.equal(typeof ROLE_DRILLS['FLIXO i18n Agent'].valid, 'function');
});
test('Scout drills require research-only schema and fail closed on authority escalation', async () => {
  const { ROLE_DRILLS } = await import('../../../scripts/agent-learning/run-role-drills.mjs');
  for (const name of ['FLIXO Architecture Scout', 'FLIXO Technology Scout', 'FLIXO Ecosystem Scout']) {
    const role = ROLE_DRILLS[name];
    const positive = role.valid('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    assert.equal(positive.status, 'central-report', name);
    assert.equal(positive.proposalSchema, 'v4', name);
    assert.equal(positive.executionClaim, false, name);
  }
});

test('AGENTS and ROLE_DRILLS stay one-to-one for all ten principal agents', async () => {
  const { ROLE_DRILLS } = await import('../../../scripts/agent-learning/run-role-drills.mjs');
  for (const agent of AGENTS) {
    assert.ok(ROLE_DRILLS[agent.name], agent.name);
    assert.equal(ROLE_DRILLS[agent.name].drill, agent.drill, agent.name);
  }
});
