import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const {estimateScroll,createMarqueeTracker,collectMarquee}=require('../electron/behavior-tracking.cjs');
const {mergeTokens,encounterFromTokens,joinMarquee,durationEffects}=require('../electron/boss-behavior-core.cjs');
const body={left:98,top:394,width:705,height:845};
const mark=(text:string,top:number,clipped=false,kind='line',page=Symbol())=>Object.defineProperty({text,kind,...(kind==='event'?{trigger:'preemptive',label:'İlk saldırı'}:{})},'position',{value:{top,height:25,rightClipped:clipped,page},enumerable:false});
test('For-prefix duration and a percentage suffix are different values, while changed durations still conflict',()=>{
 const {conflictingNumbers}=require('../electron/boss-behavior-core.cjs');
 assert.equal(conflictingNumbers(mark('IN T] slots, reduce damage dealt by 90%',600),mark('For 2 turn(s), when attacking with',600)),false);
 assert.equal(conflictingNumbers(mark('For 2 turn(s), when attacking with',600),mark('For 3 turn(s), when attacking with',600)),true);
 assert.equal(conflictingNumbers(mark('For 2 turn(s), damage dealt by 90%',600),mark('For 2 turn(s), damage dealt by 50%',600)),true);
 const tracker=createMarqueeTracker([mark('For 2 turn(s), when attacking with',600,true)],{body});tracker.observe([mark('IN T] slots, reduce damage dealt by 90%',600,false)]);assert.equal(tracker.result()[0].marquee.complete,false);
});

test('marquee time budget keeps unobserved suffixes partial and bounds captures',async()=>{
 let time=0,captures=0;
 const first={image:Buffer.from('frame')};
 const result=await collectMarquee(first,{capture:async()=>{captures++;time+=3000;return first;},tokens:()=>[mark('99 turn(s) Non-Normal Attacks deal',600,true)],body,check:()=>{},progress:()=>{},wait:async()=>{time+=450;},maxDuration:8000,maxSamples:20,now:()=>time,measure:async()=>({verified:true,shift:0})});
 assert.equal(captures,3);assert.equal(result.tokens[0].marquee.complete,false);
});

test('fast OCR still observes the full marquee time window instead of exhausting the old frame cap',async()=>{
 let time=0,captures=0;const frame={image:Buffer.from('frame')};
 const result=await collectMarquee(frame,{capture:async()=>{captures++;return frame;},tokens:()=>[mark('99 turn(s) Non-Normal Attacks deal',600,true)],body,check:()=>{},progress:()=>{},wait:async(ms:number)=>{time+=ms;},maxDuration:8000,now:()=>time,measure:async()=>({verified:true,shift:0})});
 assert.ok(time>=8000&&time<=8450,'A faster OCR engine must retain the chance to see the text wrap');assert.ok(captures>12);assert.equal(result.tokens[0].marquee.complete,false);
});

test('default marquee reading has no duration or frame cutoff and waits for the observed ending',async()=>{
 let time=0,captures=0;const frame={image:Buffer.from('frame')};
 const result=await collectMarquee(frame,{capture:async()=>{captures++;time+=5000;return frame;},tokens:()=>[mark('99 turn(s) Delay Immunity',600,captures<150)],body,check:()=>{},progress:()=>{},wait:async(ms:number)=>{time+=ms;},now:()=>time,measure:async()=>({verified:true,shift:0})});
 assert.equal(captures,150);assert.ok(time>600000);assert.equal(result.tokens[0].marquee.complete,true);assert.equal(result.tokens[0].text,'99 turn(s) Delay Immunity');
});

test('an unfinished marquee can be cancelled after the former duration and frame limits',async()=>{
 let time=0,captures=0,cancelled=false;const frame={image:Buffer.from('frame')};
 await assert.rejects(collectMarquee(frame,{capture:async()=>{captures++;time+=5000;return frame;},tokens:()=>[mark('99 turn(s) Delay Immunity',600,true)],body,check:()=>{if(cancelled)throw Error('cancelled');},progress:()=>{},wait:async()=>{if(captures===150)cancelled=true;},now:()=>time,measure:async()=>({verified:true,shift:0})}),/cancelled/);
 assert.equal(captures,150);assert.ok(time>600000);
});

