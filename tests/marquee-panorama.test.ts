import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
test('real static ATK percentage survives OCR box offsets and heights',{skip:process.platform!=='win32'},async()=>{
 const {ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),{readLineOCR}=require('../electron/line-ocr.cjs'),image=fs.readFileSync(new URL('./fixtures/kizuna/atk-down-row.png',import.meta.url)),failures:any[]=[];
 try{for(const delta of [-6,-3,0,3,6])for(const height of [20,24,27,32]){
  const token=positioned({kind:'line',text:'6 turn(s) ATK Down'},{top:30+delta,height,left:80,rightClipped:false}),tracker=createPixelMarquee([token],{left:0,top:0,width:706,height:180});for(let i=0;i<3;i++)await tracker.observe(image);
  const result=await tracker.recognize(ocrBuffer,()=>{},readLineOCR);if(result.retry.size||result.tokens[0].text!=='6 turn(s) ATK 90% Down')failures.push({delta,height,text:result.tokens[0].text,retry:[...result.retry]});
 }assert.deepEqual(failures,[]);}finally{closeOCR();}
});
const require=createRequire(import.meta.url),sharp=require('sharp'),{collectMarquee,createMarqueeTracker}=require('../electron/behavior-tracking.cjs'),{positioned}=require('../electron/boss-behavior-core.cjs'),{createPixelMarquee}=require('../electron/marquee-panorama.cjs');
const fixture=fs.readFileSync(new URL('./fixtures/kizuna/marquee-cycle.png',import.meta.url)),transcripts=JSON.parse(fs.readFileSync(new URL('./fixtures/kizuna/marquee-cycle.json',import.meta.url),'utf8')),body={left:0,top:0,width:706,height:180};
const tokens=(n:number)=>transcripts[n].map((t:any)=>{const {position,...value}=t;return positioned(value,position);});
async function interruptionFrames(){const sheet=fs.readFileSync(new URL('./fixtures/kizuna/interruption-cycle.png',import.meta.url));return Promise.all(Array.from({length:15},(_,i)=>sharp(sheet).extract({left:0,top:i*76,width:705,height:76}).png().toBuffer()));}
const interruptionToken=()=>positioned({kind:'event',trigger:'interrupt',text:'INTERRUPTION ot applied (after Special/'},{top:24.5,height:22,left:297.5,contentLeft:185.25,rightClipped:true});
test('a fixed defeated badge is retained without treating its clipped label as an animated condition',async()=>{
 for(const text of ['DEFEATED','ON DEFEAT']){const token=positioned({kind:'event',trigger:'defeated',text},{top:24,height:22,contentLeft:185,rightClipped:false}),tracker=createPixelMarquee([token],{left:0,top:0,width:705,height:76});assert.equal(tracker.pending(),0);const result=await tracker.recognize(async()=>assert.fail('A fixed defeated label needs no panorama OCR'),()=>{});assert.equal(result.tokens[0],token);}
});
test('a short real overflow recognizes its head pause after the entrance was already counted as motion',async()=>{
 const sheet=fs.readFileSync(new URL('./fixtures/boss-behavior/short-entry-cycle.png',import.meta.url)),cycle=await Promise.all(Array.from({length:6},(_,i)=>sharp(sheet).extract({left:0,top:i*64,width:705,height:64}).png().toBuffer()));
 for(let phase=0;phase<cycle.length;phase++){const token=positioned({kind:'line',text:'98 turn(s) Chain Multiplier Growth Rate x C'},{top:12,height:27,left:81,rightClipped:true}),tracker=createPixelMarquee([token],{left:0,top:0,width:705,height:64});for(let n=0;n<cycle.length*3&&tracker.pending();n++)await tracker.observe(cycle[(phase+n)%cycle.length]);assert.equal(tracker.pending(),0,'Short entry phase '+phase);}
});

test('the real interruption wrap recognizes its head while that head is still entering from the right',async()=>{
 const images=await interruptionFrames(),tracker=createPixelMarquee([interruptionToken()],{left:0,top:0,width:705,height:76});
 for(const image of images)await tracker.observe(image);assert.equal(tracker.pending(),0,'A head shifted 31px to the right is still the observed head');
});

