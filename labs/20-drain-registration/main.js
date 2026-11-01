import { setImmediate as checkpoint } from 'node:timers/promises';
import { observeCleanup } from './logic.js';
const moduleURL=new URL('../../upstream/dist/artifacts/ArtifactResourceScope.js',import.meta.url);
const { ArtifactResourceScope }=await import(moduleURL.href);
const reports=[];
const summarize=r=>r.status==='fulfilled'?{status:r.status}:{status:r.status,cleanup:r.reason.cleanup};
for(const scenario of ['during','after','during-failure']){
 const scope=new ArtifactResourceScope(),events=[];let callsA=0,callsC=0,openA,releasedA=false,releasedC=false;
 const a={kind:'reader',resource:'A',reader:{async close(){const n=++callsA;events.push('A:'+n);if(n===1)throw Error('seed-A');if(n===2)await new Promise(resolve=>{openA=resolve;});releasedA=true;}}};
 const c={kind:'reader',resource:'C',reader:{async close(){const n=++callsC;events.push('C:'+n);if(n===1||scenario==='during-failure')throw Error('failed-C');releasedC=true;}}};
 const seedA=(await scope.release(a)).kind;
 const first=scope.retryCleanup(),duplicate=scope.retryCleanup();
 const joined=Promise.allSettled([observeCleanup(first,events),observeCleanup(duplicate,events)]);
 await checkpoint();const before={callsA,callsC};let seedC;
 if(scenario!=='after')seedC=(await scope.release(c)).kind;
 openA();const firstResults=await joined;
 const firstSnapshot={callsA,callsC,releasedA,releasedC};
 if(scenario==='after')seedC=(await scope.release(c)).kind;
 const next=scope.retryCleanup(),nextDuplicate=scope.retryCleanup();
 const nextResults=await Promise.allSettled([observeCleanup(next,events),observeCleanup(nextDuplicate,events)]);
 reports.push({scenario,seedA,seedC,before,firstSame:first===duplicate,nextSame:next===nextDuplicate,newWave:first!==next,firstResults:firstResults.map(summarize),firstSnapshot,nextResults:nextResults.map(summarize),final:{callsA,callsC,releasedA,releasedC,ownerC:releasedC?'released':'adapter-owner'},events});
}
console.log(JSON.stringify(reports));
