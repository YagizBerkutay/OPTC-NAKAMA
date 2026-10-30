import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRequire} from 'node:module';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {EventEmitter} from 'node:events';
import {applyAutomaticKizuna,onlineImport,sameEvent,kizunaTargetChanged,type KizunaAutoResult,type KizunaOnline} from '../src/kizuna-auto';
import {newKizunaSetup,kizunaProblem,validateKizunaSetup} from '../src/kizuna';
import type {Character} from '../src/model';
const require=createRequire(import.meta.url),online=require('../electron/kizuna-online.cjs');
const now=new Date('2026-10-21T19:00:00Z'),origin='https://e9wiki.com',url=origin+'/optc/en/notices/123';
const cards=[{id:'101',name:'QA A',types:['STR'],stars:'6'},{id:'102',name:'QA B',types:['QCK'],stars:'5'}] as Character[];
const effects='Boosts Kizuna Tickets earned by 1.4x, boosts Super Boss Tokens earned by 1.2x, stats boosted by 5x, Special charge time reduced by 15 turns at start of quest!';
const notice='<h1>Pirate Alliance Kizuna Clash!! Vs. QA</h1><p>Certain Characters Powered Up!<span class="font-medium">'+effects+'</span></p><div class="grid"><a href="/optc/en/characters/99101"></a></div><p><span class="font-medium">When owned, boosts Kizuna Tickets earned by 1.2x!</span></p><div class="grid"><a href="/optc/en/characters/99102"></a></div><p>About Kizuna Clash!!</p>';
const index='<a href="/optc/en/notices/123" data-notice-title="Pirate Alliance Kizuna Clash!! Vs. QA">Oct. 20 (19:00) - Oct. 25 (05:59) PST</a><a href="/optc/en/notices/124" data-notice-title="Pirate Alliance Kizuna Clash!! Sugo-Fest!">Oct. 16 (19:00) - Oct. 25 (05:59) PST</a>';
const event:KizunaOnline={title:'Pirate Alliance Kizuna Clash!! Vs. QA',url,startsAt:'2026-10-21T03:00:00.000Z',endsAt:'2026-10-25T13:59:00.000Z',fetchedAt:now.toISOString(),warnings:[],groups:[{text:effects,scope:'crew',ids:['101'],gameIds:['99101']},{text:'When owned, boosts Kizuna Tickets earned by 1.2x!',scope:'owned',ids:['102'],gameIds:['99102']}]};
function result():KizunaAutoResult{return {event,live:{target:{title:'Vs. QA',remainingHP:'1000000',maxHP:'1000000',level:31,difficulty:10,enemyType:'QCK',observedAt:now.toISOString()},boss:{id:'qa',name:'Vs. QA',difficulty:'10★',source:'MuMu QA',training:false,reviewed:'2026-10-21',notes:'QA',restrictions:{status:'verified',source:'QA',text:'No requirement',quest:'QA',difficulty:10,warnings:[]},observation:{observedAt:now.toISOString(),quest:'QA',difficulty:10,level:31,complete:true,pages:3,fingerprint:'qa',warnings:[]},stages:[{id:'s1',name:'Battle 1',turn:0,requirements:[],notes:''},{id:'s2',name:'Battle 2',turn:1,requirements:[],notes:''},{id:'s3',name:'Battle 3',turn:2,requirements:[],notes:'',hp:1000000,enemyType:'QCK'}]},bonusPages:[],bonusComplete:false},warnings:[]};}
test('online discovery distinguishes the active Global event from Sugo-Fest and stale notices',()=>{
 const links=online.eventLinks(index);assert.equal(links.length,1);assert.equal(links[0].url,url);
 const period=online.schedule(links[0].dateText,now);assert.equal(period.startsAt,event.startsAt);assert.equal(period.endsAt,event.endsAt);
 assert.equal(online.schedule(links[0].dateText,new Date('2026-11-01')),null);assert.equal(online.schedule('Oct. 20 - Oct. 25 PST',now),null);
 assert.equal(online.schedule('Oct. 20 (19:00) - Oct. 25 (05:59) JST',now),null);
});

