import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),core=require('../electron/boss-behavior-core.cjs'),pka=require('../electron/pka-guide.cjs');
const page=(n:number)=>JSON.parse(fs.readFileSync(new URL(`./fixtures/pka-guide/page-${n}.json`,import.meta.url),'utf8'));
test('An expanded range verifies the guide start even when Battle 1 is not listed; clipped or ambiguous headers do not',()=>{const body={top:394,height:845},band={top:550,bottom:620,expanded:true,clippedTop:false,clippedBottom:false};assert.deepEqual(pka.expandedStart(body,[band]),band);for(const item of [{...band,clippedTop:true},{...band,clippedBottom:true},{...band,top:390},{...band,bottom:1230},{...band,expanded:false}])assert.equal(pka.expandedStart(body,[item]),null);assert.equal(pka.expandedStart(body,[band,{...band,top:700,bottom:760}]),null);});
test('A guide starting at Battle 3 retains omitted battles as notListed and never invents their mechanics',()=>{const identity={title:'Vs. Fixture',mode:'pka',difficulty:null,level:null},tokens=[{kind:'heading',text:'BEHAVIOR'},{kind:'battle',number:3,text:'BATTLE 3'},{kind:'event',trigger:'preemptive',label:'PREEMPTIVE'},{kind:'line',text:'3 turns Bind'}];const result=core.encounterFromTokens(identity,tokens,{observedAt:'2026-10-28T12:00:00Z',complete:true,startVerified:true,pages:1,mode:'pka'});assert.equal(result.stages[0].behaviorStatus,'notListed');assert.equal(result.stages[1].behaviorStatus,'notListed');assert.equal(result.stages[0].requirements.length,0);assert.equal(result.stages[2].requirements[0].turns,3);assert.throws(()=>core.encounterFromTokens(identity,tokens,{complete:false,startVerified:true}),/başı ve sonu/);});
test('PKA home is recognized when account-level ink splits the stylized Pirate King title, while Rumble and ordinary home stay excluded',()=>{assert.equal(pka.isPKAHome('PIRATEfLv.\n25 d left\nKING\nHELP\nINFO\nLIST\nEDIT\nCREW\nDEFEAT Lv.\nADVENTURE!!\nADV. STAMINA -1\nADV. STAMINA'),true);for(const text of ['PIRATE RUMBLE EDIT CREW ADV. STAMINA','PIRATE KING ADV. STAMINA','PIRATE KING EDIT CREW DEFEAT Lv.'])assert.equal(pka.isPKAHome(text),false);});
test('PKA guide has its own modal geometry without inventing a star difficulty or precise level',()=>{
 const identity=core.modalIdentity(page(5));assert.equal(identity.mode,'pka');assert.equal(identity.title,'Vs. Crocodile');assert.equal(identity.difficulty,null);assert.equal(identity.level,null);assert.equal(identity.body.top,394);
 const changed=page(5);changed.lines=changed.lines.filter((l:any)=>!l.text.startsWith('Vs.'));assert.equal(core.modalIdentity(changed),null);
});

test('A missing animated home anchor is recovered only from all three fixed image regions',async()=>{
 const snap={ocr:{text:'PIRATE KING HELP ADV. STAMINA'},width:900,height:1600,image:Buffer.from('fixture')};let calls=0;
 assert.equal(await pka.verifyPKAHome(snap,async()=>({text:['PIRATE KING','HELP LIST','ADV. STAMINA'][calls++]})),true);assert.equal(calls,3);
 calls=0;assert.equal(await pka.verifyPKAHome(snap,async()=>({text:['PIRATE KING','HELP','ADV. STAMINA'][calls++]})),false);
 assert.equal(await pka.verifyPKAHome({...snap,identity:{mode:'pka'}},()=>{throw Error('Modal must never pass as home');}),false);
});

test('Real PKA home animation phases retain already observed anchors and recover labels omitted by narrow segmentation',{skip:process.platform!=='win32'},async()=>{try{for(const n of [4,6,7]){const image=fs.readFileSync(new URL(`./fixtures/pka-guide/home-phase-${n}.png`,import.meta.url)),ocr=JSON.parse(fs.readFileSync(new URL(`./fixtures/pka-guide/home-phase-${n}.json`,import.meta.url),'utf8'));assert.equal(await pka.verifyPKAHome({image,ocr,width:900,height:1600}),true,'Same PKA home rejected in animation phase '+n);}}finally{await require('../electron/rule-ocr.cjs').closeOCR();}});

