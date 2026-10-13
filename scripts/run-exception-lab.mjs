import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const require=createRequire(resolve(root,'upstream/package.json'));const {parse}=require('@babel/parser');
const output=resolve(root,'results/11-exceptions');mkdirSync(output,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const records={};
const expected={plain:[['returned','ok'],['returned','ok']],'prefix-throw':[['returned','ok'],['threw','boom']],catch:[['returned','ok'],['returned','caught']],'finally-normal':[['returned','ok'],['returned','ok']],'finally-return':[['returned','override'],['returned','override']],'finally-throw':[['threw','finally'],['threw','finally']]};
for(const version of Object.keys(expected)){
 const directory=resolve(root,`labs/11-exceptions/${version}`),path=resolve(directory,'logic.js'),text=readFileSync(path,'utf8');
 const cli=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',directory,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});if(cli.error)throw cli.error;assert.equal(cli.status,0,cli.stderr);
 const evidence=JSON.parse(cli.stdout);assert.ok(!evidence.error);writeFileSync(resolve(output,`${version}-evidence.json`),JSON.stringify(evidence,null,2));
 const ast=parse(text,{sourceType:'module'});const fn=ast.program.body.map(n=>n.declaration??n).find(n=>n.type==='FunctionDeclaration'&&n.id.name==='evaluate');assert.ok(fn);
 const sourceNode=evidence.normalized_result.semantic_graph.nodes.find(n=>n.kind==='function'&&n.label==='evaluate'&&n.identity.module_path==='logic.js');assert.equal(sourceNode.identity.artifact_sha256,hash(text));
 const statements=[];
 function walk(node,context=[]){
  if(!node||typeof node!=='object')return;
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type))return;
  if(node.type==='ReturnStatement'){statements.push({startOffset:node.start,endOffset:node.end,text:text.slice(node.start,node.end),context});return;}
  if(node.type==='TryStatement'){
    walk(node.block,[...context,'try']);if(node.handler)walk(node.handler.body,[...context,'catch']);if(node.finalizer)walk(node.finalizer,[...context,'finally']);return;
  }
  if(node.type==='IfStatement'){walk(node.consequent,[...context,'conditional']);walk(node.alternate,[...context,'conditional']);return;}
  if(node.type==='BlockStatement')node.body.forEach(n=>walk(n,context));
 }
 walk(fn.body);
 const coverageDir=mkdtempSync(resolve(output,`${version}-coverage-`));const execution=spawnSync(process.execPath,[resolve(directory,'main.js')],{encoding:'utf8',timeout:10000,env:{...process.env,NODE_V8_COVERAGE:coverageDir}});if(execution.error)throw execution.error;assert.equal(execution.status,0,execution.stderr);
 const oracle=JSON.parse(execution.stdout);assert.deepEqual(oracle.outputs.map(x=>[x.kind,x.value??x.message]),expected[version]);if(version==='finally-normal')assert.deepEqual(oracle.events,['finally','finally']);
 assert.equal(hash(readFileSync(path,'utf8')),hash(text));
 const files=readdirSync(coverageDir).filter(n=>n.endsWith('.json'));assert.equal(files.length,1);const raw=JSON.parse(readFileSync(resolve(coverageDir,files[0]),'utf8'));const script=raw.result.find(s=>s.url===pathToFileURL(path).href);assert.ok(script);
 const coverage=script.functions.filter(f=>f.ranges[0].startOffset===fn.start&&f.ranges[0].endOffset===fn.end);assert.equal(coverage.length,1);assert.equal(coverage[0].ranges[0].count,2);
 const prefix=fn.body.body.slice(0,fn.body.body.findIndex(n=>n.type==='ReturnStatement')).map(n=>n.type);
 records[version]={source_sha256:hash(text),evidence_id:evidence.evidence_id,function_node_id:sourceNode.node_id,function_range:{startOffset:fn.start,endOffset:fn.end},statements,prefix,coverage_ranges:coverage[0].ranges,oracle};
}
const source=records.plain;const old=source.statements[0];const experiments=[];
for(const [version,target]of Object.entries(records)){
 const textCandidates=target.statements.filter(s=>s.text===old.text);
 const blockedByTry=target.statements.some(s=>s.context.some(c=>['try','catch','finally'].includes(c)));
 const nonReturnPrefix=target.prefix.length>0;
 const accepted=!blockedByTry&&!nonReturnPrefix&&textCandidates.length===1&&textCandidates[0].context.length===0;
 const reason=blockedByTry?'exception-completion-context-unsupported':nonReturnPrefix?'prefix-call-may-throw':accepted?null:'no-unique-safe-return';
 const mapping=accepted?{source_range:old,target_range:textCandidates[0],historical_ranges:source.coverage_ranges.map(r=>({startOffset:Math.max(old.startOffset,r.startOffset),endOffset:Math.min(old.endOffset,r.endOffset),count:r.count})).filter(r=>r.startOffset<r.endOffset),source_evidence_id:source.evidence_id,target_evidence_id:target.evidence_id,confidence:'analyst-inference',target_execution:'independent-coverage-only'}:null;
 const unknown=accepted?[
 {startOffset:target.function_range.startOffset,endOffset:textCandidates[0].startOffset,count:null,status:'unknown'},
 {startOffset:textCandidates[0].endOffset,endOffset:target.function_range.endOffset,count:null,status:'unknown'}
 ]:[{...target.function_range,count:null,status:'unknown'}];
 experiments.push({version,source_sha256:source.source_sha256,target_sha256:target.source_sha256,target_evidence_id:target.evidence_id,mapping,reason,text_candidates:textCandidates,source_unknown:accepted?[{startOffset:source.function_range.startOffset,endOffset:old.startOffset,count:null,status:'unknown'},{startOffset:old.endOffset,endOffset:source.function_range.endOffset,count:null,status:'unknown'}]:[{...source.function_range,count:null,status:'unknown'}],unmigrated_source:accepted?[]:[{...old,original_coverage_ranges:source.coverage_ranges}],target_unknown:unknown,observed_function_count:2,independent_outputs:target.oracle});
 assert.equal(Boolean(mapping),version==='plain');
}
assert.equal(records['finally-return'].statements[0].text,old.text);
assert.ok(experiments.find(x=>x.version==='finally-normal').reason);
assert.equal(records['finally-throw'].statements[0].text,old.text);
const report={authority:'analyst historical mapping with separate controlled execution coverage',parser_version:require('@babel/parser/package.json').version,offset_units:'utf16-code-units',records,experiments,limitations:['Function coverage does not prove pending return was delivered to caller.','try/catch/finally completion semantics are intentionally not migrated.','Whole target function remains unknown when exceptional context cannot be modeled.']};
writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(experiments.map(x=>({version:x.version,mapped:!!x.mapping,reason:x.reason,count:x.observed_function_count,outputs:x.independent_outputs})),null,2));
