import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {EventEmitter} from 'node:events';
const require=createRequire(import.meta.url),{createDiagnostics,createScanRecorder}=require('../electron/diagnostics.cjs'),{createBossWorkerService}=require('../electron/boss-worker-service.cjs');
const dir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'nakama-diagnostics-test-'));
test('boss diagnostic preserves exact worker failure, last step and successor outcome without stale messages',async()=>{
 const root=dir(),diagnostics=createDiagnostics(root),instances:any[]=[];
 class Worker extends EventEmitter{workerData:any;constructor(_file:string,options:any){super();this.workerData=options.workerData;instances.push(this);}async terminate(){return 0;}}
 const service=createBossWorkerService({WorkerClass:Worker,validate:false,diagnostics});
 const first=service.read('adb','device'),failed=instances.at(-1);assert.equal(failed.workerData.diagnosticsDir,root);assert.ok(failed.workerData.runDir.startsWith(path.join(root,'scans')));failed.emit('message',{type:'progress',text:'Battle 2 reading'});
 failed.emit('message',{type:'error',message:'OCR failed',stack:'Exact worker stack',cause:{previous:'3 turns',current:'6 turns'}});await assert.rejects(first,/OCR failed/);
 const error=JSON.parse(fs.readFileSync(path.join(root,'boss-last.json'),'utf8'));assert.equal(error.status,'error');assert.equal(error.last,'Battle 2 reading');assert.equal(error.error.stack,'Exact worker stack');assert.deepEqual(error.error.cause,{previous:'3 turns',current:'6 turns'});
 const second=service.read('adb','device'),current=instances.at(-1);assert.notEqual(current.workerData.runDir,failed.workerData.runDir);failed.emit('message',{type:'result',result:{name:'stale'}});current.emit('message',{type:'result',result:{name:'CP9',observation:{complete:false,warnings:['Battle 2: trigger missing']}}});await second;
 const done=JSON.parse(fs.readFileSync(path.join(root,'boss-last.json'),'utf8'));assert.equal(done.result.name,'CP9');assert.equal(done.result.observation.complete,false);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'boss-previous.json'),'utf8')).error.message,'OCR failed');
});
test('a synchronous worker startup failure closes its run and leaves service available',async()=>{
 const root=dir(),diagnostics=createDiagnostics(root),instances:any[]=[];let attempts=0;
 class Worker extends EventEmitter{constructor(){super();if(++attempts===1)throw Error('worker startup failed');instances.push(this);}async terminate(){return 0;}}
 const service=createBossWorkerService({WorkerClass:Worker,validate:false,diagnostics});await assert.rejects(service.read('adb','device'),/startup failed/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'boss-last.json'),'utf8')).status,'error');
 const next=service.read('adb','device');instances[0].emit('message',{type:'result',result:{name:'retry'}});assert.equal((await next).name,'retry');
});
test('Boss image import cancellation remains immediate because it has no device input lease',async()=>{
 const instances:any[]=[];class Worker extends EventEmitter{terminated=false;constructor(){super();instances.push(this);}async terminate(){this.terminated=true;return 0;}}
 const service=createBossWorkerService({WorkerClass:Worker,validate:false}),pending=service.readImages([{name:'page.png',dataUrl:'data:image/png;base64,AA=='}]);const worker=instances[0];assert.equal(service.cancel(),true);
 await assert.rejects(pending,/iptal edildi/);assert.equal(worker.terminated,true);worker.emit('message',{type:'result',result:'stale'});
});
test('frame recorder keeps bounded first/latest/previous context and log IO failures cannot stop a scan',()=>{
 const root=dir(),recorder=createScanRecorder(root,'run-1');for(let i=0;i<3;i++)recorder.observe(Buffer.from([i]),{lines:[{text:'frame '+i,words:[]}]});
 assert.equal(fs.readFileSync(path.join(root,'boss-frame-first.png'))[0],0);assert.equal(fs.readFileSync(path.join(root,'boss-frame.png'))[0],2);assert.equal(fs.readFileSync(path.join(root,'boss-frame-previous.png'))[0],1);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'boss-frame.json'),'utf8')).runId,'run-1');
 const blocked=path.join(root,'file');fs.writeFileSync(blocked,'occupied');const logger=createDiagnostics(blocked);assert.doesNotThrow(()=>{const run=logger.beginBoss();logger.bossProgress(run,'progress');logger.finishBoss(run,Error('failure'));createScanRecorder(blocked,run.id).observe(Buffer.alloc(1),{lines:[]});});
});
test('concurrent reader scans get unique directories and old run directories are pruned',()=>{
 const root=dir(),logger=createDiagnostics(root,{maxScanRuns:2}),a=logger.beginScan('pka-rumble'),b=logger.beginScan('assault');
 createScanRecorder(a.runDir,a.id).observe(Buffer.from([1]),{lines:[{text:'PKA',words:[]}]},{reader:'pka-rumble'});
 createScanRecorder(b.runDir,b.id).observe(Buffer.from([2]),{lines:[{text:'Assault',words:[]}]},{reader:'assault'});
 assert.notEqual(a.runDir,b.runDir);assert.equal(fs.readFileSync(path.join(a.runDir,'boss-frame.png'))[0],1);assert.equal(fs.readFileSync(path.join(b.runDir,'boss-frame.png'))[0],2);
 logger.finishScan(a);logger.finishScan(b);const c=logger.beginScan('kizuna-auto'),dirs=fs.readdirSync(path.join(root,'scans'));assert.ok(fs.existsSync(c.runDir));assert.ok(dirs.length<=2,'retention bounds completed run directories rather than keeping an unbounded frame history');
});
test('oversized frame omission never pairs a new OCR record with an older screenshot',()=>{
 const root=dir(),recorder=createScanRecorder(root,'size-run',{maxImageBytes:2}),lines=(text:string)=>({lines:[{text,words:[]}]});
 recorder.observe(Buffer.from([1]),lines('small frame'));recorder.observe(Buffer.from([2,3,4]),lines('oversized frame'));
 assert.equal(fs.existsSync(path.join(root,'boss-frame.png')),false);assert.equal(fs.readFileSync(path.join(root,'boss-frame-previous.png'))[0],1);
 const latest=JSON.parse(fs.readFileSync(path.join(root,'boss-frame.json'),'utf8'));assert.equal(latest.sequence,1);assert.equal(latest.imageSaved,false);assert.equal(latest.imageBytes,3);assert.equal(latest.omissionReason,'image-size-limit');
 recorder.observe(Buffer.from([8]),lines('third frame'));assert.equal(fs.existsSync(path.join(root,'boss-frame-previous.json')),false);assert.equal(fs.existsSync(path.join(root,'boss-frame-previous.png')),false,'no stale prior PNG is presented as the omitted frame');assert.equal(fs.readFileSync(path.join(root,'boss-frame.png'))[0],8);
 recorder.alignment({beforeImage:Buffer.from([1]),afterImage:Buffer.from([2]),existing:[],before:[],after:[]});recorder.alignment({beforeImage:Buffer.from([1,2,3]),afterImage:Buffer.from([2]),existing:[],before:[],after:[]});
 const alignment=JSON.parse(fs.readFileSync(path.join(root,'boss-alignment.json'),'utf8'));assert.equal(alignment.images.before.imageSaved,false);assert.equal(fs.existsSync(path.join(root,'boss-alignment-before.png')),false);
});
test('retention defers deletion of active scan directories until finishScan',()=>{
 const root=dir(),logger=createDiagnostics(root,{maxScanRuns:1}),a=logger.beginScan('slow'),b=logger.beginScan('current');
 assert.ok(fs.existsSync(a.runDir));assert.ok(fs.existsSync(b.runDir));assert.equal(fs.readdirSync(path.join(root,'scans')).length,2);
 logger.finishScan(a);assert.equal(fs.existsSync(a.runDir),false);assert.ok(fs.existsSync(b.runDir));assert.equal(fs.readdirSync(path.join(root,'scans')).length,1);
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
test('failed marquee pixel pair keeps one pair identity and preserves unknown measurements',()=>{
 const root=dir(),recorder=createScanRecorder(root,'pixel-run'),base='boss-marquee-motion-pair';
 recorder.pixelPair({beforeImage:Buffer.from([1,2]),afterImage:Buffer.from([3,4]),measured:null,scrollbars:0,header:null,range:{start:null,end:5},reason:'motion-unverified'});
 recorder.pixelPair({beforeImage:Buffer.from([8]),afterImage:Buffer.from([9]),measured:12,scrollbars:1,header:2,range:{start:1,end:5},reason:'later-pair'});
 const names=fs.readdirSync(root).sort();assert.deepEqual(names,[`${base}.after.png`,`${base}.before.png`,`${base}.json`]);
 const pair=JSON.parse(fs.readFileSync(path.join(root,`${base}.json`),'utf8'));assert.equal(pair.runId,'pixel-run');assert.equal(pair.pairSequence,0);assert.equal(pair.measured,null);assert.equal(pair.scrollbars,0);assert.equal(pair.header,null);assert.deepEqual(pair.range,{start:null,end:5});assert.equal(pair.reason,'motion-unverified');
 assert.deepEqual(pair.images.before,{imageSaved:true,imageBytes:2});assert.deepEqual(pair.images.after,{imageSaved:true,imageBytes:2});assert.deepEqual(fs.readFileSync(path.join(root,`${base}.before.png`)),Buffer.from([1,2]));assert.deepEqual(fs.readFileSync(path.join(root,`${base}.after.png`)),Buffer.from([3,4]));
});
test('failed marquee pixel pair omits both images when either is missing or over the cap',()=>{
 const root=dir(),recorder=createScanRecorder(root,'pixel-cap-run',{maxImageBytes:2}),base='boss-marquee-motion-pair';
 recorder.pixelPair({beforeImage:Buffer.from([1]),afterImage:Buffer.from([2,3,4]),measured:null,scrollbars:null,header:null,range:null,reason:'unverified'});
 const pair=JSON.parse(fs.readFileSync(path.join(root,`${base}.json`),'utf8'));assert.equal(pair.images.before.imageSaved,false);assert.equal(pair.images.before.imageBytes,1);assert.equal(pair.images.before.omissionReason,'pair-counterpart-omitted');assert.equal(pair.images.after.imageSaved,false);assert.equal(pair.images.after.imageBytes,3);assert.equal(pair.images.after.omissionReason,'image-size-limit');assert.equal(fs.existsSync(path.join(root,`${base}.before.png`)),false);assert.equal(fs.existsSync(path.join(root,`${base}.after.png`)),false);
 const missingRoot=path.join(root,'missing'),missing=createScanRecorder(missingRoot,'missing-run');missing.pixelPair({beforeImage:null,afterImage:Buffer.from([7]),measured:null,scrollbars:null,header:null,range:null,reason:'missing-frame'});
 const missingPair=JSON.parse(fs.readFileSync(path.join(missingRoot,`${base}.json`),'utf8'));assert.equal(missingPair.images.before.imageSaved,false);assert.equal(missingPair.images.before.imageBytes,0);assert.equal(missingPair.images.before.omissionReason,'image-missing');assert.equal(missingPair.images.after.imageSaved,false);assert.equal(missingPair.images.after.imageBytes,1);assert.equal(missingPair.images.after.omissionReason,'pair-counterpart-omitted');assert.equal(fs.existsSync(path.join(missingRoot,`${base}.before.png`)),false);assert.equal(fs.existsSync(path.join(missingRoot,`${base}.after.png`)),false);
});
