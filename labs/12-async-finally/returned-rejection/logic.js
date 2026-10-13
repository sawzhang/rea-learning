export const events = [];
export async function evaluate(flag) { try { events.push('return-promise'); return flag ? Promise.reject(new Error('boom')) : Promise.resolve('ok'); } catch (error) { events.push('catch'); return 'caught'; } finally { events.push('finally-start'); await Promise.resolve(); events.push('finally-end'); } }
