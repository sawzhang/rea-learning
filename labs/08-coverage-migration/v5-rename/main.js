import { double, choose, unusedRenamed } from './logic.js';
const input = 21;
const result = double(input);
const expanded = process.argv[2] === 'expanded';
const branch = choose(expanded ? -1 : 1);
const extra = expanded ? [double(2), unusedRenamed(1)] : [];
console.log(JSON.stringify({ result, branch, extra }));