test('cancel or vertical movement aborts marquee collection without further captures',async()=>{
 const first={image:Buffer.from('frame')};let cancelled=false,captures=0;
 const options={capture:async()=>{captures++;return first;},tokens:()=>[mark('99 turn(s) Delay Immunity',600,true)],body,check:()=>{if(cancelled)throw Error('cancelled');},progress:()=>{},wait:async()=>{cancelled=true;},measure:async()=>({verified:true,shift:0})};
 await assert.rejects(collectMarquee(first,options),/cancelled/);assert.equal(captures,0);
 cancelled=false;await assert.rejects(collectMarquee(first,{...options,wait:async()=>{},measure:async()=>({verified:true,shift:120})}),/liste.*hareket etti/);assert.equal(captures,1);
});

test('literal character overlap joins inside clipped words without inventing a suffix',()=>{
 assert.equal(joinMarquee('5 turn(s) 10000 damage Burn (take dam','damage Burn (take damage when performing PERFECT attacks)'), '5 turn(s) 10000 damage Burn (take damage when performing PERFECT attacks)');
 assert.equal(joinMarquee('5 turns Burn','5 turns Paralysis'),null);
});
test('marquee coverage needs both an observed head and connected tail; a stable cropped row remains partial',()=>{
 const tracker=createMarqueeTracker([mark('5 turn(s) 10000 damage Burn (take dam',600,true)]);
 tracker.observe([mark('damage Burn (take damage when performing PER',600,true)]);
 assert.equal(tracker.pending(),1);
 tracker.observe([mark('take damage when performing PERFECT attacks)',600,false)]);
 assert.equal(tracker.pending(),0);assert.equal(tracker.result()[0].marquee.complete,true);
 assert.match(tracker.result()[0].text,/^5 turn\(s\) 10000 damage Burn.*PERFECT attacks\)/);
 const partial=createMarqueeTracker([mark('99 turn(s) Non-Normal Attacks deal',600,true)]);
 partial.observe([mark('99 turn(s) Non-Normal Attacks deal',600,true)]);assert.equal(partial.result()[0].marquee.complete,false);
 const tail=createMarqueeTracker([mark('instant defeat Specials',600,false)]);
 tail.observe([mark('to instant defeat Specials',600,false)]);assert.equal(tail.result()[0].marquee.complete,false);
});
test('repeated text blocks can use measured pixel movement, but absent evidence and numeric conflicts remain rejected',async()=>{
 const page=Symbol(),nextPage=Symbol();
 const group=(top:number,p: symbol)=>[mark('PREEMPTIVE',top,false,'event',p),mark('3 turns Bind',top+55,false,'line',p),mark('5 turns Paralysis',top+110,false,'line',p)];
 const old=[...group(600,page),...group(900,page),mark('30000 damage',1200,false,'line',page)],next=group(600,nextPage);
 assert.throws(()=>mergeTokens(old,next),/konumu belirsiz/);
 const icons=[{y:450,w:51,h:16},{y:600,w:24,h:25},{y:655,w:12,h:30},{y:710,w:39,h:20},{y:900,w:24,h:25},{y:955,w:12,h:30},{y:1010,w:39,h:20},{y:1200,w:47,h:40}];
 const image=async(shift:number)=>sharp(Buffer.from('<svg width="900" height="1600"><rect width="900" height="1600" fill="black"/>'+icons.filter(v=>v.y-shift>=body.top).map(v=>`<rect x="120" y="${v.y-shift}" width="${v.w}" height="${v.h}" fill="white"/>`).join('')+'</svg>')).png().toBuffer();
 const evidence=await estimateScroll(await image(0),await image(300),body);assert.ok(evidence);assert.equal(evidence.shift,300);
 assert.equal(mergeTokens(old,next,evidence).length,old.length);
 assert.equal((await estimateScroll(await image(0),await image(0),body))?.shift,0);
 const changed=group(600,nextPage);changed[1]=mark('4 turns Bind',655,false,'line',nextPage);assert.throws(()=>mergeTokens(old,changed,evidence),/sayıları çelişiyor/);
});
test('no visual evidence is fabricated for a blank lane',async()=>{
 const image=await sharp({create:{width:900,height:1600,channels:3,background:'black'}}).png().toBuffer();assert.equal(await estimateScroll(image,image,body),null);
});
test('a changed numeric value in a tracked row cannot be reported as complete',()=>{
 const tracker=createMarqueeTracker([mark('99 turn(s) Delay Immunity',600,true)]);
 tracker.observe([mark('9 turn(s) Delay Immunity',600,false)]);
 assert.equal(tracker.result()[0].marquee.complete,false);assert.equal(tracker.result()[0].text,'99 turn(s) Delay Immunity');
});
test('later captures recover an initially omitted row in physical order, without merging changed triggers',()=>{
 const tracker=createMarqueeTracker([mark('99 turn(s) Delay Immunity',600),mark('3 turn(s) Bind',720)]);
 tracker.observe([mark('99 turn(s) Delay Immunity',600),mark('Weakness Class: Cerebral',660),mark('3 turn(s) Bind',720)]);
 assert.deepEqual(tracker.result().map((t:any)=>t.text),['99 turn(s) Delay Immunity','Weakness Class: Cerebral','3 turn(s) Bind']);
 const event=createMarqueeTracker([mark('PREEMPTIVE',600,false,'event')]);
 const changed=mark('DEFEATED',600,false,'event');changed.trigger='defeated';assert.throws(()=>event.observe([changed]),/başlığı.*değişti/);
});
test('Weakness Class is structured, while partial scrolling coverage stays independent of vertical completion',()=>{
 const token={kind:'line',text:'99 turns Non-Normal Attacks deal',marquee:{complete:false,samples:4}};
 const result=encounterFromTokens({title:'Vs. Crocodile',difficulty:null,level:null},[{kind:'battle',number:1,variant:'',text:'BATTLE 1'},{kind:'event',trigger:'starting',label:'STARTING STATE',text:'STARTING STATE'},{kind:'line',text:'Weakness Class: Cerebral'},token],{observedAt:'2026-10-09T19:00:00Z',complete:true,startVerified:true,pages:1,marqueeChecked:true});
 assert.deepEqual(result.stages[0].weaknessClasses,['Cerebral']);assert.equal(result.observation.complete,true);assert.equal(result.observation.textComplete,false);assert.equal(result.observation.marquee.partial,1);assert.ok(result.observation.warnings.some((w:string)=>w.includes('Kayan satırın tamamı')));
 assert.equal(result.stages[0].behaviorTextComplete,false);
 assert.deepEqual(durationEffects('4 turn(s) ATK 70% Down').effects,[{mechanic:'atkDown',turns:4}]);
});
test('collection waits past the old five frames for a head, then reads the tail in the following cycle',async()=>{
 let time=0,captures=0;const messages:string[]=[];
 const texts=['instant defeat Specials','instant defeat Specials','instant defeat Specials','instant defeat Specials','instant defeat Specials','instant defeat Specials','99 turn(s) Immune to instant defeat Specials'];
 const result=await collectMarquee({image:Buffer.from([0])},{capture:async()=>{time+=1500;return {image:Buffer.from([++captures])};},tokens:(s:any)=>[mark(texts[Math.min(s.image[0],texts.length-1)],600)],body,check:()=>{},progress:(s:string)=>messages.push(s),wait:async()=>{time+=450;},now:()=>time,measure:async()=>({verified:true,shift:0})});
 assert.ok(captures>=6);assert.ok(messages.some(s=>s.includes('başa dönmesi')));assert.equal(result.tokens[0].marquee.complete,true);assert.match(result.tokens[0].text,/^99 turn/);
});
test('text seen before the head cannot supply an unread suffix after a loop reset',()=>{
 const tracker=createMarqueeTracker([mark('instant defeat Specials',600)]);
 tracker.observe([mark('99 turn(s) Immune to instant',600,true)]);
 assert.equal(tracker.pending(),1);assert.equal(tracker.result()[0].marquee.complete,false);assert.equal(tracker.result()[0].text,'99 turn(s) Immune to instant');
});