test('the real interruption completes from every phase even when capture misses the right-hand entrance',async()=>{
 const images=await interruptionFrames(),cycle=images.slice(1,14);
 for(const omitIngress of [false,true]){const sequence=omitIngress?cycle.slice(0,-1):cycle;for(let phase=0;phase<sequence.length;phase++){
  const tracker=createPixelMarquee([interruptionToken()],{left:0,top:0,width:705,height:76});for(let n=0;n<sequence.length*3&&tracker.pending();n++)await tracker.observe(sequence[(phase+n)%sequence.length]);
  assert.equal(tracker.pending(),0,'No convergence for phase '+phase+', omitted entrance '+omitIngress);
 }}
});

test('a condition separated from its badge by OCR never tracks the fixed badge as moving text',async()=>{
 const images=await interruptionFrames(),cycle=images.slice(1,14),badge=positioned({kind:'event',trigger:'interrupt',text:'INTERRUPTION'},{top:24.5,height:22,contentLeft:185.25,rightClipped:false}),condition=positioned({kind:'line',text:'ot applied (after Special/'},{top:28,height:27,left:300,rightClipped:true}),tracker=createPixelMarquee([badge,condition],{left:0,top:0,width:705,height:76});
 for(let n=0;n<cycle.length*3&&tracker.pending();n++)await tracker.observe(cycle[n%cycle.length]);assert.equal(tracker.pending(),0);
});
async function frames(){return Promise.all(Array.from({length:10},(_,i)=>sharp(fixture).extract({left:0,top:i*180,width:706,height:180}).png().toBuffer()));}
const line=(text:string,x:number,y:number)=>({text,words:[{text,x,y,width:Math.max(600,text.length*16),height:18}]});

test('recorded colored text poisons the old string tracker but pixel reading does not run OCR on each frame',async()=>{
 const old=createMarqueeTracker(tokens(0),{body});for(let i=1;i<10;i++)old.observe(tokens(i));assert.ok(old.pending()>0);
 const images=await frames();let captures=0,reads=0;const full=['DEX PSY type Reduce Special Charge by 10','DEX PSY type Super Switch Effect requirement reduction: 10','DEX PSY type VS Effect gauge reduction: 10'];
 const result=await collectMarquee({image:images[0],index:0},{capture:async({pixelsOnly}:any={})=>{assert.equal(pixelsOnly,true);assert.ok(++captures<10,'A recorded full cycle must finish');return {image:images[captures],index:captures};},tokens:(s:any)=>tokens(s.index),body,check:()=>{},wait:async()=>{},progress:()=>{},measure:async()=>({shift:0}),readOCR:async()=>{reads++;assert.ok(captures>=7,'The head pause cannot certify an unseen last word');return {lines:full.map((text,i)=>line(text,20,28+i*60))};}});
 assert.equal(captures,9);assert.equal(reads,2);assert.deepEqual(result.tokens.map((t:any)=>t.text),full);assert.ok(result.tokens.every((t:any)=>t.marquee.complete));
});

test('real native OCR reconstructs every colored prefix and trailing counter from the recorded one-word overflow',{skip:process.platform!=='win32'},async()=>{
 const {ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),images=await frames();let captures=0,reads=0;
 try{const result=await collectMarquee({image:images[0],index:0},{capture:async()=>{assert.ok(++captures<10);return {image:images[captures],index:captures};},tokens:(s:any)=>tokens(s.index),body,check:()=>{},wait:async()=>{},progress:()=>{},measure:async()=>({shift:0}),readOCR:async(...args:any[])=>{reads++;return ocrBuffer(...args);}});
 assert.match(result.tokens[0].text,/^DEX PSY type Reduce Special Char[go]e by 10$/);assert.equal(result.tokens[1].text,'DEX PSY type Super Switch Effect requirement reduction: 10');assert.equal(result.tokens[2].text,'DEX PSY type VS Effect gauge reduction: 10');assert.ok(result.tokens.every((t:any)=>t.marquee.complete));assert.ok(reads<=3);
 }finally{closeOCR();}
});

test('the observed tail alone and the entrance/head pause cannot certify the extra last word',async()=>{
 const images=await frames(),tracker=createPixelMarquee(tokens(0),body);await tracker.observe(images[0]);await tracker.observe(images[0]);await tracker.observe(images[0]);assert.equal(tracker.pending(),3);
 for(let i=1;i<=5;i++)await tracker.observe(images[i]);assert.equal(tracker.pending(),3);
 for(let i=6;i<10;i++)await tracker.observe(images[i]);assert.equal(tracker.pending(),0);
});

