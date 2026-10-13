export const events = [];
export async function evaluate(flag) { try { events.push('before-await'); const result = await (flag ? Promise.reject(new Error('boom')) : Promise.resolve('ok')); events.push('after-await'); return result; } finally { events.push('finally-start'); await Promise.reject(new Error('cleanup')); events.push('finally-end'); } }
