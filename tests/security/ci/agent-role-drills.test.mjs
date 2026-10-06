import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENTS } from '../../../scripts/agent-learning/self-learning-control-plane.mjs';
import { evaluateAgentDrill, evaluateAllAgents } from '../../../scripts/agent-learning/run-role-drills.mjs';

const SHA='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('every official agent has a role-specific drill', () => {
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

test('stale SHA evidence is rejected before role scoring', () => {
  const result=evaluateAgentDrill('FLIXO QA Agent', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(result.passed, true);
});

test('all drills remain behavioral-evidence unproven until real agent runs exist', () => {
  for (const result of evaluateAllAgents(SHA)) assert.equal(result.behavioralEvidence,'UNPROVEN',result.name);
});