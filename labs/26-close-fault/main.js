import { observeCleanup } from './logic.js';

const moduleURL = new URL('../../upstream/dist/filesystem/OwnedFileHandle.js', import.meta.url);
const { OwnedFileHandle } = await import(moduleURL.href);
const reports = [];

for (const invalidates of [false, true]) {
  const events = [];
  const injected = new Error('injected-close-failure');
  let calls = 0;
  const handle = {
    fd: 42,
    async close() {
      calls++;
      events.push('handle-close:' + calls);
      if (calls === 1) {
        if (invalidates) this.fd = -1;
        throw injected;
      }
      this.fd = -1;
    },
  };
  const owner = new OwnedFileHandle(handle);
  const first = owner.close();
  const second = owner.close();
  const initial = await Promise.allSettled([
    observeCleanup(first, events), observeCleanup(second, events),
  ]);
  const afterFailure = { fd: handle.fd, calls };
  const [retry] = await Promise.allSettled([observeCleanup(owner.close(), events)]);
  const afterRetry = { fd: handle.fd, calls };
  const [again] = await Promise.allSettled([observeCleanup(owner.close(), events)]);
  reports.push({
    invalidates, samePromise: first === second,
    initial: initial.map(result => ({ status: result.status, injected: result.reason === injected })),
    afterFailure, afterRetry,
    retry: { status: retry.status, injected: retry.reason === injected },
    again: { status: again.status, injected: again.reason === injected },
    final: { fd: handle.fd, calls }, events,
  });
}
console.log(JSON.stringify(reports));
