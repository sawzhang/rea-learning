import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'results/03-static-semantics');
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
const application = run('application', ['analyze-javascript-application', resolve(root, 'labs/03-static-semantics/target')]);
const graph = application.normalized_result.semantic_graph;
assert.ok(graph?.nodes.length && graph?.relations.length, 'Semantic graph must contain facts');
function trace(name, query) {
  const input = resolve(output, `${name}-input.json`);
  writeFileSync(input, JSON.stringify({ application, query }));
  const result = run(name, ['trace-javascript-semantics', input]).normalized_result;
  assert.equal(result.source_evidence_id, application.evidence_id);
  assert.equal(result.source_graph_id, graph.graph_id);
  const contexts = new Set(result.evidence_contexts.map(context => context.context_id));
  for (const fact of [...result.nodes, ...result.relations, ...result.unknowns]) {
    assert.ok(contexts.has(fact.evidence.context_id), 'Trace must retain referenced provenance contexts');
  }
  return result;
}
const forward = trace('literal-forward', { seed: { kind: 'literal', value: 21 }, direction: 'forward-influence' });
assert.ok(forward.seed_node_ids.length && forward.relations.length, 'Literal must influence retained relations');
assert.ok(forward.relations.every(relation => relation.resolution !== 'candidate'));
const candidates = trace('literal-with-candidates', { seed: { kind: 'literal', value: 21 }, direction: 'forward-influence', include_ambiguous_dynamic_edges: true });
assert.ok(candidates.relations.some(relation => relation.resolution === 'candidate'), 'Opt-in must retain reachable candidates');
assert.equal(candidates.status, 'ambiguous');
const backward = trace('property-backward', { seed: { kind: 'property', name: 'mode' }, direction: 'backward-provenance' });
assert.ok(backward.seed_node_ids.length && backward.relations.length, 'Property must have retained provenance');
const endpoint = trace('endpoint-backward', { seed: { kind: 'endpoint', value: 'https://example.invalid/api/invoice' }, direction: 'backward-provenance' });
assert.ok(endpoint.seed_node_ids.length, 'Request endpoint must be found');
const missing = trace('literal-missing', { seed: { kind: 'literal', value: 'NOT_PRESENT_IN_FIXTURE' }, direction: 'forward-influence' });
assert.equal(missing.status, 'partial', 'Incomplete semantic coverage must not claim absence');
assert.equal(missing.seed_node_ids.length, 0);
const calls = graph.relations.filter(relation => relation.relation === 'calls' && relation.resolution === 'resolved');
assert.ok(calls.length, 'Local call must resolve');
const callers = trace('local-callers', { seed: { kind: 'semantic-node', node_id: calls[0].target_node_id }, direction: 'callers' });
assert.ok(callers.relations.some(relation => relation.relation_id === calls[0].relation_id), 'Callers query must retain local call');
assert.ok(graph.unknowns.some(unknown => unknown.reason === 'dynamic-property'), 'Computed property must retain an explicit unknown');
for (const [name, result] of Object.entries({ forward, candidates, backward, endpoint, missing, callers })) {
  console.log(name, JSON.stringify({ status: result.status, summary: result.summary, coverage: result.coverage }));
}
console.log(`Graph: ${graph.nodes.length} nodes, ${graph.relations.length} relations, ${graph.unknowns.length} unknowns`);
console.log(`Results: ${output}`);
