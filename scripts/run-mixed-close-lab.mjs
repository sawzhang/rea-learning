import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(root,'results/31-mixed-close');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(root,'upstream/package.json')), {parse}=require('@babel/parser');
const hash=x=>createHash('sha256').update(x).digest('hex');
const upstreamCommit=spawnSync('git',['-C',resolve(root,'upstream'),'rev-parse','HEAD'],{encoding:'utf8'});assert.equal(upstreamCommit.status,0);assert.equal(upstreamCommit.stdout.trim(),'c22111eca2c4bc84a084f12711f405b3e7422a40');
const directory=resolve(root,'labs/31-mixed-close'),path=resolve(directory,'logic.js'),source=readFileSync(path,'utf8');
const cli=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',directory,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});if(cli.error)throw cli.error;assert.equal(cli.status,0,cli.stderr);const evidence=JSON.parse(cli.stdout);assert.ok(!evidence.error);writeFileSync(resolve(output,'evidence.json'),cli.stdout);writeFileSync(resolve(output,'stderr.log'),cli.stderr);
const ast=parse(source,{sourceType:'module'}),observer=ast.program.body.map(n=>n.declaration).find(n=>n?.id?.name==='observeCleanup'),graph=evidence.normalized_result.semantic_graph,node=graph.nodes.find(n=>n.kind==='function'&&n.label==='observeCleanup'&&n.identity.module_path==='logic.js');assert.equal(node.identity.artifact_sha256,hash(source));
const coverageDir=mkdtempSync(resolve(output,'coverage-')),run=spawnSync(process.execPath,['--unhandled-rejections=strict',resolve(directory,'main.js')],{encoding:'utf8',timeout:10000,env:{...process.env,NODE_V8_COVERAGE:coverageDir}});if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);const reports=JSON.parse(run.stdout);writeFileSync(resolve(output,'runtime.json'),run.stdout);
assert.deepEqual(reports.rounds,[
 {status:'rejected',resources:['a.js','c.js'],causes:['injected:a.js','injected:c.js'],trace:[
  {name:'a.js',beforeValid:true,afterValid:false},{name:'b.js',beforeValid:true,afterValid:false},{name:'c.js',beforeValid:true,afterValid:true}]},
 {status:'rejected',resources:['a.js'],causes:['injected:a.js'],trace:[
  {name:'a.js',beforeValid:false,afterValid:false},{name:'c.js',beforeValid:true,afterValid:false}]},
 {status:'rejected',resources:['a.js'],causes:['injected:a.js'],trace:[{name:'a.js',beforeValid:false,afterValid:false}]},
]);
assert.deepEqual(reports.events,Array(3).fill('observer-finally'));
const files=readdirSync(coverageDir).filter(n=>n.endsWith('.json'));assert.equal(files.length,1);const raw=JSON.parse(readFileSync(resolve(coverageDir,files[0]),'utf8')),script=raw.result.find(s=>s.url===pathToFileURL(path).href),coverage=script.functions.find(f=>f.ranges[0].startOffset===observer.start&&f.ranges[0].endOffset===observer.end);assert.equal(coverage.ranges[0].count,3);assert.equal(hash(readFileSync(path,'utf8')),hash(source));
const previous=readFileSync(resolve(root,'labs/30-stream-sticky/logic.js'),'utf8'),previousObserver=parse(previous,{sourceType:'module'}).program.body.map(n=>n.declaration).find(n=>n?.id?.name==='observeCleanup');
assert.equal(previous.slice(previousObserver.start,previousObserver.end),source.slice(observer.start,observer.end));
const report={upstream_commit:upstreamCommit.stdout.trim(),upstream_source_sha256:hash(readFileSync(resolve(root,'upstream/src/artifacts/DirectoryArtifactReader.ts'))),owner_source_sha256:hash(readFileSync(resolve(root,'upstream/src/filesystem/OwnedFileHandle.ts'))),executed_module_sha256:hash(readFileSync(resolve(root,'upstream/dist/artifacts/DirectoryArtifactReader.js'))),executed_owner_sha256:hash(readFileSync(resolve(root,'upstream/dist/filesystem/OwnedFileHandle.js'))),node:process.version,evidence_id:evidence.evidence_id,logic_sha256:hash(source),semantic_unknowns:graph.unknowns,reports,observer_coverage:coverage,migration:{status:'unknown',reason:'identical-observer-but-mixed-file-outcomes-changed',source_sha256:hash(previous),unmigrated_source_ast_range:{startOffset:previousObserver.start,endOffset:previousObserver.end},target_unknown:[{startOffset:observer.start,endOffset:observer.end,count:null,status:'unknown'}]},limitations:['Real temporary file handles; faults injected before or after actual close; no OS failure.','Private maps inferred from public close outcomes and owner dispatch, not directly inspected.','Prior coverage is not copied into this target.']};
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({reports,migration:report.migration},null,2));
