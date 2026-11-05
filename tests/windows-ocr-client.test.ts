import {test} from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import {createRequire} from 'node:module';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {Worker} from 'node:worker_threads';
const require=createRequire(import.meta.url),{createOCRClient}=require('../electron/windows-ocr-client.cjs');
const value={text:'Paralysis · Işık',lines:[],width:900,height:1600};
function harness(options={}){
 const spawned:any[]=[];
 const spawnProcess=(exe:string,args:string[],config:any)=>{assert.match(exe,/WindowsPowerShell/);assert.equal(args.at(-1),'-Server');assert.equal(config.windowsHide,true);const child:any=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.requests=[];child.kills=0;child.stdin.on('data',(data:Buffer)=>child.requests.push(JSON.parse(data.toString())));child.kill=()=>{child.kills++;queueMicrotask(()=>child.emit('exit',0));};spawned.push(child);return child;};
 return {spawned,client:createOCRClient({spawnProcess,...options})};
}

test('OCR requests share one process and split UTF-8 replies retain their request identity',async()=>{
 const {client,spawned}=harness();try{const a=client.read('one.png'),b=client.read('two.png'),child=spawned[0];assert.equal(spawned.length,1);assert.deepEqual(child.requests.map((r:any)=>r.file),['one.png','two.png']);
  const bytes=Buffer.from(JSON.stringify({id:child.requests[1].id,result:value})+'\n');for(const byte of bytes)child.stdout.write(Buffer.from([byte]));child.stdout.write(JSON.stringify({id:child.requests[0].id,result:{...value,text:'Bind'}})+'\n');assert.deepEqual(await b,value);assert.equal((await a).text,'Bind');
 }finally{client.close();}
});

test('one failed image does not discard other queued requests or restart the OCR engine',async()=>{
 const {client,spawned}=harness();try{const a=client.read('missing.png'),rejected=assert.rejects(a,/missing image/),b=client.read('valid.png'),child=spawned[0];child.stdout.write(JSON.stringify({id:child.requests[0].id,error:'missing image'})+'\n');child.stdout.write(JSON.stringify({id:child.requests[1].id,result:value})+'\n');await rejected;assert.deepEqual(await b,value);assert.equal(spawned.length,1);}finally{client.close();}
});

test('aborting one pending OCR request preserves other work and ignores only its late reply',async()=>{
 const {client,spawned}=harness(),controller=new AbortController();let drained=false;try{const a=assert.rejects(client.read('a',{signal:controller.signal,onDrained:()=>{drained=true;}} as any),/cancel/i),b=client.read('b'),child=spawned[0],aId=child.requests[0].id,bId=child.requests[1].id;controller.abort();await a;assert.equal(drained,false);child.stdout.write(JSON.stringify({id:aId,result:value})+'\n');assert.equal(drained,true);child.stdout.write(JSON.stringify({id:bId,result:{...value,text:'Bind'}})+'\n');assert.equal((await b).text,'Bind');assert.equal(spawned.length,1);assert.equal(child.kills,0);}finally{client.close();}
});

test('aborting the last native OCR request retires its process and drains file cleanup before reuse',async()=>{
 const {client,spawned}=harness(),controller=new AbortController();let drained=false;try{const read=assert.rejects(client.read('a',{signal:controller.signal,onDrained:()=>{drained=true;}} as any),/cancel/i);controller.abort();await read;assert.equal(spawned[0].kills,1);await new Promise(r=>setImmediate(r));assert.equal(drained,true);const next=client.read('b'),child=spawned[1];child.stdout.write(JSON.stringify({id:child.requests[0].id,result:value})+'\n');assert.deepEqual(await next,value);}finally{client.close();}
});

test('a retired process exit cannot drain a newer worker request',async()=>{
 const {client,spawned}=harness(),controller=new AbortController();let drained=false;try{const oldRead=assert.rejects(client.read('old',{signal:controller.signal} as any),/cancel/i),old=spawned[0];old.kill=()=>{old.kills++;};controller.abort();await oldRead;const current=client.read('current',{onDrained:()=>{drained=true;}} as any),child=spawned[1];old.emit('exit',0);assert.equal(drained,false);child.stdout.write(JSON.stringify({id:child.requests[0].id,result:value})+'\n');assert.deepEqual(await current,value);assert.equal(drained,true);}finally{client.close();}
});

