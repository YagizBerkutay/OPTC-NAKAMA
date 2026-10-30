import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {stageBarriers} from '../src/pve-barriers';
const require=createRequire(import.meta.url),sharp=require('sharp');
const {readBehaviorPage}=require('../electron/boss-behavior.cjs'),{modalIdentity,pageTokens,encounterFromTokens}=require('../electron/boss-behavior-core.cjs'),{startingStateBoxes,recoverStartingState}=require('../electron/starting-state-ocr.cjs');
const image=fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-starting-state.png',import.meta.url)),original=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-starting-state.json',import.meta.url),'utf8'));
test('real CP9 green outlined Starting State badges recover three enemy triggers and distinct timing barriers',{skip:process.platform!=='win32'},async()=>{
 const before=pageTokens(original,modalIdentity(original));assert.equal(before.filter((t:any)=>t.trigger==='starting').length,0);
 const ocr=await readBehaviorPage(image),tokens=pageTokens(ocr,modalIdentity(ocr));assert.equal(tokens.filter((t:any)=>t.trigger==='starting').length,3);
 const start=tokens.findIndex((t:any)=>t.kind==='battle'&&t.number===2),end=tokens.findIndex((t:any)=>t.kind==='battle'&&t.number===3);
 const result=encounterFromTokens({...modalIdentity(ocr),difficulty:10},tokens.slice(start,end),{observedAt:'2026-10-12T18:00:00Z',complete:true,startVerified:true,pages:1});
 const stage=result.stages.find((s:any)=>s.battleNumber===2);assert.equal(stage.events.length,3);assert.ok(stage.events.every((e:any)=>e.trigger==='starting'&&e.text.includes('Barrier')));
 assert.ok(stage.events[0].label.includes('cannoneer'));assert.equal(result.observation.warnings.some((w:string)=>w.includes('Battle 2: tetik')),false);
 assert.deepEqual(stageBarriers(stage).map(b=>[b.kind,b.timing,b.count]),[['timing','GOOD',1],['timing','PERFECT',2],['timing','GREAT',1]]);
});
test('green outline is only a locator: unrelated OCR and absent borders cannot invent a trigger',async()=>{
 const body=modalIdentity(original).body,boxes=await startingStateBoxes(image,body);assert.equal(boxes.length,3);assert.ok(boxes.every((b:any)=>b.height>=35));
 const differentPixels=await sharp(image).modulate({brightness:.98}).png().toBuffer();
 const ocr=await recoverStartingState(differentPixels,structuredClone(original),body,async()=>({text:'UNKNOWN',lines:[]}));assert.equal(pageTokens(ocr,modalIdentity(ocr)).filter((t:any)=>t.trigger==='starting').length,0);
 const blank=await sharp({create:{width:900,height:1600,channels:3,background:'black'}}).png().toBuffer();assert.deepEqual(await startingStateBoxes(blank,body),[]);
 let calls=0;await recoverStartingState(blank,structuredClone(original),body,async()=>{calls++;throw Error('no border');});assert.equal(calls,0);
});
