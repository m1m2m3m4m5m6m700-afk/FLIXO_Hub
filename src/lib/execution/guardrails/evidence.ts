export type CellExecutionEvidence = Readonly<{
  schemaVersion: 1;
  requestId: string;
  taskId: string;
  capabilityId: string;
  policyFingerprint: string;
  inputSha256: string;
  outputSha256: string;
}>;

const SHA256 = /^[0-9a-f]{64}$/u;

async function sha256(blob: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function bindExecutionEvidence(
  identity: Readonly<{ requestId: string; taskId: string; capabilityId: string; policyFingerprint: string }>,
  input: Blob,
  output: Blob,
): Promise<CellExecutionEvidence> {
  if (!identity.requestId || !identity.taskId || !identity.capabilityId || !identity.policyFingerprint) {
    throw new Error("CELL evidence binding requires complete execution identity.");
  }
  const [inputSha256, outputSha256] = await Promise.all([sha256(input), sha256(output)]);
  return Object.freeze({
    schemaVersion: 1,
    ...identity,
    inputSha256,
    outputSha256,
  });
}

export function assertExecutionEvidence(evidence: CellExecutionEvidence): void {
  if (evidence.schemaVersion !== 1) throw new Error("CELL evidence schema is unsupported.");
  for (const value of [evidence.requestId, evidence.taskId, evidence.capabilityId, evidence.policyFingerprint]) {
    if (!value.trim()) throw new Error("CELL evidence contains an empty identity field.");
  }
  if (!SHA256.test(evidence.inputSha256) || !SHA256.test(evidence.outputSha256)) {
    throw new Error("CELL evidence contains an invalid SHA-256 digest.");
  }
}
