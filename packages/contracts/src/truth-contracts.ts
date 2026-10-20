const SHA1 = /^[0-9a-f]{40}$/iu;
const SHA256 = /^[0-9a-f]{64}$/iu;

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map((key) => JSON.stringify(key) + ":" + canonical(record[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Reflect.ownKeys(value as object).forEach((key) => {
      const child = (value as Record<PropertyKey, unknown>)[key];
      if (child && typeof child === "object") deepFreeze(child);
    });
    Object.freeze(value);
  }
  return value;
}

export const POLICY_KERNEL_VERSION = "1.0.0" as const;

export const POLICY_KERNEL_RULES = deepFreeze({
  authorityChain: ["HUMAN_AUTHORITY", "CANONICAL_GOVERNANCE_POLICY", "POLICY_KERNEL", "CALL_MASTER", "AGENTS"],
  authority: {
    humanAuthority: "FINAL",
    canonicalGovernance: "POLICY_OWNER",
    policyKernel: "IMMUTABLE_ENFORCEMENT_POLICY",
    callMaster: "ROUTER_ONLY",
    agents: "NON_AUTHORITY",
  },
  prohibitions: [
    "AGENT_POLICY_MUTATION",
    "AGENT_POLICY_NEGOTIATION",
    "CALL_MASTER_POLICY_OVERRIDE",
    "DIRECT_MAIN_WRITE",
    "AGENT_CERTIFICATION",
    "AGENT_MERGE",
  ],
  admission: "POLICY_ADMISSION_REQUIRED",
  evidence: "EXACT_SHA_BOUND",
} as const);

export const POLICY_KERNEL_CANONICAL_JSON = canonical({
  version: POLICY_KERNEL_VERSION,
  policy: POLICY_KERNEL_RULES,
});

export const POLICY_KERNEL_HASH = "5f4aa5e440bdef725e012b5fa66bd26410e94c5f09a7d8f1ecadde79627e8344" as const;

export const POLICY_AUTHORITY_MODEL = deepFreeze({
  humanAuthority: "FINAL_POLICY_AUTHORITY",
  canonicalGovernance: "OWNS_POLICY_DEFINITION",
  policyKernel: "OWNS_POLICY_ENFORCEMENT",
  callMaster: "ROUTER_ONLY_NO_POLICY_AUTHORITY",
  agents: "NO_POLICY_AUTHORITY_NO_POLICY_NEGOTIATION",
} as const);

export type PolicyActor = "HUMAN_AUTHORITY" | "CALL_MASTER" | "AGENT";
export type PolicyOperation = "VERSION_UPDATE" | "MUTATE" | "NEGOTIATE" | "OVERRIDE";

export function authorizePolicyAction(actor: PolicyActor, operation: PolicyOperation): boolean {
  if (operation === "NEGOTIATE" || operation === "OVERRIDE") return false;
  return actor === "HUMAN_AUTHORITY" && operation === "VERSION_UPDATE";
}

export function assertPolicyActionAuthorized(actor: PolicyActor, operation: PolicyOperation): void {
  if (!authorizePolicyAction(actor, operation)) throw new Error("POLICY_AUTHORITY_DENIED");
}

export async function computeSha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("CRYPTO_HASH_UNAVAILABLE");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function computePolicyKernelHash(): Promise<string> {
  return computeSha256Hex(POLICY_KERNEL_CANONICAL_JSON);
}

export async function verifyPolicyKernelIntegrity(): Promise<boolean> {
  return (await computePolicyKernelHash()) === POLICY_KERNEL_HASH;
}

export const CANDIDATE_INTERFACE_VERSION = "1.0.0" as const;
export const CANDIDATE_INTERFACE_SPEC = deepFreeze({
  version: CANDIDATE_INTERFACE_VERSION,
  requiredFields: [
    "candidateId","taskId","missionId","candidateSha","baseSha","interfaceVersion","interfaceDigest",
    "policyVersion","policyHash","capabilityId","capabilityContractIdentity","handoffTarget",
  ],
  handoffTarget: "execution",
  admissionAuthority: "POLICY_KERNEL",
  callMasterAuthority: "ROUTER_ONLY",
  agentPolicyNegotiation: "DENY",
  extraFields: "REJECT",
  shaChange: "INVALIDATE_DOWNSTREAM_EVIDENCE_AND_RERUN_DEPENDENT_GATES",
} as const);
export const CANDIDATE_INTERFACE_CANONICAL_JSON = canonical(CANDIDATE_INTERFACE_SPEC);
export const CANDIDATE_INTERFACE_DIGEST = "44813533f7dd203efb82cfd626b2cde10f7679ab2075c98377121cc892c9ca6d" as const;

export type MissionAdmissionManifest = Readonly<{
  missionId: string; taskId: string; objectiveId: string;
  policyVersion: string; policyHash: string;
  interfaceVersion: string; interfaceDigest: string;
}>;

export function validateMissionAdmission(manifest: MissionAdmissionManifest): void {
  if (!manifest.missionId.trim() || !manifest.taskId.trim() || !manifest.objectiveId.trim()) {
    throw new Error("MISSION_ADMISSION_IDENTITY_REQUIRED");
  }
  if (manifest.policyVersion !== POLICY_KERNEL_VERSION || manifest.policyHash !== POLICY_KERNEL_HASH) {
    throw new Error("MISSION_ADMISSION_POLICY_BINDING_INVALID");
  }
  if (manifest.interfaceVersion !== CANDIDATE_INTERFACE_VERSION || manifest.interfaceDigest !== CANDIDATE_INTERFACE_DIGEST) {
    throw new Error("MISSION_ADMISSION_INTERFACE_BINDING_INVALID");
  }
}

export type CandidateAdmissionManifest = Readonly<{
  candidateId: string; taskId: string; missionId: string;
  candidateSha: string; baseSha: string;
  interfaceVersion: string; interfaceDigest: string;
  policyVersion: string; policyHash: string;
  capabilityId: string; capabilityContractIdentity: string;
  handoffTarget: "execution";
}>;

export type CandidateAdmissionResult = Readonly<{ admitted: boolean; errors: readonly string[] }>;

function exactKeys(value: object, required: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...required].sort());
}