test('a level accordion just below GUIDE tabs does not turn the same PKA into a normal quest',()=>{
 const o=JSON.parse(fs.readFileSync(new URL('./fixtures/pka-guide/range-at-body-top.json',import.meta.url),'utf8'));
 const identity=core.modalIdentity(o);assert.equal(identity.mode,'pka');assert.equal(identity.title,'Vs. Crocodile');assert.equal(identity.body.top,394);assert.equal(identity.level,null);assert.equal(identity.difficulty,null);
 const normal=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/page-0.json',import.meta.url),'utf8'));
 assert.equal(core.modalIdentity(normal).mode,undefined);assert.equal(core.modalIdentity(normal).body.top,418);
});
test('Current PKA range pixels include both endpoints for one-, two- and three-digit bands',{skip:process.platform!=='win32'},async()=>{const image=fs.readFileSync(new URL('./fixtures/pka-guide/current-bands.png',import.meta.url)),items=await pka.bands(image,{left:98,top:394,width:705,height:845});assert.equal(items.length,7);assert.deepEqual(await pka.rangeNumber(image,items[0]),[1,59]);assert.deepEqual(await pka.rangeNumber(image,items[3]),[100,149]);assert.deepEqual(await pka.rangeNumber(image,items[6]),[250,300]);});
test('An expanded bright header retains the previously verified band only with a complete independent reread and matching native tail',{skip:process.platform!=='win32'},async()=>{const image=fs.readFileSync(new URL('./fixtures/pka-guide/current-expanded-range.png',import.meta.url)),items=await pka.bands(image,{left:98,top:394,width:705,height:845});assert.equal(items.length,1);assert.equal(items[0].expanded,true);assert.deepEqual(await pka.rangeNumber(image,items[0],[1,59]),[1,59]);assert.notDeepEqual(await pka.rangeNumber(image,items[0],[2,59]),[2,59]);});
test('PKA clipping excludes other level ranges and never merges their repeated Battle 1',()=>{
 const o=page(5),identity=core.modalIdentity(o),tokens=pka.clipBand(o,identity,803,1238);assert.ok(tokens.some((t:any)=>t.kind==='battle'&&t.number===1));assert.ok(tokens.every((t:any)=>t.position.top>=803));
 const clipped=pka.clipBand(o,identity,803,1000);assert.ok(clipped.every((t:any)=>t.position.top<1000));assert.ok(!clipped.some((t:any)=>t.kind==='battle'&&t.number===3));
});

test('a clipped collapsed next-range band cannot be mistaken for an expanded different level',async()=>{
 const image=fs.readFileSync(new URL('./fixtures/pka-guide/collapsed-bottom-100-149.png',import.meta.url)),body=core.modalIdentity(page(5)).body;
 const items=await pka.bands(image,body);assert.equal(items.length,1);assert.equal(items[0].clippedBottom,true);assert.equal(items[0].expanded,false);assert.equal(items[0].clippedTop,false);
 assert.ok(pka.clipBand(page(12),core.modalIdentity(page(12)),undefined,items[0].top).every((t:any)=>t.position.top<items[0].top));
});

test('A real top-clipped Lv.60–79 header stays outside tokens and pixel discovery without guessing expansion',async()=>{
 const image=fs.readFileSync(new URL('./fixtures/pka-guide/clipped-top-60-79.png',import.meta.url)),ocr=JSON.parse(fs.readFileSync(new URL('./fixtures/pka-guide/clipped-top-60-79.json',import.meta.url),'utf8')),body={left:98,top:394,width:705,height:845},items=await pka.bands(image,body);assert.equal(items.length,1);assert.equal(items[0].clippedTop,true);assert.equal(items[0].expanded,false);
 const window=pka.behaviorWindow(body,items),tokens=pka.clipBand(ocr,{body},window.body.top,window.body.top+window.body.height);assert.equal(window.body.top,472);assert.ok(tokens.some((t:any)=>t.kind==='battle'&&t.number===1));assert.ok(!tokens.some((t:any)=>t.text.includes('60 7 9')));
 const tracker=require('../electron/marquee-panorama.cjs').createPixelMarquee(tokens,window.body);for(let n=0;n<4;n++)await tracker.observe(image);assert.ok(!tracker.waitingText().includes('60 7 9'),'foreground discovery must not reinsert the orange level header');
});

