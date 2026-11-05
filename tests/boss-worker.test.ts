import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createBossWorkerService}=require('../electron/boss-worker-service.cjs');
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
class FakeWorker extends EventEmitter {
 static instances:FakeWorker[]=[];
 terminated=false;
 autoCancel=true;
 constructor(..._args:unknown[]){super();FakeWorker.instances.push(this);}
 postMessage(message:unknown){if((message as any)?.type==='cancel'&&this.autoCancel)queueMicrotask(()=>this.emit('message',{type:'error',message:'reader cancelled after draining current operation'}));}
 async terminate(){this.terminated=true;return 0;}
}
const setup=(totalMs=300,idleMs=80,cancelDrainMs=40000)=>createBossWorkerService({WorkerClass:FakeWorker,totalMs,idleMs,cancelDrainMs,validate:false});
const latest=()=>FakeWorker.instances.at(-1)!;

test('the default Boss Plan worker keeps a progressing scan alive past eight minutes',(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});const service=createBossWorkerService({WorkerClass:FakeWorker,validate:false}),pending=service.read('fake','fake'),worker=latest();
 for(let i=0;i<600;i++){worker.emit('message',{type:'progress',text:'captured new pixels'});t.mock.timers.tick(1000);}assert.equal(worker.terminated,false);worker.emit('message',{type:'result',result:'complete'});return pending.then((result:unknown)=>assert.equal(result,'complete'));
});

test('stalled worker is terminated and a subsequent read succeeds',async()=>{
 const service=setup(),pending=service.read('fake','fake'),stalled=latest();
 await assert.rejects(pending,/ilerlemedi; işlem durduruldu/);assert.equal(stalled.terminated,true);
 const next=service.read('fake','fake');latest().emit('message',{type:'result',result:{stages:[1]}});
 assert.deepEqual(await next,{stages:[1]});assert.equal(latest().terminated,true);
});

test('progress resets the idle timer but cannot extend the total deadline',async()=>{
 const service=setup(120,90),progress:string[]=[],pending=service.read('fake','fake',(s:string)=>progress.push(s)),worker=latest();
 const beat=setInterval(()=>worker.emit('message',{type:'progress',text:'page'}),15);
 try{await assert.rejects(pending,/süre sınırına ulaştı/);assert.ok(progress.length>=2);assert.equal(worker.terminated,true);}finally{clearInterval(beat);service.close();}
});

test('cancel waits for the reader cancellation response before releasing ownership',async()=>{
 const service=setup(),first=service.read('fake','fake'),old=latest();
 assert.throws(()=>service.read('fake','fake'),/zaten sürüyor/);
 old.autoCancel=false;let settled=false;const rejection=assert.rejects(first,/iptal edildi/).finally(()=>{settled=true;});assert.equal(service.cancel(),true);
 assert.throws(()=>service.read('fake','fake'),/zaten sürüyor/);await new Promise(r=>setImmediate(r));assert.equal(settled,false);
 old.emit('message',{type:'error',message:'reader cancelled after current operation drained'});
  await rejection;assert.equal(old.terminated,true);const second=service.read('fake','fake'),current=latest();assert.equal(current.terminated,false);
 current.emit('message',{type:'result',result:'current'});assert.equal(await second,'current');
 assert.equal(service.close(),true);
});

test('worker errors and exit without a result reject the job and release it',async()=>{
 const service=setup();
 for(const mode of ['message','error','exit']){
  const pending=service.read('fake','fake'),worker=latest(),rejection=assert.rejects(pending,mode==='exit'?/sonuç vermeden/:/OCR failed/);
  if(mode==='message')worker.emit('message',{type:'error',message:'OCR failed'});
  if(mode==='error')worker.emit('error',Error('OCR failed'));
  if(mode==='exit')worker.emit('exit',1);
  await rejection;assert.equal(worker.terminated,true);
 }
 const pending=service.read('fake','fake');latest().emit('message',{type:'result',result:'ok'});assert.equal(await pending,'ok');
 await wait(100);
});

test('screen-read worker ownership is retained until terminate finishes',async()=>{
 let release!:()=>void,entered!:()=>void;const draining=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 class SlowTerminateWorker extends EventEmitter{terminated=false;constructor(){super();latestWorkers.push(this);}async terminate(){this.terminated=true;entered();await draining;return 0;}}
 const latestWorkers:SlowTerminateWorker[]=[],service=createBossWorkerService({WorkerClass:SlowTerminateWorker,validate:false}),first=service.read('fake','fake'),worker=latestWorkers[0];
 worker.emit('message',{type:'result',result:'complete'});await started;
 assert.throws(()=>service.read('fake','fake'),/zaten sürüyor/);let settled=false;first.finally(()=>{settled=true;});await new Promise(r=>setImmediate(r));assert.equal(settled,false);
 release();assert.equal(await first,'complete');assert.equal(worker.terminated,true);
});

test('a worker that ignores cancellation times out as undrained and poisons the device lease',async()=>{
 const {createDeviceReadGate}=require('../electron/device-read-gate.cjs'),service=setup(300,80,20),withRead=createDeviceReadGate((device:string)=>device),worker=(()=>{const pending=withRead('device-a',()=>service.read('fake','fake'));return {pending,worker:latest()};})();
 worker.worker.autoCancel=false;
 await assert.rejects(worker.pending,(error:any)=>error.code==='SCREEN_READ_UNDRAINED'&&/sonlandıramadı/.test(error.message));assert.equal(worker.worker.terminated,true);
 await assert.rejects(withRead('device-a',async()=>'unsafe'),/güvenli biçimde sonlanmadı/);
 assert.equal(await withRead('device-b',async()=>'independent'),'independent');
});