export function validateCandidateAdmission(manifest: CandidateAdmissionManifest): CandidateAdmissionResult {
  const errors: string[] = [];
  if (!exactKeys(manifest, CANDIDATE_INTERFACE_SPEC.requiredFields)) errors.push("CANDIDATE_INTERFACE_FIELDS_MISMATCH");
  if (!manifest.candidateId?.trim() || !manifest.taskId?.trim() || !manifest.missionId?.trim() || !manifest.capabilityId?.trim()) {
    errors.push("CANDIDATE_IDENTITY_REQUIRED");
  }
  if (!SHA1.test(manifest.candidateSha) || !SHA1.test(manifest.baseSha)) errors.push("CANDIDATE_SHA_INVALID");
  if (manifest.candidateSha === manifest.baseSha) errors.push("CANDIDATE_SHA_MUST_DIFFER_FROM_BASE_SHA");
  if (manifest.interfaceVersion !== CANDIDATE_INTERFACE_VERSION) errors.push("CANDIDATE_INTERFACE_VERSION_MISMATCH");
  if (manifest.interfaceDigest !== CANDIDATE_INTERFACE_DIGEST) errors.push("CANDIDATE_INTERFACE_DIGEST_MISMATCH");
  if (manifest.policyVersion !== POLICY_KERNEL_VERSION) errors.push("CANDIDATE_POLICY_VERSION_MISMATCH");
  if (manifest.policyHash !== POLICY_KERNEL_HASH || !SHA256.test(manifest.policyHash)) errors.push("CANDIDATE_POLICY_HASH_MISMATCH");
  if (!SHA256.test(manifest.capabilityContractIdentity)) errors.push("CAPABILITY_CONTRACT_IDENTITY_INVALID");
  if (manifest.handoffTarget !== "execution") errors.push("CANDIDATE_HANDOFF_TARGET_FORBIDDEN");
  return Object.freeze({ admitted: errors.length === 0, errors: Object.freeze(errors) });
}

export function assertCandidateAdmission(manifest: CandidateAdmissionManifest): void {
  const result = validateCandidateAdmission(manifest);
  if (!result.admitted) throw new Error(result.errors[0] ?? "CANDIDATE_ADMISSION_DENIED");
}

export const DOWNSTREAM_GATES = Object.freeze([
  "candidate-admission","red-team","independent-verification","certification","promotion",
] as const);

export type CandidateShaInvalidation = Readonly<{
  status: "REQUALIFICATION_REQUIRED";
  previousCandidateSha: string;
  newCandidateSha: string;
  invalidatedEvidenceIds: readonly string[];
  requiredActions: readonly ("candidate-regeneration"|"candidate-admission-rerun"|"red-team-rerun"|"independent-verification-rerun"|"certification-rerun"|"promotion-rerun")[];
}>;

export function invalidateAfterCandidateShaChange(previousCandidateSha: string, newCandidateSha: string, evidenceIds: readonly string[] = []): CandidateShaInvalidation {
  if (!SHA1.test(previousCandidateSha) || !SHA1.test(newCandidateSha)) throw new Error("CANDIDATE_SHA_INVALID");
  if (previousCandidateSha === newCandidateSha) throw new Error("CANDIDATE_SHA_NOT_CHANGED");
  return Object.freeze({
    status: "REQUALIFICATION_REQUIRED",
    previousCandidateSha, newCandidateSha,
    invalidatedEvidenceIds: Object.freeze([...evidenceIds]),
    requiredActions: Object.freeze(["candidate-regeneration", ...DOWNSTREAM_GATES.map((gate) => ({
      "candidate-admission":"candidate-admission-rerun",
      "red-team":"red-team-rerun",
      "independent-verification":"independent-verification-rerun",
      "certification":"certification-rerun",
      "promotion":"promotion-rerun",
    } as const)[gate])] as CandidateShaInvalidation["requiredActions"]),
  });
}

