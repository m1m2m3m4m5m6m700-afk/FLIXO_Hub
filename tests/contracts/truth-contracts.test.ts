import assert from "node:assert/strict";
import test from "node:test";
import {
  POLICY_KERNEL_VERSION,POLICY_KERNEL_HASH,CANDIDATE_INTERFACE_VERSION,CANDIDATE_INTERFACE_DIGEST,
  CANDIDATE_INTERFACE_SPEC,authorizePolicyAction,computePolicyKernelHash,validateMissionAdmission,
  validateCandidateAdmission,validateEvidenceProvenance,classifyEvidence,computeEvidenceDigest,
  proveGateATwoSha,invalidateAfterCandidateShaChange,assertMvpTruthSet,
} from "../../packages/contracts/src/truth-contracts.ts";

const A="0123456789abcdef0123456789abcdef01234567";
const B="fedcba9876543210fedcba9876543210fedcba98";
const BASE="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const D="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function evidence(candidateSha:string,status:"CURRENT"|"HISTORICAL"|"INVALIDATED"="CURRENT"){
  return {
    evidenceId:"ev-"+candidateSha.slice(0,8),taskId:"EXEC-TRUTH-001",candidateId:"candidate-001",
    capabilityId:"background-remover",baseSha:BASE,candidateSha,testedSha:candidateSha,
    workflowRunId:"37676935064",workflowName:"CELL Agent Fleet",toolchain:"Node 22.x / npm",
    lockfileDigest:D,configurationDigest:D,generatedArtifactIdentity:D,
    policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,
    interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST,
    capabilityContractIdentity:D,status,
  } as const;
}

function truth(exactSha:string){
  return {
    capabilityId:"background-remover",registryMembership:"CANONICAL_REGISTRY" as const,executableState:"EXECUTABLE" as const,
    readyState:"READY" as const,executionMode:"LOCAL" as const,networkPolicy:"DENY" as const,
    executorIdentity:"TOOL_REGISTRY:background-remover",parameterSchemaIdentity:"MANUAL_CAPABILITY_DEFINITION:background-remover",
    safetyLimitsIdentity:"MANUAL_CAPABILITY_DEFINITION:background-remover:SAFETY_LIMITS",
    recoveryPolicyIdentity:"MANUAL_CAPABILITY_DEFINITION:background-remover:RECOVERY",
    outputContractIdentity:"TOOL_OUTPUT_CONTRACTS:background-remover",verifierIdentity:"MANUAL_CAPABILITY_DEFINITION:background-remover:VERIFIER",
    manualRoute:"/en/background-remover",agentGuidedIntent:"canonical-intent:background-remover",
    acceptanceCriteria:["registry-ready","verifier-bound","exact-sha"],exactShaIdentity:exactSha,
  } as const;
}

test("Policy Kernel is immutable and authority is fail-closed",async()=>{
  assert.equal(await computePolicyKernelHash(),POLICY_KERNEL_HASH);
  assert.equal(authorizePolicyAction("AGENT","MUTATE"),false);
  assert.equal(authorizePolicyAction("AGENT","NEGOTIATE"),false);
  assert.equal(authorizePolicyAction("CALL_MASTER","OVERRIDE"),false);
  assert.equal(authorizePolicyAction("HUMAN_AUTHORITY","VERSION_UPDATE"),true);
  assert.equal(Object.isFrozen(CANDIDATE_INTERFACE_SPEC),true);
});

test("Mission admission binds policy and interface",()=>{
  validateMissionAdmission({missionId:"mission-001",taskId:"EXEC-TRUTH-001",objectiveId:"objective-001",policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST});
  assert.throws(()=>validateMissionAdmission({missionId:"mission-001",taskId:"EXEC-TRUTH-001",objectiveId:"objective-001",policyVersion:"9.9.9",policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST}),/MISSION_ADMISSION_POLICY_BINDING_INVALID/);
});

test("Candidate Admission binds SHA, policy, interface, capability and execution",()=>{
  const valid={candidateId:"candidate-001",taskId:"EXEC-TRUTH-001",missionId:"mission-001",candidateSha:A,baseSha:BASE,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST,policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,capabilityId:"background-remover",capabilityContractIdentity:D,handoffTarget:"execution" as const};
  assert.equal(validateCandidateAdmission(valid).admitted,true);
  assert.equal(validateCandidateAdmission({...valid,candidateSha:BASE}).admitted,false);
  assert.equal(validateCandidateAdmission({...valid,policyHash:"0".repeat(64)}).admitted,false);
  assert.equal(validateCandidateAdmission({...valid,interfaceDigest:"0".repeat(64)}).admitted,false);
  assert.equal(validateCandidateAdmission({...valid,handoffTarget:"main" as "execution"}).admitted,false);
  assert.equal(validateCandidateAdmission({...valid,extra:"x"} as typeof valid).admitted,false);
});

test("Evidence provenance marks SHA drift historical and invalidated records ineligible",async()=>{
  const a=evidence(A),b=evidence(B);
  validateEvidenceProvenance(a);
  assert.equal(classifyEvidence(a,{candidateSha:A,baseSha:BASE,capabilityId:"background-remover",capabilityContractIdentity:D,policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST}),"CURRENT");
  assert.equal(classifyEvidence(a,{candidateSha:B,baseSha:BASE,capabilityId:"background-remover",capabilityContractIdentity:D,policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST}),"HISTORICAL");
  assert.equal(classifyEvidence({...b,status:"INVALIDATED"},{candidateSha:B,baseSha:BASE,capabilityId:"background-remover",capabilityContractIdentity:D,policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST}),"INVALIDATED");
  assert.notEqual(await computeEvidenceDigest(a),await computeEvidenceDigest(b));
});

test("Gate A requires two different candidate SHAs and distinct evidence identities",async()=>{
  const result=await proveGateATwoSha(evidence(A),evidence(B),{baseSha:BASE,capabilityId:"background-remover",capabilityContractIdentity:D,policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST});
  assert.equal(result.passed,true);
  assert.notEqual(result.firstEvidenceDigest,result.secondEvidenceDigest);
  await assert.rejects(()=>proveGateATwoSha(evidence(A),evidence(A),{baseSha:BASE,capabilityId:"background-remover",capabilityContractIdentity:D,policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST}),/GATE_A_REQUIRES_DISTINCT_SHAS/);
});

test("Candidate SHA change forces regeneration and downstream reruns",()=>{
  const result=invalidateAfterCandidateShaChange(A,B,["ev-a","ev-b"]);
  assert.equal(result.status,"REQUALIFICATION_REQUIRED");
  assert.deepEqual(result.requiredActions,["candidate-regeneration","candidate-admission-rerun","red-team-rerun","independent-verification-rerun","certification-rerun","promotion-rerun"]);
});

test("MVP Truth enforces exact-SHA identity and bounded capability set",()=>{
  assertMvpTruthSet([truth(A)],["background-remover"],A);
  assert.throws(()=>assertMvpTruthSet([truth(B)],["background-remover"],A),/MVP_TRUTH_SHA_MISMATCH/);
  assert.throws(()=>assertMvpTruthSet([truth(A),truth(A)],["background-remover","background-remover"],A),/MVP_TRUTH_DUPLICATE_CAPABILITY/);
});
