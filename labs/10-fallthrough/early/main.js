import { choose } from './logic.js';
console.log(JSON.stringify([1,0,-1].map(value => choose(value))));
