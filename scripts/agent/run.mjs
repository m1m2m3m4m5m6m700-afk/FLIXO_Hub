import { createHash } from 'node:crypto';
import { join } from 'node:path';

import {
  Budget,
  BudgetExceededError,
  heartbeat,
  loadCheckpoint,
  envInt,
  saveCheckpoint,
  worker,
} from './lib.mjs';
import { dispatchNext, discoverTasks, processTask } from './task.mjs';

export const BATCH_MS = envInt('BATCH_MS', 2_000, 0, 60_000);
export const MAX_ATTEMPTS = envInt('MAX_ATTEMPTS', 3, 1, 20);
export const MAX_CHAIN = envInt('MAX_CHAIN', 8, 1, 100);
export const TASK_HARD_MS = envInt('TASK_HARD_MS', 15 * 60_000, 5_000, 60 * 60_000);
export const CHECKPOINT_PATH = process.env.AGENT_CHECKPOINT_PATH || join(process.cwd(), '.agent-state', 'repair-agent.json');

export async function run({
  discover = discoverTasks,
  processTaskImpl = processTask,
  dispatch = null,
  checkpointPath = CHECKPOINT_PATH,
  heartbeatImpl = heartbeat,
  load = loadCheckpoint,
  save = saveCheckpoint,
  budget = new Budget(),
  taskHardMs = TASK_HARD_MS,
  batchMs = BATCH_MS,
  maxAttempts = MAX_ATTEMPTS,
  maxChain = MAX_CHAIN,
  runUrl = process.env.RUN_URL || '',
  signal,
} = {}) {
  let checkpoint = await load(checkpointPath, {
    attempts: {},
    tasks: {},
    pending: [],
    chain: 0,
    status: 'idle',
  });
  const attempts = { ...(checkpoint.attempts || {}) };
  const taskState = { ...(checkpoint.tasks || {}) };
  const taskList = dedupeTasks(await discover());
  const queue = taskList.filter((task) => taskState[task.id] !== 'done' && attempts[task.id] !== 'dead');
  let progressed = false;
  let processed = 0;

  for (const task of queue) {
    if (signal?.aborted) break;
    let taskCompleted = false;
    while (true) {
      const currentAttempt = attempts[task.id];
      const attempt = Number.isInteger(currentAttempt) ? currentAttempt + 1 : 1;
      if (attempt > maxAttempts) {
        attempts[task.id] = 'dead';
        taskState[task.id] = 'dead';
        break;
      }
      attempts[task.id] = attempt;
      taskState[task.id] = 'processing';
      checkpoint = await persist({ checkpoint, attempts, taskState, queue, task, status: 'processing', checkpointPath, save });
      await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: task.id, last_checkpoint: checkpointPath, pending: queue.length > 1, status: 'running' });

      let reservation = 0;
      try {
        reservation = budget?.reserve?.(1) ?? 0;
        const result = await worker(
          (innerSignal) => processTaskImpl(task, { attempt, signal: innerSignal, budget }),
          { timeoutMs: taskHardMs, signal },
        );
        if (result?.progress === false || result?.status === 'retry') {
          if (reservation) budget.refund(reservation);
          taskState[task.id] = 'retry';
          checkpoint = await persist({ checkpoint, attempts, taskState, queue, task, status: 'retry', result, checkpointPath, save });
          await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: task.id, last_checkpoint: checkpointPath, pending: true, status: 'retry' });
          break;
        }
        if (reservation) budget.spend(reservation);
        taskState[task.id] = 'done';
        delete attempts[task.id];
        processed += 1;
        progressed = true;
        checkpoint = { ...checkpoint, chain: 0 };
        checkpoint = await persist({ checkpoint, attempts, taskState, queue, task, status: 'done', result, checkpointPath, save });
        await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: task.id, last_checkpoint: checkpointPath, pending: queue.length > 1, status: 'done' });
        taskCompleted = true;
        break;
      } catch (error) {
        if (reservation) {
          try { budget.refund(reservation); } catch {}
        }
        if (error instanceof BudgetExceededError || error?.code === 'AGENT_BUDGET_EXHAUSTED') {
          checkpoint = await persist({ checkpoint, attempts, taskState, queue, task, status: 'budget-exhausted', error: error.message, checkpointPath, save });
          await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: task.id, last_checkpoint: checkpointPath, pending: true, status: 'failed' });
          return { status: 'budget-exhausted', processed, checkpoint };
        }
        if (attempt >= maxAttempts) {
          attempts[task.id] = 'dead';
          taskState[task.id] = 'dead';
        } else {
          taskState[task.id] = 'retry';
        }
        checkpoint = await persist({ checkpoint, attempts, taskState, queue, task, status: taskState[task.id], error: error?.message || String(error), checkpointPath, save });
        await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: task.id, last_checkpoint: checkpointPath, pending: true, status: taskState[task.id] === 'dead' ? 'failed' : 'retry' });
        if (taskState[task.id] === 'retry') continue;
        break;
      }
    }
    if (batchMs > 0 && !taskCompleted) await new Promise((resolve) => setTimeout(resolve, batchMs));
  }

  const pending = dedupeTasks(await discover()).filter((task) => taskState[task.id] !== 'done' && attempts[task.id] !== 'dead');
  if (pending.length && !progressed && dispatch) {
    if (Number(checkpoint.chain || 0) >= maxChain) {
      checkpoint = await persist({ checkpoint, attempts, taskState, queue: pending, status: 'chain-limit', checkpointPath, save });
      await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: '', last_checkpoint: checkpointPath, pending: true, status: 'failed' });
      return { status: 'chain-limit', processed, checkpoint };
    }
    const nextChain = Number(checkpoint.chain || 0) + 1;
    const dispatchKey = makeDispatchKey(nextChain, pending);
    if (checkpoint.dispatch_key === dispatchKey && checkpoint.dispatch_status === 'dispatched') {
      checkpoint = await persist({ checkpoint, attempts, taskState, queue: pending, status: 'already-dispatched', checkpointPath, save });
      await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: '', last_checkpoint: checkpointPath, pending: true, status: 'running' });
      return { status: 'already-dispatched', processed, pending: pending.length, checkpoint };
    }
    if (checkpoint.dispatch_key === dispatchKey && checkpoint.dispatch_status === 'dispatching') {
      checkpoint = await persist({ checkpoint, attempts, taskState, queue: pending, status: 'dispatch-ambiguous', error: 'dispatch request may have been accepted before checkpoint acknowledgement', checkpointPath, save });
      await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: '', last_checkpoint: checkpointPath, pending: true, status: 'failed' });
      return { status: 'dispatch-ambiguous', processed, pending: pending.length, checkpoint };
    }
    checkpoint = { ...checkpoint, chain: nextChain, dispatch_key: dispatchKey, dispatch_status: 'dispatching' };
    checkpoint = await persist({ checkpoint, attempts, taskState, queue: pending, status: 'dispatching', checkpointPath, save });
    try {
      const dispatched = await dispatch({ chain: nextChain, pending, dispatchKey });
      checkpoint = { ...checkpoint, dispatch_status: 'dispatched' };
      checkpoint = await persist({ checkpoint, attempts, taskState, queue: pending, status: 'dispatched', dispatch: dispatched, checkpointPath, save });
    } catch (error) {
      checkpoint = await persist({ checkpoint, attempts, taskState, queue: pending, status: 'dispatch-failed', error: error?.message || String(error), checkpointPath, save });
      await heartbeatImpl({ run_url: runUrl, seq: checkpoint.__seq, task_id: '', last_checkpoint: checkpointPath, pending: true, status: 'failed' });
      return { status: 'dispatch-failed', processed, checkpoint };
    }
  } else {
    checkpoint = await persist({ checkpoint, attempts, taskState, queue: pending, status: pending.length ? 'retry' : 'idle', checkpointPath, save });
  }

  return {
    status: pending.length ? 'pending' : 'idle',
    processed,
    pending: pending.length,
    checkpoint,
  };
}

async function persist({ checkpoint, attempts, taskState, queue, task, status, result = null, error = null, dispatch = null, checkpointPath, save }) {
  const next = {
    ...checkpoint,
    attempts,
    tasks: taskState,
    pending: queue.map((item) => item.id).slice(0, 100),
    active_task: task?.id || null,
    status,
    last_error: error ? String(error).slice(0, 1_000) : null,
    last_result: result ? sanitizeResult(result) : null,
    dispatch: dispatch ? sanitizeResult(dispatch) : checkpoint.dispatch || null,
    dispatch_key: checkpoint.dispatch_key || null,
    dispatch_status: checkpoint.dispatch_status || null,
  };
  return save(checkpointPath, next, { expectedSeq: Number(checkpoint.__seq || 0) });
}

function sanitizeResult(value) {
  if (value == null) return null;
  if (typeof value !== 'object') return String(value).slice(0, 1_000);
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'string' ? item.slice(0, 1_000) : item));
}

function makeDispatchKey(chain, pending) {
  return createHash('sha256').update(JSON.stringify({ chain, pending: pending.map((task) => task.id) })).digest('hex').slice(0, 32);
}

function dedupeTasks(tasks) {
  const seen = new Set();
  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (!task?.id || seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

export { dispatchNext };