test('active event discovery survives the notice leaving the short homepage list',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nakama-kizuna-online-test-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const calls:string[]=[];
 const service=online.createService(folder,{clock:()=>now,load:async(link:string)=>{calls.push(link);if(link===origin+'/optc/en')return '<a href="/optc/en/notices/999">Notice Correction</a>';if(link===origin+'/optc/en/notices')return index;if(link===url)return notice;return '<meta name="description" content="QA (No.'+(link.endsWith('99101')?'101':'102')+', 6★)">';}});
 const r=await service.read();assert.equal(r.title,event.title);assert.equal(r.startsAt,event.startsAt);assert.ok(calls.includes(origin+'/optc/en/notices'));
});

test('notice discovery can recover from a homepage outage without borrowing expired cached rules',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nakama-kizuna-online-test-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 const service=online.createService(folder,{clock:()=>now,load:async(link:string)=>{if(link===origin+'/optc/en')throw Error('HTTP 503');if(link===origin+'/optc/en/notices')return index;if(link===url)return notice;return '<meta name="description" content="QA (No.'+(link.endsWith('99101')?'101':'102')+', 6★)">';}});
 assert.equal((await service.read()).url,url);
});
test('online URLs cannot fetch arbitrary hosts, credentials, IPs, article paths or query strings',()=>{
 for(const value of ['http://e9wiki.com/optc/en','https://evil.test/optc/en','https://127.0.0.1/optc/en','https://user:pass@e9wiki.com/optc/en','https://e9wiki.com/optc/en?token=secret','https://e9wiki.com/optc/en/characters/../private'])assert.throws(()=>online.safeUrl(value));
 assert.equal(online.safeUrl(url).href,url);
});
test('notice parsing preserves per-group card links and owning a card is a distinct scope',()=>{
 const groups=online.noticeGroups(notice);assert.equal(groups.length,2);assert.deepEqual(groups[0].gameIds,['99101']);assert.equal(groups[0].scope,'crew');assert.equal(groups[1].scope,'owned');assert.deepEqual(groups[1].gameIds,['99102']);
 assert.equal(online.characterNumber('<meta name="description" content="Name (No.101, 6★, DEX): HP 100">'),'101');assert.throws(()=>online.characterNumber('<h1>Unknown ID 101</h1>'));
});
test('automatic internet intake fetches and caches exact log numbers with no URL supplied by the user',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nakama-kizuna-online-test-'));t.after(()=>{assert.ok(folder.startsWith(path.join(os.tmpdir(),'nakama-kizuna-online-test-')));fs.rmSync(folder,{recursive:true,force:true});});
 const calls:string[]=[];const load=async(link:string)=>{calls.push(link);if(link===origin+'/optc/en')return index;if(link===url)return notice;return '<meta name="description" content="QA (No.'+(link.endsWith('99101')?'101':'102')+', 6★)">';};
 const service=online.createService(folder,{load,clock:()=>now});const first=await service.read();assert.deepEqual(first.groups[0].ids,['101']);assert.deepEqual(first.warnings,[]);assert.equal(calls.filter(l=>l.includes('/characters/')).length,2);
 calls.length=0;await service.read();assert.equal(calls.filter(l=>l.includes('/characters/')).length,0);
});
test('previously verified public card numbers work on a fresh profile without refetching every character page',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nakama-kizuna-online-test-'));t.after(()=>{assert.ok(folder.startsWith(path.join(os.tmpdir(),'nakama-kizuna-online-test-')));fs.rmSync(folder,{recursive:true,force:true});});
 const pairs=Object.entries(require('../electron/kizuna-character-map.json').mapping).slice(0,2) as [string,string][],seeded=notice.replaceAll('99101',pairs[0][0]).replaceAll('99102',pairs[1][0]);
 const service=online.createService(folder,{clock:()=>now,load:async(link:string)=>{if(link===origin+'/optc/en')return index;if(link===url)return seeded;assert.fail('A verified card mapping must not require another network request');}});
 const r=await service.read();assert.deepEqual(r.groups.map((g:any)=>g.ids),pairs.map(p=>[p[1]]));assert.deepEqual(r.warnings,[]);assert.notEqual(pairs[0][0],pairs[0][1]);
});
test('internet cancellation does not complete a late request or silently reuse expired event data',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nakama-kizuna-online-test-'));t.after(()=>{assert.ok(folder.startsWith(path.join(os.tmpdir(),'nakama-kizuna-online-test-')));fs.rmSync(folder,{recursive:true,force:true});});
 const service=online.createService(folder,{clock:()=>now,load:(_url:string,signal:AbortSignal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))});
 const pending=service.read();service.cancel();await assert.rejects(pending,/aborted/);assert.equal(fs.existsSync(path.join(folder,'kizuna-online.json')),false);
 const stale=online.createService(folder,{clock:()=>new Date('2026-11-20'),load:async()=>index});await assert.rejects(stale.read(),/bulunamadı/);
});