test('charge-counter headings retain their observed beginning until a connected numeric ending is read',()=>{
 for(const heading of ['Super Switch Effect requirement reduction:','VS Effect gauge reduction:']){
  const tracker=createMarqueeTracker([mark(heading,600,true)],{body});
  tracker.observe([mark(heading.replace(/^\S+\s+/,'' )+' 10',600,false)]);
  assert.equal(tracker.result()[0].text,heading+' 10');assert.equal(tracker.result()[0].marquee.complete,true);
 }
 const suffix=createMarqueeTracker([mark('requirement reduction: 10',600,true)],{body});
 suffix.observe([mark('requirement reduction: 10',600,false)]);assert.equal(suffix.result()[0].marquee.complete,false);
});
test('an unrecognized beginning is verified by entering from the right, while clipped left fragments prove nothing',()=>{
 const at=(text:string,x:number,clipped=true)=>{const t=mark(text,600,clipped);(t as any).position.left=x;return t;};
 const tracker=createMarqueeTracker([at('to [STR] Slots',176,false)],{body});
 tracker.observe([at('[EMPTY][STR][DEX][QCK]',620)]);
 tracker.observe([at('[EMPTY][STR][DEX][QCK][PSY][INT][G][RCV][TND][BOMB]',360)]);
 tracker.observe([at('[QCK][PSY][INT][G][RCV][TND][BOMB] Slots to [STR] Slots',176,false)]);
 assert.equal(tracker.result()[0].marquee.complete,true);assert.match(tracker.result()[0].text,/^\[EMPTY\].*to \[STR\] Slots$/);
 const clipped=createMarqueeTracker([at('[INT] Slots to [STR] Slots',176,true)],{body});clipped.observe([at('Slots to [STR] Slots',176,false)]);
 assert.equal(clipped.result()[0].marquee.complete,false);
});
test('a fixed PREEMPTIVE badge does not masquerade as the beginning of its scrolling condition',()=>{
 const event=(s:string,clipped=false)=>mark('PREEMPTIVE '+s,600,clipped,'event');
 const tracker=createMarqueeTracker([event('p-Right is DEX QCK PSY INT type')],{body});
 tracker.observe([event('If Top-Right is DEX QCK',true)]);assert.equal(tracker.pending(),1);
 tracker.observe([event('Top-Right is DEX QCK PSY INT type')]);const t=tracker.result()[0];
 assert.equal(t.marquee.complete,true);assert.equal(t.text,'PREEMPTIVE If Top-Right is DEX QCK PSY INT type');assert.match(t.label,/If Top-Right/);
 const battle={kind:'battle',number:1,variant:'',text:'BATTLE 1'},line={kind:'line',text:'98 turn(s) Delay Immunity'};
 const partial=encounterFromTokens({title:'test',difficulty:11,level:null},[battle,{...t,marquee:{complete:false,samples:2}},line],{observedAt:'2026-10-12T19:00:00Z',complete:true,startVerified:true,pages:1,marqueeChecked:true});
 assert.equal(partial.stages[0].behaviorTextComplete,false);assert.equal(partial.observation.textComplete,false);
});
test('a longer disconnected condition suffix never erases an observed beginning or certifies itself',()=>{
 const event=(s:string,clipped=false)=>mark('PREEMPTIVE '+s,600,clipped,'event'),tracker=createMarqueeTracker([event('If Top-Right is',true)]);
 tracker.observe([event('DEX QCK PSY INT type')]);assert.equal(tracker.result()[0].text,'PREEMPTIVE If Top-Right is');assert.equal(tracker.result()[0].marquee.complete,false);
 tracker.observe([event('If Top-Right is DEX QCK PSY INT type')]);assert.equal(tracker.result()[0].marquee.complete,true);
});

