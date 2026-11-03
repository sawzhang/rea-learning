import { observeCleanup } from './logic.js';
const moduleURL=new URL('../../upstream/dist/artifacts/ArtifactResourceScope.js',import.meta.url);
const { ArtifactResourceScope }=await import(moduleURL.href);
const reports=[];
for(const scenario of ['same-object','distinct-same-label','distinct-labels']){
 const scope=new ArtifactResourceScope(),events=[],ledger=[];
 function owner(id,resource){const entry={id,resource,calls:0,ownership:'adapter-owner'};ledger.push(entry);return {kind:'reader',resource,reader:{async close(){entry.calls++;events.push(id+':'+entry.calls);throw Error(id+':failed');}}};}
 const a=owner('owner-A','shared'),b=scenario==='same-object'?a:owner('owner-B',scenario==='distinct-labels'?'other':'shared');
 const seeds=[(await scope.release(a)).kind,(await scope.release(b)).kind],waves=[];
 for(let i=0;i<2;i++){
  const first=scope.retryCleanup(),second=scope.retryCleanup();
  const results=await Promise.allSettled([observeCleanup(first,events),observeCleanup(second,events)]);
  waves.push({samePromise:first===second,outcomes:results.map(r=>({status:r.status,cleanup:r.reason?.cleanup,causes:r.reason?.cause?.errors?.map(e=>e.message)})),ledger:structuredClone(ledger)});
 }
 reports.push({scenario,sameOwner:a===b,seeds,waves,ledger,events});
}
console.log(JSON.stringify(reports));