test('internet event intake has no overall ninety-second deadline while requests are still completing',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nakama-kizuna-online-test-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});t.mock.timers.enable({apis:['setTimeout']});
 const service=online.createService(folder,{clock:()=>now,load:async(link:string)=>{if(link===origin+'/optc/en')return index;if(link===url){await gate;return notice;}return '<meta name="description" content="QA (No.'+(link.endsWith('99101')?'101':'102')+', 6★)">';}});
 const pending=service.read();await new Promise(r=>setImmediate(r));t.mock.timers.tick(90001);release();assert.equal((await pending).url,url);
});
test('automatic result fills the exact boss context and bonus roster without per-field confirmation',t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const previous=newKizunaSetup(),before=structuredClone(previous),r=result(),built=applyAutomaticKizuna(previous,r,cards).setup;
 assert.equal(built.confirmed,true);assert.equal(built.level,31);assert.equal(built.levelMax,31);assert.equal(built.maxHP,'1000000');assert.equal(built.enemyType,'QCK');assert.equal(built.profileId,'qa');assert.equal(built.bonusCoverage,'complete');assert.equal(built.bonuses[0].atk,5);assert.equal(built.bonuses[0].tickets,1.4);assert.equal(built.bonuses[0].cooldown,15);assert.equal(built.bonuses.length,1);assert.ok(built.otherEffects.includes('Sahiplik bonusu #102'));assert.deepEqual(previous,before);assert.equal(kizunaProblem(built,r.live!.boss),'');
});
test('event rollover clears old coefficient proofs; source and game mismatch cannot confirm a guide',()=>{
 const old={...newKizunaSetup(),statOrder:'after-flat' as const,rewardStack:'multiply' as const,rewardSource:'old event evidence'};
 const applied=applyAutomaticKizuna(old,result(),cards).setup;assert.equal(applied.statOrder,'unknown');assert.equal(applied.rewardStack,'unknown');assert.equal(applied.rewardSource,'');
 const r=result();r.live!.target.title='Vs. Other';const mismatched=applyAutomaticKizuna(old,r,cards).setup;assert.equal(mismatched.confirmed,false);
 assert.equal(sameEvent(event.title,'Vs. QA'),true);assert.equal(sameEvent(event.title,'Vs. Another QA'),false);
});
test('unknown catalog IDs remain explicit gaps; online data cannot create owned characters',()=>{
 const imported=onlineImport({...event,groups:[...event.groups,{text:'Stats boosted by 2x',scope:'crew',ids:['99999'],gameIds:['12345']}]},cards);assert.equal(imported.rows.length,2);assert.ok(imported.warnings.some(w=>w.includes('99999')));
 const r=result();r.event={...event,groups:[...event.groups,{text:'Stats boosted by 2x',scope:'crew',ids:['99999'],gameIds:['12345']}]};assert.equal(applyAutomaticKizuna(newKizunaSetup(),r,cards).setup.bonusCoverage,'partial');
});
test('Super guide intake retains explicit mode and remaining HP; event dates validate',t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const r=result();r.live!.target.difficulty=13;const setup=applyAutomaticKizuna(newKizunaSetup(),r,cards).setup;assert.equal(setup.mode,'super');assert.equal(setup.remainingHP,r.live!.target.remainingHP);assert.equal(kizunaProblem(setup,r.live!.boss),'');
 assert.throws(()=>validateKizunaSetup({...setup,eventPeriod:{startsAt:'invalid',endsAt:'invalid',source:'QA'}},new Set(['101','102'])));
});
test('live Kizuna helper distinguishes main screens, owns exact HP strings, and rejects unrelated screens',()=>{
 const {mainValues,screenKind,sameName}=require('../electron/kizuna-live.cjs');
 const lines=[['Vs. QA',990],['12345678901234567890 / 22345678901234567890',1070],['Lv. 31',1050],['TIPS Battle: 3 Required: x20',1120],['KIZUNA CLASH LIST',500]].map(([text,y])=>({text:String(text),words:String(text).split(' ').map((text,i)=>({text,x:100+i*100,y,width:80,height:25}))}));
 const ocr={width:900,height:1600,lines,text:lines.map(l=>l.text).join('\n')};assert.equal(screenKind(ocr),'main');assert.equal(mainValues(ocr).maxHP,'22345678901234567890');assert.equal(mainValues(ocr).level,31);assert.equal(sameName('Vs. QA','Pirate Alliance Kizuna Clash!! Vs. QA'),true);assert.equal(screenKind({...ocr,text:'Rumble Shop'}),'unknown');
 const withUse=structuredClone(ocr);withUse.lines[0].words.push({text:'USEF',x:680,y:990,width:80,height:25});assert.equal(mainValues(withUse).title,'Vs. QA');
 assert.throws(()=>mainValues({...ocr,lines:lines.filter(l=>!l.text.startsWith('Lv.'))}));
});
test('automatic service keeps internet results if MuMu is unavailable and does not request a manual source',async()=>{
 const {createService}=require('../electron/kizuna-auto-service.cjs');let calls=0;
 const service=createService('.local',{online:{read:async()=>{calls++;return event;},cancel:()=>true}}),r=await service.read({exe:'',device:'',difficulty:10});assert.equal(r.event,event);assert.equal(r.live,undefined);assert.equal(calls,1);assert.ok(r.warnings[0].includes('MuMu'));
 await assert.rejects(service.read({exe:'',device:'',difficulty:4}),/geçersiz/);assert.equal(calls,1);
});
test('automatic worker switches to live LIST fallback on network failure and preserves cancellation',async()=>{
 const {createService}=require('../electron/kizuna-auto-service.cjs'),workers:any[]=[];
 class FakeWorker extends EventEmitter {data:any;terminated=false;constructor(_file:string,options:any){super();this.data=options.workerData;workers.push(this);}async terminate(){this.terminated=true;}}
 const api={validateAdb:()=>{},validateDevice:()=>{},connect:async()=>{}},input={exe:'qa',device:'127.0.0.1:1',difficulty:10};
 const service=createService('.local',{WorkerClass:FakeWorker,deviceApi:api,online:{read:async()=>{throw Error('network unavailable');},cancel:()=>true}});
 const pending=service.read(input);await new Promise(r=>setImmediate(r));assert.equal(workers[0].data.options.collectBonuses,true);workers[0].emit('message',{type:'result',result:result().live});const response=await pending;assert.equal(response.event,undefined);assert.ok(response.live);assert.ok(response.warnings.some((w:string)=>w.includes('network unavailable')));
 const next=service.read(input);await new Promise(r=>setImmediate(r));service.cancel();await assert.rejects(next,/iptal/);assert.equal(workers[1].terminated,true);workers[1].emit('message',{type:'result',result:result().live});
});

