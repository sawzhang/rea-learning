export const ownership = new Map();
export function createTask(id, controller, events, cleanupFailures = 0) {
  const resource = { id, owner: id, released: false };
  ownership.set(id, resource);
  let state = 'pending', rejectPromise, cleanupAttempts = 0, abortCallbacks = 0, settlements = 0;
  const promise = new Promise((resolve, reject) => { rejectPromise = reject; });
  function cleanup() {
    cleanupAttempts++;
    if (cleanupAttempts <= cleanupFailures) { events.push('cleanup-failed'); return false; }
    controller.signal.removeEventListener('abort', onAbort);
    resource.released = true; ownership.delete(id); events.push('cleanup-confirmed'); return true;
  }
  function onAbort() {
    abortCallbacks++; events.push('abort-observed');
    queueMicrotask(() => {
      if (state !== 'pending') return;
      state = 'rejected'; settlements++; rejectPromise(new Error('aborted'));
      cleanup();
    });
  }
  controller.signal.addEventListener('abort', onAbort, { once: true });

  return { promise, retryCleanup: cleanup, forceStop: () => { events.push('forced-stop'); onAbort(); }, inspect: () => ({ state, cleanupAttempts, abortCallbacks, settlements, owned: ownership.has(id), resource: { ...resource } }) };
}
export async function consume(promise, events) { try { return await promise; } finally { events.push('owner-finally'); } }
