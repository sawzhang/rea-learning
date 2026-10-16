import { setImmediate as checkpoint } from 'node:timers/promises';
import { createReader, observeCleanup } from './logic.js';
const scopeModule = new URL('../../upstream/dist/artifacts/ArtifactResourceScope.js', import.meta.url);
const { ArtifactResourceScope } = await import(scopeModule.href);
const reports = [];
for (const permanent of [false, true]) {
  const events = [], scope = new ArtifactResourceScope();
  const a = createReader('A', 1, events), b = createReader('B', permanent ? Infinity : 2, events);
  const seed = [];
  for (const adapter of [a, b]) seed.push((await scope.release({ kind: 'reader', resource: adapter.resource, reader: adapter.reader })).kind);
  const waves = [];
  for (let i = 0; i < 2; i++) {
    const first = scope.retryCleanup(), second = scope.retryCleanup();
    const joined = Promise.allSettled([observeCleanup(first, events), observeCleanup(second, events)]);
    await checkpoint();
    const before = [a.snapshot(), b.snapshot()];
    b.openGate();
    const results = await joined;
    waves.push({ samePromise: first === second, sameFailure: results[0].status === 'rejected' && results[0].reason === results[1].reason, before, after: [a.snapshot(), b.snapshot()], outcomes: results.map(r => r.status === 'fulfilled' ? {status:r.status,value:r.value} : {status:r.status,message:r.reason.message,cleanup:r.reason.cleanup}) });
  }
  let admission = 0, closeOutcome;
  if (!permanent) { await scope.run(async () => { admission++; }); await scope.close(); closeOutcome = {status:'fulfilled'}; }
  else { const closing = scope.close(); const settled = Promise.allSettled([closing]); await checkpoint(); b.openGate(); const result = (await settled)[0]; closeOutcome = {status:result.status,cleanup:result.reason?.cleanup}; }
  const closed = await Promise.allSettled([scope.run(async () => { admission++; })]);
  reports.push({ permanent, seed, waves, admission, closeOutcome, closed: closed[0].status, final: [a.snapshot(), b.snapshot()], events });
}
console.log(JSON.stringify(reports));
