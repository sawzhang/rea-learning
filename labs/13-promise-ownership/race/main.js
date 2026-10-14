import { setImmediate as checkpoint } from 'node:timers/promises';
import { createTasks, consume } from './logic.js';
const reports = [];
for (const scenario of ['B-first', 'A-reject-first', 'A-win-B-late-reject']) {
  const events = [];
  const tasks = createTasks(events);
  let outcome = null;
  const owned = consume(tasks, events).then(value => { outcome = { kind: 'fulfilled', value }; events.push('owner:fulfilled'); }, error => { outcome = { kind: 'rejected', message: error.message }; events.push('owner:rejected'); });
  if (scenario === 'B-first') { events.push('settle:B'); tasks.resolveB('B'); }
  else if (scenario === 'A-reject-first') { events.push('settle:A'); tasks.rejectA(new Error('A-boom')); }
  else { events.push('settle:A'); tasks.resolveA('A'); }
  await checkpoint();
  const afterFirst = { outcome: outcome === null ? null : { ...outcome }, events: [...events] };
  events.push('checkpoint:first');
  if (scenario === 'B-first') { events.push('settle:A'); tasks.resolveA('A'); }
  else if (scenario === 'A-reject-first') { events.push('settle:B'); tasks.resolveB('B'); }
  else { events.push('settle:B'); tasks.rejectB(new Error('B-late')); }
  await owned;
  await checkpoint();
  events.push('checkpoint:drained');
  reports.push({ scenario, afterFirst, outcome, events });
}
console.log(JSON.stringify(reports));