test('automatic reading continues beyond ten minutes, accepts progress and results, and can still be cancelled',async t=>{
 const {createService}=require('../electron/kizuna-auto-service.cjs'),workers:any[]=[],messages:string[]=[];
 class FakeWorker extends EventEmitter {terminated=false;constructor(){super();workers.push(this);}async terminate(){this.terminated=true;}}
 const service=createService('.local',{WorkerClass:FakeWorker,deviceApi:{validateAdb:()=>{},validateDevice:()=>{},connect:async()=>{}},online:{read:async()=>event,cancel:()=>true}}),input={exe:'qa',device:'127.0.0.1:1',difficulty:10};
 t.mock.timers.enable({apis:['setTimeout']});t.after(()=>service.cancel());
 let settled=false;const pending=service.read(input,(text:string)=>messages.push(text)).finally(()=>{settled=true;});await new Promise(r=>setImmediate(r));
 t.mock.timers.tick(600001);await new Promise(r=>setImmediate(r));
 assert.equal(settled,false,'A reader must not end just because ten minutes elapsed');assert.equal(workers[0].terminated,false);
 workers[0].emit('message',{type:'progress',text:'Kayan yazı okunuyor'});assert.deepEqual(messages,['Kayan yazı okunuyor']);
 workers[0].emit('message',{type:'result',result:result().live});assert.deepEqual((await pending).live,result().live);assert.equal(workers[0].terminated,true);
 const cancelled=service.read(input);await new Promise(r=>setImmediate(r));t.mock.timers.tick(3600000);service.cancel();await assert.rejects(cancelled,/iptal/);assert.equal(workers[1].terminated,true);
});
test('Kizuna explicit boss levels select the appropriate alternative, without merging later-level debuffs',()=>{
 const {levelRange,selectLevelTokens,selectedRangeComplete}=require('../electron/kizuna-levels.cjs');
 assert.deepEqual(levelRange('When Lv1&Lv20'),{min:1,max:20});assert.deepEqual(levelRange('When Lv31~'),{min:31,max:Infinity});assert.equal(levelRange('When Lv20'),null);
 assert.deepEqual(levelRange('When LVI &Lv20'),{min:1,max:20});assert.deepEqual(levelRange('When Lv21-vLv30'),{min:21,max:30});
 const tokens=[{kind:'heading',text:'BEHAVIOR'},{kind:'battle',number:1,text:'BATTLE 1'},{kind:'event',text:'PREEMPTIVE'},...[[1,'When Lv1~Lv20','early'],[2,'When Lv21~','middle'],[3,'When Lv31~','late']].flatMap(([n,range,value])=>[{kind:'battle',number:3,variant:String(n),text:'BATTLE 3-'+n},{kind:'line',text:range},{kind:'event',text:'PREEMPTIVE'},{kind:'line',text:value}])];
 for(const [lv,value]of [[3,'early'],[25,'middle'],[40,'late']]){const selected=selectLevelTokens(tokens,lv);assert.deepEqual(selected.tokens.filter((t:any)=>t.kind==='line').map((t:any)=>t.text),[value]);assert.equal(selected.tokens.filter((t:any)=>t.kind==='battle').length,2);}
 const broken=structuredClone(tokens);broken[4].text='When Lv20';assert.throws(()=>selectLevelTokens(broken,3),/aralığı/);
 broken[4].text='When';assert.throws(()=>selectLevelTokens(broken,3),/aralığı/);
 assert.throws(()=>selectLevelTokens(tokens.slice(0,7),30),/aralığı/);
 assert.equal(selectedRangeComplete(tokens,3,3),true);assert.equal(selectedRangeComplete(tokens.slice(0,8),3,3),false);assert.equal(selectedRangeComplete(tokens,40,3),false);assert.equal(selectedRangeComplete(tokens,3,4),false);
});

 test('HP tracking detects exact HP and level changes without joining other events',()=>{
 const a=result().live!.target;
 assert.equal(kizunaTargetChanged(a,{...a}),false);
 for(const patch of [{level:32},{maxHP:'1050000'},{remainingHP:'900000'},{enemyType:'STR'}])assert.equal(kizunaTargetChanged(a,{...a,...patch}),true);
 assert.equal(kizunaTargetChanged(a,{...a,title:'Vs. Other',level:32}),true);
 assert.equal(kizunaTargetChanged(a,{...a,difficulty:13}),true);
 });
 test('target probe skips internet and returns null during battle without reading guides',async()=>{
 const {createService}=require('../electron/kizuna-auto-service.cjs');const workers:any[]=[];
 class FakeWorker extends EventEmitter{data:any;constructor(_file:string,o:any){super();this.data=o.workerData;workers.push(this);}async terminate(){}}
 const service=createService('.local',{WorkerClass:FakeWorker,deviceApi:{validateAdb:()=>{},validateDevice:()=>{},connect:async()=>{}},online:{read:async()=>assert.fail('probe must not fetch internet'),cancel:()=>true}});
 const input={exe:'qa',device:'127.0.0.1:1',difficulty:10};
 const pending=service.readTarget(input);await new Promise(r=>setImmediate(r));assert.equal(workers[0].data.options.observe,true);
 workers[0].emit('message',{type:'result',result:null});assert.equal(await pending,null);
 const next=service.readTarget(input);await new Promise(r=>setImmediate(r));workers[1].emit('message',{type:'result',result:result().live!.target});assert.deepEqual(await next,result().live!.target);
 });

 test('target OCR retains Battle count when the original row also contains the replaced TIPS crop',async()=>{
 const {createReader,mainValues}=require('../electron/kizuna-live.cjs');
 const line=(text:string,x:number,y:number)=>({text,words:[{text,x,y,width:80,height:20}]});
 const base={width:900,height:1600,text:'KIZUNA CLASH TIPS Vs. QA Battle: 3',lines:[line('Vs. QA',160,995),line('850000000 850000000',260,1070),line('TIPS Battle: 3',70,1114)]};
 const reader=createReader({capture:async()=>({image:Buffer.from('qa'),width:900,height:1600}),readOCR:async(_image:any,options:any)=>{
 if(!options.crop)return structuredClone(base);
 const c=options.crop,text=c.left===180?'Battle: 3':c.left>600?'Lv. 1':c.left===144?'Vs. QA':'TIPS';
 return {width:900,height:1600,text,lines:[line(text,c.left,c.left>600?1044:c.top)]};
 }});
 const snap=await reader.observe('qa','qa');assert.equal(mainValues(snap.ocr).battles,3);assert.equal(mainValues(snap.ocr).maxHP,'850000000');
 });

