import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {EventEmitter} from 'node:events';
const require=createRequire(import.meta.url),{createDiagnostics,createScanRecorder}=require('../electron/diagnostics.cjs'),{createBossWorkerService}=require('../electron/boss-worker-service.cjs');
const dir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nakama-diagnostics-test-'));
test('boss diagnostic preserves exact worker failure, last step and successor outcome without stale messages',async()=>{
 const root=dir(),diagnostics=createDiagnostics(root),instances:any[]=[];
 class Worker extends EventEmitter{constructor(..._args:any[]){super();instances.push(this);}async terminate(){return 0;}}
 const service=createBossWorkerService({WorkerClass:Worker,validate:false,diagnostics});
 const first=service.read('adb','device'),failed=instances.at(-1);failed.emit('message',{type:'progress',text:'Battle 2 reading'});
 failed.emit('message',{type:'error',message:'OCR failed',stack:'Exact worker stack',cause:{previous:'3 turns',current:'6 turns'}});await assert.rejects(first,/OCR failed/);
 const error=JSON.parse(fs.readFileSync(path.join(root,'boss-last.json'),'utf8'));assert.equal(error.status,'error');assert.equal(error.last,'Battle 2 reading');assert.equal(error.error.stack,'Exact worker stack');assert.deepEqual(error.error.cause,{previous:'3 turns',current:'6 turns'});
 const second=service.read('adb','device'),current=instances.at(-1);failed.emit('message',{type:'result',result:{name:'stale'}});current.emit('message',{type:'result',result:{name:'CP9',observation:{complete:false,warnings:['Battle 2: trigger missing']}}});await second;
 const done=JSON.parse(fs.readFileSync(path.join(root,'boss-last.json'),'utf8'));assert.equal(done.result.name,'CP9');assert.equal(done.result.observation.complete,false);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'boss-previous.json'),'utf8')).error.message,'OCR failed');
});
test('frame recorder keeps bounded first/latest/previous context and log IO failures cannot stop a scan',()=>{
 const root=dir(),recorder=createScanRecorder(root,'run-1');for(let i=0;i<3;i++)recorder.observe(Buffer.from([i]),{lines:[{text:'frame '+i,words:[]}]});
 assert.equal(fs.readFileSync(path.join(root,'boss-frame-first.png'))[0],0);assert.equal(fs.readFileSync(path.join(root,'boss-frame.png'))[0],2);assert.equal(fs.readFileSync(path.join(root,'boss-frame-previous.png'))[0],1);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'boss-frame.json'),'utf8')).runId,'run-1');
 const blocked=path.join(root,'file');fs.writeFileSync(blocked,'occupied');const logger=createDiagnostics(blocked);assert.doesNotThrow(()=>{const run=logger.beginBoss();logger.bossProgress(run,'progress');logger.finishBoss(run,Error('failure'));createScanRecorder(blocked,run.id).observe(Buffer.alloc(1),{lines:[]});});
});
test('application event journal rotates to one previous file and excludes input arguments',()=>{
 const root=dir(),logger=createDiagnostics(root,{maxBytes:500});for(let i=0;i<20;i++)logger.record('ipc-error','boss:readBehavior',{message:'Error '+i});
 const files=fs.readdirSync(root);assert.deepEqual(files.sort(),['app-previous.jsonl','app.jsonl']);for(const file of files){const text=fs.readFileSync(path.join(root,file),'utf8');assert.ok(Buffer.byteLength(text)<=500);for(const line of text.trim().split('\n'))assert.equal(JSON.parse(line).kind,'ipc-error');}
});
test('last alignment diagnostics preserve two real page images and non-enumerable row positions for merge replay',()=>{
 const root=dir(),recorder=createScanRecorder(root,'align-run'),oldPage=Symbol(),newPage=Symbol();
 const row=(page:symbol,top:number)=>Object.defineProperty({kind:'line',text:'98 turns Delay Immunity'},'position',{value:{page,top,height:25},enumerable:false});
 for(let i=0;i<3;i++)recorder.alignment({beforeImage:Buffer.from([i]),afterImage:Buffer.from([i+1]),body:{left:98},page:10,retry:i,evidence:{shift:223,verified:true},existing:[row(oldPage,750)],before:[row(oldPage,750)],after:[row(newPage,527)]});
 const state=JSON.parse(fs.readFileSync(path.join(root,'boss-alignment.json'),'utf8'));assert.equal(state.runId,'align-run');assert.equal(state.retry,2);assert.equal(state.existing[0].position.page,state.before[0].position.page);assert.notEqual(state.before[0].position.page,state.after[0].position.page);assert.equal(state.after[0].position.top,527);
 assert.equal(fs.readFileSync(path.join(root,'boss-alignment-before.png'))[0],2);assert.equal(fs.readFileSync(path.join(root,'boss-alignment-after.png'))[0],3);assert.equal(fs.readdirSync(root).length,3);
});
