import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const {createScrollAlignment}=require('../electron/behavior-tracking.cjs');
const {scrollbar}=require('../electron/scrollbar.cjs');
const {mergeTokens,positioned}=require('../electron/boss-behavior-core.cjs');
const body={left:98,top:394,width:705,height:845};
const frame=(i:number)=>Buffer.from([i]);
const readBar=async(image:Buffer)=>({known:true,thumbTop:100+image[0]*42,thumbHeight:192,trackHeight:845});
const pixel=(shift:number)=>({shift,score:.95,support:1000,bands:6,verified:true});
const setup=()=>createScrollAlignment({readBar,measure:async(a:Buffer,b:Buffer)=>b[0]<=2&&b[0]>a[0]?pixel(200):null});
const group=(top:number,page:symbol)=>['PREEMPTIVE','3 turns Bind','5 turns Paralysis','99 turns Delay Immunity'].map((text,i)=>positioned({kind:i?'line':'event',text,...(!i?{trigger:'preemptive'}:{})},{top:top+55*i,height:25,page}));

test('independently calibrated thumb movement resolves repeated text while numeric conflicts still fail',async()=>{
 const context=setup();await context.evidence(frame(0),frame(1),body);await context.evidence(frame(1),frame(2),body);
 const evidence=await context.evidence(frame(2),frame(3),body);assert.ok(evidence.range.verified);assert.ok(evidence.range.min<200&&evidence.range.max>200);assert.equal(evidence.shift,undefined);
 const oldPage=Symbol(),newPage=Symbol(),old=[...group(600,oldPage),...group(900,oldPage)],next=group(400,newPage);
 assert.throws(()=>mergeTokens(old,next),/konumu belirsiz/);
 assert.equal(mergeTokens(old,next,evidence).length,old.length);
 const conflict=group(400,Symbol());conflict[1].text='4 turns Bind';assert.throws(()=>mergeTokens(old,conflict,evidence),/sayıları çelişiyor/);
 assert.throws(()=>mergeTokens(old,group(400,Symbol()).map((t:any)=>positioned({...t,text:'Unrelated '+t.text},t.position)),evidence),/birleştir/);
});

test('one calibration, duplicate retries, missing thumb and changed thumb geometry cannot invent alignment',async()=>{
 const context=createScrollAlignment({readBar,measure:async(a:Buffer,b:Buffer)=>a[0]===0&&b[0]===1?pixel(200):null});
 await context.evidence(frame(0),frame(1),body);await context.evidence(frame(0),frame(1),body);assert.equal(await context.evidence(frame(1),frame(2),body),null);
 const invalid=createScrollAlignment({readBar:async(b:Buffer)=>({...await readBar(b),thumbHeight:b[0]>=3?260:192}),measure:async(a:Buffer,b:Buffer)=>b[0]<=2?pixel(200):null});
 await invalid.evidence(frame(0),frame(1),body);await invalid.evidence(frame(1),frame(2),body);assert.equal(await invalid.evidence(frame(2),frame(3),body),null);
 const missing=createScrollAlignment({readBar:async(b:Buffer)=>b[0]===3?{known:false}:readBar(b),measure:async(a:Buffer,b:Buffer)=>b[0]<=2?pixel(200):null});
 await missing.evidence(frame(0),frame(1),body);await missing.evidence(frame(1),frame(2),body);assert.equal(await missing.evidence(frame(2),frame(3),body),null);
});

test('thumb bounds alone do not relax the minimum distinct-anchor requirement',()=>{
 const page=Symbol(),old=group(600,page),next=group(400,Symbol()).slice(0,2);
 assert.throws(()=>mergeTokens(old,next,{range:{verified:true,min:190,max:210}}),/birleştir/);
});

test('scrollbar is a single measured neutral thumb; isolated white decorations are not a position',async()=>{
 const image=async(split=false)=>sharp(Buffer.from('<svg width="900" height="1600"><rect width="900" height="1600" fill="#302320"/><rect x="796" y="620" width="6" height="192" fill="white"/>'+(split?'<rect x="796" y="1050" width="6" height="30" fill="white"/>':'')+'</svg>')).png().toBuffer();
 const bar=await scrollbar(await image(),body);assert.equal(bar.known,true);assert.equal(bar.thumbTop,226);assert.equal(bar.thumbHeight,192);assert.equal(bar.trackHeight,845);
 assert.equal((await scrollbar(await image(true),body)).known,false);
});
