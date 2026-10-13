import { evaluate, events } from './logic.js';
const outcomes = [];
for (const flag of [false, true]) {
  const start = events.length;
  events.push('caller-start');
  const pending = evaluate(flag);
  events.push('caller-pending');
  try { const value = await pending; events.push('caller-fulfilled'); outcomes.push({ flag, kind: 'fulfilled', value, events: events.slice(start) }); }
  catch (error) { events.push('caller-rejected'); outcomes.push({ flag, kind: 'rejected', message: error.message, events: events.slice(start) }); }
}
console.log(JSON.stringify(outcomes));
