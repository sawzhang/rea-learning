import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const require=createRequire(resolve(root,'upstream/package.json'));const {parse}=require('@babel/parser');
const output=resolve(root,'results/12-async-finally');mkdirSync(output,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const expectations={plain:[['fulfilled','ok'],['fulfilled','ok']],'await-catch':[['fulfilled','ok'],['fulfilled','caught']],'returned-rejection':[['fulfilled','ok'],['rejected','boom']],'finally-normal':[['fulfilled','ok'],['rejected','boom']],'finally-return':[['fulfilled','override'],['fulfilled','override']],'finally-rejection':[['rejected','cleanup'],['rejected','cleanup']]};
const records={};
for(const [version,expected]of Object.entries(expectations)){
 const directory=resolve(root,`labs/12-async-finally/${version}`),path=resolve(directory,'logic.js'),text=readFileSync(path,'utf8');
 const cli=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',directory,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});if(cli.error)throw cli.error;assert.equal(cli.status,0,cli.stderr);const evidence=JSON.parse(cli.stdout);assert.ok(!evidence.error);writeFileSync(resolve(output,`${version}-evidence.json`),JSON.stringify(evidence,null,2));
 const ast=parse(text,{sourceType:'module'}),fn=ast.program.body.map(n=>n.declaration??n).find(n=>n.type==='FunctionDeclaration'&&n.id.name==='evaluate');assert.ok(fn.async);
 const graph=evidence.normalized_result.semantic_graph,node=graph.nodes.find(n=>n.kind==='function'&&n.label==='evaluate'&&n.identity.module_path==='logic.js');assert.equal(node.identity.artifact_sha256,hash(text));
 const astFacts=[];
 function walk(n,context=[]){
  if(!n||typeof n!=='object')return;if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type))return;
  if(n.type==='TryStatement'){astFacts.push({type:n.type,start:n.start,end:n.end,context});walk(n.block,[...context,'try']);if(n.handler)walk(n.handler.body,[...context,'catch']);if(n.finalizer)walk(n.finalizer,[...context,'finally']);return;}
  if(['AwaitExpression','ReturnStatement'].includes(n.type))astFacts.push({type:n.type,start:n.start,end:n.end,text:text.slice(n.start,n.end),context});
  for(const [key,value]of Object.entries(n)){if(['loc','start','end','comments'].includes(key))continue;if(Array.isArray(value))value.forEach(x=>walk(x,context));else if(value&&typeof value==='object'&&value.type)walk(value,context);}
 }
 walk(fn.body);
 const captureDir=mkdtempSync(resolve(output,`${version}-coverage-`));
 const execution=spawnSync(process.execPath,['--unhandled-rejections=strict',resolve(directory,'main.js')],{encoding:'utf8',timeout:10000,env:{...process.env,NODE_V8_COVERAGE:captureDir}});if(execution.error)throw execution.error;assert.equal(execution.status,0,execution.stderr);
 const outcomes=JSON.parse(execution.stdout);assert.deepEqual(outcomes.map(x=>[x.kind,x.value??x.message]),expected);
 for(const result of outcomes){const events=result.events;assert.equal(events[0],'caller-start');assert.ok(events.indexOf('caller-pending')<events.length-1);assert.equal(events.at(-1),result.kind==='fulfilled'?'caller-fulfilled':'caller-rejected');
  if(version!=='plain'){assert.ok(events.indexOf('caller-pending')<events.indexOf('finally-start')||version==='returned-rejection');if(version==='finally-rejection'){assert.ok(!events.includes('finally-end'));}else{assert.ok(events.indexOf('finally-start')<events.indexOf('finally-end'));assert.ok(events.indexOf('caller-pending')<events.indexOf('finally-end'));assert.ok(events.indexOf('finally-end')<events.length-1);}}
 }
 if(version==='await-catch')assert.ok(outcomes[1].events.includes('catch'));
 if(version==='returned-rejection'){assert.ok(outcomes.every(x=>!x.events.includes('catch')));assert.ok(outcomes.every(x=>x.events.indexOf('finally-start')<x.events.indexOf('caller-pending')));}
 const files=readdirSync(captureDir).filter(n=>n.endsWith('.json'));assert.equal(files.length,1);const raw=JSON.parse(readFileSync(resolve(captureDir,files[0]),'utf8')),script=raw.result.find(s=>s.url===pathToFileURL(path).href);assert.ok(script);const coverage=script.functions.filter(f=>f.ranges[0].startOffset===fn.start&&f.ranges[0].endOffset===fn.end);assert.equal(coverage.length,1);assert.equal(coverage[0].ranges[0].count,2);assert.equal(hash(readFileSync(path,'utf8')),hash(text));
 const blocked=astFacts.some(f=>f.type==='AwaitExpression'||f.type==='TryStatement');
 records[version]={source_sha256:hash(text),evidence_id:evidence.evidence_id,function_node_id:node.node_id,range:{startOffset:fn.start,endOffset:fn.end},astFacts,coverage_ranges:coverage[0].ranges,outcomes,migration_status:blocked?'unknown':'historical-control-only',reason:blocked?'async-suspension-or-exception-completion-unmodeled':null,semantic_summary:{nodes:graph.nodes.length,relations:graph.relations.length,unknowns:graph.unknowns.length}};
 assert.equal(blocked,version!=='plain');
}
const source=records.plain;
const sourceReturn=source.astFacts.find(f=>f.type==='ReturnStatement');
const experiments=Object.entries(records).map(([version,r])=>({version,source_evidence_id:source.evidence_id,target_evidence_id:r.evidence_id,reason:r.reason,unmigrated_source:version==='plain'?[]:[{statement:sourceReturn,original_coverage_ranges:source.coverage_ranges}],target_unknown:[{...r.range,count:null,status:'unknown'}],historical_control:version==='plain'?{statement:sourceReturn,count:2,confidence:'analyst-inference',target_execution:'separate-run'}:null,independent_outcomes:r.outcomes}));
const report={authority:'controlled async execution + conservative historical mapping boundary',parser_version:require('@babel/parser/package.json').version,offset_units:'utf16-code-units',records,experiments,limitations:['Event order is fixture-local, not universal scheduling or timing evidence.','Function count does not identify fulfillment/rejection or awaited continuation coverage.','All await/try/catch/finally migration contexts remain unknown.']};
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(experiments.map(e=>({version:e.version,reason:e.reason,outcomes:e.independent_outcomes})),null,2));