export type EvidenceProvenanceRecord = Readonly<{
  evidenceId: string; taskId: string; candidateId: string; capabilityId: string;
  baseSha: string; candidateSha: string; testedSha: string;
  workflowRunId: string; workflowName: string; toolchain: string;
  lockfileDigest: string; configurationDigest: string; generatedArtifactIdentity: string;
  policyVersion: string; policyHash: string;
  interfaceVersion: string; interfaceDigest: string;
  capabilityContractIdentity: string;
  status: "CURRENT"|"HISTORICAL"|"INVALIDATED";
}>;

export type EvidenceFreshnessBinding = Readonly<{
  candidateSha: string; baseSha: string; capabilityId: string;
  capabilityContractIdentity: string; policyVersion: string; policyHash: string;
  interfaceVersion: string; interfaceDigest: string;
}>;

export function validateEvidenceProvenance(record: EvidenceProvenanceRecord): void {
  for (const [key,value] of Object.entries(record)) {
    if (typeof value === "string" && !value.trim()) throw new Error("EVIDENCE_PROVENANCE_FIELD_EMPTY:" + key);
  }
  if (!SHA1.test(record.baseSha) || !SHA1.test(record.candidateSha) || !SHA1.test(record.testedSha)) {
    throw new Error("EVIDENCE_PROVENANCE_SHA_INVALID");
  }
  if (record.candidateSha !== record.testedSha) throw new Error("EVIDENCE_TESTED_SHA_MISMATCH");
  if (!/^\d+$/.test(record.workflowRunId)) throw new Error("EVIDENCE_WORKFLOW_RUN_ID_INVALID");
  if (!SHA256.test(record.lockfileDigest) || !SHA256.test(record.configurationDigest) || !SHA256.test(record.generatedArtifactIdentity)) {
    throw new Error("EVIDENCE_ARTIFACT_OR_CONFIG_DIGEST_INVALID");
  }
  if (!SHA256.test(record.policyHash) || record.policyVersion !== POLICY_KERNEL_VERSION || record.policyHash !== POLICY_KERNEL_HASH) {
    throw new Error("EVIDENCE_POLICY_BINDING_INVALID");
  }
  if (record.interfaceVersion !== CANDIDATE_INTERFACE_VERSION || record.interfaceDigest !== CANDIDATE_INTERFACE_DIGEST) {
    throw new Error("EVIDENCE_INTERFACE_BINDING_INVALID");
  }
  if (!SHA256.test(record.capabilityContractIdentity)) throw new Error("EVIDENCE_CAPABILITY_CONTRACT_INVALID");
}

export function classifyEvidence(record: EvidenceProvenanceRecord, binding: EvidenceFreshnessBinding): "CURRENT"|"HISTORICAL"|"INVALIDATED" {
  validateEvidenceProvenance(record);
  if (
    record.status === "INVALIDATED" ||
    record.candidateSha !== binding.candidateSha ||
    record.baseSha !== binding.baseSha ||
    record.capabilityId !== binding.capabilityId ||
    record.capabilityContractIdentity !== binding.capabilityContractIdentity ||
    record.policyVersion !== binding.policyVersion ||
    record.policyHash !== binding.policyHash ||
    record.interfaceVersion !== binding.interfaceVersion ||
    record.interfaceDigest !== binding.interfaceDigest
  ) return record.candidateSha === binding.candidateSha ? "INVALIDATED" : "HISTORICAL";
  return "CURRENT";
}

export function assertFreshEvidence(record: EvidenceProvenanceRecord, binding: EvidenceFreshnessBinding): void {
  if (classifyEvidence(record,binding) !== "CURRENT" || record.status !== "CURRENT") throw new Error("STALE_OR_INVALID_EVIDENCE");
}

export async function computeEvidenceDigest(record: EvidenceProvenanceRecord): Promise<string> {
  validateEvidenceProvenance(record);
  return computeSha256Hex(canonical(record));
}

export type GateAResult = Readonly<{
  passed: boolean; firstCandidateSha: string; secondCandidateSha: string;
  firstEvidenceDigest: string; secondEvidenceDigest: string;
}>;

