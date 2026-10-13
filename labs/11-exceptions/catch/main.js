import * as logic from './logic.js';
const outputs = [false, true].map(flag => {
  try { return { kind: 'returned', value: logic.evaluate(flag) }; }
  catch (error) { return { kind: 'threw', message: error.message }; }
});
console.log(JSON.stringify({ outputs, events: logic.events ?? [] }));