test('Behavior windows keep clipped headers out across every current difficulty band and exclude the next range',async()=>{
 const body={left:98,top:394,width:705,height:845},image=fs.readFileSync(new URL('./fixtures/pka-guide/current-bands.png',import.meta.url)),items=await pka.bands(image,body);assert.equal(items.length,7);
 for(let i=0;i<items.length;i++){const own=items[i],window=pka.behaviorWindow(body,items,own);assert.equal(window.body.top,own.bottom);assert.equal(window.body.top+window.body.height,items[i+1]?.top??body.top+body.height);}
 for(const top of [394,402,410,418,426]){const clippedBody={...body,top,height:body.top+body.height-top},cuts=await pka.bands(fs.readFileSync(new URL('./fixtures/pka-guide/clipped-top-60-79.png',import.meta.url)),clippedBody);assert.equal(cuts[0]?.clippedTop,true);assert.equal(cuts[0]?.expanded,false);const window=pka.behaviorWindow(clippedBody,cuts);assert.equal(window.body.top,472);}
});
test('real PKA marquee containing only 99 preserves the earlier full line and does not create conflicting damage',()=>{
 let tokens:any[]=[];for(let n=5;n<=12;n++){const o=page(n),identity=core.modalIdentity(o);tokens=core.mergeTokens(tokens,pka.clipBand(o,identity,n===5?803:undefined));}
 const result=core.encounterFromTokens({...core.modalIdentity(page(5)),levelRange:[80,99]},[{kind:'heading',text:'BEHAVIOR'},...tokens],{observedAt:'2026-10-09T16:00:00Z',complete:false,pages:8,startVerified:true});
 assert.equal(result.stages.length,5);assert.ok(result.stages[4].notes.includes('Non-Normal Attacks deal 1 damage'));assert.ok(result.observation.warnings.some((s:string)=>s.includes('yalnız sayısı')));assert.ok(!result.stages[4].requirements.some((e:any)=>e.turns===99));
});
test('real PKA range requires two consistent numeric reads; arrow pixels select only the expanded 80–99 band',{skip:process.platform!=='win32'},async()=>{
 const image=fs.readFileSync(new URL('./fixtures/pka-guide/expanded-80-99.png',import.meta.url)),body=core.modalIdentity(page(5)).body;
 const items=await pka.bands(image,body),open=items.filter((b:any)=>b.expanded);assert.equal(items.length,3);assert.equal(open.length,1);assert.deepEqual(await pka.rangeNumber(image,open[0]),[80,99]);
});
test('a dropped OCR dash is accepted only from its measured horizontal separator pixels',{skip:process.platform!=='win32'},async()=>{
 const sharp=require('sharp'),image=fs.readFileSync(new URL('./fixtures/pka-guide/expanded-dash-80-99.png',import.meta.url)),body=core.modalIdentity(page(5)).body;
 const open=(await pka.bands(image,body)).find((b:any)=>b.expanded);assert.deepEqual(await pka.rangeNumber(image,open),[80,99]);
 const blank=await sharp(image).composite([{input:Buffer.from('<svg width="65" height="45"><rect width="65" height="45" fill="black"/></svg>'),left:480,top:560}]).png().toBuffer();
 assert.equal(await pka.rangeNumber(blank,open),null,'two unseparated OCR numbers must not invent a range');
});

test('A real returning 99-turn duration cannot become a fixed turn badge or force another scan of its verified overlap',async()=>{
 const body={left:98,top:394,width:705,height:845},load=(side:string)=>JSON.parse(fs.readFileSync(new URL('./fixtures/pka-guide/overlap-'+side+'.json',import.meta.url),'utf8')),a=core.pageTokens(load('before'),{body}),b=core.pageTokens(load('after'),{body}),old=a.find((t:any)=>/^99 turn/.test(t.text)),current=b.find((t:any)=>/^99 turn/.test(t.text));assert.equal(current.kind,'line');assert.equal(current.position.contentLeft,undefined);
 const before=fs.readFileSync(new URL('./fixtures/pka-guide/overlap-before.png',import.meta.url)),after=fs.readFileSync(new URL('./fixtures/pka-guide/overlap-after.png',import.meta.url)),proof=await require('../electron/behavior-tracking.cjs').createScrollAlignment().evidence(before,after,body,{previous:a,next:b});assert.equal(proof.verified,true);
 const complete=core.positioned({...old,text:'99 turn(s) Non-Normal Attacks deal 1 damage',marquee:{complete:true}},old.position),make=require('../electron/marquee-panorama.cjs').createPixelMarquee,tracker=make([current],body,{...proof,tokens:[complete]});assert.equal(tracker.pending(),0);const result=await tracker.recognize(()=>assert.fail('A proven overlap must not wait for another full animation'),()=>{});assert.equal(result.tokens[0].text,complete.text);assert.equal(make([current],body,{...proof,verified:false,tokens:[complete]}).pending(),1);
 const label={width:900,height:1600,lines:[{words:[{text:'TURN',x:118,y:800,width:65,height:22},{text:'2',x:190,y:800,width:16,height:22}]}]};assert.equal(core.pageTokens(label,{body})[0].trigger,'turn');
});
