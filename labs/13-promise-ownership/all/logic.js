export function createTasks(events) {
  let resolveA, rejectA, resolveB, rejectB;
  const a = new Promise((resolve, reject) => { resolveA = resolve; rejectA = reject; });
  const b = new Promise((resolve, reject) => { resolveB = resolve; rejectB = reject; });
  a.then(() => events.push('A:fulfilled'), () => events.push('A:rejected'));
  b.then(() => events.push('B:fulfilled'), () => events.push('B:rejected'));
  const aggregate = Promise.all([a, b]);
  return { aggregate, resolveA, rejectA, resolveB, rejectB };
}
export async function consume(tasks, events) {
  events.push('owner-await');
  try { return await tasks.aggregate; }
  finally { events.push('owner-finally'); }
}
