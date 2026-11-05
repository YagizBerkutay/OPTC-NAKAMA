import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createService}=require('../electron/kizuna-auto-service.cjs'),{createDeviceReadGate}=require('../electron/device-read-gate.cjs');

test('Kizuna acquires the screen lease after online work and holds it through worker termination',async()=>{
 const workers:any[]=[];let release!:()=>void,terminateStarted!:()=>void;const drain=new Promise<void>(r=>release=r),terminating=new Promise<void>(r=>terminateStarted=r),events:string[]=[];
 class FakeWorker extends EventEmitter{data:any;constructor(_file:string,options:any){super();this.data=options.workerData;workers.push(this);}async terminate(){terminateStarted();await drain;return 0;}}
 const withScreenRead=createDeviceReadGate((device:string)=>device),service=createService('.local',{WorkerClass:FakeWorker,
  online:{read:async()=>{events.push('online');return {title:'Test Event'};},cancel:()=>true},
  deviceApi:{validateAdb:()=>{},validateDevice:()=>{},connect:async()=>{}},
  withScreenRead:(device:string,operation:()=>Promise<unknown>)=>{events.push('lease');return withScreenRead(device,operation);},
  beginScan:(kind:string)=>{events.push('scan:'+kind);return {id:'run-1',runDir:'.local/run-1'};},finishScan:(run:any)=>events.push('finish:'+run.id)
 });
 const pending=service.read({exe:'qa',device:'device-a',difficulty:10});await new Promise(r=>setImmediate(r));assert.deepEqual(events,['online','lease','scan:kizuna-auto']);assert.equal(workers[0].data.runId,'run-1');assert.equal(workers[0].data.runDir,'.local/run-1');
 workers[0].emit('message',{type:'result',result:{live:true}});await terminating;
 await assert.rejects(withScreenRead('device-a',async()=>true),/başka bir ekran okuması sürüyor/);
 release();assert.deepEqual((await pending).live,{live:true});assert.deepEqual(events,['online','lease','scan:kizuna-auto','finish:run-1']);assert.equal(await withScreenRead('device-a',async()=>'retry'),'retry');
});

test('Kizuna cancellation keeps the same-device lease until the worker reports cooperative drain',async()=>{
 const workers:EventEmitter[]=[];
 class FakeWorker extends EventEmitter{cancelRequested=false;constructor(){super();workers.push(this);}postMessage(message:any){if(message.type==='cancel')this.cancelRequested=true;}async terminate(){return 0;}}
 const withScreenRead=createDeviceReadGate((device:string)=>device),service=createService('.local',{WorkerClass:FakeWorker,
  online:{read:async()=>{throw Error('offline');},cancel:()=>true},deviceApi:{validateAdb:()=>{},validateDevice:()=>{},connect:async()=>{}},withScreenRead
 });
 const pending=service.read({exe:'qa',device:'device-a',difficulty:10});await new Promise(r=>setImmediate(r));assert.equal(workers.length,1);
 service.cancel();assert.equal((workers[0] as any).cancelRequested,true);
 await assert.rejects(withScreenRead('device-a',async()=>true),/başka bir ekran okuması sürüyor/);
 workers[0].emit('message',{type:'error',message:'Kizuna otomatik okuması iptal edildi.'});await assert.rejects(pending,/iptal/);
 assert.equal(await withScreenRead('device-a',async()=>'retry'),'retry');
});
test('Kizuna worker that cannot acknowledge cancel leaves its device lease poisoned',async()=>{
 const workers:any[]=[];class FakeWorker extends EventEmitter{terminated=false;constructor(){super();workers.push(this);}postMessage(){}async terminate(){this.terminated=true;}}
 const withScreenRead=createDeviceReadGate((device:string)=>device),service=createService('.local',{WorkerClass:FakeWorker,cancelDrainMs:15,
  online:{read:async()=>{throw Error('offline');},cancel:()=>true},deviceApi:{validateAdb:()=>{},validateDevice:()=>{},connect:async()=>{}},withScreenRead
 });
 const pending=service.read({exe:'qa',device:'device-a',difficulty:10});await new Promise(r=>setImmediate(r));service.cancel();
 await assert.rejects(pending,(error:any)=>error.code==='SCREEN_READ_UNDRAINED');assert.equal(workers[0].terminated,true);
 await assert.rejects(withScreenRead('device-a',async()=>'unsafe'),/güvenli biçimde sonlanmadı/);
});
test('observe-only Kizuna polls do not consume retained scan runs',async()=>{
 let scanStarts=0;const workers:any[]=[];
 class FakeWorker extends EventEmitter{constructor(){super();workers.push(this);}async terminate(){return 0;}}
 const service=createService('.local',{WorkerClass:FakeWorker,beginScan:()=>{scanStarts++;return {id:'run',runDir:'.local/run'};},finishScan:()=>{},
  online:{read:async()=>{throw Error('observe skips online');},cancel:()=>true},deviceApi:{validateAdb:()=>{},validateDevice:()=>{},connect:async()=>{}}
 });
 const pending=service.read({exe:'qa',device:'device-a',difficulty:10,observe:true});await new Promise(r=>setImmediate(r));workers[0].emit('message',{type:'result',result:{kind:'main'}});
 assert.deepEqual((await pending).live,{kind:'main'});assert.equal(scanStarts,0);
});