test('different numeric OCR readings require corroboration and missing observed numbers remain unread',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,height:60});for(const image of images)await tracker.observe(image);assert.equal(tracker.pending(),0);
 const read=(text:string)=>({lines:[line(text,20,28)]});let calls=0;
 const mismatch=await tracker.recognize(async()=>read('DEX PSY type Reduce Special Charge by '+(++calls)),()=>{});assert.deepEqual([...mismatch.retry],[0]);assert.equal(calls,6);
 calls=0;const recovered=await tracker.recognize(async()=>read('DEX PSY type Reduce Special Charge by '+(++calls===2?'IO':'10')),()=>{});assert.equal(recovered.retry.size,0);assert.match(recovered.tokens[0].text,/by 10$/);assert.equal(calls,3);
 const missing=await tracker.recognize(async()=>read('DEX PSY type Reduce Special Charge'),()=>{});assert.deepEqual([...missing.retry],[0]);
});

test('pixel collection preserves cancellation and rejects movement before recognizing a different row',async()=>{
 const images=await frames();let captures=0,cancelled=false;const options={capture:async()=>{captures++;return {image:images[0],index:0};},tokens:()=>tokens(0),body,check:()=>{if(cancelled)throw Error('cancelled');},wait:async()=>{cancelled=true;},progress:()=>{},measure:async()=>({shift:0}),readOCR:async()=>assert.fail('No verified complete panorama')};
 await assert.rejects(collectMarquee({image:images[0]},options),/cancelled/);assert.equal(captures,0);
 cancelled=false;await assert.rejects(collectMarquee({image:images[0]},{...options,wait:async()=>{},measure:async()=>({shift:100})}),/liste.*hareket etti/);assert.equal(captures,1);
});

test('level-range headings retain their original full text and never enter the effect text crop',async()=>{
 const token=positioned({kind:'line',text:'When Lv1&Lv20'},{top:20,height:26,left:15,rightClipped:false}),tracker=createPixelMarquee([token],body);
 assert.equal(tracker.pending(),0);const result=await tracker.recognize(async()=>assert.fail('A level heading is not a marquee effect'),()=>{});assert.equal(result.tokens[0],token);
});

test('a stationary fragment entering from the right cannot be accepted as the entire static line',async()=>{
 const image=await sharp(Buffer.from('<svg width="706" height="180"><rect width="706" height="180" fill="black"/><text x="610" y="45" fill="white" font-size="26">10</text></svg>')).png().toBuffer(),token=positioned({kind:'line',text:'10'},{top:20,height:26,left:610,rightClipped:false}),tracker=createPixelMarquee([token],body);
 for(let i=0;i<4;i++)await tracker.observe(image);assert.equal(tracker.pending(),1);
});

test('a row missing from the initial OCR is discovered from pixels and restored in its physical order',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0],tokens(0)[2]],body);for(const image of images)await tracker.observe(image);assert.equal(tracker.pending(),0);
 const texts=['DEX PSY type Reduce Special Charge by 10','DEX PSY type VS Effect gauge reduction: 10','DEX PSY type Super Switch Effect requirement reduction: 10'];
 const result=await tracker.recognize(async()=>({lines:texts.map((text,i)=>line(text,20,28+i*60))}),()=>{});assert.equal(result.retry.size,0);assert.deepEqual(result.tokens.map((t:any)=>t.text),[texts[0],texts[2],texts[1]]);assert.equal(result.tokens[1].pixelDiscovered,true);
});

test('a tall colored word box belongs to its row by center and cannot disappear while its trailing number survives',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,height:60});for(const image of images)await tracker.observe(image);
 const result=await tracker.recognize(async()=>({lines:[{words:[{text:'DEX PSY type Reduce Special Charge by',x:20,y:16,width:600,height:45},{text:'10',x:610,y:28,width:30,height:18}]}]}),()=>{});
 assert.equal(result.retry.size,0);assert.equal(result.tokens[0].text,'DEX PSY type Reduce Special Charge by 10');
});

