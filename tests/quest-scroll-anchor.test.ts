import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const {modalIdentity,pageTokens}=require('../electron/boss-behavior-core.cjs'),{headingScrollEvidence}=require('../electron/quest-scroll-anchor.cjs'),{createScrollAlignment}=require('../electron/behavior-tracking.cjs');
const load=(name:string)=>({image:fs.readFileSync(new URL('./fixtures/boss-behavior/'+name+'.png',import.meta.url)),ocr:JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/'+name+'.json',import.meta.url),'utf8'))});
const a=load('clash-lucci-scroll-a'),b=load('clash-lucci-scroll-b'),body=modalIdentity(a.ocr).body;
const previous=()=>pageTokens(a.ocr,modalIdentity(a.ocr)),next=()=>pageTokens(b.ocr,modalIdentity(b.ocr));
test('stationary Battle numeral pixels independently establish a real Lucci scroll',async()=>{
 const evidence=await headingScrollEvidence(a.image,b.image,body,{previous:previous(),next:next()});
 assert.equal(evidence?.verified,true);assert.ok(evidence.shift>=200&&evidence.shift<=204);assert.equal(evidence.source,'battle-heading-pixels');
 const alignment=createScrollAlignment({measure:async()=>null,readBar:async()=>({known:false})});
 assert.deepEqual(await alignment.evidence(a.image,b.image,body,{previous:previous(),next:next()}),evidence);
 assert.equal(await alignment.evidence(a.image,b.image,body),null);
});
test('heading OCR alone, clipped numerals, repeated headings and different actual pixels cannot establish a scroll',async()=>{
 const left=previous().filter((t:any)=>t.kind==='battle'&&t.number===3),right=next().filter((t:any)=>t.kind==='battle'&&t.number===3);
 assert.equal(await headingScrollEvidence(a.image,b.image,body,{previous:[...left,...left],next:right}),null);
 const clipped=right.map((t:any)=>({...t,position:{...t.position,edge:true}}));
 assert.equal(await headingScrollEvidence(a.image,b.image,body,{previous:left,next:clipped}),null);
 const wrong=next().filter((t:any)=>t.kind==='battle'&&t.number===4).map((t:any)=>({...t,number:3,variant:'',position:t.position}));
 assert.equal(await headingScrollEvidence(a.image,b.image,body,{previous:left,next:wrong}),null);
 const blank=await sharp({create:{width:900,height:1600,channels:3,background:'black'}}).png().toBuffer();
 assert.equal(await headingScrollEvidence(blank,blank,body,{previous:left,next:right}),null);
 assert.equal(await headingScrollEvidence(a.image,blank,body,{previous:left,next:right}),null);
 assert.equal(await headingScrollEvidence(a.image,b.image,body,{previous:[],next:right}),null);
});
