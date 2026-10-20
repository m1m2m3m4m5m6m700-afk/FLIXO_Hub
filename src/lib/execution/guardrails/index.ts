/**
 * Private execution safety guards used by canonical-executor.ts only.
 * This barrel does not dispatch tools, own a registry, execute tools, or certify/promote artifacts.
 * Tool and capability truth remains in the canonical config registries.
 * Keep legacy CELL lifecycle/delegation helpers out of this surface.
 */
export { admitExecution } from "./hard-control.ts";
export { getCellPolicyFingerprint } from "./fingerprint.ts";
export { recordCellEvent } from "./audit.ts";
export { startCellWatchdog } from "./watchdog.ts";
export { bindExecutionEvidence, assertExecutionEvidence } from "./evidence.ts";