test('matching trailing numbers cannot certify a line when OCR misses most of its visible prefix',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,height:60});for(const image of images)await tracker.observe(image);
 const result=await tracker.recognize(async()=>({lines:[{words:[{text:'10',x:580,y:28,width:30,height:18}]}]}),()=>{});assert.deepEqual([...result.retry],[0]);
});

test('dense colored slot labels are visually separated without changing glyphs and native OCR reads the whole list',{skip:process.platform!=='win32'},async()=>{
 const {prepareStrip}=require('../electron/marquee-panorama.cjs'),{ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),input=fs.readFileSync(new URL('./fixtures/kizuna/slot-marquee.png',import.meta.url)),raw=await sharp(input).removeAlpha().raw().toBuffer({resolveWithObject:true}),prepared=prepareStrip(raw.data,raw.info.width,raw.info.height);
 assert.ok(prepared.width>raw.info.width);assert.equal(prepared.data.length,prepared.width*prepared.height*3);
 try{const image=await sharp(prepared.data,{raw:{width:prepared.width,height:prepared.height,channels:3}}).png().toBuffer(),text=(await ocrBuffer(image,{scale:3})).text;assert.deepEqual([...text.toUpperCase().matchAll(/\[([A-Z]+)\]/g)].map(m=>m[1]),['EMPTY','STR','DEX','QCK','PSY','INT','G','RCV','TND','BOMB','BLOCK']);}finally{closeOCR();}
});

test('the real yellow level range uses corroborating resize reads rather than losing its first level',{skip:process.platform!=='win32'},async()=>{
 const {createLevelReader,levelRange}=require('../electron/kizuna-levels.cjs'),{ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),image=fs.readFileSync(new URL('./fixtures/kizuna/level-range-lv1-20.png',import.meta.url)),ocr=JSON.parse(fs.readFileSync(new URL('./fixtures/kizuna/level-range-lv1-20.json',import.meta.url),'utf8'));
 try{const result=await createLevelReader(ocrBuffer)(image,ocr,{left:98,top:418,width:705,height:846});assert.ok(result.lines.some((l:any)=>{const r=levelRange(l.text);return r?.min===1&&r?.max===20;}));}finally{closeOCR();}
});

test('disagreeing numeric level-range resizes cannot fill a missing first level',async()=>{
 const {createLevelReader}=require('../electron/kizuna-levels.cjs'),image=fs.readFileSync(new URL('./fixtures/kizuna/level-range-lv1-20.png',import.meta.url)),ocr=JSON.parse(fs.readFileSync(new URL('./fixtures/kizuna/level-range-lv1-20.json',import.meta.url),'utf8')),before=structuredClone(ocr);
 const result=await createLevelReader(async(_image:any,options:any)=>({text:options?.scale===.8?'When Lv1&Lv20':options?.scale===1.5?'When Lv21&Lv30':before.text}))(image,ocr,{left:98,top:418,width:705,height:846});assert.deepEqual(result,before);
});

test('already complete overlap rows need independent pixel alignment and unchanged numeric values before reuse',async()=>{
 const original=tokens(0)[0],old=positioned({...original,text:'DEX PSY type Reduce Special Charge by 10',marquee:{complete:true,samples:10}},{...original.position,top:original.position.top+80});
 const reuse={verified:true,shift:80,tokens:[old]},tracker=createPixelMarquee([original],{...body,height:60},reuse);assert.equal(tracker.pending(),0);const result=await tracker.recognize(async()=>assert.fail('A verified complete overlap row must not be OCRed again'),()=>{});assert.equal(result.tokens[0].text,old.text);
 for(const proof of [{...reuse,verified:false},{...reuse,shift:70},{...reuse,tokens:[positioned({...old,text:'DEX PSY type Reduce Special Charge by 15'},old.position)]}])assert.equal(createPixelMarquee([original],{...body,height:60},proof).pending(),1);
});

test('an ending flush with the viewport mask is verified by its observed wrap rather than waiting forever for a black margin',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,width:690,height:60});for(const image of images)await tracker.observe(image);assert.equal(tracker.pending(),1);
 await tracker.observe(images[2]);assert.equal(tracker.pending(),0);const result=await tracker.recognize(async()=>({lines:[line('DEX PSY type Reduce Special Charge by 10',20,28)]}),()=>{});assert.equal(result.retry.size,0);
});

