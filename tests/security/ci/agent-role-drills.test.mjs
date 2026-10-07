import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENTS } from '../../../scripts/agent-learning/self-learning-control-plane.mjs';
import { evaluateAgentDrill, evaluateAllAgents } from '../../../scripts/agent-learning/run-role-drills.mjs';

const SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('every core trained agent has a role-specific drill', () => {
  const results=evaluateAllAgents(SHA);
  assert.equal(results.length, AGENTS.length);
  assert.equal(results.length, 8);
  for (const result of results) {
    assert.equal(result.validScore, 100, result.name);
    assert.equal(result.validPassed, true, result.name);
    assert.equal(result.negativeRejected, true, result.name);
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
  assert.equal(Object.keys(ROLE_DRILLS).length, 8);
  assert.equal(ROLE_DRILLS['المطور AI'].valid('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').referenceSha.length, 40);
  assert.match(ROLE_DRILLS['المطور AI'].valid('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').referenceSha, /^[0-9a-f]{40}$/i);
  assert.equal(typeof ROLE_DRILLS['FLIXO i18n Agent'].valid, 'function');
});