export async function proveGateATwoSha(
  first: EvidenceProvenanceRecord,
  second: EvidenceProvenanceRecord,
  binding: Omit<EvidenceFreshnessBinding,"candidateSha">,
): Promise<GateAResult> {
  validateEvidenceProvenance(first);
  validateEvidenceProvenance(second);
  if (first.candidateSha === second.candidateSha) throw new Error("GATE_A_REQUIRES_DISTINCT_SHAS");
  if (
    first.baseSha !== second.baseSha ||
    first.capabilityId !== binding.capabilityId || second.capabilityId !== binding.capabilityId ||
    first.capabilityContractIdentity !== binding.capabilityContractIdentity || second.capabilityContractIdentity !== binding.capabilityContractIdentity ||
    first.policyVersion !== binding.policyVersion || second.policyVersion !== binding.policyVersion ||
    first.policyHash !== binding.policyHash || second.policyHash !== binding.policyHash ||
    first.interfaceVersion !== binding.interfaceVersion || second.interfaceVersion !== binding.interfaceVersion ||
    first.interfaceDigest !== binding.interfaceDigest || second.interfaceDigest !== binding.interfaceDigest
  ) throw new Error("GATE_A_SHARED_CONTRACT_MISMATCH");
  const [firstEvidenceDigest,secondEvidenceDigest] = await Promise.all([computeEvidenceDigest(first),computeEvidenceDigest(second)]);
  if (firstEvidenceDigest === secondEvidenceDigest) throw new Error("GATE_A_EVIDENCE_IDENTITY_COLLISION");
  return Object.freeze({passed:true,firstCandidateSha:first.candidateSha,secondCandidateSha:second.candidateSha,firstEvidenceDigest,secondEvidenceDigest});
}

export const MVP_TRUTH_CONTRACT_VERSION = "1.0.0" as const;
export const MVP_TRUTH_FIELDS = Object.freeze([
  "registryMembership","executableState","readyState","executionMode","networkPolicy",
  "executorIdentity","parameterSchemaIdentity","safetyLimitsIdentity","recoveryPolicyIdentity",
  "outputContractIdentity","verifierIdentity","manualRoute","agentGuidedIntent","acceptanceCriteria","exactShaIdentity",
] as const);

export type MvpTruthRecord = Readonly<{
  capabilityId:string; registryMembership:"CANONICAL_REGISTRY"; executableState:"EXECUTABLE"; readyState:"READY";
  executionMode:"LOCAL"; networkPolicy:"DENY"; executorIdentity:string; parameterSchemaIdentity:string;
  safetyLimitsIdentity:string; recoveryPolicyIdentity:string; outputContractIdentity:string; verifierIdentity:string;
  manualRoute:string; agentGuidedIntent:string; acceptanceCriteria:readonly string[]; exactShaIdentity:string;
}>;

export function validateMvpTruthRecord(record:MvpTruthRecord, expectedSha?:string):void {
  if (!record.capabilityId.trim()) throw new Error("MVP_TRUTH_CAPABILITY_ID_REQUIRED");
  for (const [key,expected] of [
    ["registryMembership","CANONICAL_REGISTRY"],["executableState","EXECUTABLE"],["readyState","READY"],
    ["executionMode","LOCAL"],["networkPolicy","DENY"],
  ] as const) if (record[key] !== expected) throw new Error("MVP_TRUTH_" + key.toUpperCase() + "_INVALID");
  for (const key of ["executorIdentity","parameterSchemaIdentity","safetyLimitsIdentity","recoveryPolicyIdentity","outputContractIdentity","verifierIdentity","manualRoute","agentGuidedIntent"] as const) {
    if (!String(record[key]).trim()) throw new Error("MVP_TRUTH_FIELD_REQUIRED:" + key);
  }
  if (!record.acceptanceCriteria.length) throw new Error("MVP_TRUTH_ACCEPTANCE_REQUIRED");
  if (!SHA1.test(record.exactShaIdentity)) throw new Error("MVP_TRUTH_SHA_INVALID");
  if (expectedSha !== undefined && record.exactShaIdentity !== expectedSha) throw new Error("MVP_TRUTH_SHA_MISMATCH");
}

export function assertMvpTruthSet(records:readonly MvpTruthRecord[], expectedCapabilityIds:readonly string[], exactSha:string):void {
  if (!SHA1.test(exactSha)) throw new Error("MVP_TRUTH_SET_SHA_INVALID");
  const expected=[...expectedCapabilityIds].sort(), actual=records.map((r)=>r.capabilityId).sort();
  if (records.length !== expectedCapabilityIds.length || JSON.stringify(actual)!==JSON.stringify(expected)) throw new Error("MVP_TRUTH_CAPABILITY_SET_MISMATCH");
  const seen=new Set<string>();
  for (const record of records) {
    if (seen.has(record.capabilityId)) throw new Error("MVP_TRUTH_DUPLICATE_CAPABILITY");
    seen.add(record.capabilityId);
    validateMvpTruthRecord(record,exactSha);
  }
}