test('a prefix omitted by page layout OCR is retried on its isolated line without waiting for another animation',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,height:60});for(const image of images)await tracker.observe(image);let calls=0;
 const result=await tracker.recognize(async()=>{calls++;return calls<=3?{lines:[{words:[{text:'10',x:580,y:28,width:30,height:18}]}]}:{lines:[line('DEX PSY type Reduce Special Charge by 10',0,8)]};},()=>{});
 assert.equal(result.retry.size,0);assert.match(result.tokens[0].text,/Charge by 10$/);assert.ok(calls>=4&&calls<=6);
});

test('an unchanged static row can corroborate one complete isolated numeric read but cannot supply missing text',async()=>{
 const image=await sharp(Buffer.from('<svg width="706" height="180"><rect width="706" height="180" fill="black"/><text x="78" y="45" fill="white" font-size="26">6 turn(s) ATK 90% Down</text></svg>')).png().toBuffer(),token=positioned({kind:'line',text:'6 turn(s) ATK 90% Down'},{top:20,height:26,left:78,rightClipped:false});
 for(const finalCorrect of [true,false]){const tracker=createPixelMarquee([token],body);for(let i=0;i<3;i++)await tracker.observe(image);let calls=0;const result=await tracker.recognize(async()=>{calls++;if(finalCorrect&&calls===5)return {lines:[line('6 turn(s) ATK 90% Down',0,8)]};return {lines:[{words:[{text:'6 turn(s) ATK',x:20,y:28,width:170,height:18}]}]};},()=>{});assert.equal(result.retry.size,finalCorrect?0:1);if(finalCorrect)assert.equal(result.tokens[0].text,token.text);}
});

test('a discovered row reused from the previous page appears once and keeps its complete text',async()=>{
 const images=await frames(),middle=tokens(0)[1],old=positioned({...middle,text:'DEX PSY type Super Switch Effect requirement reduction: 10',marquee:{complete:true,samples:10}},{...middle.position,top:middle.position.top+80}),tracker=createPixelMarquee([tokens(0)[0],tokens(0)[2]],body,{verified:true,shift:80,tokens:[old]});for(const image of images)await tracker.observe(image);
 const result=await tracker.recognize(async()=>({lines:[line('DEX PSY type Reduce Special Charge by 10',20,28),line('DEX PSY type VS Effect gauge reduction: 10',20,88)]}),()=>{});assert.equal(result.retry.size,0);assert.equal(result.tokens.length,3);assert.equal(result.tokens[1].text,old.text);assert.ok(result.tokens.every((t:any)=>t.text.length>0));
});

test('a complete observed loop also finishes when capture sampling misses the ending pause',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,width:690,height:60});for(const index of [0,1,2,3,4,5,6])await tracker.observe(images[index]);assert.equal(tracker.pending(),1);
 await tracker.observe(images[2]);assert.equal(tracker.pending(),0);
});

test('a missing original percentage needs two isolated OCR reads and never inherits the missing value',async()=>{
 const image=await sharp(Buffer.from('<svg width="706" height="180"><rect width="706" height="180" fill="black"/><text x="78" y="45" fill="white" font-size="26">6 turn(s) ATK 90% Down</text></svg>')).png().toBuffer(),token=positioned({kind:'line',text:'6 turn(s) ATK Down'},{top:20,height:26,left:78,rightClipped:false}),tracker=createPixelMarquee([token],body);for(let i=0;i<3;i++)await tracker.observe(image);let calls=0;
 const result=await tracker.recognize(async()=>{calls++;return calls>=5?{lines:[line('6 turn(s) ATK 90% Down',0,8)]}:{lines:[{words:[{text:'6 turn(s) ATK',x:20,y:28,width:170,height:18}]}]};},()=>{});assert.equal(calls,6);assert.equal(result.retry.size,0);assert.equal(result.tokens[0].text,'6 turn(s) ATK 90% Down');
});

test('identical unreadable pixels report a concrete error after alternative OCR methods instead of looping forever',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,height:60});for(const image of images)await tracker.observe(image);const unreadable=async()=>({lines:[{words:[{text:'10',x:580,y:28,width:30,height:18}]}]});
 const first=await tracker.recognize(unreadable,()=>{});assert.deepEqual([...first.retry],[0]);await assert.rejects(tracker.recognize(unreadable,()=>{}),/aynı görüntüde.*doğrulanamadı/);
});

