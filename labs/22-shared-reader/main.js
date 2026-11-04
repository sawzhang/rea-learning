import { observeCleanup } from './logic.js';
const moduleURL=new URL('../../upstream/dist/artifacts/ArtifactResourceScope.js',import.meta.url);
const { ArtifactResourceScope }=await import(moduleURL.href);
const reports=[];
for(const scenario of ['idempotent','strict-duplicate','permanent']){
 const scope=new ArtifactResourceScope(),events=[];let calls=0,released=false,duplicates=0;
 const reader={async close(){const n=++calls;events.push('close:'+n);if(n<=2||scenario==='permanent')throw Error('cleanup-failed:'+n);if(released){duplicates++;if(scenario==='strict-duplicate')throw Error('already-released:'+n);return;}released=true;events.push('released:'+n);}};
 const a={kind:'reader',resource:'wrapper-A',reader},b={kind:'reader',resource:'wrapper-B',reader};
 const seeds=[(await scope.release(a)).kind,(await scope.release(b)).kind],waves=[];
 for(let i=0;i<2;i++){
  const first=scope.retryCleanup(),second=scope.retryCleanup();
  const outcomes=await Promise.allSettled([observeCleanup(first,events),observeCleanup(second,events)]);
  waves.push({samePromise:first===second,outcomes:outcomes.map(r=>r.status==='fulfilled'?{status:r.status}:{status:r.status,cleanup:r.reason.cleanup,causes:r.reason.cause.errors.map(e=>e.message)}),snapshot:{calls,released,duplicates}});
 }
 reports.push({scenario,distinctOwners:a!==b,sameReader:a.reader===b.reader,seeds,waves,final:{calls,released,duplicates,resourceOwnership:released?'released':'adapter-owner'},events});
}
console.log(JSON.stringify(reports));
