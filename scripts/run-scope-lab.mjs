import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(root,'results/18-upstream-scope');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(root,'upstream/package.json')), {parse}=require('@babel/parser');
const hash=x=>createHash('sha256').update(x).digest('hex');
const upstreamCommit=spawnSync('git',['-C',resolve(root,'upstream'),'rev-parse','HEAD'],{encoding:'utf8'});assert.equal(upstreamCommit.status,0);assert.equal(upstreamCommit.stdout.trim(),'c22111eca2c4bc84a084f12711f405b3e7422a40');
const directory=resolve(root,'labs/18-upstream-scope'),path=resolve(directory,'logic.js'),source=readFileSync(path,'utf8');
const cli=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',directory,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});if(cli.error)throw cli.error;assert.equal(cli.status,0,cli.stderr);const evidence=JSON.parse(cli.stdout);assert.ok(!evidence.error);writeFileSync(resolve(output,'evidence.json'),cli.stdout);writeFileSync(resolve(output,'stderr.log'),cli.stderr);
const ast=parse(source,{sourceType:'module'}),observer=ast.program.body.map(n=>n.declaration).find(n=>n?.id?.name==='observeCleanup'),graph=evidence.normalized_result.semantic_graph,node=graph.nodes.find(n=>n.kind==='function'&&n.label==='observeCleanup'&&n.identity.module_path==='logic.js');assert.equal(node.identity.artifact_sha256,hash(source));
const coverageDir=mkdtempSync(resolve(output,'coverage-')),run=spawnSync(process.execPath,['--unhandled-rejections=strict',resolve(directory,'main.js')],{encoding:'utf8',timeout:10000,env:{...process.env,NODE_V8_COVERAGE:coverageDir}});if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);const reports=JSON.parse(run.stdout);assert.equal(reports.length,2);writeFileSync(resolve(output,'runtime.json'),run.stdout);
for(const r of reports){
 assert.equal(r.closeOutcome.status,r.permanent?'rejected':'fulfilled');if(r.permanent)assert.deepEqual(r.closeOutcome.cleanup.resources,['B']);assert.deepEqual(r.seed,['failed','failed']);assert.equal(r.closed,'rejected');assert.equal(r.admission,r.permanent?0:1);
 for(const [i,w] of r.waves.entries()){
  assert.equal(w.samePromise,true);assert.equal(w.before[0].calls,2);assert.equal(w.before[0].released,true);assert.equal(w.before[1].calls,i+2);assert.equal(w.before[1].gated,true);
  const failed=r.permanent||i===0;assert.ok(w.outcomes.every(o=>o.status===(failed?'rejected':'fulfilled')));
  if(failed){assert.equal(w.sameFailure,true);for(const o of w.outcomes)assert.deepEqual(o.cleanup.resources,['B']);assert.equal(w.after[1].ownership,'adapter-owner');}
 }
 assert.equal(r.final[0].calls,2);assert.equal(r.final[1].calls,r.permanent?4:3);assert.equal(r.final[1].released,!r.permanent);assert.equal(r.events.filter(e=>e==='observer-finally').length,4);
}
const files=readdirSync(coverageDir).filter(n=>n.endsWith('.json'));assert.equal(files.length,1);const raw=JSON.parse(readFileSync(resolve(coverageDir,files[0]),'utf8')),script=raw.result.find(s=>s.url===pathToFileURL(path).href),coverage=script.functions.find(f=>f.ranges[0].startOffset===observer.start&&f.ranges[0].endOffset===observer.end);assert.equal(coverage.ranges[0].count,8);assert.equal(hash(readFileSync(path,'utf8')),hash(source));
const previous=readFileSync(resolve(root,'labs/17-cleanup-inflight/coalesced/logic.js'),'utf8'),previousObserver=parse(previous,{sourceType:'module'}).program.body.map(n=>n.declaration).find(n=>n?.id?.name==='observeCleanup');
const report={upstream_commit:upstreamCommit.stdout.trim(),upstream_source_sha256:hash(readFileSync(resolve(root,'upstream/src/artifacts/ArtifactResourceScope.ts'))),executed_module_sha256:hash(readFileSync(resolve(root,'upstream/dist/artifacts/ArtifactResourceScope.js'))),node:process.version,evidence_id:evidence.evidence_id,logic_sha256:hash(source),semantic_unknowns:graph.unknowns,reports,observer_coverage:coverage,migration:{status:'unknown',reason:'changed-observer-and-real-scope-multi-owner-context',source_sha256:hash(previous),unmigrated_source_ast_range:{startOffset:previousObserver.start,endOffset:previousObserver.end},target_unknown:[{startOffset:observer.start,endOffset:observer.end,count:null,status:'unknown'}]},limitations:['Controlled reader.close adapters, not real OS handles.','Private pending state inferred from public cleanup outcomes and later close calls, not directly inspected.','Prior coverage is not copied into this target.']};
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({reports,migration:report.migration},null,2));