test('Kizuna main screen uses stable quest landmarks when animated logo OCR is unreadable',()=>{
 const {screenKind}=require('../electron/kizuna-live.cjs');
 const text='K!zUorA CLAST-I!! LIST TIPS Vs. Koala Battle: 3 Required: x20';
 assert.equal(screenKind({width:900,height:1600,lines:[],text}),'main');
 assert.equal(screenKind({width:900,height:1600,lines:[],text:text.replace('Battle: 3','')}),'main');
 for(const bad of ['RUMBLE TIPS Vs. Koala','LIST TIPS Vs. Koala','LIST TIPS Required: x20'])assert.equal(screenKind({width:900,height:1600,lines:[],text:bad}),'unknown');
});

test('Kizuna reads target crops when full-frame OCR misses both Vs title and TIPS',async()=>{
 const {createReader,mainValues}=require('../electron/kizuna-live.cjs');
 const line=(text:string,x:number,y:number)=>({text,words:[{text,x,y,width:80,height:20}]});
 const lines=[line('HELP',250,520),line('KizuåA CLASH!!',300,470),line('13738800 / 13738800',290,1070),line('X10 Required: X20',480,1110),line('Battle: 3 Obtained',190,1110)];
 const raw={width:900,height:1600,lines,text:lines.map(l=>l.text).join('\n')};
 const reader=createReader({capture:async()=>({image:Buffer.from('qa'),width:900,height:1600}),act:async()=>assert.fail('Observation must not send inputs'),readOCR:async(_image:any,{crop}:any)=>{
  if(!crop)return structuredClone(raw);
  const text=crop.left===180?'Battle: 3':crop.left>600?'3':crop.left===144?'vs. Koala':'TIPS';
  return {width:900,height:1600,text,lines:[line(text,crop.left,crop.left>600?1047:crop.top)]};
 }});
 const snap=await reader.observe('qa','qa');assert.equal(snap.kind,'main');
 assert.deepEqual(mainValues(snap.ocr),{title:'vs. Koala',remainingHP:'13738800',maxHP:'13738800',level:3,battles:3});
});

