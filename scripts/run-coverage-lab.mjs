import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'results/05-function-coverage');
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
const targetRoot = resolve(root, 'labs/05-function-coverage/target');
const application = run('application', ['analyze-javascript-application', targetRoot]);
const sourcePath = resolve(targetRoot, 'logic.js');
const bytes = readFileSync(sourcePath);
const source = bytes.toString('utf8');
const digest = createHash('sha256').update(bytes).digest('hex');
const functions = application.normalized_result.semantic_graph.nodes.filter(node => node.kind === 'function' && node.identity.module_path === 'logic.js');
assert.equal(functions.length, 3);
function offset(position) {
  const lines = source.split('\n');
  return lines.slice(0, position.line - 1).reduce((sum, line) => sum + line.length + 1, 0) + position.column;
}
const reports = {};
for (const scenario of ['baseline', 'expanded']) {
  const coverageDir = mkdtempSync(resolve(output, `${scenario}-coverage-`));
  const execution = spawnSync(process.execPath, [resolve(targetRoot, 'main.js'), scenario], {
    encoding: 'utf8', timeout: 10000, env: { ...process.env, NODE_V8_COVERAGE: coverageDir },
  });
  if (execution.error) throw execution.error;
  assert.equal(execution.status, 0, execution.stderr);
  const oracle = JSON.parse(execution.stdout);
  assert.equal(oracle.result, 42);
  assert.equal(oracle.branch, scenario === 'baseline' ? 'positive' : 'non-positive');
  const files = readdirSync(coverageDir).filter(name => name.endsWith('.json'));
  assert.equal(files.length, 1, 'One process must produce one coverage payload');
  const raw = JSON.parse(readFileSync(resolve(coverageDir, files[0]), 'utf8'));
  const script = raw.result.find(item => item.url === pathToFileURL(sourcePath).href);
  assert.ok(script, 'Loaded logic.js must have coverage');
  assert.equal(createHash('sha256').update(readFileSync(sourcePath)).digest('hex'), digest);
  const items = functions.map(node => {
    assert.equal(node.identity.artifact_sha256, digest);
    const start = offset(node.identity.source_range.start), end = offset(node.identity.source_range.end);
    const matches = script.functions.filter(fn => fn.ranges[0].startOffset === start && fn.ranges[0].endOffset === end);
    assert.equal(matches.length, 1, 'Digest and exact UTF-16 function range must identify one record');
    const fn = matches[0];
    assert.equal(fn.functionName, node.label);
    for (const range of fn.ranges) assert.ok(range.startOffset >= start && range.endOffset <= end && range.count >= 0);
    return { static_node_id: node.node_id, name: node.label, count: fn.ranges[0].count, ranges: fn.ranges, is_block_coverage: fn.isBlockCoverage };
  });
  const byName = new Map(items.map(item => [item.name, item]));
  assert.equal(byName.get('double').count, scenario === 'baseline' ? 1 : 2);
  assert.equal(byName.get('unused').count, scenario === 'baseline' ? 0 : 1);
  assert.equal(byName.get('choose').count, 1);
  assert.ok(byName.get('choose').ranges.some(range => range.count === 0), 'Called function must retain an uncovered branch range');
  reports[scenario] = { oracle, items };
}
assert.notDeepEqual(reports.baseline.items.find(item => item.name === 'choose').ranges, reports.expanded.items.find(item => item.name === 'choose').ranges);
const queryPath = resolve(output, 'static-query-input.json');
writeFileSync(queryPath, JSON.stringify({ application, query: { seed: { kind: 'semantic-node', node_id: functions.find(node => node.label === 'unused').node_id }, direction: 'callers' } }));
const trace = run('static-unused-callers', ['trace-javascript-semantics', queryPath]);
assert.equal(trace.normalized_result.source_evidence_id, application.evidence_id);
const report = { authority: 'caller-owned V8 coverage; comparison is analyst inference, not REA runtime Evidence', node_version: process.version, static_evidence_id: application.evidence_id, source_sha256: digest, offset_units: 'utf16-code-units', scenarios: reports, static_query: { status: trace.normalized_result.status, summary: trace.normalized_result.summary, coverage: trace.normalized_result.coverage } };
writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
