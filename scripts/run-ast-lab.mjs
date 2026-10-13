import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'upstream/package.json'));
const { parse }=require('@babel/parser');
const output=resolve(root,'results/09-ast-intervals');mkdirSync(output,{recursive:true});
// Recollect versioned source coverage, including the previous identity checks.
const capture=spawnSync(process.execPath,[resolve(root,'scripts/run-identity-lab.mjs')],{encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});
if(capture.error) throw capture.error;assert.equal(capture.status,0,capture.stderr);
writeFileSync(resolve(output,'collection.log'),capture.stdout);
const targetRoot=resolve(root,'labs/09-ast-intervals/target');
const cli=spawnSync(process.execPath,[resolve(root,'upstream/scripts/rea.mjs'),'analyze-javascript-application',targetRoot,'--json'],{encoding:'utf8',timeout:30000,maxBuffer:64*1024*1024});
if(cli.error) throw cli.error;assert.equal(cli.status,0,cli.stderr);
const targetEvidence=JSON.parse(cli.stdout);assert.ok(!targetEvidence.error);
writeFileSync(resolve(output,'target-evidence.json'),JSON.stringify(targetEvidence,null,2));
const sourceEvidence=JSON.parse(readFileSync(resolve(root,'results/07-cross-version-identity/v1/application.json'),'utf8'));
const coverage=JSON.parse(readFileSync(resolve(root,'results/07-cross-version-identity/v1/report.json'),'utf8'));
const sourceText=readFileSync(resolve(root,'labs/07-cross-version-identity/v1/logic.js'),'utf8');
const targetText=readFileSync(resolve(targetRoot,'logic.js'),'utf8');
const digest=text=>createHash('sha256').update(text).digest('hex');
assert.equal(digest(sourceText),coverage.source_sha256);
function inventory(text) {
  const ast=parse(text,{sourceType:'module'});
  const functions=[];
  for(const declaration of ast.program.body) {
    const fn=declaration.type==='ExportNamedDeclaration'?declaration.declaration:declaration;
    if(fn?.type!=='FunctionDeclaration') continue;
    const returns=[];
    function walk(node,guards=[]) {
      if(!node||typeof node!=='object')return;
      if(node.type==='FunctionDeclaration'||node.type==='FunctionExpression'||node.type==='ArrowFunctionExpression')return;
      if(node.type==='ReturnStatement') {returns.push({start:node.start,end:node.end,text:text.slice(node.start,node.end),guards});return;}
      if(node.type==='IfStatement') {
        walk(node.consequent,[...guards,{branch:'consequent',test:text.slice(node.test.start,node.test.end)}]);
        walk(node.alternate,[...guards,{branch:'alternate',test:text.slice(node.test.start,node.test.end)}]);return;
      }
      if(node.type==='BlockStatement') node.body.forEach(n=>walk(n,guards));
      // All other control constructs stay unknown; no descent into loops/try/switch.
    }
    walk(fn.body);
    functions.push({name:fn.id.name,parameters:fn.params.map(p=>text.slice(p.start,p.end)),start:fn.start,end:fn.end,returns});
  }
  return functions;
}
const src=inventory(sourceText),dst=inventory(targetText);
const items=coverage.scenarios.baseline.items;
function match(oldFn,nextFn) {
  const key=n=>JSON.stringify([n.text,n.guards]);
  return oldFn.returns.map(node=>{
    const candidates=nextFn.returns.filter(n=>key(n)===key(node));
    const sourceCount=oldFn.returns.filter(n=>key(n)===key(node)).length;
    return {node,candidates,matched:sourceCount===1&&candidates.length===1};
  });
}
const mappings=[],unmapped_source=[],unknown_target=[];
for(const fn of src) {
  const candidates=dst.filter(n=>n.name===fn.name&&JSON.stringify(n.parameters)===JSON.stringify(fn.parameters));
  assert.equal(candidates.length,1,'Fixture function anchor must be unique');
  const next=candidates[0];
  const item=items.find(n=>n.name===fn.name);assert.ok(item);
  assert.deepEqual([fn.start,fn.end],[item.ranges[0].startOffset,item.ranges[0].endOffset]);
  const sourceNode=sourceEvidence.normalized_result.semantic_graph.nodes.find(n=>n.node_id===item.static_node_id);assert.equal(sourceNode.identity.artifact_sha256,digest(sourceText));
  const targetNode=targetEvidence.normalized_result.semantic_graph.nodes.find(n=>n.kind==='function'&&n.identity.module_path==='logic.js'&&n.label===fn.name);assert.equal(targetNode.identity.artifact_sha256,digest(targetText));
  const accepted=match(fn,next).filter(m=>m.matched);
  for(const m of accepted){
    const node=m.node,target=m.candidates[0];
    const points=[...new Set([node.start,node.end,...item.ranges.flatMap(r=>[r.startOffset,r.endOffset]).filter(p=>p>node.start&&p<node.end)])].sort((a,b)=>a-b);
    const ranges=points.slice(0,-1).map((start,index)=>{
      const end=points[index+1];
      const containing=item.ranges.filter(r=>r.startOffset<=start&&r.endOffset>=end).sort((a,b)=>(a.endOffset-a.startOffset)-(b.endOffset-b.startOffset));assert.ok(containing.length);
      return {source_range:{startOffset:start,endOffset:end},target_range:{startOffset:target.start+start-node.start,endOffset:target.start+end-node.start},historical_count:containing[0].count};
    });
    mappings.push({function:fn.name,node_type:'ReturnStatement',source_node_id:sourceNode.node_id,target_node_id:targetNode.node_id,source_range:{start:node.start,end:node.end},target_range:{start:target.start,end:target.end},basis:{function_anchor:'unique name + exact parameter text',statement_text_sha256:digest(node.text),guards:node.guards,source_evidence_id:sourceEvidence.evidence_id,target_evidence_id:targetEvidence.evidence_id,confidence:'analyst-inference'},ranges,target_execution:'not-established'});
  }
  function remainder(start,end,spans) {
    const sorted=[...spans].sort((a,b)=>a.start-b.start);const gaps=[];let cursor=start;
    for(const span of sorted){assert.ok(span.start>=cursor&&span.end<=end);if(cursor<span.start)gaps.push({startOffset:cursor,endOffset:span.start,count:null,status:'unknown'});cursor=span.end;}
    if(cursor<end)gaps.push({startOffset:cursor,endOffset:end,count:null,status:'unknown'});return gaps;
  }
  unmapped_source.push({function:fn.name,original_coverage_ranges:item.ranges,intervals:remainder(fn.start,fn.end,accepted.map(m=>m.node))});
  unknown_target.push({function:fn.name,intervals:remainder(next.start,next.end,accepted.map(m=>m.candidates[0]))});
}
assert.equal(mappings.length,3);
assert.ok(!mappings.some(m=>m.function==='choose'&&m.basis.guards.length));
assert.equal(mappings.find(m=>m.function==='choose').ranges[0].historical_count,0);
assert.equal(mappings.find(m=>m.function==='double').ranges[0].historical_count,1);
assert.ok(unknown_target.find(n=>n.function==='double').intervals.some(r=>targetText.slice(r.startOffset,r.endOffset).includes('adjustment')));
assert.ok(unknown_target.find(n=>n.function==='choose').intervals.some(r=>targetText.slice(r.startOffset,r.endOffset).includes('positive-v2')));
const guardVariant=inventory(sourceText.replace('value > 0','value >= 0'));
assert.ok(!match(src.find(n=>n.name==='choose'),guardVariant.find(n=>n.name==='choose')).find(m=>m.node.guards.length).matched,'Changed guard must block identical return text');
const duplicateVariant=inventory(sourceText.replace("return 'non-positive';","return 'non-positive'; return 'non-positive';"));
assert.ok(!match(src.find(n=>n.name==='choose'),duplicateVariant.find(n=>n.name==='choose')).find(m=>!m.node.guards.length).matched,'Duplicate return must remain ambiguous');
const loopVariant=inventory(sourceText.replace("return 'non-positive';","while(value < 0) { return 'non-positive'; }"));
assert.ok(!match(src.find(n=>n.name==='choose'),loopVariant.find(n=>n.name==='choose')).find(m=>!m.node.guards.length).matched,'Unsupported loop context must remain unmapped');
const execution=spawnSync(process.execPath,[resolve(targetRoot,'main.js'),'baseline'],{encoding:'utf8',timeout:10000});
if(execution.error)throw execution.error;assert.equal(execution.status,0,execution.stderr);
const oracle=JSON.parse(execution.stdout);assert.equal(oracle.result,42);assert.equal(oracle.branch,'positive-v2');
const result={authority:'historical coverage projection through restricted AST correspondences',parser_version:require('@babel/parser/package.json').version,source_sha256:digest(sourceText),target_sha256:digest(targetText),mappings,unmapped_source,unknown_target,independent_target_stdout:oracle,negative_controls:{changed_guard_rejected:true,duplicate_return_rejected:true,unsupported_loop_unmapped:true},limitations:['ReturnStatement subset only; function anchors are analyst correspondence, not identity proof.','Identical return text does not establish equivalent reaching state or control flow.','Unknown spans are never zero-filled; historical counts do not prove target execution.']};
writeFileSync(resolve(output,'report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({mapped_returns:mappings.length,unknown_target,oracle,negative_controls:result.negative_controls},null,2));
