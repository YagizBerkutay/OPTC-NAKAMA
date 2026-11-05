import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const {modalIdentity}=require('../electron/boss-behavior-core.cjs');
const {headerHash,sameHeader,createBehaviorReader}=require('../electron/boss-behavior.cjs');
const {selectionButtons,createQuestRestrictionReader}=require('../electron/quest-restrictions.cjs');
const {readRequirementButton}=require('../electron/quest-requirement-button.cjs');
const load=(name:string)=>({image:fs.readFileSync(new URL('./fixtures/boss-behavior/'+name+'.png',import.meta.url)),ocr:JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/'+name+'.json',import.meta.url),'utf8'))});
const hash=(p:ReturnType<typeof load>)=>headerHash(p.image,p.ocr.width,p.ocr.height,modalIdentity(p.ocr),p.ocr);
test('Judge title omitted by full-screen OCR is recovered from the actual title pixels',{skip:process.platform!=='win32'},async()=>{
 const {enrichTitle}=require('../electron/behavior-page.cjs');
 const {closeOCR}=require('../electron/rule-ocr.cjs');
 const title=fs.readFileSync(new URL('./fixtures/pka-header/judge-title.png',import.meta.url));
 const image=await sharp({create:{width:900,height:1600,channels:3,background:'black'}}).composite([{input:title,left:99,top:152}]).png().toBuffer();
 const lines=[['Difficulty 1 1',268],['QUEST GUIDE',345],['OK',1330]].map(([text,y])=>({text,words:[{text,x:300,y,width:200,height:30}]}));
 const raw={width:900,height:1600,lines,text:lines.map(line=>line.text).join('\n')};
 try{
  assert.equal(modalIdentity(raw),null);
  const identity=modalIdentity(await enrichTitle(image,raw));
  assert.equal(identity?.title,'Clash!! Judge: Tyrannical Father');
  assert.equal(identity?.difficulty,11);
 }finally{await closeOCR();}
});
test('real Clash title moving 14 pixels is the same quest; difficulty and different title remain guarded',async()=>{
 const a=load('clash-moving-title-a'),b=load('clash-moving-title-b');
 const before=await hash(a),after=await hash(b);assert.equal(sameHeader(before,after),true);
 // Even a one-word change at the same position must not share the old rule.
 const changed=structuredClone(b.ocr);changed.lines.find((l:any)=>/Clash/.test(l.text)).words.find((w:any)=>w.text==='Magellan').text='Crocodile';
 assert.equal(sameHeader(before,await hash({...b,ocr:changed})),false);
 const image=await sharp(b.image).composite([{input:Buffer.from('<svg width="24" height="36"><rect width="24" height="36" fill="black"/></svg>'),left:562,top:265}]).png().toBuffer();
 assert.equal(sameHeader(before,await hash({...b,image})),false);
 const unknown=structuredClone(b.ocr);unknown.lines=unknown.lines.filter((l:any)=>!/Clash/.test(l.text));
 assert.equal(sameHeader(before,await headerHash(b.image,900,1600,modalIdentity(b.ocr),unknown)),false);
});
test('PKA keeps its original fixed header guard and never uses the Clash marquee signature',async()=>{
 const image=fs.readFileSync(new URL('./fixtures/pka-guide/expanded-80-99.png',import.meta.url)),ocr=JSON.parse(fs.readFileSync(new URL('./fixtures/pka-guide/page-5.json',import.meta.url),'utf8'));
 const raw=await headerHash(image,900,1600);assert.equal(await headerHash(image,900,1600,modalIdentity(ocr),ocr),raw);
 assert.equal(raw.startsWith('quest-header:'),false);assert.equal(sameHeader(raw,await hash(load('clash-moving-title-a'))),false);
});

test('recorded Lucci header survives joined and split OCR words with unchanged difficulty',async()=>{
 const a=load('clash-lucci-split-title'),b=load('clash-lucci-joined-title');
 assert.notEqual(modalIdentity(a.ocr).title,modalIdentity(b.ocr).title);
 const before=await hash(a),after=await hash(b);
 assert.equal(sameHeader(before,after),true);assert.equal(sameHeader(after,before),true);
 const {sameQuestModal}=require('../electron/quest-header.cjs');
 assert.equal(sameQuestModal({identity:modalIdentity(a.ocr),header:before},{identity:modalIdentity(b.ocr),header:after},sameHeader),true);
 const changed=structuredClone(b.ocr);
 changed.lines.find((l:any)=>/Clash/.test(l.text)).words.find((w:any)=>w.text==='Lucci:').text='Kaku:';
 assert.equal(sameHeader(before,await hash({...b,ocr:changed})),false);
 const image=await sharp(b.image).composite([{input:Buffer.from('<svg width="24" height="36"><rect width="24" height="36" fill="black"/></svg>'),left:562,top:265}]).png().toBuffer();
 assert.equal(sameHeader(before,await hash({...b,image})),false);
});

test('scanner keeps reading the same boss when OCR segmentation changes after a swipe',async()=>{
 const a=load('clash-lucci-split-title'),b=load('clash-lucci-joined-title'),headers=await Promise.all([hash(a),hash(b)]);
 const pages=[0,2,4,6,8].map(n=>JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/page-'+n+'.json',import.meta.url),'utf8')));
 let index=0,segmentation=0;const inputs:string[]=[];
 const reader=require('../electron/boss-behavior.cjs').createBehaviorReader({
  capture:async()=>({image:Buffer.from([index,segmentation++%2]),width:900,height:1600}),
  ocr:async(image:Buffer)=>{
   const ocr=structuredClone(pages[image[0]]),title=(image[1]?b:a).ocr.lines.find((l:any)=>/Clash/.test(l.text));
   ocr.lines=ocr.lines.filter((l:any)=>!l.words.some((w:any)=>w.y>1600*.09&&w.y<1600*.15));ocr.lines.push(title);return ocr;
  },
  scrollbar:async(image:Buffer)=>({known:true,top:image[0]===0,bottom:image[0]===4}),
  headerHash:async(image:Buffer)=>headers[image[1]],difficulty:async()=>11,
  readRestrictions:async()=>({status:'verified'}),
  input:async(_e:string,_d:string,action:string)=>{inputs.push(action);index++;},wait:async()=>{}
 });
 const result=await reader.read('adb','device');
 assert.equal(result.observation.complete,true);assert.equal(result.stages.length,5);assert.equal(result.difficulty,'11★');
 assert.deepEqual(inputs,['down','down','down','down']);
});
test('recorded Clash CONNECTING frame waits for the same modal instead of becoming a changed-screen error',async()=>{
 const loading=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/clash-connecting.json',import.meta.url),'utf8'));
 const restart=load('clash-title-loop-restart').ocr;
 const {pendingQuestModal}=require('../electron/quest-header.cjs'),{createBehaviorReader}=require('../electron/boss-behavior.cjs');
 assert.equal(pendingQuestModal(loading),true);assert.equal(pendingQuestModal({...loading,lines:[]}),false);assert.equal(pendingQuestModal(restart),true,'Clash!! I at a marquee restart is not a boss identity');assert.equal(pendingQuestModal(load('clash-title-loop-start').ocr),false);
 const pages=[0,2,4,6,8].map(n=>JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/page-'+n+'.json',import.meta.url),'utf8')));
 let index=0,pending=2;const inputs:string[]=[],progress:string[]=[];
 const reader=createBehaviorReader({capture:async()=>({image:Buffer.from([pending?253+pending--:index]),width:900,height:1600}),ocr:async(b:Buffer)=>b[0]===255?loading:b[0]===254?restart:pages[b[0]],scrollbar:async(b:Buffer)=>({known:true,top:b[0]===0,bottom:b[0]===4}),headerHash:async()=>'same',difficulty:async()=>9,input:async(_e:string,_d:string,a:string)=>{inputs.push(a);index++;},wait:async()=>{}});
 const result=await reader.read('adb','device',(t:string)=>progress.push(t));assert.equal(result.stages.length,5);assert.equal(result.observation.complete,true);assert.ok(progress.some(t=>t.includes('yükleniyor')));assert.deepEqual(inputs,['down','down','down','down']);
});
test('a partial QUEST GUIDE transition retries until its identity is readable, but unknown screens fail before input',async()=>{
 const loading=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/clash-connecting.json',import.meta.url),'utf8')),partial={...loading,text:'QUEST GUIDE',lines:loading.lines.filter((line:any)=>/QUEST GUIDE/i.test(line.text))},pages=[0,2,4,6,8].map(n=>JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/page-'+n+'.json',import.meta.url),'utf8')));
 const {createBehaviorReader}=require('../electron/boss-behavior.cjs');let index=0,first=true,inputs:string[]=[],captures=0;
 const reader=createBehaviorReader({capture:async()=>({image:Buffer.from([captures++]),width:900,height:1600}),ocr:async(image:Buffer)=>{if(first){first=false;return partial;}return pages[index];},scrollbar:async(image:Buffer)=>({known:true,top:index===0,bottom:index===4}),headerHash:async()=>'same',difficulty:async()=>9,input:async(_e:string,_d:string,a:string)=>{inputs.push(a);index++;},wait:async()=>{}});
 const result=await reader.read('adb','device');assert.equal(result.stages.length,5);assert.ok(captures>1);assert.deepEqual(inputs,['down','down','down','down']);
 const wrongInputs:string[]=[],wrong={width:900,height:1600,text:'Settings',lines:[{text:'Settings',words:[{text:'Settings',x:20,y:100,width:150,height:30}]}]};
 const wrongReader=createBehaviorReader({capture:async()=>({image:Buffer.from([0]),width:900,height:1600}),ocr:async()=>wrong,scrollbar:async()=>({known:true,top:true,bottom:true}),headerHash:async()=>'same',difficulty:async()=>9,input:async(_e:string,_d:string,a:string)=>wrongInputs.push(a)});
 await assert.rejects(wrongReader.read('adb','device'),/farklı ekrana/);assert.deepEqual(wrongInputs,[]);
});
test('cancelling a boss read aborts only its active OCR waiter and prevents input',async()=>{
 let entered!:()=>void,signal:AbortSignal|undefined,inputs:string[]=[];const started=new Promise<void>(r=>entered=r),reader=createBehaviorReader({capture:async()=>({image:Buffer.from([0]),width:900,height:1600}),ocr:async(_image:Buffer,options:any)=>{signal=options?.signal;entered();return new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(Error('OCR request cancelled.')),{once:true}));},scrollbar:async()=>({known:true,top:true,bottom:true}),headerHash:async()=>'same',difficulty:async()=>9,input:async(_e:string,_d:string,a:string)=>inputs.push(a)});
 const read=reader.read('adb','device');await started;reader.cancel();await assert.rejects(read,/cancel/i);assert.equal(signal?.aborted,true);assert.deepEqual(inputs,[]);
});
test('the same read signal reaches deferred OCR in prepare, restrictions and PKA phases',async()=>{
 const fixture=load('clash-lucci-split-title').ocr,pka=JSON.parse(fs.readFileSync(new URL('./fixtures/pka-guide/page-5.json',import.meta.url),'utf8'));
 async function cancelledAt(io:any,started:Promise<void>){const reader=createBehaviorReader({capture:async()=>({image:Buffer.from([0]),width:900,height:1600}),ocr:async()=>fixture,scrollbar:async()=>({known:true,top:true,bottom:true}),headerHash:async()=>'same',difficulty:async()=>9,...io}),read=reader.read('adb','device');await started;reader.cancel();await assert.rejects(read,/cancel/i);}
 for(const phase of ['prepare','restrictions','pka']){let signal:AbortSignal|undefined,enter!:()=>void;const entered=new Promise<void>(r=>enter=r),wait=async(check:any)=>{signal=check.signal;enter();return new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(Error('OCR request cancelled.')),{once:true}));},io:any={};
  if(phase==='prepare')io.prepare=async(_e:string,_d:string,check:any)=>wait(check);
  if(phase==='restrictions')io.readRestrictions=async(_e:string,_d:string,_first:any,_identity:any,check:any)=>wait(check);
  if(phase==='pka'){io.ocr=async()=>pka;io.readPKA=async(_e:string,_d:string,_first:any,check:any)=>wait(check);}
  await cancelledAt(io,entered);assert.equal(signal?.aborted,true,phase+' should receive the active read signal');
 }
});
test('legacy modal adapters also reject a different boss even when their pixel signature is reused',()=>{
 const {sameQuestModal}=require('../electron/quest-header.cjs'),identity=modalIdentity(load('clash-moving-title-a').ocr),snap={identity,header:'same'};
 assert.equal(sameQuestModal(snap,{...snap,identity:{...identity,title:'Clash!! Crocodile'}},sameHeader),false);
 assert.equal(sameQuestModal(snap,{...snap,identity:{...identity,level:100}},sameHeader),false);
});
test('real red REQUIREMENT missed by full OCR is recovered from measured red ink',{skip:process.platform!=='win32'},async()=>{
 const {image,ocr}=load('clash-red-requirement');assert.equal(selectionButtons(ocr).requirement,undefined);
 const button=await readRequirementButton(image,ocr,require('../electron/rule-ocr.cjs').ocrBuffer);
 assert.ok(button);assert.equal(button.text,'REQUIREMENT');assert.ok(button.x>500&&button.x<530&&button.y>1080&&button.y<1120);
 assert.ok(selectionButtons({...ocr,lines:[...ocr.lines,{text:button.text,words:[button]}]}).requirement);
 const blank=await sharp(image).composite([{input:Buffer.from('<svg width="150" height="48"><rect width="150" height="48" fill="black"/></svg>'),left:514,top:1091}]).png().toBuffer();
 assert.equal(await readRequirementButton(blank,ocr,()=>{throw Error('missing button must not trigger OCR');}),null);
 assert.equal(await readRequirementButton(image,ocr,async()=>({text:'BATTLE'})),null,'red pixels alone never authorize the button');
});
test('missing red requirement remains unverified and cannot silently become an unrestricted quest',async()=>{
 const {ocr}=load('clash-red-requirement'),identity=modalIdentity(load('clash-moving-title-a').ocr),modal={identity,header:'fixed'},inputs:string[]=[];
 let n=0;const reader=createQuestRestrictionReader({observe:async()=>n++<2?{ocr,identity:null}:modal,sameHeader:(a:string,b:string)=>a===b,input:async(_e:string,_d:string,a:string)=>inputs.push(a)});
 const result=await reader.read('adb','device',modal,identity,()=>{},()=>{});assert.equal(result.status,'unverified');assert.deepEqual(inputs,['closeGuide','openDetails','questGuide']);
});
