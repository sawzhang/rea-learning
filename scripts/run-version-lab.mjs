import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'results/02-version-comparison');
mkdirSync(output, { recursive: true });
function run(name, args, expectedError = false) {
  const result = spawnSync(process.execPath, [resolve(root, 'upstream/scripts/rea.mjs'), ...args, '--json'], {
    cwd: resolve(root, 'upstream'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(resolve(output, `${name}.stderr.log`), result.stderr ?? '');
  if (result.error) throw result.error;
  const data = JSON.parse(result.stdout);
  writeFileSync(resolve(output, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  if (expectedError) assert.ok(data.error, 'Expected a structured rejection');
  else {
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.ok(!data.error, `${name}: ${result.stdout}`);
  }
  return data;
}
function compare(name, left, right, expectedError = false) {
  const input = resolve(output, `${name}-input.json`);
  writeFileSync(input, JSON.stringify({ left, right }));
  return run(name, ['compare-application-versions', input], expectedError);
}
const left = run('v1', ['analyze-javascript-application', resolve(root, 'labs/02-version-comparison/v1')]);
const right = run('v2', ['analyze-javascript-application', resolve(root, 'labs/02-version-comparison/v2')]);
assert.notEqual(left.evidence_id, right.evidence_id);
const forward = compare('forward', left, right).normalized_result;
const reverse = compare('reverse', right, left).normalized_result;
assert.equal(forward.left.evidence_id, left.evidence_id);
assert.equal(forward.right.evidence_id, right.evidence_id);
assert.equal(forward.coverage.status, 'complete-within-inputs');
const items = forward.items;
assert.ok(items.some(item => item.node_kind === 'endpoint' && item.status === 'removed'), 'Old endpoint must be removed');
assert.ok(items.some(item => item.node_kind === 'endpoint' && item.status === 'added'), 'New endpoint must be added');
assert.ok(items.some(item => item.status === 'unchanged'), 'Unchanged entities must be retained');
assert.equal(forward.summary.added, reverse.summary.removed);
assert.equal(forward.summary.removed, reverse.summary.added);
assert.equal(forward.summary.changed, reverse.summary.changed);
assert.equal(forward.summary.unchanged, reverse.summary.unchanged);
const same = compare('same-evidence', left, left, true);
assert.match(JSON.stringify(same), /distinct/i);
const tampered = structuredClone(right);
tampered.normalized_result.graph.nodes[0].observations[0].label = 'tampered';
const rejected = compare('tampered-evidence', left, tampered, true);
assert.ok(rejected.error);
console.log(JSON.stringify({ forward: forward.summary, reverse: reverse.summary, matching: forward.matching, coverage: forward.coverage }, null, 2));
console.log(`Results: ${output}`);
