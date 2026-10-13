import { double } from './logic.js';
const input = 21;
const result = double(input);
console.log(JSON.stringify({ kind: 'fixture-ready', result, invoked: 'double', unusedInvoked: false }));
const keepAlive = setInterval(() => {}, 1000);
process.on('SIGTERM', () => { clearInterval(keepAlive); process.exit(0); });