test('candidate landmarks never authorize inputs without independently readable target title and TIPS',async()=>{
 const {createReader}=require('../electron/kizuna-live.cjs');
 for(const missing of ['title','tips']){
  const line=(text:string,x:number,y:number)=>({text,words:[{text,x,y,width:80,height:20}]});
  const reader=createReader({capture:async()=>({image:Buffer.from('qa'),width:900,height:1600}),act:async()=>assert.fail('Unverified screen must not send inputs'),wait:async()=>{},readOCR:async(_image:any,{crop}:any)=>{
   if(!crop)return {width:900,height:1600,text:'LIST Battle: 3 Required: x20',lines:[line('LIST Battle: 3 Required: x20',200,1110)]};
   const text=crop.left===180?'Battle: 3':crop.left>600?'3':crop.left===144?(missing==='title'?'Unreadable':'Vs. Koala'):(missing==='tips'?'Unreadable':'TIPS');
   return {width:900,height:1600,text,lines:[line(text,crop.left,crop.top)]};
  }});
  assert.equal((await reader.observe('qa','qa')).kind,'unknown');
  await assert.rejects(reader.read('qa','qa'),/Kizuna ana ekranını/);
 }
});

test('Kizuna waits for the connection overlay before measuring difficulty or closing a guide',async t=>{
 const {createReader}=require('../electron/kizuna-live.cjs'),behavior=require('../electron/boss-behavior.cjs');
 const guide=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/page-0.json',import.meta.url),'utf8'));
 guide.lines=guide.lines.filter((l:any)=>!l.words.some((w:any)=>w.y>160&&w.y<210));guide.lines.push({text:'Vs. QA',words:[{text:'Vs. QA',x:300,y:180,width:180,height:24}]});guide.text=guide.lines.map((l:any)=>l.text).join('\n');
 let captures=0,inputs=0;const ready=structuredClone(guide),loading={...guide,text:guide.text+'\nCONNECTING...'};
 t.mock.method(behavior,'difficultyNumber',async()=>{assert.ok(captures>=2,'Difficulty cannot be measured through the overlay');return 10;});
 const reader=createReader({capture:async()=>({image:Buffer.from(String(++captures)),width:900,height:1600}),readOCR:async(image:Buffer)=>image.toString()==='1'?loading:ready,wait:async()=>{},act:async()=>{inputs++;assert.ok(captures>=2);throw Error('verified-close');}});
 await assert.rejects(reader.read('qa','qa'),/verified-close/);assert.equal(inputs,1);
});

