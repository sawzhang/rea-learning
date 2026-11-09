import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { observeCleanup } from './logic.js';

const readerURL = new URL('../../upstream/dist/artifacts/DirectoryArtifactReader.js', import.meta.url);
const ownerURL = new URL('../../upstream/dist/filesystem/OwnedFileHandle.js', import.meta.url);
const { DirectoryArtifactReader } = await import(readerURL.href);
const { OwnedFileHandle } = await import(ownerURL.href);
const root = await mkdtemp(join(tmpdir(), 'rea-directory-close-'));
const reader = new DirectoryArtifactReader(root);
const names = ['a.js', 'b.js', 'c.js'];
const owners = [], trace = [], events = [], streams = [];
const originalClose = OwnedFileHandle.prototype.close;
try {
  for (const name of names) await writeFile(join(root, name), 'export const fixture = 1;\n');
  const entries = new Map();
  for await (const entry of reader.entries()) if (entry.kind === 'file') entries.set(entry.path, entry);
  for (const name of names) streams.push(await reader.open(entries.get(name)));

  // Observe owner dispatch and inject a single rejection at each selected handle port.
  OwnedFileHandle.prototype.close = async function () {
    if (!owners.includes(this)) owners.push(this);
    const name = names[owners.indexOf(this)];
    const first = !trace.some(row => row.name === name);
    const handle = this.handle, close = handle.close, before = handle.fd;
    if (first && name !== 'b.js') {
      handle.close = async () => { throw new Error('injected:' + name); };
    }
    try { return await originalClose.call(this); }
    finally {
      handle.close = close;
      trace.push({ name, beforeValid: before >= 0, afterValid: handle.fd >= 0 });
    }
  };

  const rounds = [];
  for (let i = 0; i < 3; i++) {
    const start = trace.length;
    const [result] = await Promise.allSettled([observeCleanup(reader.close(), events)]);
    rounds.push({
      status: result.status,
      resources: result.reason?.cleanup?.resources.map(path => basename(path)) ?? [],
      causes: result.reason?.cause?.errors.map(error => error.cause?.message) ?? [],
      trace: trace.slice(start),
    });
  }
  console.log(JSON.stringify({ rounds, events }));
} finally {
  OwnedFileHandle.prototype.close = originalClose;
  try { await reader.close(); }
  finally {
    for (const stream of streams) stream.destroy();
    await rm(root, { recursive: true, force: true });
  }
}
