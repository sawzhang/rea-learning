import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { mergeCoverage } from './merge-coverage.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'results/07-cross-version-identity');
mkdirSync(output, { recursive: true });
const reports = {};
for (const [version, expected] of [['v1',42],['v2-comment',42],['v3-behavior',63]]) {
  const runOutput = resolve(output,version);
  const result = spawnSync(process.execPath, [resolve(root,'scripts/run-coverage-lab.mjs'), resolve(root,`labs/07-cross-version-identity/${version}`), runOutput, String(expected)], { encoding:'utf8', timeout:60000, maxBuffer:64*1024*1024 });
  writeFileSync(resolve(output,`${version}.stdout.log`),result.stdout ?? '');
  writeFileSync(resolve(output,`${version}.stderr.log`),result.stderr ?? '');
  if (result.error) throw result.error;
  assert.equal(result.status,0,result.stderr);
  reports[version] = JSON.parse(readFileSync(resolve(runOutput,'report.json'),'utf8'));
}
function captures(version) {
  const report = reports[version];
  return Object.entries(report.scenarios).map(([scenario,data]) => ({ capture_id:`${version}:${scenario}`, source_sha256:report.source_sha256, node_version:report.node_version, offset_units:report.offset_units, items:data.items }));
}
const accepted = {};
for (const version of Object.keys(reports)) {
  accepted[version] = mergeCoverage(captures(version));
  assert.equal(accepted[version].find(item=>item.name==='double').invocation_count,3);
}
const rejected = [];
for (const version of ['v2-comment','v3-behavior']) {
  assert.notEqual(reports.v1.source_sha256,reports[version].source_sha256);
  assert.notEqual(reports.v1.static_evidence_id,reports[version].static_evidence_id);
  const inputs = [captures('v1')[0],captures(version)[1]];
  let reason;
  try { mergeCoverage(inputs); } catch(error) { reason=error.message; }
  assert.match(reason ?? '', /Source digest mismatch/);
  rejected.push({ left:'v1:baseline',right:`${version}:expanded`,reason:'Source digest mismatch' });
}
const baseline = reports.v1.scenarios.baseline.items;
const behavior = reports['v3-behavior'].scenarios.baseline.items;
for (const left of baseline) {
  const right = behavior.find(item=>item.name===left.name);
  assert.deepEqual([left.ranges[0].startOffset,left.ranges[0].endOffset], [right.ranges[0].startOffset,right.ranges[0].endOffset]);
  assert.equal(left.count,right.count);
  assert.notEqual(left.static_node_id,right.static_node_id);
}
assert.equal(reports['v2-comment'].scenarios.baseline.oracle.result,42);
assert.equal(reports['v3-behavior'].scenarios.baseline.oracle.result,63);
const summary = { authority:'caller-owned coverage with analyst identity checks', versions:Object.fromEntries(Object.entries(reports).map(([version,r])=>[version,{source_sha256:r.source_sha256,static_evidence_id:r.static_evidence_id,result:r.scenarios.baseline.oracle.result,functions:r.scenarios.baseline.items.map(item=>({name:item.name,count:item.count,start:item.ranges[0].startOffset,end:item.ranges[0].endOffset}))}])),same_version_merge:accepted,cross_version_rejections:rejected,same_names_ranges_counts_do_not_establish_identity:true };
writeFileSync(resolve(output,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({ versions:summary.versions,rejections:rejected,same_version_merge:'3 versions accepted' },null,2));
