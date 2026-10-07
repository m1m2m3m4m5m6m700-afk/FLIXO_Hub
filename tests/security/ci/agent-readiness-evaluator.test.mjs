import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { evaluateAllAgents } from '../../../scripts/agent-learning/evaluate-agent-readiness.mjs';

function currentSha(){ return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(); }

test('all core role-drill agents pass the 100/100 readiness evaluator', () => {
  const evaluation=evaluateAllAgents(currentSha());
  assert.equal(evaluation.results.length,8);
  assert.equal(evaluation.all100,true);
  for(const result of evaluation.results){
    assert.equal(result.score,100,result.name);
    assert.equal(result.passed,true,result.name);
    assert.equal(result.drill.validScore,100,result.name);
    assert.equal(result.drill.negativeRejected,true,result.name);
    assert.equal(result.behavioralEvidence,'UNPROVEN',result.name);
  }
});