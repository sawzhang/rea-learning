import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'upstream/package.json'));const {parse}=require('@babel/parser');
const output=resolve(root,'results/10-fallthrough');mkdirSync(output,{recursive:true});
const collected=spawnSync(process.execPath,[resolve(root,'scripts/run-coverage-lab.mjs')],{encoding:'utf8',timeout:60000,maxBuffer:64*1024*1024});
if(collected.error)throw collected.error;assert.equal(collected.status,0,collected.stderr);
const coverage=JSON.parse(readFileSync(resolve(root,'results/05-function-coverage/report.json'),'utf8'));
const source=readFileSync(resolve(root,'labs/05-function-coverage/target/logic.js'),'utf8');
const digest=text=>createHash('sha256').update(text).digest('hex');assert.equal(digest(source),coverage.source_sha256);
function analyze(text){
 const ast=parse(text,{sourceType:'module'});const fn=ast.program.body.map(n=>n.declaration??n).find(n=>n.type==='FunctionDeclaration'&&n.id.name==='choose');assert.ok(fn);
 const returns=[],unknown=[];const literal=n=>text.slice(n.start,n.end);
 function terminal(n){return n?.type==='ReturnStatement'||(n?.type==='BlockStatement'&&n.body.length===1&&n.body[0].type==='ReturnStatement');}
 function statement(n,guards,effects){
   if(n.type==='ReturnStatement'){returns.push({start:n.start,end:n.end,text:literal(n),guards,effects});return;}
   if(n.type==='BlockStatement'){sequence(n.body,guards,effects);return;}
   unknown.push({start:n.start,end:n.end,reason:'unsupported-branch-body'});
 }
 function sequence(body,initialGuards,initialEffects){
   let guards=[...initialGuards],effects=[...initialEffects];
   for(let i=0;i<body.length;i++){
    const n=body[i];
    if(n.type==='ReturnStatement'){statement(n,guards,effects);for(const later of body.slice(i+1))unknown.push({start:later.start,end:later.end,reason:'after-unconditional-return'});break;}
    if(n.type==='IfStatement'){
      const test=literal(n.test);
      if(!terminal(n.consequent)||(n.alternate&&!terminal(n.alternate))){unknown.push({start:n.start,end:fn.end,reason:'unsupported-fallthrough-control'});break;}
      statement(n.consequent,[...guards,{test,outcome:true,basis:'direct-if'}],effects);
      if(n.alternate){statement(n.alternate,[...guards,{test,outcome:false,basis:'direct-else'}],effects);for(const later of body.slice(i+1))unknown.push({start:later.start,end:later.end,reason:'after-both-branches-return'});break;}
      guards=[...guards,{test,outcome:false,basis:'fallthrough-after-returning-consequent'}];continue;
    }
    if(n.type==='ExpressionStatement'||n.type==='VariableDeclaration'){effects=[...effects,literal(n)];continue;}
    unknown.push({start:n.start,end:fn.end,reason:'unsupported-prefix-control'});break;
   }
 }
 sequence(fn.body.body,[],[]);return {start:fn.start,end:fn.end,returns,unknown};
}
const old=analyze(source),item=coverage.scenarios.baseline.items.find(n=>n.name==='choose');assert.deepEqual([old.start,old.end],[item.ranges[0].startOffset,item.ranges[0].endOffset]);
assert.equal(old.returns[1].guards[0].outcome,false);
function complement(start,end,spans){const gaps=[];let cursor=start;for(const s of [...spans].sort((a,b)=>a.start-b.start)){assert.ok(s.start>=cursor);if(cursor<s.start)gaps.push({startOffset:cursor,endOffset:s.start,count:null,status:'unknown'});cursor=s.end;}if(cursor<end)gaps.push({startOffset:cursor,endOffset:end,count:null,status:'unknown'});return gaps;}
const experiments=[];
for(const [version,expected]of [['comment',['positive','non-positive','non-positive']],['guard',['positive','positive','non-positive']],['early',['positive','zero','non-positive']],['assignment',['non-positive','non-positive','non-positive']],['stop',['stopped','stopped','stopped']]]){
 const directory=resolve(root,`labs/10-fallthrough/${version}`),text=readFileSync(resolve(directory,'logic.js'),'utf8'),target=analyze(text);
 const cli=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',directory,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});if(cli.error)throw cli.error;assert.equal(cli.status,0,cli.stderr);
 const evidence=JSON.parse(cli.stdout);assert.ok(!evidence.error);writeFileSync(resolve(output,`${version}-evidence.json`),JSON.stringify(evidence,null,2));
 const targetFunction=evidence.normalized_result.semantic_graph.nodes.find(n=>n.kind==='function'&&n.identity.module_path==='logic.js'&&n.label==='choose');assert.equal(targetFunction.identity.artifact_sha256,digest(text));
 const key=n=>JSON.stringify([n.text,n.guards,n.effects]);
 const mappings=[],rejections=[];
 for(const node of old.returns){
  const candidates=target.returns.filter(n=>key(n)===key(node));
  if(candidates.length!==1||old.returns.filter(n=>key(n)===key(node)).length!==1){rejections.push({source_range:node,reason:'control-context-or-prefix-effects-differ',text_candidates:target.returns.filter(n=>n.text===node.text),original_coverage_ranges:item.ranges});continue;}
  const next=candidates[0];const points=[...new Set([node.start,node.end,...item.ranges.flatMap(r=>[r.startOffset,r.endOffset]).filter(p=>p>node.start&&p<node.end)])].sort((a,b)=>a-b);
  const ranges=points.slice(0,-1).map((start,i)=>{const end=points[i+1],containing=item.ranges.filter(r=>r.startOffset<=start&&r.endOffset>=end).sort((a,b)=>(a.endOffset-a.startOffset)-(b.endOffset-b.startOffset));assert.ok(containing.length);return {source_range:{startOffset:start,endOffset:end},target_range:{startOffset:next.start+start-node.start,endOffset:next.start+end-node.start},historical_count:containing[0].count};});
  mappings.push({source_statement:node,target_statement:next,ranges,basis:'unique exact return + explicit/implicit guard chain + prefix effect text',confidence:'analyst-inference',target_execution:'not-established-by-migration'});
 }
 const captureDir=mkdtempSync(resolve(output,`${version}-coverage-`));
 const executed=spawnSync(process.execPath,[resolve(directory,'main.js')],{encoding:'utf8',timeout:10000,env:{...process.env,NODE_V8_COVERAGE:captureDir}});if(executed.error)throw executed.error;assert.equal(executed.status,0,executed.stderr);const oracle=JSON.parse(executed.stdout);assert.deepEqual(oracle,expected);assert.equal(digest(readFileSync(resolve(directory,'logic.js'),'utf8')),digest(text));
 assert.equal(mappings.length,version==='comment'?2:0);
 experiments.push({version,source_sha256:digest(source),target_sha256:digest(text),source_evidence_id:coverage.static_evidence_id,target_evidence_id:evidence.evidence_id,mappings,rejections,source_unmapped:complement(old.start,old.end,mappings.map(m=>m.source_statement)),target_unknown:complement(target.start,target.end,mappings.map(m=>m.target_statement)),parser_unknown:target.unknown,independent_target_outputs:oracle});
}
const unsupported=analyze(source.replace("  if (value > 0)","  while (value < 0) value++;\n  if (value > 0)"));assert.equal(unsupported.returns.length,0);assert.ok(unsupported.unknown.some(n=>n.reason==='unsupported-prefix-control'));
const result={authority:'analyst historical projection with restricted fallthrough model',parser_version:require('@babel/parser/package.json').version,offset_units:'utf16-code-units',experiments,unsupported_control_rejected:unsupported.unknown,limitations:['No general CFG or dataflow equivalence proof.','Prefix effects are text commitments, not evaluated semantics.','Fresh target coverage is separate and never upgrades historical migration authority.']};
writeFileSync(resolve(output,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(experiments.map(e=>({version:e.version,mapped:e.mappings.length,rejected:e.rejections.length,outputs:e.independent_target_outputs})),null,2));
