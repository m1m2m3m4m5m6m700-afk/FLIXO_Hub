import type { CellAuditEvent } from "./types.ts";

const events: CellAuditEvent[] = [];

export function recordCellEvent(event: CellAuditEvent): void {
  events.push(Object.freeze({ ...event }));
}

export function getCellAuditSnapshot(): readonly CellAuditEvent[] {
  return Object.freeze(events.slice());
}

export function clearCellAuditForTests(): void {
  events.length = 0;
}
