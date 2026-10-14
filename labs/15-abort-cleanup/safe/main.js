import { setImmediate as checkpoint } from 'node:timers/promises';
import { createTask, consume, ownership } from './logic.js';
const listenerOnly = false;
const cases = listenerOnly ? ['already-aborted'] : ['already-aborted', 'repeat', 'cleanup-once', 'cleanup-permanent'];
const reports = [];
for (const scenario of cases) {
  const controller = new AbortController(), events = [];
  if (scenario === 'already-aborted') controller.abort();
  const failures = scenario === 'cleanup-once' ? 1 : scenario === 'cleanup-permanent' ? Infinity : 0;
  const task = createTask(scenario, controller, events, failures);
  let outcome = null;
  const owner = consume(task.promise, events).then(value => { outcome = { kind: 'fulfilled', value }; }, error => { outcome = { kind: 'rejected', message: error.message }; });
  const initial = task.inspect();
  if (scenario !== 'already-aborted') { events.push('request-abort'); controller.abort(); controller.abort(); controller.abort(); }
  await checkpoint();
  const first = { ...task.inspect(), outcome, events: [...events] };
  if (listenerOnly) { controller.abort(); await checkpoint(); events.push('still-pending-after-reabort'); task.forceStop(); }
  let retry = null;
  if (scenario.startsWith('cleanup-')) { events.push('request-cleanup-retry'); const acknowledged = task.retryCleanup(); retry = { acknowledged, ...task.inspect(), outcome }; }
  await owner; await checkpoint();
  reports.push({ scenario, initial, first, retry, final: { ...task.inspect(), outcome }, retained: [...ownership.values()].map(r => ({ ...r })), events });
}
console.log(JSON.stringify(reports));
