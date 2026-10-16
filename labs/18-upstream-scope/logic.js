export function createReader(resource, failThrough, events) {
  let calls = 0, released = false, open;
  return {
    resource,
    reader: { async close() {
      const attempt = ++calls;
      events.push(`${resource}:start:${attempt}`);
      if (resource === 'B' && attempt > 1) await new Promise(resolve => { open = resolve; });
      if (attempt <= failThrough) { events.push(`${resource}:failed:${attempt}`); throw new Error(`${resource}:cleanup-failed:${attempt}`); }
      released = true;
      events.push(`${resource}:released:${attempt}`);
    } },
    openGate() { const resolve = open; open = undefined; resolve?.(); },
    snapshot() { return { resource, calls, released, ownership: released ? 'released' : 'adapter-owner', gated: open !== undefined }; }
  };
}
export async function observeCleanup(promise, events) {
  try { await promise; return 'complete'; }
  finally { events.push('observer-finally'); }
}
