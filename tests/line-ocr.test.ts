import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {EventEmitter} from 'node:events';
const require=createRequire(import.meta.url),sharp=require('sharp'),{createLineOCR}=require('../electron/line-ocr.cjs');
const image=()=>sharp({create:{width:40,height:20,channels:3,background:'black'}}).png().toBuffer();
const data={text:'6 turns',blocks:[{paragraphs:[{lines:[{text:'6 turns',words:[{text:'6',confidence:96,bbox:{x0:4,y0:2,x1:20,y1:18}},{text:'turns',confidence:92,bbox:{x0:22,y0:2,x1:76,y1:18}}]}]}]}]};
const fake=(recognize:any=async()=>({data}))=>{const worker=Object.assign(new EventEmitter(),{unref(){}});let closed=0;return {worker,recognize,parameters:[] as any[],async setParameters(p:any){this.parameters.push(p);},async terminate(){closed++;},get closed(){return closed;}};};

test('line OCR reuses one offline worker, queues reads, and maps confidence and word boxes',async()=>{
 let initialized=0,inFlight=0,max=0;const w=fake(async()=>{max=Math.max(max,++inFlight);await new Promise(r=>setTimeout(r,3));inFlight--;return {data};}),client=createLineOCR({factory:async()=>{initialized++;return w;}});
 try{const input=await image(),results=await Promise.all([client.read(input,{scale:2}),client.read(input,{scale:2})]);assert.equal(initialized,1);assert.equal(max,1);assert.equal(w.parameters[0].tessedit_pageseg_mode,'7');assert.equal(results[0].lines[0].words[0].confidence,96);assert.deepEqual(results[0].lines[0].words[0],{text:'6',confidence:96,x:2,y:1,width:8,height:8});}finally{await client.close();}assert.equal(w.closed,1);
});

test('closing line OCR rejects active and queued reads and permits a new clean worker',async()=>{
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),blocked=new Promise<void>(r=>release=r),old=fake(async()=>{entered();await blocked;return {data};}),next=fake();let calls=0;const client=createLineOCR({factory:async()=>++calls===1?old:next}),input=await image();
 const first=assert.rejects(client.read(input),/kapatıldı/),second=assert.rejects(client.read(input),/kapatıldı/);await started;await client.close();await Promise.all([first,second]);release();assert.equal(old.closed,1);assert.equal((await client.read(input)).text,'6 turns');assert.equal(calls,2);await client.close();
});

test('a stalled individual line request terminates its worker and the next request restarts',async t=>{
 let entered!:()=>void,calls=0;const started=new Promise<void>(r=>entered=r),old=fake(()=>{entered();return new Promise(()=>{});}),next=fake(),client=createLineOCR({timeout:30,factory:async()=>++calls===1?old:next}),input=await image();t.mock.timers.enable({apis:['setTimeout']});
 const pending=assert.rejects(client.read(input),/yanıt vermedi/);await started;t.mock.timers.tick(31);await pending;assert.equal(old.closed,1);assert.equal((await client.read(input)).text,'6 turns');await client.close();
});

test('unexpected OCR worker exit rejects the read instead of leaving the guide hung',async()=>{
 let entered!:()=>void;const started=new Promise<void>(r=>entered=r),w=fake(async()=>{entered();return new Promise(()=>{});}),client=createLineOCR({factory:async()=>w}),input=await image(),pending=assert.rejects(client.read(input),/beklenmedik/);await started;w.worker.emit('exit',1);await pending;assert.equal(w.closed,1);await client.close();
});

test('an idle line OCR worker is released and initialized again on demand',async()=>{
 let calls=0;const workers:any[]=[],client=createLineOCR({idleTimeout:10,factory:async()=>{calls++;const w=fake();workers.push(w);return w;}}),input=await image();await client.read(input);await new Promise(r=>setTimeout(r,30));assert.equal(workers[0].closed,1);await client.read(input);assert.equal(calls,2);await client.close();
});

test('a worker finishing initialization after cancellation is terminated and never reused',async()=>{
 let enter!:()=>void,ready!:(v:any)=>void;const entered=new Promise<void>(r=>enter=r),boot=new Promise(r=>ready=r),stale=fake(),current=fake();let calls=0;const client=createLineOCR({factory:()=>{if(++calls===1){enter();return boot;}return Promise.resolve(current);}}),input=await image(),pending=assert.rejects(client.read(input),/kapatıldı/);await entered;await client.close();await pending;ready(stale);await new Promise(r=>setTimeout(r,0));assert.equal(stale.closed,1);assert.equal((await client.read(input)).text,'6 turns');await client.close();
});

test('the bundled English model reads real short effects, a large multiplier and the missing percentage',async()=>{
 const client=createLineOCR(),source=fs.readFileSync(new URL('./fixtures/kizuna/static-mechanics.png',import.meta.url)),expected=[[2],[3,10000000],[6,90]],labels=[/Nullify Damage/i,/DEF/i,/ATK.*Down/i];
 try{for(let i=0;i<3;i++){const crop=await sharp(source).extract({left:0,top:i*44,width:610,height:44}).png().toBuffer(),value=await client.read(crop);assert.deepEqual(value.text.match(/\d+/g)?.map(Number),expected[i]);assert.match(value.text,labels[i]);assert.ok(value.lines.flatMap((l:any)=>l.words).filter((w:any)=>/\d/.test(w.text)).every((w:any)=>w.confidence>=80));}}finally{await client.close();}
});
