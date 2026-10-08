export const CELL_CONTEXT_CONTRACT_VERSION = "1.0.0" as const;

export type CellContextInput = Readonly<{
  missionId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  startingSha: string;
  taskId: string;
}>;

export type CellContextArtifact = Readonly<{
  contractVersion: typeof CELL_CONTEXT_CONTRACT_VERSION;
  taskId: string;
  artifactPath: string;
  missionId: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  startingSha: string;
  hashAlgorithm: "SHA-256";
  canonicalHashInput: string;
  sharedContextHash: string;
  authorityOwned: true;
}>;

const SHA1 = /^[0-9a-f]{40}$/iu;
const SHA256 = /^[0-9a-f]{64}$/iu;

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + canonical(record[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

const SHA256_K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

const SHA256_INITIAL = new Uint32Array([
  0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

function sha256Hex(value: string): string {
  const input = new TextEncoder().encode(value);
  const bitLength = input.length * 8;
  const paddedLength = ((input.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const h = new Uint32Array(SHA256_INITIAL);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[i] = Math.imul(Math.imul(1, s0) + w[i - 16] + s1 + w[i - 7], 1) >>> 0;
    }

    let [a,b,c,d,e,f,g,hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return Array.from(h, (word) => word.toString(16).padStart(8, "0")).join("");
}

function required(value: string, code: string): void {
  if (typeof value !== "string" || value.trim() === "") throw new Error(code);
}

function requiredList(values: readonly string[], code: string): void {
  if (values.length === 0 || values.some((value) => typeof value !== "string" || value.trim() === "")) {
    throw new Error(code);
  }
}

export function createCellContextArtifact(input: CellContextInput): CellContextArtifact {
  required(input.taskId, "CELL_CONTEXT_TASK_REQUIRED");
  required(input.missionId, "CELL_CONTEXT_MISSION_REQUIRED");
  required(input.objective, "CELL_CONTEXT_OBJECTIVE_REQUIRED");
  requiredList(input.acceptanceCriteria, "CELL_CONTEXT_ACCEPTANCE_REQUIRED");
  if (!SHA1.test(input.startingSha)) throw new Error("CELL_CONTEXT_START_SHA_INVALID");

  const canonicalHashInput = canonical({
    missionId: input.missionId.trim(),
    objective: input.objective.trim(),
    acceptanceCriteria: [...input.acceptanceCriteria].map((value) => value.trim()),
    startingSha: input.startingSha,
  });
  const sharedContextHash = sha256Hex(canonicalHashInput);
  if (!SHA256.test(sharedContextHash)) throw new Error("CELL_CONTEXT_HASH_GENERATION_FAILED");

  return Object.freeze({
    contractVersion: CELL_CONTEXT_CONTRACT_VERSION,
    taskId: input.taskId.trim(),
    artifactPath: `.cell/context/${input.taskId.trim()}.json`,
    missionId: input.missionId.trim(),
    objective: input.objective.trim(),
    acceptanceCriteria: Object.freeze([...input.acceptanceCriteria].map((value) => value.trim())),
    startingSha: input.startingSha,
    hashAlgorithm: "SHA-256" as const,
    canonicalHashInput,
    sharedContextHash,
    authorityOwned: true as const,
  });
}

export function serializeCellContextArtifact(artifact: CellContextArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}
