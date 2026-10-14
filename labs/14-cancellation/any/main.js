import { setImmediate as checkpoint } from 'node:timers/promises';
import { createTask, aggregate, consume } from './logic.js';
const cancel = false, cooperative = true;
const reports = [];
for (const scenario of ['A-reject-B-win', 'both-reject', 'A-win-B-pending']) {
  const events = [], ca = new AbortController(), cb = new AbortController();
  const a = createTask('A', ca, events), b = createTask('B', cb, events, cooperative);
  let outcome = null;
  const owned = consume(aggregate(a.promise, b.promise), events).then(value => { outcome = { kind: 'fulfilled', value }; events.push('owner:fulfilled'); }, error => { outcome = { kind: 'rejected', name: error.name, errors: error.errors?.map(e => e.message), message: error.message }; events.push('owner:rejected'); });
  if (scenario === 'A-win-B-pending') a.resolve('A'); else a.reject(new Error('A-boom'));
  await checkpoint();
  const first = { outcome, a: a.inspect(), b: b.inspect(), events: [...events] };
  let requested = null, afterCancel = null;
  if (scenario === 'A-win-B-pending' && cancel) {
    events.push('cancel-request:B'); cb.abort();
    requested = { signalAborted: cb.signal.aborted, b: b.inspect(), events: [...events] };
    await checkpoint(); afterCancel = { b: b.inspect(), outcome, events: [...events] };
  }
  if (b.inspect().state === 'pending') {
    if (scenario === 'both-reject') b.reject(new Error('B-boom')); else b.resolve('B');
  }
  await owned; await checkpoint();
  const normalized = outcome.kind === 'fulfilled' && Array.isArray(outcome.value) ? { ...outcome, value: outcome.value.map(item => item.status === 'fulfilled' ? item : { status: item.status, reason: item.reason.message }) } : outcome;
  reports.push({ scenario, first, requested, afterCancel, outcome: normalized, final: { a: a.inspect(), b: b.inspect() }, events });
}
console.log(JSON.stringify(reports));
