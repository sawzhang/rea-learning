import { open, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeCleanup } from './logic.js';
const moduleURL=new URL('../../upstream/dist/filesystem/OwnedFileHandle.js',import.meta.url);
const { OwnedFileHandle }=await import(moduleURL.href);
const directory=await mkdtemp(join(tmpdir(),'rea-owned-file-')),reports=[];
try {
 const path=join(directory,'controlled.txt');await writeFile(path,'controlled file\n');
 for(const scenario of ['sequential','concurrent','externally-invalidated']){
  const events=[],handle=await open(path,'r'),owner=new OwnedFileHandle(handle),beforeFd=handle.fd;
  try {
   if(scenario==='externally-invalidated')await handle.close();
   const first=owner.close();
   const firstJoined=Promise.allSettled([observeCleanup(first,events)]);
   if(scenario==='sequential')await firstJoined;
   const second=owner.close();
   const secondJoined=Promise.allSettled([observeCleanup(second,events)]);
   const results=[...(await firstJoined),...(await secondJoined)];
   reports.push({scenario,beforeFd,afterFd:handle.fd,samePromise:first===second,sameFailure:results[0].status==='rejected'&&results[0].reason===results[1].reason,outcomes:results.map(r=>r.status==='fulfilled'?{status:r.status}:{status:r.status,message:r.reason.message}),events});
  }finally{if(handle.fd>=0)await handle.close();}
 }
}finally{await rm(directory,{recursive:true,force:true});}
console.log(JSON.stringify(reports));
