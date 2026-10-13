function mayThrow(flag) { if (flag) throw new Error('boom'); }
export function evaluate(flag) { mayThrow(flag); return 'ok'; }