test('repeated overlapping OCR does not grow closing punctuation on every merge pass',()=>{
 const text='1 turn(s) Tap-Timing Barrier (GREAT 2 time(s))';let result=text;
 for(let i=0;i<20;i++)result=joinMarquee(result,'rn(s) Tap-Timing Barrier (GREAT 2 time(s))');
 assert.equal(result,text);
 const tracker=createMarqueeTracker([mark(text,600,true)]);for(let i=0;i<6;i++)tracker.observe([mark(text,600,false)]);
 assert.equal(tracker.result()[0].text,text);
});

test('row OCR maps separate strips back to their physical rows without leaking adjacent values',async()=>{
 const {readMarqueeRows}=require('../electron/marquee-row-ocr.cjs');
 const line=(text:string,x:number,y:number)=>({text,words:[{text,x,y,width:200,height:20}]});
 const template={width:900,height:1600,lines:[line('Vs. QA',200,180),line('3 turn(s) Bind',180,600),line('10000 damage Burn',180,660)]};
 const image=await sharp({create:{width:900,height:1600,channels:3,background:'black'}}).png().toBuffer();
 const result=await readMarqueeRows(image,template,body,async(_image:any,options:any)=>{assert.equal(options.scale,3);return {lines:[line('3 turn(s) Bind',5,21),line('10000 damage Burn',5,71)]};});
 const r=require('../electron/boss-behavior-core.cjs').rows(result);assert.deepEqual(r.map((r:any)=>r.text),['Vs. QA','3 turn(s) Bind','10000 damage Burn']);assert.equal(r[1].y,600);assert.equal(r[2].y,660);
});

