import test from "node:test";
import assert from "node:assert/strict";
import { computeAuthorityContextHash, canonicalizeTaskContext } from "../../packages/contracts/src/call-context.ts";
import { decidePlanDisposition } from "../../packages/contracts/src/call-policy-kernel.ts";
import { budgetExhausted, terminateMission, type MissionControlRecord } from "../../packages/contracts/src/call-mission-control.ts";
import { classifyObjectiveComparison } from "../../packages/contracts/src/call-objective-registry.ts";
import { validateCandidateBundle } from "../../packages/contracts/src/call-candidate-bundle.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("canonical context is order-stable", () => {
  const a = canonicalizeTaskContext({missionId:"m",taskId:"t",objective:"x",acceptanceCriteria:["a"],constraints:["c"],oppositionPlanHash:"h",startingSha:SHA});
  const b = canonicalizeTaskContext({startingSha:SHA,oppositionPlanHash:"h",constraints:["c"],acceptanceCriteria:["a"],objective:"x",taskId:"t",missionId:"m"});
  assert.equal(a,b);
});
test("authority context hash is deterministic", async () => {
  const ctx={missionId:"m",taskId:"t",objective:"x",acceptanceCriteria:["a"],constraints:["c"],oppositionPlanHash:"h",startingSha:SHA} as const;
  assert.equal(await computeAuthorityContextHash(ctx), await computeAuthorityContextHash(ctx));
});
test("policy fails closed on integrity", () => {
  const d=decidePlanDisposition({policyVersion:"1",planRound:0,maxPlanRounds:3,retryCount:0,maxRetries:3,budgetRemaining:true,acceptanceCriteriaComplete:true,oppositionPlanComplete:true,exactShaValid:false,independenceValid:true,objections:[]});
  assert.equal(d.disposition,"ESCALATE");
});
test("evidence gap requests evidence", () => {
  const d=decidePlanDisposition({policyVersion:"1",planRound:0,maxPlanRounds:3,retryCount:0,maxRetries:3,budgetRemaining:true,acceptanceCriteriaComplete:true,oppositionPlanComplete:true,exactShaValid:true,independenceValid:true,objections:[{type:"EVIDENCE_GAP",fatal:true,evidenceRefs:["e"]}]});
  assert.equal(d.disposition,"ADD_EVIDENCE");
});
test("zero optional budget is not automatically exhaustion", () => {
  const base:MissionControlRecord={missionId:"m",objectiveId:"o",owner:"x",priority:1,riskClass:"low",acceptedAtMs:1,deadlineAtMs:2,budget:{wallclockMs:100,agentRuns:1,retries:1,externalCalls:0},spent:{wallclockMs:1,agentRuns:0,retries:0,externalCalls:0},planVersion:"1",assignmentVersion:"1",currentStage:"MISSION",currentSha:SHA,acceptanceCriteria:["a"],terminationState:"ACTIVE",escalationState:"NONE",evidenceIndex:[],artifactIndex:[],decisionLog:[]};
  assert.equal(budgetExhausted(base),false);
});
test("completed mission cannot ignore pending escalation", () => {
  const base:MissionControlRecord={missionId:"m",objectiveId:"o",owner:"x",priority:1,riskClass:"low",acceptedAtMs:1,deadlineAtMs:2,budget:{wallclockMs:100,agentRuns:1,retries:1,externalCalls:1},spent:{wallclockMs:1,agentRuns:0,retries:0,externalCalls:0},planVersion:"1",assignmentVersion:"1",currentStage:"MISSION",currentSha:SHA,acceptanceCriteria:["a"],terminationState:"ACTIVE",escalationState:"PENDING",evidenceIndex:[],artifactIndex:[],decisionLog:[]};
  assert.throws(()=>terminateMission(base,"COMPLETED"),/ESCALATED_MISSION_CANNOT_COMPLETE/);
});
test("objective similarity uses heuristic only", () => {
  assert.equal(classifyObjectiveComparison(0.85,false,false),"RELATED");
  assert.equal(classifyObjectiveComparison(0.84,false,false),"INDEPENDENT");
});
test("candidate bundle requires a changed exact SHA", () => {
  assert.throws(()=>validateCandidateBundle({version:"1",candidateId:"c",taskId:"t",missionId:"m",sourceSha:SHA,candidateSha:SHA,patchRef:"p",evidenceRef:"e",redTeamReportRef:"r",verifierReportRef:"v",dispositionRef:"d"}),/CANDIDATE_BUNDLE_NO_CHANGE/);
});
