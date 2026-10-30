import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const {readBehaviorPage}=require('../electron/boss-behavior.cjs'),{modalIdentity,pageTokens,mergeTokens}=require('../electron/boss-behavior-core.cjs'),{recoverPreemptive,outlinedTriggerBoxes}=require('../electron/starting-state-ocr.cjs');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/ace-preemptive-merge.json',import.meta.url),'utf8'));
const before=fs.readFileSync(new URL('./fixtures/boss-behavior/ace-preemptive-before.png',import.meta.url)),after=fs.readFileSync(new URL('./fixtures/boss-behavior/ace-preemptive-after.png',import.meta.url));
test('actual Ace 11-star page pair recovers omitted fixed PREEMPTIVE badges and preserves separate repeated branches',{skip:process.platform!=='win32'},async()=>{
 const page=Symbol(),restore=(list:any[])=>list.map(t=>Object.defineProperty({...t},'position',{value:{...t.position,page}}));
 assert.throws(()=>mergeTokens(restore(fixture.before),restore(fixture.after),fixture.evidence),/birleştir/);
 const a=await readBehaviorPage(before),b=await readBehaviorPage(after),left=pageTokens(a,modalIdentity(a)),right=pageTokens(b,modalIdentity(b));
 assert.equal(left.filter((t:any)=>t.trigger==='preemptive').length,2);assert.equal(right.filter((t:any)=>t.trigger==='preemptive').length,1);
 const joined=mergeTokens(left,right,fixture.evidence);assert.equal(joined.filter((t:any)=>t.trigger==='preemptive').length,2);
 assert.equal(joined.filter((t:any)=>t.text==='Remove Beneficial Effects').length,2);assert.equal(joined.filter((t:any)=>/6000 damage Burn/.test(t.text)).length,2);
 assert.equal(joined.filter((t:any)=>t.trigger==='interrupt').length,1);
});
test('cyan pixels alone or unrelated OCR cannot create a preemptive trigger',async()=>{
 const boxes=await outlinedTriggerBoxes(before,fixture.body,'cyan');assert.equal(boxes.length,2);
 const image=await sharp(before).modulate({brightness:.98}).png().toBuffer(),ocr={width:900,height:1600,text:'',lines:[]};
 const result=await recoverPreemptive(image,ocr,fixture.body,async()=>({text:'UNKNOWN',lines:[]}));assert.equal(result.lines.length,0);
});
test('effect icons and moving coloured condition words cannot move the fixed row anchor',()=>{
 const word=(text:string,x:number,y:number,height:number)=>({text,x,y,height,width:40}),identity={body:fixture.body};
 const effect=word('98 turn(s) Delay Immunity',176,800,24),icon=word('@',125,790,36),badge=word('PREEMPTIVE',112,650,23);
 const read=(withIcon:boolean,y:number)=>pageTokens({width:900,height:1600,lines:[{words:[...(withIcon?[icon]:[]),effect]},{words:[badge,word('If Top-Right is STR type',290,y,30)]}]},identity);
 const a=read(true,643),b=read(false,651);
 assert.equal(a.find((t:any)=>t.kind==='line').position.top,800);assert.equal(b.find((t:any)=>t.kind==='line').position.top,800);
 assert.equal(a.find((t:any)=>t.kind==='event').position.top,650);assert.equal(b.find((t:any)=>t.kind==='event').position.top,650);
});
test('a clipped trigger at the Ace bottom viewport keeps its previous event and does not duplicate repeated effects',{skip:process.platform!=='win32'},async()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/ace-clipped-trigger-merge.json',import.meta.url),'utf8'));
 const a=await readBehaviorPage(fs.readFileSync(new URL('./fixtures/boss-behavior/ace-clipped-trigger-before.png',import.meta.url))),b=await readBehaviorPage(fs.readFileSync(new URL('./fixtures/boss-behavior/ace-clipped-trigger-after.png',import.meta.url)));
 const left=pageTokens(a,modalIdentity(a)),right=pageTokens(b,modalIdentity(b)),joined=mergeTokens(left,right,data.evidence);
 assert.equal(joined.filter((t:any)=>t.trigger==='preemptive').length,1);assert.equal(joined.filter((t:any)=>t.trigger==='interrupt').length,1);assert.equal(joined.filter((t:any)=>t.trigger==='defeated').length,1);
 assert.equal(joined.filter((t:any)=>/6000 damage Burn/.test(t.text)).length,2);assert.equal(joined.filter((t:any)=>/98 turn\(s\) Delay Immunity/.test(t.text)).length,1);
});