test('letter-shaped OCR digits cannot certify a partial number even when both OCR views agree',async()=>{
 const images=await frames(),token=positioned({...tokens(0)[0],text:'DEX PSY type Reduce Special Charge by IO'},tokens(0)[0].position),tracker=createPixelMarquee([token],{...body,height:60});for(const image of images)await tracker.observe(image);
 const result=await tracker.recognize(async()=>({lines:[line('DEX PSY type Reduce Special Charge by I0',20,28)]}),()=>{});assert.deepEqual([...result.retry],[0]);
});

test('a tiny repeated fragment cannot outweigh the independently matching larger overlap',()=>{
 const {horizontalShift}=require('../electron/marquee-panorama.cjs'),width=300,height=20,a=Buffer.alloc(width*height),b=Buffer.alloc(width*height);let seed=17;for(let i=0;i<a.length;i++){seed=(seed*1664525+1013904223)>>>0;a[i]=seed>>>31;}
 for(let y=0;y<height;y++){for(let x=80;x<140;x++)a[y*width+x+120]=a[y*width+x];for(let x=0;x<width-80;x++)b[y*width+x]=a[y*width+x+80];for(let x=100;x<=120;x++)b[y*width+x]^=1;}
 const strip=(mask:Buffer)=>{const columns=new Uint32Array(width+1),points:number[]=[];for(let i=0;i<mask.length;i++)if(mask[i]){points.push(i);columns[i%width+1]++;}for(let x=1;x<columns.length;x++)columns[x]+=columns[x-1];return {mask,columns,points,width,height};};
 assert.equal(horizontalShift(strip(a),strip(b))?.shift,80);
});

test('adjacent colored slot words combine only observed labels at the same physical positions',{skip:process.platform!=='win32'},async()=>{
 const {prepareStrip,mergeSlotWords}=require('../electron/marquee-panorama.cjs'),{ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),raw=await sharp(fs.readFileSync(new URL('./fixtures/kizuna/rcv-slot-marquee.png',import.meta.url))).removeAlpha().raw().toBuffer({resolveWithObject:true}),prepared=prepareStrip(raw.data,raw.info.width,raw.info.height);
 try{const image=await sharp(prepared.data,{raw:{width:prepared.width,height:prepared.height,channels:3}}).png().toBuffer(),reads=[];for(const scale of [3,2,2.5])reads.push((await ocrBuffer(image,{scale})).lines.flatMap((l:any)=>l.words));const merged=mergeSlotWords(reads),text=merged.lists[0].map((w:any)=>w.text).join(' ');assert.equal(merged.ambiguous,false);assert.deepEqual([...text.toUpperCase().matchAll(/\[([A-Z]+)\]/g)].map(m=>m[1]),['EMPTY','STR','DEX','QCK','PSY','INT','G','RCV','TND','BOMB','RCV']);}finally{closeOCR();}
});

test('slot-view reconciliation preserves counts and converter words, and refuses conflicting valid labels',()=>{
 const {mergeSlotWords}=require('../electron/marquee-panorama.cjs'),word=(text:string,x:number,width=80)=>({text,x,y:0,width,height:24});
 const merged=mergeSlotWords([[word('2[DEX]',0,100),word('to[RCV]',200,100)],[word('[DEX]',15),word('[RCV]',220)]]);const text=merged.lists[0].map((w:any)=>w.text).join(' ');assert.match(text,/2\[DEX\]/);assert.match(text,/to\[RCV\]/);
 assert.equal(mergeSlotWords([[word('[STR]',0)],[word('[DEX]',0)]]).ambiguous,true);
});

test('the independent line reader cannot certify a low confidence numeral',async()=>{
 const images=await frames(),tracker=createPixelMarquee([tokens(0)[0]],{...body,height:60});for(const image of images)await tracker.observe(image);
 const result=await tracker.recognize(async()=>({lines:[{words:[{text:'10',x:580,y:28,width:30,height:18}]}]}),()=>{},async()=>({lines:[{words:[{...line('DEX PSY type Reduce Special Charge by 10',0,8).words[0],confidence:50}]}]}));assert.deepEqual([...result.retry],[0]);
});

