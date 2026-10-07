#!/usr/bin/env node
import {
  assertMvpTruthSet,computePolicyKernelHash,verifyPolicyKernelIntegrity,
  CANDIDATE_INTERFACE_DIGEST,CANDIDATE_INTERFACE_VERSION,MVP_TRUTH_CONTRACT_VERSION,
  POLICY_KERNEL_HASH,POLICY_KERNEL_VERSION,
} from "../packages/contracts/src/truth-contracts.ts";
import { MVP_EXECUTABLE_TOOL_IDS } from "../src/config/manual-capability-definition.ts";

const SHA=/^[0-9a-f]{40}$/iu;
const exactSha=process.env.FLIXO_EXACT_SHA || process.argv[2] || "";
if(!SHA.test(exactSha)){console.error("MVP_TRUTH_EXACT_SHA_REQUIRED");process.exit(2);}

const records=MVP_EXECUTABLE_TOOL_IDS.map((capabilityId)=>({
  capabilityId,registryMembership:"CANONICAL_REGISTRY",executableState:"EXECUTABLE",readyState:"READY",
  executionMode:"LOCAL",networkPolicy:"DENY",executorIdentity:`TOOL_REGISTRY:${capabilityId}`,
  parameterSchemaIdentity:`MANUAL_CAPABILITY_DEFINITION:${capabilityId}`,
  safetyLimitsIdentity:`MANUAL_CAPABILITY_DEFINITION:${capabilityId}:SAFETY_LIMITS`,
  recoveryPolicyIdentity:`MANUAL_CAPABILITY_DEFINITION:${capabilityId}:RECOVERY`,
  outputContractIdentity:`TOOL_OUTPUT_CONTRACTS:${capabilityId}`,
  verifierIdentity:`MANUAL_CAPABILITY_DEFINITION:${capabilityId}:VERIFIER`,
  manualRoute:`/en/${capabilityId}`,agentGuidedIntent:`canonical-intent:${capabilityId}`,
  acceptanceCriteria:[`registry-ready:${capabilityId}`,`verifier-bound:${capabilityId}`,`exact-sha:${exactSha}`],
  exactShaIdentity:exactSha,
}));
assertMvpTruthSet(records,MVP_EXECUTABLE_TOOL_IDS,exactSha);
const computed=await computePolicyKernelHash();
if(!await verifyPolicyKernelIntegrity() || computed!==POLICY_KERNEL_HASH) throw new Error("POLICY_KERNEL_HASH_MISMATCH");
console.log(JSON.stringify({status:"PASS",truthContractVersion:MVP_TRUTH_CONTRACT_VERSION,policyVersion:POLICY_KERNEL_VERSION,policyHash:POLICY_KERNEL_HASH,interfaceVersion:CANDIDATE_INTERFACE_VERSION,interfaceDigest:CANDIDATE_INTERFACE_DIGEST,mvpCount:records.length,exactSha,sourceOfTruth:"src/config/manual-capability-definition.ts"},null,2));