test('a loading-only frame keeps its loading retry budget even before the guide is recognized',async t=>{
 const {createReader}=require('../electron/kizuna-live.cjs'),behavior=require('../electron/boss-behavior.cjs');
 const guide=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/page-0.json',import.meta.url),'utf8'));
 guide.lines=guide.lines.filter((l:any)=>!l.words.some((w:any)=>w.y>160&&w.y<210));guide.lines.push({text:'Vs. QA',words:[{text:'Vs. QA',x:300,y:180,width:180,height:24}]});guide.text=guide.lines.map((l:any)=>l.text).join('\n');
 let captures=0,inputs=0;
 t.mock.method(behavior,'difficultyNumber',async()=>{assert.ok(captures>=5);return 10;});
 const reader=createReader({capture:async()=>({image:Buffer.from(String(++captures)),width:900,height:1600}),readOCR:async(image:Buffer)=>Number(image.toString())<5?{width:900,height:1600,text:'CONNECTING...',lines:[]}:guide,wait:async()=>{},act:async()=>{inputs++;assert.ok(captures>=5);throw Error('verified-close');}});
 await assert.rejects(reader.read('qa','qa'),/verified-close/);assert.equal(inputs,1);
});

test('difficulty navigation reaches 3 stars from Super through a measured visible intermediate target',async t=>{
 const {createReader}=require('../electron/kizuna-live.cjs'),behavior=require('../electron/boss-behavior.cjs');
 const line=(text:string,x:number,y:number)=>({text,words:[{text,x,y,width:80,height:20}]});
 const guide=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/page-0.json',import.meta.url),'utf8'));guide.lines=guide.lines.filter((l:any)=>!l.words.some((w:any)=>w.y>160&&w.y<210));guide.lines.push(line('Vs. QA',300,180));guide.text=guide.lines.map((l:any)=>l.text).join('\n');
 const main={width:900,height:1600,lines:[line('KIZUNA CLASH LIST',300,500),line('Vs. QA',160,995),line('1000000 / 1000000',260,1070),line('TIPS Battle: 3 Required: x20',70,1114)],text:'KIZUNA CLASH LIST Vs. QA TIPS Battle: 3 Required: x20'};
 let phase='guide',selected=13;const measured:number[]=[],taps:number[]=[];
 t.mock.method(behavior,'difficultyNumber',async()=>{measured.push(selected);return selected;});
 const reader=createReader({capture:async()=>({image:Buffer.from(phase),width:900,height:1600}),wait:async()=>{},readOCR:async(image:Buffer,{crop}:any)=>{
  if(!crop)return structuredClone(image.toString()==='guide'?guide:main);
  const text=crop.left===180?'Battle: 3':crop.left>600?'1':crop.left===144?'Vs. QA':'TIPS';return {width:900,height:1600,text,lines:[line(text,crop.left,crop.left>600?1047:crop.top)]};
 },act:async(_e:string,_d:string,action:string,_snap:any,rect:any)=>{
  if(action==='hold'){phase='guide';return;}
  if(rect.y>1200&&rect.y<1250){taps.push(Math.round(rect.x));if(taps.length===2)throw Error('final-visible-target');selected=7;}
  phase='main';
 }});
 await assert.rejects(reader.read('qa','qa',{difficulty:3}),/final-visible-target/);assert.deepEqual(taps,[144,297]);assert.deepEqual(measured,[13,7]);
});

test('real Kizuna difficulty headers exclude the star icon when full-frame OCR omits the numeral',{skip:process.platform!=='win32'},async()=>{
 const {difficultyNumber}=require('../electron/boss-behavior.cjs');
 for(const difficulty of [3,7,10,13]){
  const image=fs.readFileSync(new URL('./fixtures/kizuna/difficulty-'+difficulty+'.png',import.meta.url));
  assert.equal(await difficultyNumber(image,{difficultyRow:{words:[{text:'Difficulty',x:298.5,y:19,width:149,height:34}]}}),difficulty);
 }
});
