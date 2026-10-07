export type CellWatchdog = Readonly<{
  signal: AbortSignal;
  stop(): void;
  timedOut(): boolean;
}>;

export function startCellWatchdog(timeoutMs: number, parentSignal?: AbortSignal): CellWatchdog {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error("CELL watchdog timeout must be a positive finite number.");
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.floor(timeoutMs));

  return Object.freeze({
    signal: controller.signal,
    stop() {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onParentAbort);
      controller.abort();
    },
    timedOut: () => timedOut,
  });
}
