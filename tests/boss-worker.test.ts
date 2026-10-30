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
 constructor(..._args:unknown[]){super();FakeWorker.instances.push(this);}
 async terminate(){this.terminated=true;return 0;}
}
const setup=(totalMs=300,idleMs=80)=>createBossWorkerService({WorkerClass:FakeWorker,totalMs,idleMs,validate:false});
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

test('cancel frees the active job immediately; late messages cannot replace its successor',async()=>{
 const service=setup(),first=service.read('fake','fake'),old=latest();
 assert.throws(()=>service.read('fake','fake'),/zaten sürüyor/);
 const rejection=assert.rejects(first,/iptal edildi/);assert.equal(service.cancel(),true);
 const second=service.read('fake','fake'),current=latest();
 old.emit('message',{type:'result',result:'stale'});old.emit('exit',1);old.emit('error',Error('late'));
 await rejection;assert.equal(old.terminated,true);assert.equal(current.terminated,false);
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
