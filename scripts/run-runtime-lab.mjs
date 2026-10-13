import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'results/04-runtime-observation');
mkdirSync(output, { recursive: true });
function run(name, args, expectedError = false) {
  const result = spawnSync(process.execPath, [resolve(root, 'upstream/scripts/rea.mjs'), ...args, '--json'], {
    cwd: resolve(root, 'upstream'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30000,
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
const targetRoot = resolve(root, 'labs/04-runtime-observation/target');
const application = run('application', ['analyze-javascript-application', targetRoot]);
const child = spawn(process.execPath, ['--inspect=127.0.0.1:0', resolve(targetRoot, 'main.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = '';
child.stdout.on('data', chunk => { stdout += chunk; });
child.stderr.on('data', chunk => { stderr += chunk; });
try {
  const endpoint = await new Promise((accept, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fixture startup timed out')), 10000);
    const check = () => {
      const match = stderr.match(/ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (match && stdout.includes('fixture-ready')) { clearTimeout(timeout); accept(`http://127.0.0.1:${match[1]}`); }
    };
    child.stdout.on('data', check); child.stderr.on('data', check);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Fixture exited early: ${code}`)); });
    check();
  });
  const targets = run('targets', ['list-javascript-runtime-targets', endpoint]);
  const target = targets.normalized_result.targets[0];
  assert.ok(target, 'Inspector must expose the owned fixture');
  const runtime = run('runtime', ['observe-javascript-runtime', endpoint, target.target_id, '--runtime-kind', 'node', '--observation-ms', '200']);
  const input = { static_layers: [{ role: 'application', analysis: application, runtime_mappings: [] }], runtime_observations: [runtime] };
  writeFileSync(resolve(output, 'reconcile-input.json'), JSON.stringify(input));
  const reconciled = run('reconciled', ['reconcile-javascript-runtime', resolve(output, 'reconcile-input.json')]);
  const repeated = run('reconciled-repeat', ['reconcile-javascript-runtime', resolve(output, 'reconcile-input.json')]);
  assert.equal(reconciled.evidence_id, repeated.evidence_id, 'Same retained inputs must reconcile deterministically');
  assert.equal(child.exitCode, null, 'REA must not terminate the caller-owned target');
  const observation = runtime.normalized_result;
  const fileScripts = observation.scripts.items.filter(script => script.location.kind === 'file');
  for (const filename of ['main.js', 'logic.js']) assert.ok(fileScripts.some(script => script.location.file_path === resolve(targetRoot, filename)));
  assert.ok(!fileScripts.some(script => script.location.file_path === resolve(targetRoot, 'unloaded.js')));
  assert.equal(observation.capture.truncated, false);
  const comparison = reconciled.normalized_result;
  const matches = comparison.reconciliations.filter(item => item.status === 'matched');
  assert.equal(matches.length, 2);
  assert.ok(matches.every(item => item.basis === 'artifact-path' && item.confidence === 'medium'));
  assert.ok(comparison.evidence_links.includes(application.evidence_id) && comparison.evidence_links.includes(runtime.evidence_id));
  const staticNodes = new Map(application.normalized_result.graph.nodes.map(node => [node.node_id, node]));
  const unloadedState = comparison.static_load_states.find(item => staticNodes.get(item.static_node_id).kind === 'javascript-asset' && staticNodes.get(item.static_node_id).observations.some(observation => observation.label === 'unloaded.js'));
  assert.equal(unloadedState?.status, 'unknown', 'Passive incomplete capture must not claim global absence');
  const graph = application.normalized_result.semantic_graph;
  assert.ok(graph.nodes.some(node => node.kind === 'function' && node.label === 'unused'));
  const query = { application, query: { seed: { kind: 'literal', value: 21 }, direction: 'forward-influence', include_ambiguous_dynamic_edges: true } };
  writeFileSync(resolve(output, 'semantic-input.json'), JSON.stringify(query));
  const semantic = run('semantic-trace', ['trace-javascript-semantics', resolve(output, 'semantic-input.json')]);
  assert.equal(semantic.normalized_result.source_evidence_id, application.evidence_id);
  assert.ok(semantic.normalized_result.seed_node_ids.length);
  const oracle = JSON.parse(stdout.trim());
  assert.equal(oracle.result, 42);
  assert.equal(oracle.unusedInvoked, false);
  const report = { oracle, runtime: { target: observation.target, capture: observation.capture, local_scripts: fileScripts.map(script => script.location.file_path), unavailable: observation.unavailable_without_instrumentation }, reconciliation: { summary: comparison.summary, coverage: comparison.coverage, matches: matches.map(item => ({ basis: item.basis, confidence: item.confidence })) }, semantic: { status: semantic.normalized_result.status, summary: semantic.normalized_result.summary, coverage: semantic.normalized_result.coverage }, deterministic_reconciliation: true };
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (child.exitCode === null) {
    const exited = new Promise(accept => child.once('exit', accept));
    child.kill('SIGTERM');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3000);
    await exited;
    clearTimeout(timeout);
  }
  writeFileSync(resolve(output, 'fixture.stdout.log'), stdout);
  writeFileSync(resolve(output, 'fixture.stderr.log'), stderr);
}