test('a recovered fixed interruption badge survives a same-page raw OCR miss',{skip:process.platform!=='win32'},async()=>{
 const {createPageReader}=require('../electron/kizuna-live.cjs'),{modalIdentity,pageTokens}=require('../electron/boss-behavior-core.cjs'),{ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),image=fs.readFileSync(new URL('./fixtures/kizuna/interruption-cache.png',import.meta.url));
 const read=createPageReader({readOCR:async(...args:any[])=>{const value=await ocrBuffer(...args);if(value.width===900&&value.height===1600){value.lines=value.lines.map((l:any)=>({...l,words:l.words.filter((w:any)=>!/INTERRUPT/i.test(w.text))})).filter((l:any)=>l.words.length);value.text=value.lines.map((l:any)=>l.words.map((w:any)=>w.text).join(' ')).join('\n');}return value;}});
 try{for(let i=0;i<2;i++){const value=await read(image);assert.ok(pageTokens(value,modalIdentity(value)).some((t:any)=>t.kind==='event'&&t.trigger==='interrupt'),'Recovered badge lost on observation '+i);}}finally{await closeOCR();}
});

test('a missing short word cannot hide inside a high overall ink coverage score',async()=>{
 const svg='<svg width="1700" height="100"><rect width="1700" height="100" fill="black"/><g fill="white" font-size="26"><text x="200" y="45">'+('A'.repeat(35))+'</text><text x="850" y="45">90%</text><text x="930" y="45">'+('A'.repeat(20))+'</text></g></svg>',image=await sharp(Buffer.from(svg)).png().toBuffer(),token=positioned({kind:'line',text:'2 turns prefix suffix'},{top:20,height:26,left:200,rightClipped:false}),tracker=createPixelMarquee([token],{left:0,top:0,width:1700,height:100});for(let i=0;i<3;i++)await tracker.observe(image);
 const result=await tracker.recognize(async()=>({lines:[{words:[{text:'2 turns prefix',x:20,y:28,width:650,height:24},{text:'suffix',x:760,y:28,width:700,height:24}]}]}),()=>{});assert.deepEqual([...result.retry],[0]);
});

test('shared stationary text pixels verify the real scroll when icon alignment and an OCR slot typo fail',async()=>{
 const {createScrollAlignment,estimateScroll}=require('../electron/behavior-tracking.cjs'),{mergeTokens}=require('../electron/boss-behavior-core.cjs'),body={left:98,top:418,width:705,height:846},images=[2,3].map(n=>fs.readFileSync(new URL('./fixtures/kizuna/scroll-static-'+n+'.png',import.meta.url))),tokens=[2,3].map(n=>{const page=Symbol();return JSON.parse(fs.readFileSync(new URL('./fixtures/kizuna/scroll-static-'+n+'.json',import.meta.url),'utf8')).map(({position,...t}:any)=>positioned(t,{...position,page}));});
 assert.equal(await estimateScroll(...images,body),null);const evidence=await createScrollAlignment().evidence(...images,body,{previous:tokens[0],next:tokens[1]});assert.equal(evidence?.verified,true);assert.equal(evidence.shift,457);const joined=mergeTokens(tokens[0],tokens[1],evidence);assert.ok(joined.some((t:any)=>t.kind==='battle'&&t.number===3&&t.variant==='1'));assert.equal(joined.filter((t:any)=>t.text==='Percentage damage 50% of current HP').length,1);
});

