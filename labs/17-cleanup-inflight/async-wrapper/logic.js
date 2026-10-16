export function createScope(events, failures = 0) {
  const resource = { id: 'logical-resource', owner: 'scope-1', released: false };
  let owned = true, inFlight, attempts = 0, active = 0, maxActive = 0, duplicateReleases = 0;
  const gates = [];
  async function performCleanup() {
    if (!owned) return 'already-released';
    const attempt = ++attempts;
    active++; maxActive = Math.max(maxActive, active); events.push('start:' + attempt);
    try {
      await new Promise(resolve => gates.push({ attempt, resolve }));
      if (attempt <= failures) { events.push('failed:' + attempt); throw new Error('cleanup-failed:' + attempt); }
      if (resource.released) { duplicateReleases++; events.push('duplicate-release:' + attempt); return 'already-released'; }
      resource.released = true; owned = false; events.push('released:' + attempt); return 'released';
    } finally { active--; events.push('finish:' + attempt); }
  }
  async function retryCleanup() {
    if (inFlight !== undefined) return inFlight;
    inFlight = performCleanup().finally(() => { inFlight = undefined; });
    return inFlight;
  }
  return { retryCleanup, openGates: () => { const pending = gates.splice(0); for (const gate of pending) { events.push('gate:' + gate.attempt); gate.resolve(); } }, inspect: () => ({ owned, attempts, active, maxActive, duplicateReleases, inFlight: inFlight !== undefined, gated: gates.length, resource: { ...resource } }) };
}
export async function observeCleanup(promise, events) { try { return await promise; } finally { events.push('observer-finally'); } }
