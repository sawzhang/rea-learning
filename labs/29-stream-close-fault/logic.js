export async function observeCleanup(promise, events) {
  try { await promise; return 'complete'; }
  finally { events.push('observer-finally'); }
}