test('stationary text alignment rejects a lone matching row and repeated competing offsets',async()=>{
 const {stationaryTextScrollEvidence}=require('../electron/quest-scroll-anchor.cjs'),body={left:98,top:418,width:705,height:846},images=[2,3].map(n=>fs.readFileSync(new URL('./fixtures/kizuna/scroll-static-'+n+'.png',import.meta.url))),tokens=[2,3].map(n=>JSON.parse(fs.readFileSync(new URL('./fixtures/kizuna/scroll-static-'+n+'.json',import.meta.url),'utf8')).map(({position,...t}:any)=>positioned(t,position))),black=await sharp({create:{width:610,height:75,channels:3,background:'black'}}).png().toBuffer(),different=await sharp(images[1]).composite([{input:black,left:176,top:525}]).png().toBuffer();assert.equal(await stationaryTextScrollEvidence(images[0],different,body,{previous:tokens[0],next:tokens[1]}),null);
 const texts=['Repeated alpha phrase','Repeated beta phrase'],ys=[50,120,250,320],svg='<svg width="500" height="600"><rect width="500" height="600" fill="black"/>'+ys.map((y,i)=>'<text x="80" y="'+(y+22)+'" fill="white" font-size="22">'+texts[i%2]+'</text>').join('')+'</svg>',image=await sharp(Buffer.from(svg)).png().toBuffer(),repeated=ys.map((top,i)=>positioned({kind:'line',text:texts[i%2]},{top,height:26,left:80,edge:false}));assert.equal(await stationaryTextScrollEvidence(image,image,{left:0,top:0,width:500,height:600},{previous:repeated,next:repeated}),null);
});

test('a fixed badge uses literal independent OCR when the page engine misses it',async()=>{
 const {recoverInterruption}=require('../electron/starting-state-ocr.cjs'),image=await sharp(Buffer.from('<svg width="900" height="1600"><rect width="900" height="1600" fill="black"/><rect x="113" y="750" width="180" height="40" fill="black" stroke="#ffcc22" stroke-width="3"/><text x="118" y="779" font-size="23" fill="white">INTERRUPTION</text></svg>')).png().toBuffer();let fallback=0;
 const result=await recoverInterruption(image,{width:900,height:1600,text:'',lines:[]},{left:98,top:418,width:705,height:846},async()=>({text:'UNKNOWN',lines:[]}),async()=>{fallback++;return {text:'INTERRUPTION',lines:[{words:[{text:'INTERRUPTION',x:4,y:8,width:170,height:26,confidence:90}]}]};});assert.equal(fallback,1);assert.ok(result.lines.some((l:any)=>l.text==='INTERRUPTION'));
});

test('a wide stationary enemy caption uses a measured badge boundary and observed animation calibration',{skip:process.platform!=='win32'},async()=>{
 const {createPageReader}=require('../electron/kizuna-live.cjs'),{modalIdentity,pageTokens}=require('../electron/boss-behavior-core.cjs'),{ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),{readLineOCR}=require('../electron/line-ocr.cjs'),image=fs.readFileSync(new URL('./fixtures/kizuna/wide-starting-state.png',import.meta.url));
 try{const page=await createPageReader({readLineOCR})(image),token=pageTokens(page,modalIdentity(page)).find((t:any)=>t.kind==='event'&&t.trigger==='starting');assert.ok(token);assert.ok(token.position.contentLeft>270&&token.position.contentLeft<292);let clock=0;const tracker=createPixelMarquee([token],{left:98,top:1080,width:705,height:100},undefined,{staticCycleMs:1000,now:()=>clock});for(const t of [0,100,200]){clock=t;await tracker.observe(image);}assert.equal(tracker.pending(),1);clock=1100;await tracker.observe(image);assert.equal(tracker.pending(),0);const result=await tracker.recognize(ocrBuffer,()=>{},readLineOCR);assert.equal(result.retry.size,0);assert.match(result.tokens[0].text,/STARTING STATE Bonney: Halloween Buffet Banquet/);}finally{await closeOCR();}
});

test('independent masked and colored header reads restore a missing first level without borrowing another range',{skip:process.platform!=='win32'},async()=>{
 const {createPageReader}=require('../electron/kizuna-live.cjs'),{levelRange}=require('../electron/kizuna-levels.cjs'),{ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),{readLineOCR}=require('../electron/line-ocr.cjs'),image=fs.readFileSync(new URL('./fixtures/kizuna/level-header-omission.png',import.meta.url));
 const failedHeader=async(...args:any[])=>{const value=await ocrBuffer(...args);for(const l of value.lines)if(/^When\b/.test(l.text)){const w=l.words[0];l.words=[{...w,text:'When Lv?~Lv20'}];l.text='When Lv?~Lv20';}value.text=value.lines.map((l:any)=>l.text).join('\n');return value;};
 try{const result=await createPageReader({readOCR:failedHeader,readLineOCR})(image);assert.ok(result.lines.some((l:any)=>{const range=levelRange(l.text);return range?.min===1&&range?.max===20;}));}finally{await closeOCR();}
});
