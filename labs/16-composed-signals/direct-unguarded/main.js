import { setImmediate as checkpoint } from 'node:timers/promises';
import { createTask, consume, ownership } from './logic.js';
const reports = [];
for (const scenario of ['A-first', 'B-first', 'pre-aborted-both', 'cleanup-once', 'cleanup-permanent']) {
  const a = new AbortController(), b = new AbortController(), events = [];
  if (scenario === 'pre-aborted-both') { b.abort('B-reason'); a.abort('A-reason'); }
  const failures = scenario === 'cleanup-once' ? 1 : scenario === 'cleanup-permanent' ? Infinity : 0;
  const task = createTask(scenario, [a.signal, b.signal], events, failures);
  let outcome = null;
  const owner = consume(task.promise, events).then(value => { outcome = { kind: 'fulfilled', value }; }, error => { outcome = { kind: 'rejected', message: error.message }; });
  if (scenario === 'B-first') { b.abort('B-reason'); a.abort('A-reason'); }
  else if (scenario !== 'pre-aborted-both') { a.abort('A-reason'); b.abort('B-reason'); }
  a.abort('ignored-repeat'); b.abort('ignored-repeat');
  await checkpoint();
  const first = { ...task.inspect(), outcome, events: [...events] };
  let retry = null;
  if (task.inspect().owned) { events.push('explicit-cleanup-retry'); const acknowledged = task.retryCleanup(); retry = { acknowledged, ...task.inspect() }; }
  await owner; await checkpoint();
  reports.push({ scenario, first, retry, final: { ...task.inspect(), outcome }, events, retained: [...ownership.values()].map(resource => ({ ...resource })) });
}
console.log(JSON.stringify(reports));
