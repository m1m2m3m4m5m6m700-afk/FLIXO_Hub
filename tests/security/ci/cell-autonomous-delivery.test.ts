import assert from "node:assert/strict";
import test from "node:test";
import {assertAutonomousStopReason,createAutonomousTaskDelivery,isAutonomousDeliveryComplete,mustContinueAutonomousDelivery,recordAutonomousFailure,recordAutonomousImplementation,recordAutonomousPublication,recordAutonomousVerification,reconcileAutonomousDelivery,recoverAutonomousDelivery,startAutonomousDelivery} from "../../../packages/contracts/src/cell-autonomous-delivery.ts";
const A="a".repeat(40),B="b".repeat(40),C="c".repeat(40);
const task=()=>createAutonomousTaskDelivery({taskId:"TASK-DELIVERY-1",agentId:"AGENT-01",sessionId:"SESSION-1",missionId:"MISSION-1",startSha:A,expectedOutput:"repository change",acceptanceDigest:"acceptance"});
test("human approval cannot stop execution",()=>{const r=task();assert.equal(r.humanApprovalRequired,false);for(const x of ["HUMAN_APPROVAL","OWNER_ACTION","WAITING_FOR_HUMAN","REVIEW_REQUIRED"] as const)assert.throws(()=>assertAutonomousStopReason(x),/HUMAN_APPROVAL_NOT_A_VALID_EXECUTION_BLOCKER/);assert.equal(mustContinueAutonomousDelivery(r),true)});
test("DONE requires implementation publication and exact SHA verification",()=>{let r=startAutonomousDelivery(task());r=recordAutonomousImplementation(r,B,["src/example.ts","tests/example.test.ts"]);r=recordAutonomousPublication(r,"execution",B);assert.throws(()=>recordAutonomousVerification(r,B,C,r.changedPaths,r.changedPaths),/EXACT_SHA/);r=recordAutonomousVerification(r,B,B,r.changedPaths,r.changedPaths);assert.equal(isAutonomousDeliveryComplete(r,B),true)});
test("HEAD drift preserves published work and requires verification again",()=>{let r=startAutonomousDelivery(task());r=recordAutonomousImplementation(r,B,["src/example.ts"]);r=recordAutonomousPublication(r,"execution",B);r=recordAutonomousVerification(r,B,B,r.changedPaths,r.changedPaths);r=reconcileAutonomousDelivery(r,C);assert.equal(r.state,"RECONCILING");assert.equal(r.publishedSha,B);assert.equal(r.verifiedSha,null);assert.equal(mustContinueAutonomousDelivery(r),true)});
test("agent/session loss recovers the same task",()=>{let r=startAutonomousDelivery(task());r=recordAutonomousImplementation(r,B,["src/example.ts"]);r=recoverAutonomousDelivery(r,"AGENT-02","SESSION-2",B);assert.equal(r.taskId,"TASK-DELIVERY-1");assert.equal(r.agentId,"AGENT-02");assert.equal(r.implemented,true)});
test("failures never silently discard implementation",()=>{let r=startAutonomousDelivery(task());r=recordAutonomousImplementation(r,B,["src/example.ts"]);r=recordAutonomousFailure(r,"EXTERNAL",true);assert.equal(r.state,"WORKING");r=recordAutonomousFailure(r,"SAFETY");assert.equal(r.state,"BLOCKED_SAFETY");assert.equal(mustContinueAutonomousDelivery(r),false)});

import { CellRuntime } from "../../../packages/contracts/src/cell-runtime.ts";
import { InMemoryAutonomousTaskDeliveryStore } from "../../../packages/contracts/src/cell-autonomous-delivery.ts";

test("CellRuntime persists autonomous task delivery", () => {
  const store=new InMemoryAutonomousTaskDeliveryStore();
  const rt=new CellRuntime(() => 1000,{autoStart:false,deliveryStore:store});
  rt.registerTask("TASK-RUNTIME-DELIVERY");
  rt.transitionTask("TASK-RUNTIME-DELIVERY","READY");
  rt.assignTask("TASK-RUNTIME-DELIVERY",{assignmentId:"A-RUNTIME",primaryAgentId:"AGENT-01",backupAgentId:"AGENT-02",verifierAgentId:null,escalationTargetAgentId:null,startingSha:A,currentSha:A},A);
  rt.transitionTask("TASK-RUNTIME-DELIVERY","CLAIMED");
  rt.transitionTask("TASK-RUNTIME-DELIVERY","RUNNING");
  rt.registerAutonomousTaskDelivery({taskId:"TASK-RUNTIME-DELIVERY",agentId:"AGENT-01",sessionId:"S1",missionId:"M1",startSha:A,expectedOutput:"implementation",acceptanceDigest:"accept"});
  rt.startTaskDelivery("TASK-RUNTIME-DELIVERY");
  rt.recordTaskImplementation("TASK-RUNTIME-DELIVERY",B,["src/example.ts"]);
  const restored=new CellRuntime(() => 1000,{autoStart:false,deliveryStore:store});
  assert.equal(restored.getTaskDelivery("TASK-RUNTIME-DELIVERY").implemented,true);
  assert.equal(restored.getTaskDelivery("TASK-RUNTIME-DELIVERY").candidateSha,B);
});
