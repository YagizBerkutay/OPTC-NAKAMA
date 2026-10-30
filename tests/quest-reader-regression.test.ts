import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const {modalIdentity}=require('../electron/boss-behavior-core.cjs');
const {headerHash,sameHeader}=require('../electron/boss-behavior.cjs');
const {selectionButtons,createQuestRestrictionReader}=require('../electron/quest-restrictions.cjs');
const {readRequirementButton}=require('../electron/quest-requirement-button.cjs');
const load=(name:string)=>({image:fs.readFileSync(new URL('./fixtures/boss-behavior/'+name+'.png',import.meta.url)),ocr:JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/'+name+'.json',import.meta.url),'utf8'))});
const hash=(p:ReturnType<typeof load>)=>headerHash(p.image,p.ocr.width,p.ocr.height,modalIdentity(p.ocr),p.ocr);
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
