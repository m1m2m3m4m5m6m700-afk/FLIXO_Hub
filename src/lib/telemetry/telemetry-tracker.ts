export type TelemetryEvent = 'ad_impression' | 'ad_clicked' | (string & {});

type TelemetryProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Hub privacy baseline: browser telemetry transport is disabled.
 *
 * The function remains a compatibility no-op for existing UI callers.
 * No Beacon, fetch, XHR, WebSocket or other network transport is created.
 */
export function trackUserMovement(
  _event: TelemetryEvent,
  _properties: TelemetryProperties = {},
  _endpoint?: string,
): void {
  return;
}
