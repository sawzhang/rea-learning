export function evaluate(flag) { try { if (flag) throw new Error('boom'); return 'ok'; } catch (error) { return 'caught'; } }
