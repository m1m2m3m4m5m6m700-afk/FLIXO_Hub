export type CellLifecycle = "ADMITTED" | "RUNNING" | "VERIFYING" | "VERIFIED" | "FAILED" | "ABORTED";

const transitions: Readonly<Record<CellLifecycle, readonly CellLifecycle[]>> = {
  ADMITTED: ["RUNNING", "ABORTED", "FAILED"],
  RUNNING: ["VERIFYING", "ABORTED", "FAILED"],
  VERIFYING: ["VERIFIED", "ABORTED", "FAILED"],
  VERIFIED: [],
  FAILED: [],
  ABORTED: [],
};

export function canTransition(from: CellLifecycle, to: CellLifecycle): boolean {
  return transitions[from].includes(to);
}

export function transitionCell(from: CellLifecycle, to: CellLifecycle): CellLifecycle {
  if (!canTransition(from, to)) throw new Error(`CELL lifecycle transition denied: ${from} -> ${to}`);
  return to;
}
