import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeCleanup } from './logic.js';

const readerURL = new URL('../../upstream/dist/artifacts/DirectoryArtifactReader.js', import.meta.url);
const ownerURL = new URL('../../upstream/dist/filesystem/OwnedFileHandle.js', import.meta.url);
const { DirectoryArtifactReader } = await import(readerURL.href);
const { OwnedFileHandle } = await import(ownerURL.href);
const original = OwnedFileHandle.prototype.close;
const reports = [];

for (const order of ['reader-first', 'stream-first']) {
  const root = await mkdtemp(join(tmpdir(), 'rea-stream-close-'));
  const reader = new DirectoryArtifactReader(root);
  const gate = Promise.withResolvers(), started = Promise.withResolvers();
  const attempts = [], owners = [], events = [];
  let stream, handle, rawClose, portCalls = 0, nativeCalls = 0;
  try {
    await writeFile(join(root, 'fixture.js'), 'export const fixture = 1;\n');
    for await (const entry of reader.entries()) {
      if (entry.kind === 'file') stream = await reader.open(entry);
    }
    OwnedFileHandle.prototype.close = function () {
      if (!handle) {
        handle = this.handle;
        rawClose = handle.close;
        handle.close = async function () {
          portCalls++;
          started.resolve();
          await gate.promise;
          nativeCalls++;
          return rawClose.call(this);
        };
      }
      const attempt = original.call(this);
      owners.push(this);
      attempts.push(attempt);
      return attempt;
    };
    const destroyStream = async () => {
      const closed = once(stream, 'close');
      stream.destroy();
      await closed;
    };
    let readerDone;
    if (order === 'reader-first') {
      readerDone = observeCleanup(reader.close(), events);
      await started.promise;
      await destroyStream();
    } else {
      await destroyStream();
      await started.promise;
      readerDone = observeCleanup(reader.close(), events);
    }
    const overlap = {
      dispatches: attempts.length,
      sameOwner: owners[0] === owners[1],
      sameAttempt: attempts[0] === attempts[1],
      portCalls, nativeCalls,
      fdValid: handle.fd >= 0,
    };
    gate.resolve();
    await readerDone;
    await observeCleanup(reader.close(), events);
    reports.push({ order, overlap, final: { dispatches: attempts.length, portCalls, nativeCalls, fd: handle.fd }, events });
  } finally {
    gate.resolve();
    OwnedFileHandle.prototype.close = original;
    if (handle) handle.close = rawClose;
    try { await reader.close(); }
    finally {
      stream?.destroy();
      await rm(root, { recursive: true, force: true });
    }
  }
}
console.log(JSON.stringify(reports));
