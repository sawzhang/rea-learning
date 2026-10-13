export const events = [];
export function evaluate(flag) { try { return 'ok'; } finally { events.push('finally'); } }
