import { setImmediate as checkpoint } from 'node:timers/promises';
import { createScope, observeCleanup } from './logic.js';
const reports = [];
for (const scenario of ['success', 'transient', 'permanent']) {
  const events = [];
  const scope = createScope(events, scenario === 'success' ? 0 : scenario === 'transient' ? 1 : Infinity);
  const waves = [];
  let previous;
  async function wave(label) {
    const first = scope.retryCleanup(), second = scope.retryCleanup();
    const joined = Promise.allSettled([observeCleanup(first, events), observeCleanup(second, events)]);
    await checkpoint();
    const before = scope.inspect();
    const identity = { samePromise: first === second, differentFromPrevious: previous === undefined ? null : first !== previous };
    previous = first;
    scope.openGates();
    const settled = await joined;
    await checkpoint();
    const outcomes = settled.map(item => item.status === 'fulfilled' ? { status: item.status, value: item.value } : { status: item.status, error: item.reason.message });
    waves.push({ label, identity, before, outcomes, after: scope.inspect() });
  }
  await wave('initial-two-callers');
  if (scope.inspect().owned) await wave('explicit-retry-two-callers');
  if (!scope.inspect().owned) await wave('after-release-no-resource-work');
  reports.push({ scenario, waves, final: scope.inspect(), events });
}
console.log(JSON.stringify(reports));
