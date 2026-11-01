import { setImmediate as checkpoint } from 'node:timers/promises';
import { createReader, observeCleanup } from './logic.js';
const moduleURL = new URL('../../upstream/dist/artifacts/ArtifactResourceScope.js', import.meta.url);
const { ArtifactResourceScope } = await import(moduleURL.href);
const reports = [];
const summary = r => r.status === 'fulfilled' ? {status:r.status} : {status:r.status,message:r.reason.message,cleanup:r.reason.cleanup};
for (const [operationFails, cleanupFails] of [[false,false],[true,false],[false,true]]) {
 const events=[],scope=new ArtifactResourceScope(),b=createReader('B',cleanupFails?Infinity:1,events);
 let finishOperation, entered=0, closeSettled=false;
 const active=scope.run(async()=>{events.push('active-start');await new Promise(resolve=>{finishOperation=resolve;});events.push('active-exit');if(operationFails)throw new Error('operation-failed');});
 const activeJoined=Promise.allSettled([active]);await checkpoint();
 const seed=(await scope.release({kind:'reader',resource:'B',reader:b.reader})).kind;
 const retry=scope.retryCleanup();
 const waiting=Promise.allSettled([scope.run(async()=>{entered++;})]);
 const closing=scope.close();
 const closingJoined=Promise.allSettled([observeCleanup(retry,events),observeCleanup(closing,events)]).then(result=>{closeSettled=true;return result;});
 const immediate=await Promise.allSettled([scope.run(async()=>{entered++;})]);
 await checkpoint();const before={resource:b.snapshot(),closeSettled};
 finishOperation();const operation=(await activeJoined)[0];await checkpoint();
 const during={resource:b.snapshot(),closeSettled};b.openGate();
 const results=await closingJoined, waited=(await waiting)[0];
 reports.push({operationFails,cleanupFails,seed,samePromise:retry===closing,before,during,operation:summary(operation),results:results.map(summary),waiting:summary(waited),immediate:summary(immediate[0]),entered,final:b.snapshot(),events});
}
console.log(JSON.stringify(reports));
