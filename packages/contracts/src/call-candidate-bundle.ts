export const CALL_CANDIDATE_BUNDLE_VERSION = "1.0.0" as const;

export type CandidateBundleManifest = Readonly<{
  version: string;
  candidateId: string;
  taskId: string;
  missionId: string;
  sourceSha: string;
  candidateSha: string;
  patchRef: string;
  evidenceRef: string;
  redTeamReportRef: string;
  verifierReportRef: string;
  dispositionRef: string;
}>;

export function validateCandidateBundle(manifest: CandidateBundleManifest): void {
  if (!manifest.version || !manifest.candidateId || !manifest.taskId || !manifest.missionId) {
    throw new Error("CANDIDATE_BUNDLE_SCHEMA_INVALID");
  }
  if (!/^[0-9a-f]{40}$/iu.test(manifest.sourceSha) || !/^[0-9a-f]{40}$/iu.test(manifest.candidateSha)) {
    throw new Error("CANDIDATE_BUNDLE_SHA_INVALID");
  }
  for (const ref of [
    manifest.patchRef,
    manifest.evidenceRef,
    manifest.redTeamReportRef,
    manifest.verifierReportRef,
    manifest.dispositionRef,
  ]) {
    if (!ref.trim()) throw new Error("CANDIDATE_BUNDLE_ARTIFACT_REF_REQUIRED");
  }
  if (manifest.sourceSha === manifest.candidateSha) throw new Error("CANDIDATE_BUNDLE_NO_CHANGE");
}
