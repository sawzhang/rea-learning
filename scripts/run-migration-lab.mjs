import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root,'results/08-coverage-migration');
mkdirSync(output,{recursive:true});
const fresh = spawnSync(process.execPath,[resolve(root,'scripts/run-identity-lab.mjs')],{encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});
if (fresh.error) throw fresh.error;
writeFileSync(resolve(output,'collection.log'),fresh.stdout ?? '');
assert.equal(fresh.status,0,fresh.stderr);
const duplicateRoot = resolve(root,'labs/08-coverage-migration/v4-duplicate');
const analyzed = spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',duplicateRoot,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});
if (analyzed.error) throw analyzed.error;
assert.equal(analyzed.status,0,analyzed.stderr);
const duplicate = JSON.parse(analyzed.stdout); assert.ok(!duplicate.error);
writeFileSync(resolve(output,'v4-application.json'),JSON.stringify(duplicate,null,2));
function model(version) {
  const special = version.startsWith('v4-') || version.startsWith('v5-');
  const directory = special ? resolve(root,`labs/08-coverage-migration/${version}`) : resolve(root,`labs/07-cross-version-identity/${version}`);
  let extra;
  if (version==='v5-rename') {
    const result=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',directory,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});
    if(result.error) throw result.error; assert.equal(result.status,0,result.stderr);
    extra=JSON.parse(result.stdout);assert.ok(!extra.error);writeFileSync(resolve(output,'v5-application.json'),JSON.stringify(extra,null,2));
  }
  const app = special ? (extra ?? duplicate) : JSON.parse(readFileSync(resolve(root,`results/07-cross-version-identity/${version}/application.json`),'utf8'));
  const source = readFileSync(resolve(directory,'logic.js'),'utf8');
  const digest = createHash('sha256').update(source).digest('hex');
  const graph = app.normalized_result.semantic_graph;
  const offset = p => source.split('\n').slice(0,p.line-1).reduce((sum,line)=>sum+line.length+1,0)+p.column;
  const functions = graph.nodes.filter(n=>n.kind==='function'&&n.identity.module_path==='logic.js').map(node=>{
    assert.equal(node.identity.artifact_sha256,digest);
    const fp = graph.fingerprints.find(f=>f.function_node_id===node.node_id);
    const start=offset(node.identity.source_range.start),end=offset(node.identity.source_range.end);
    return {id:node.node_id,name:node.label,start,end,text:source.slice(start,end),fingerprint:fp?.fingerprint_sha256,status:fp?.status,algorithm:fp?.algorithm};
  });
  return {version,evidence_id:app.evidence_id,digest,functions};
}
const source = model('v1');
const coverage = JSON.parse(readFileSync(resolve(root,'results/07-cross-version-identity/v1/report.json'),'utf8'));
assert.equal(coverage.source_sha256,source.digest);
const oldItems = coverage.scenarios.baseline.items;
function migrate(target) {
  const mappings=[],unmigrated=[];
  for (const old of source.functions) {
    const item=oldItems.find(item=>item.static_node_id===old.id); assert.ok(item);
    assert.deepEqual([item.ranges[0].startOffset,item.ranges[0].endOffset],[old.start,old.end]);
    const candidates=target.functions.filter(n=>n.status==='complete'&&old.status==='complete'&&n.algorithm===old.algorithm&&n.fingerprint===old.fingerprint);
    const sourceCount=source.functions.filter(n=>n.status==='complete'&&n.fingerprint===old.fingerprint&&n.algorithm===old.algorithm).length;
    const basis={algorithm:old.algorithm,fingerprint_sha256:old.fingerprint,source_status:old.status,candidate_target_ids:candidates.map(n=>n.id),source_evidence_id:source.evidence_id,target_evidence_id:target.evidence_id};
    if (sourceCount!==1||candidates.length!==1) {
      unmigrated.push({source_id:old.id,name:old.name,reason:candidates.length||sourceCount>1?'ambiguous-fingerprint':'no-complete-fingerprint-match',basis,ranges:item.ranges,target_execution:'unknown'}); continue;
    }
    const next=candidates[0];
    if (old.text!==next.text) { unmigrated.push({source_id:old.id,name:old.name,reason:'function-text-differs',basis,ranges:item.ranges,target_execution:'unknown'}); continue; }
    const delta=next.start-old.start;
    const ranges=item.ranges.map(r=>{assert.ok(r.startOffset>=old.start&&r.endOffset<=old.end);return {source_range:r,target_range:{startOffset:r.startOffset+delta,endOffset:r.endOffset+delta},historical_count:r.count};});
    mappings.push({source_id:old.id,target_id:next.id,name:old.name,basis:{...basis,function_text_sha256:createHash('sha256').update(old.text).digest('hex'),range_mapping:'exact-identical-function-text + UTF-16 translation',confidence:'inferred'},delta,ranges,target_execution:'not-established-by-migration'});
  }
  const mapped=new Set(mappings.map(m=>m.target_id));
  return {source_version:'v1',target_version:target.version,source_sha256:source.digest,target_sha256:target.digest,mappings,unmigrated,target_without_migrated_coverage:target.functions.filter(n=>!mapped.has(n.id)).map(n=>({id:n.id,name:n.name,startOffset:n.start,endOffset:n.end,count:null,status:'unknown'}))};
}
const comment=migrate(model('v2-comment'));
assert.equal(comment.mappings.length,3);assert.equal(comment.unmigrated.length,0);
assert.ok(comment.mappings.every(m=>m.delta===17));
const behavior=migrate(model('v3-behavior'));
assert.equal(behavior.mappings.length,2);assert.equal(behavior.unmigrated.length,1);
assert.equal(behavior.unmigrated[0].name,'double');
assert.equal(behavior.unmigrated[0].reason,'no-complete-fingerprint-match');
const ambiguous=migrate(model('v4-duplicate'));
assert.equal(ambiguous.mappings.length,2);assert.equal(ambiguous.unmigrated[0].name,'unused');
assert.equal(ambiguous.unmigrated[0].basis.candidate_target_ids.length,2);
assert.equal(ambiguous.target_without_migrated_coverage.length,2);
const renamed=migrate(model('v5-rename'));
assert.equal(renamed.mappings.length,2);assert.equal(renamed.unmigrated[0].reason,'function-text-differs');
assert.equal(renamed.unmigrated[0].basis.candidate_target_ids.length,1);
const result={authority:'analyst historical coverage migration, not target execution Evidence',offset_units:'utf16-code-units',experiments:[comment,behavior,ambiguous,renamed]};
writeFileSync(resolve(output,'report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result.experiments.map(x=>({target:x.target_version,mapped:x.mappings.length,unmigrated:x.unmigrated.map(u=>({name:u.name,reason:u.reason,candidates:u.basis.candidate_target_ids.length}))})),null,2));
