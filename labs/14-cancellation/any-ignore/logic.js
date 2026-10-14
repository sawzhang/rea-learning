export function createTask(name, controller, events, cooperative = true) {
  let state = 'pending', cleaned = false, resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  function finish(kind, value) {
    if (state !== 'pending') return;
    state = kind;
    controller.signal.removeEventListener('abort', onAbort);
    cleaned = true; events.push(name + ':cleanup');
    if (kind === 'fulfilled') resolvePromise(value); else rejectPromise(value);
  }
  function onAbort() {
    events.push(name + ':abort-received');
    if (cooperative) queueMicrotask(() => finish('rejected', new Error(name + '-aborted')));
    else events.push(name + ':abort-ignored');
  }
  controller.signal.addEventListener('abort', onAbort, { once: true });
  promise.then(() => events.push(name + ':fulfilled'), () => events.push(name + ':rejected'));
  return { promise, resolve: value => finish('fulfilled', value), reject: error => finish('rejected', error), inspect: () => ({ state, cleaned }) };
}
export function aggregate(a, b) { return Promise.any([a, b]); }
export async function consume(promise, events) { try { return await promise; } finally { events.push('owner-finally'); } }
