export const ownership = new Map();
export function createTask(id, signals, events, failures = 0) {
  const resource = { id, owner: id, released: false };
  ownership.set(id, resource);
  const observedSignals = signals;
  let state = 'pending', rejectPromise, chosenReason = null;
  let abortCallbacks = 0, settlements = 0, cleanupAttempts = 0, duplicateReleaseAttempts = 0;
  const listeners = [];
  const promise = new Promise((resolve, reject) => { rejectPromise = reject; });
  function cleanup() {
    cleanupAttempts++;
    if (resource.released) { duplicateReleaseAttempts++; events.push('duplicate-release-attempt'); return false; }
    if (cleanupAttempts <= failures) { events.push('cleanup-failed'); return false; }
    for (const { signal, listener } of listeners) signal.removeEventListener('abort', listener);
    resource.released = true; ownership.delete(id); events.push('cleanup-confirmed'); return true;
  }
  function onAbort(signal) {
    abortCallbacks++; events.push('abort-observed:' + signal.reason);
    queueMicrotask(() => {
      if (state !== 'pending') return;
      state = 'rejected'; settlements++; chosenReason = signal.reason; rejectPromise(new Error(String(chosenReason)));
      cleanup();
    });
  }
  for (const signal of observedSignals) {
    const listener = () => onAbort(signal);
    listeners.push({ signal, listener });
    signal.addEventListener('abort', listener, { once: true });
    if (signal.aborted) onAbort(signal);
  }
  return { promise, retryCleanup: cleanup, inspect: () => ({ state, chosenReason, abortCallbacks, settlements, cleanupAttempts, duplicateReleaseAttempts, owned: ownership.has(id), resource: { ...resource } }) };
}
export async function consume(promise, events) { try { return await promise; } finally { events.push('owner-finally'); } }