test('a beginning entering from the right is not evidence of a complete ending',()=>{
 const at=(text:string,x:number,clipped:boolean)=>{const t=mark(text,600,clipped);(t as any).position.left=x;return t;};
 const tracker=createMarqueeTracker([at('1 turn(s) Tap-Timing Barrier',176,true)],{body});
 tracker.observe([at('1 turn(s) Tap-Timing Barrier (GREAT 2',620,false)]);
 assert.equal(tracker.result()[0].marquee.complete,false);
 tracker.observe([at('Tap-Timing Barrier (GREAT 2 time(s))',176,false)]);
 assert.equal(tracker.result()[0].marquee.complete,true);
});
test('corroborated heads discard only an unstable last glyph, retaining the observed duration',()=>{
 const tracker=createMarqueeTracker([mark('1 turn(s) Tap-Timing I',600,true)],{body});
 tracker.observe([mark('1 turn(s) Tap-Timing Barrier (GREAT 2',600,true)]);
 tracker.observe([mark('Tap-Timing Barrier (GREAT 2 time(s))',600,false)]);
 assert.equal(tracker.result()[0].text,'1 turn(s) Tap-Timing Barrier (GREAT 2 time(s))');assert.equal(tracker.result()[0].marquee.complete,true);
});

test('a physically observed wraparound beginning replaces an interior When clause',()=>{
 const at=(text:string,x:number,clipped:boolean)=>{const t=mark('INTERRUPTION '+text,600,clipped,'event');(t as any).position.left=x;return t;};
 const tracker=createMarqueeTracker([at('When ally status is not applied',298,false)],{body});
 tracker.observe([at('After Special activation',650,true)]);
 tracker.observe([at('After Special activation When ally',500,true)]);
 tracker.observe([at('Special activation When ally status is not applied',298,false)]);
 assert.equal(tracker.result()[0].text,'INTERRUPTION After Special activation When ally status is not applied');assert.equal(tracker.result()[0].marquee.complete,true);
});
