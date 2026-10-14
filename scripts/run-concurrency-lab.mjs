import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(root,'results/13-promise-ownership');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(root,'upstream/package.json'));const {parse}=require('@babel/parser');
const hash=text=>createHash('sha256').update(text).digest('hex');const models={};
for(const mode of ['all','race']){
 const directory=resolve(root,`labs/13-promise-ownership/${mode}`),path=resolve(directory,'logic.js'),source=readFileSync(path,'utf8');
 const analyzed=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',directory,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});if(analyzed.error)throw analyzed.error;assert.equal(analyzed.status,0,analyzed.stderr);const evidence=JSON.parse(analyzed.stdout);assert.ok(!evidence.error);writeFileSync(resolve(output,`${mode}-evidence.json`),JSON.stringify(evidence,null,2));
 const ast=parse(source,{sourceType:'module'});const declarations=ast.program.body.map(n=>n.declaration??n);const consumeAst=declarations.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='consume');const factory=declarations.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='createTasks');const declaration=factory.body.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].id.name==='aggregate');const call=declaration.declarations[0].init;assert.equal(call.type,'CallExpression');assert.equal(call.callee.object.name,'Promise');assert.equal(call.callee.property.name,mode);
 const astPolicy={method:mode,range:{startOffset:call.start,endOffset:call.end},text:source.slice(call.start,call.end),consume_text:source.slice(consumeAst.start,consumeAst.end),consume_range:{startOffset:consumeAst.start,endOffset:consumeAst.end},inputs:call.arguments[0].elements.map(n=>n.name)};assert.deepEqual(astPolicy.inputs,['a','b']);
 const graph=evidence.normalized_result.semantic_graph;
 const aggregates=graph.nodes.filter(n=>n.properties.operation_kind==='aggregate');
 if(mode==='all')assert.ok(aggregates.some(n=>n.properties.method==='all'),'Supported all must retain aggregator');
 else assert.ok(!aggregates.some(n=>n.properties.method==='race'),'Pinned extractor does not model race aggregation');
 const coverageDir=mkdtempSync(resolve(output,`${mode}-coverage-`));
 const executed=spawnSync(process.execPath,['--unhandled-rejections=strict',resolve(directory,'main.js')],{encoding:'utf8',timeout:10000,env:{...process.env,NODE_V8_COVERAGE:coverageDir}});if(executed.error)throw executed.error;assert.equal(executed.status,0,executed.stderr);
 const reports=JSON.parse(executed.stdout);assert.equal(reports.length,3);
 for(const report of reports){
  const expected=report.scenario==='B-first'?{kind:'fulfilled',value:mode==='all'?['A','B']:'B'}:report.scenario==='A-reject-first'?{kind:'rejected',message:'A-boom'}:mode==='all'?{kind:'rejected',message:'B-late'}:{kind:'fulfilled',value:'A'};
  assert.deepEqual(report.outcome,expected);
  const settledFirst=mode==='race'||report.scenario==='A-reject-first';assert.equal(report.afterFirst.outcome!==null,settledFirst);
  if(settledFirst)assert.deepEqual(report.afterFirst.outcome,expected);
  assert.equal(report.events.filter(e=>e==='owner-finally').length,1);
  assert.ok(report.events.indexOf('owner-finally')<report.events.indexOf(`owner:${expected.kind}`));
  const second=report.scenario==='B-first'?'A':'B';const secondSettlement=`${second}:${report.scenario==='A-win-B-late-reject'?'rejected':'fulfilled'}`;
  assert.ok(report.events.includes(secondSettlement),'Unfinished task must still settle; aggregator does not cancel it');
  if(settledFirst)assert.ok(report.events.indexOf(`owner:${expected.kind}`)<report.events.indexOf(secondSettlement));
 }
 assert.equal(hash(readFileSync(path,'utf8')),hash(source));
 const files=readdirSync(coverageDir).filter(n=>n.endsWith('.json'));assert.equal(files.length,1);const raw=JSON.parse(readFileSync(resolve(coverageDir,files[0]),'utf8')),script=raw.result.find(s=>s.url===pathToFileURL(path).href);assert.ok(script);
 const consume=script.functions.filter(fn=>fn.functionName==='consume');assert.equal(consume.length,1);assert.equal(consume[0].ranges[0].count,3);
 models[mode]={ast_policy:astPolicy,source_sha256:hash(source),evidence_id:evidence.evidence_id,static_aggregation_status:mode==='all'?'modeled':'race-not-modeled-by-pinned-extractor',static_aggregates:aggregates,static_ownership_relations:graph.relations.filter(r=>['aggregates','awaits','owns','returns'].includes(r.relation)),semantic_unknowns:graph.unknowns,consume_coverage:consume[0],reports};
}
assert.notEqual(models.all.source_sha256,models.race.source_sha256);
assert.equal(models.all.ast_policy.consume_text,models.race.ast_policy.consume_text,'Same consumer text must not erase external aggregation policy');
const result={authority:'controlled task settlement logs + conservative historical mapping boundary',models,migration:{status:'unknown',reason:'aggregation-policy-and-task-completion-ownership-differ',source_evidence_id:models.all.evidence_id,target_evidence_id:models.race.evidence_id,original_coverage_ranges:models.all.consume_coverage.ranges,unmigrated_source:[{...models.all.consume_coverage.ranges[0],status:'unmigrated'}],target_unknown:[{startOffset:models.race.consume_coverage.ranges[0].startOffset,endOffset:models.race.consume_coverage.ranges[0].endOffset,count:null,status:'unknown'}],ast_policy_comparison:{source:models.all.ast_policy,target:models.race.ast_policy},basis:'Identical consume text does not bind aggregation policy in createTasks.'},limitations:['Caller-controlled settlement order, not timer-race sampling.','Static promise ownership is not cancellation authority or proof of runtime task completion.','Fresh runtime counts never authorize historical migration across all/race policy.']};
writeFileSync(resolve(output,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({outcomes:Object.fromEntries(Object.entries(models).map(([mode,m])=>[mode,m.reports.map(r=>({scenario:r.scenario,first:r.afterFirst.outcome,final:r.outcome}))])),migration:result.migration},null,2));
