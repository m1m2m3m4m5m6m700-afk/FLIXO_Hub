export type HubTaskProgress = Readonly<{ taskId: string; progress: number }>;

export type HubWorkerMessage<TResult> =
  | Readonly<{ kind: 'progress'; taskId: string; progress: number }>
  | Readonly<{ kind: 'result'; taskId: string; result: TResult }>
  | Readonly<{ kind: 'error'; taskId: string; error: string }>;

export type HubWorkerEnvelope<TPayload> = Readonly<{
  kind: 'task';
  taskId: string;
  payload: TPayload;
}>;

export type HubCancelableTask<TResult> = Readonly<{
  taskId: string;
  promise: Promise<TResult>;
  cancel: () => void;
}>;

type WorkerSlot = {
  worker: Worker;
  busy: boolean;
  taskId: string | null;
};

type PendingTask<TPayload, TResult> = {
  taskId: string;
  payload: TPayload;
  transferables: Transferable[];
  resolve: (value: TResult) => void;
  reject: (reason?: unknown) => void;
  onProgress?: (progress: HubTaskProgress) => void;
  signal?: AbortSignal;
};

export class HubWorkerPool {
  private readonly factory: () => Worker;
  private readonly slots: WorkerSlot[];
  private readonly queue: PendingTask<unknown, unknown>[] = [];
  private readonly active = new Map<string, PendingTask<unknown, unknown>>();
  private sequence = 0;

  constructor(factory: () => Worker, size = 1) {
    this.factory = factory;
    this.slots = Array.from({ length: Math.max(1, Math.floor(size)) }, () => ({
      worker: factory(),
      busy: false,
      taskId: null,
    }));
    this.slots.forEach((slot) => this.bind(slot));
  }

  submit<TPayload, TResult>(
    payload: TPayload,
    transferables: Transferable[] = [],
    options: { signal?: AbortSignal; onProgress?: (progress: HubTaskProgress) => void } = {},
  ): HubCancelableTask<TResult> {
    const taskId = 'hub-' + String(++this.sequence);
    let cancelTask: () => void = () => {};

    const promise = new Promise<TResult>((resolve, reject) => {
      const pending: PendingTask<TPayload, TResult> = {
        taskId,
        payload,
        transferables,
        resolve,
        reject,
        onProgress: options.onProgress,
        signal: options.signal,
      };
      this.queue.push(pending as PendingTask<unknown, unknown>);
      cancelTask = () => this.cancel(taskId);
      options.signal?.addEventListener('abort', cancelTask, { once: true });
      this.pump();
    });

    return { taskId, promise, cancel: cancelTask };
  }

  dispose(): void {
    this.queue.splice(0).forEach((task) => task.reject(new Error('Worker pool disposed.')));
    this.active.forEach((task) => task.reject(new Error('Worker pool disposed.')));
    this.active.clear();
    this.slots.forEach((slot) => {
      slot.worker.terminate();
      slot.busy = false;
      slot.taskId = null;
    });
  }

  private bind(slot: WorkerSlot): void {
    slot.worker.onmessage = (event: MessageEvent<HubWorkerMessage<unknown>>) => {
      const data = event.data;
      if (!data || typeof data.taskId !== 'string') return;
      if (data.kind === 'progress') {
        const task = this.active.get(data.taskId);
        task?.onProgress?.({
          taskId: data.taskId,
          progress: Math.min(1, Math.max(0, data.progress)),
        });
        return;
      }

      const task = this.active.get(data.taskId);
      if (!task) return;
      this.clearActive(slot, data.taskId);
      if (data.kind === 'result') task.resolve(data.result);
      else task.reject(new Error(data.error));
      this.pump();
    };

    slot.worker.onerror = (event) => {
      if (!slot.taskId) return;
      const task = this.active.get(slot.taskId);
      if (task) {
        this.clearActive(slot, slot.taskId);
        task.reject(event.error instanceof Error ? event.error : new Error('Worker execution failed.'));
      }
      slot.worker.terminate();
      slot.worker = this.factory();
      this.bind(slot);
      this.pump();
    };
  }

  private clearActive(slot: WorkerSlot, taskId: string): void {
    this.active.delete(taskId);
    slot.busy = false;
    slot.taskId = null;
  }

  private cancel(taskId: string): void {
    const queueIndex = this.queue.findIndex((task) => task.taskId === taskId);
    if (queueIndex >= 0) {
      const [task] = this.queue.splice(queueIndex, 1);
      task?.reject(new DOMException('Task cancelled.', 'AbortError'));
      return;
    }

    const slot = this.slots.find((candidate) => candidate.taskId === taskId);
    if (!slot) return;
    const task = this.active.get(taskId);
    task?.reject(new DOMException('Task cancelled.', 'AbortError'));
    this.active.delete(taskId);
    slot.worker.terminate();
    slot.worker = this.factory();
    slot.busy = false;
    slot.taskId = null;
    this.bind(slot);
    this.pump();
  }

  private pump(): void {
    for (const slot of this.slots) {
      if (slot.busy) continue;
      const task = this.queue.shift();
      if (!task) break;
      if (task.signal?.aborted) {
        task.reject(new DOMException('Task cancelled.', 'AbortError'));
        continue;
      }
      slot.busy = true;
      slot.taskId = task.taskId;
      this.active.set(task.taskId, task);
      const envelope: HubWorkerEnvelope<unknown> = {
        kind: 'task',
        taskId: task.taskId,
        payload: task.payload,
      };
      slot.worker.postMessage(envelope, task.transferables);
    }
  }
}