test('timeout cancels all queued work and the next read starts a fresh process',async()=>{
 const {client,spawned}=harness({timeout:15});try{const jobs=Promise.allSettled([client.read('a'),client.read('b')]),results=await jobs;assert.ok(results.every(r=>r.status==='rejected'&&/timed out/.test(r.reason.message)));assert.equal(spawned[0].kills,1);const next=client.read('c'),child=spawned[1];child.stdout.write(JSON.stringify({id:child.requests[0].id,result:value})+'\n');assert.deepEqual(await next,value);}finally{client.close();}
});

test('malformed output and unexpected process exit reject work instead of returning stale OCR',async()=>{
 for(const failure of ['malformed','exit']){const {client,spawned}=harness();try{const read=client.read('a'),rejected=assert.rejects(read),child=spawned[0];if(failure==='malformed')child.stdout.write('not JSON\n');else{child.stderr.write('OCR language is unavailable');child.emit('exit',1);}await rejected;assert.equal(child.kills,1);}finally{client.close();}}
});

test('an idle OCR process closes and explicit close cancels an active read',async()=>{
 const {client,spawned}=harness({idleTimeout:5});const first=client.read('a'),child=spawned[0];child.stdout.write(JSON.stringify({id:child.requests[0].id,result:value})+'\n');await first;await new Promise(r=>setTimeout(r,20));assert.equal(child.kills,1);const next=client.read('b'),rejected=assert.rejects(next,/closed/);assert.equal(spawned.length,2);client.close();await rejected;assert.equal(spawned[1].kills,1);
});

test('native persistent OCR matches the standalone reader and recovers after an invalid image',{skip:process.platform!=='win32'},async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'nakama-ocr-client-test-')),file=path.join(folder,'görüntü-ışık.png'),client=createOCRClient();
 try{await fs.copyFile(new URL('./fixtures/kizuna/difficulty-10.png',import.meta.url),file);const {stdout}=await promisify(execFile)(path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-File',path.resolve('electron/windows-ocr.ps1'),'-ImagePath',file],{windowsHide:true,encoding:'utf8'});const expected=JSON.parse(stdout.replace(/^\uFEFF/,''));const [a,b]=await Promise.all([client.read(file),client.read(file)]);assert.deepEqual(a,expected);assert.deepEqual(b,expected);await assert.rejects(client.read(path.join(folder,'missing.png')));assert.deepEqual(await client.read(file),expected);
 }finally{client.close();await fs.rm(file,{force:true});await fs.rmdir(folder);}
});

test('terminating an active or idle OCR-owning worker also closes its native child process',{skip:process.platform!=='win32'},async()=>{
 const modulePath=path.resolve('electron/windows-ocr-client.cjs'),file=path.resolve('tests/fixtures/kizuna/difficulty-10.png');
 for(const waitForResult of [false,true]){let pid=0;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads'),{spawn}=require('node:child_process'),{createOCRClient}=require(${JSON.stringify(modulePath)});const client=createOCRClient({spawnProcess:(...a)=>{const child=spawn(...a);parentPort.postMessage({pid:child.pid});return child;}});client.read(${JSON.stringify(file)}).then(()=>parentPort.postMessage({done:true}),e=>{throw e;});`,{eval:true});
 // Cancellation can interrupt spawn before JS tracks the child. Closed stdin
 // then lets the native server finish startup and exit, including under load.
 try{await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native OCR worker timed out')),10000);worker.on('error',error=>{clearTimeout(timer);reject(error);});worker.on('message',message=>{if(message.pid)pid=message.pid;if(message.done||message.pid&&!waitForResult){clearTimeout(timer);resolve();}});});assert.ok(pid>0);await worker.terminate();let alive=true;for(let i=0;i<250;i++){try{process.kill(pid,0);}catch{alive=false;break;}await new Promise(r=>setTimeout(r,20));}assert.equal(alive,false,'Cancelled reads must not leave a native OCR process behind');
 }finally{await worker.terminate();if(pid)try{process.kill(pid);}catch{}}
 }
});
