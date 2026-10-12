import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'results');
mkdirSync(output, { recursive: true });
const dispatcher = resolve(root, 'upstream/scripts/rea.mjs');
function run(name, args) {
  const result = spawnSync(process.execPath, [dispatcher, ...args, '--json'], {
    cwd: resolve(root, 'upstream'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(resolve(output, `${name}.stderr.log`), result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.stdout}`);
  const data = JSON.parse(result.stdout);
  if (data.error) throw new Error(`${name}: ${result.stdout}`);
  writeFileSync(resolve(output, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
  return data;
}
const evidence = run('application', ['analyze-javascript-application', resolve(root, 'labs/01-static-app/target')]);
if (!evidence.evidence_id || !evidence.normalized_result) throw new Error('Unexpected Evidence shape');
writeFileSync(resolve(output, 'view-input.json'), JSON.stringify({source: {kind: 'inline', evidence}, view: {kind: 'summary'}}));
const summary = run('summary', ['inspect-analysis-view', resolve(output, 'view-input.json')]);
if (summary.normalized_result?.parent_evidence_id !== evidence.evidence_id) throw new Error('Summary is not bound to the analyzed Evidence');
writeFileSync(resolve(output, 'trace-input.json'), JSON.stringify({application: evidence, seed: {kind: 'module', value: 'main.js', match: 'exact', case_sensitive: true}, direction: 'both'}));
const trace = run('trace', ['trace-application-feature', resolve(output, 'trace-input.json')]);
if (!trace.normalized_result?.seed_matches?.length) throw new Error('Feature trace has no seed matches');
if (trace.normalized_result.source_evidence_id !== evidence.evidence_id) throw new Error('Trace is not bound to the analyzed Evidence');
console.log(`Evidence: ${evidence.evidence_id}`);
console.log(`Results: ${output}`);
