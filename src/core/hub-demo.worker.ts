type DemoEnvelope = { kind: 'task'; taskId: string; payload: { buffer: ArrayBuffer } };
type DemoMessage =
  | { kind: 'progress'; taskId: string; progress: number }
  | { kind: 'result'; taskId: string; result: { byteLength: number; checksum: number } }
  | { kind: 'error'; taskId: string; error: string };

const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<DemoEnvelope>) => {
  const data = event.data;
  if (!data || data.kind !== 'task') return;
  const { taskId, payload } = data;

  try {
    const bytes = new Uint8Array(payload.buffer);
    let checksum = 0;
    const chunkSize = Math.max(1, Math.floor(bytes.length / 20));

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const end = Math.min(bytes.length, offset + chunkSize);
      for (let index = offset; index < end; index += 1) {
        checksum = (checksum + bytes[index]) % 65521;
      }
      ctx.postMessage({ kind: 'progress', taskId, progress: end / Math.max(1, bytes.length) } satisfies DemoMessage);
    }

    ctx.postMessage({
      kind: 'result',
      taskId,
      result: { byteLength: bytes.byteLength, checksum },
    } satisfies DemoMessage);
  } catch (error) {
    ctx.postMessage({
      kind: 'error',
      taskId,
      error: error instanceof Error ? error.message : 'Worker failed.',
    } satisfies DemoMessage);
  }
};
