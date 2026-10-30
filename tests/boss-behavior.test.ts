import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {modalIdentity,pageTokens,mergeTokens,encounterFromTokens,eventLabel,durationEffects}=require('../electron/boss-behavior-core.cjs');
const {createBehaviorReader,sameHeader}=require('../electron/boss-behavior.cjs');
const fixture=(n:number)=>JSON.parse(fs.readFileSync(new URL(`./fixtures/boss-behavior/page-${n}.json`,import.meta.url),'utf8'));
const meta={observedAt:'2026-10-07T19:00:00Z',complete:true,pages:5};
test('the actual Boss Plan service chooses pixel reconstruction and cancels without OCRing every capture',async()=>{
 const {createBossBehaviorService}=require('../electron/boss-behavior.cjs'),image=fs.readFileSync(new URL('./fixtures/boss-behavior/clash-lucci-scroll-a.png',import.meta.url)),progress:string[]=[];let reads=0;
 const reader=createBossBehaviorService(undefined,undefined,{prepare:undefined,readRestrictions:undefined,capture:async()=>({image,width:900,height:1600}),ocr:async()=>{reads++;return fixture(0);},scrollbar:async()=>({known:true,top:true,bottom:true}),headerHash:async()=>'same',difficulty:async()=>9,wait:async()=>{}});
 await assert.rejects(reader.read('fake','fake',(text:string)=>{progress.push(text);if(/görüntüden birleştiriliyor/.test(text))reader.cancel();else if(/Kayan yazının/.test(text))throw Error('Legacy string reader was selected');}),/iptal edildi/);
 assert.ok(progress.some(s=>/görüntüden birleştiriliyor/.test(s)));assert.equal(reads,1);
});
test('real MuMu pages preserve five battles, variants and separate defeated behavior',()=>{
 let tokens:any[]=[];for(const n of [0,2,4,6,8]){const o=fixture(n);tokens=mergeTokens(tokens,pageTokens(o,modalIdentity(o)));}
 const result=encounterFromTokens({...modalIdentity(fixture(0)),difficulty:9},tokens,meta);
 assert.equal(result.stages.length,5);assert.equal(result.difficulty,'9★');assert.equal(result.observation.level,null);
 assert.deepEqual(result.stages[1].requirements,[{mechanic:'paralysis',turns:1}]);assert.equal(result.stages[2].events[0].trigger,'defeated');assert.deepEqual(result.stages[2].requirements,[]);
 assert.deepEqual(result.stages[3].requirements,[{mechanic:'specialBind',turns:8},{mechanic:'despair',turns:6}]);assert.equal(result.stages[3].events.length,2);assert.equal(result.stages[3].turn,3);
 assert.equal(result.stages[4].normalAttackOnly,true);assert.ok(result.observation.warnings.some((w:string)=>w.includes('DEF x 1000')));
});
test('durations are effects, never attack-turn headings; immunity and conditional effects stay unverified',()=>{
 for(const text of ['1 turn(s) Paralysis','8 turn(s) Special Bind','3 turns Resilience'])assert.equal(eventLabel(text),null);
 assert.equal(eventLabel('TURN 3').trigger,'turn');assert.equal(eventLabel('HP < 20%').trigger,'hp');assert.equal(eventLabel('INTERRUPT').trigger,'interrupt');
 assert.deepEqual(durationEffects('8 turn(s) Middle-Row Special Bind\n6 turn(s) Top-Row Despair\n99 turns Poison Immunity\nIf HP low, 9 turns Bind').effects,[{mechanic:'specialBind',turns:8},{mechanic:'despair',turns:6}]);
});
test('unverified missing stage or unrelated page cannot become a complete boss profile',()=>{
 const o=fixture(0),id=modalIdentity(o),tokens=pageTokens(o,id);assert.throws(()=>encounterFromTokens(id,tokens.filter((t:any)=>t.number!==2),meta),/başı ve sonu/);
 assert.throws(()=>mergeTokens(tokens,[{kind:'line',text:'Entirely unrelated content'}]),/birleştir/);assert.equal(modalIdentity({...o,lines:[]}),null);
});
const battle=(number:number,variant='')=>({kind:'battle',number,variant,text:'BATTLE '+number+(variant?'-'+variant:'')});
const pre={kind:'event',trigger:'preemptive',label:'İlk saldırı',text:'PREEMPTIVE'};
const line=(text:string)=>({kind:'line',text});

test('an explicit INTERRUPTION label separates reactive Despair from initial defenses',()=>{
 assert.equal(eventLabel('INTERRUPTION Slot Change').trigger,'interrupt');
 const actual=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-combat-10star.json',import.meta.url),'utf8'));
 const fifth=actual.stages[4];assert.deepEqual(fifth.requirements,[{mechanic:'damageReduction',turns:5},{mechanic:'threshold',turns:5}]);
 const reactive=fifth.events.find((e:any)=>e.trigger==='interrupt');assert.equal(reactive.label,'INTERRUPTION Slot Change');assert.deepEqual(reactive.requirements,[{mechanic:'despair',turns:10}]);
 assert.ok(reactive.text.includes('Remove Beneficial Effects'));
});

test('real yellow interruption badge is recovered by targeted OCR without duplicate Slot Change rows',{skip:process.platform!=='win32'},async()=>{
 const {readBehaviorPage}=require('../electron/boss-behavior.cjs');
 const o=await readBehaviorPage(fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-yellow-interruption.png',import.meta.url)));
 const tokens=pageTokens(o,modalIdentity(o));assert.equal(tokens.filter((t:any)=>t.trigger==='interrupt').length,1);assert.ok(!tokens.some((t:any)=>t.kind==='line'&&t.text==='Slot Change'));
});
test('fully captured guide may omit leading and middle battles; no effects are invented',()=>{
 const id=modalIdentity(fixture(0)),tokens=[battle(3,'1'),pre,line('3 turns Bind'),battle(3,'2'),pre,line('5 turns Paralysis'),battle(5)];
 const r=encounterFromTokens(id,tokens,{...meta,startVerified:true});
 assert.deepEqual(r.stages.map((s:any)=>s.battleNumber),[1,2,3,4,5]);
 for(const i of [0,1,3]){assert.equal(r.stages[i].behaviorStatus,'notListed');assert.deepEqual(r.stages[i].requirements,[]);}
 assert.equal(r.stages[4].behaviorStatus,'empty');
 assert.deepEqual(r.stages[2].sourceSections,['Battle 3-1','Battle 3-2']);
 assert.deepEqual(r.stages[2].events.map((e:any)=>e.sourceBattle),['Battle 3-1','Battle 3-2']);
 assert.ok(r.stages[2].events.every((e:any)=>e.trigger==='preemptive'&&e.battleTurn===undefined));
 assert.equal(r.stages[2].turn,2);
 assert.throws(()=>encounterFromTokens(id,tokens,{...meta,startVerified:true,complete:false}),/başı ve sonu/);
});
test('explicit empty battle is valid; orphan behavior and backwards headings still fail',()=>{
 const id=modalIdentity(fixture(0));assert.equal(encounterFromTokens(id,[battle(1),battle(2)],meta).stages[0].behaviorStatus,'empty');
 assert.throws(()=>encounterFromTokens(id,[pre,line('5 turns Bind'),battle(3)],{...meta,startVerified:true}),/başlığı olmayan/);
 assert.throws(()=>encounterFromTokens(id,[battle(3),battle(2)],{...meta,startVerified:true}),/sırası/);
});
test('numbered turn labels retain timing; suffix and effect duration never infer a turn',()=>{
 assert.equal(eventLabel('TURN 2').battleTurn,2);assert.equal(eventLabel('AFTER 2 TURNS').battleTurn,3);assert.equal(eventLabel('EVERY 2 TURNS').repeatEvery,2);
 assert.equal(eventLabel('2 turn(s) Paralysis'),null);assert.equal(eventLabel('STARTING STATE Street Punk').trigger,'starting');
 const id=modalIdentity(fixture(0)),r=encounterFromTokens(id,[battle(1),battle(2,'2'),pre,line('3 turns Bind'),{kind:'event',...eventLabel('TURN 2'),text:'TURN 2'},line('5 turns Paralysis')],meta);
 assert.deepEqual(r.stages[1].requirements,[{mechanic:'bind',turns:3}]);assert.equal(r.stages[1].events[1].battleTurn,2);assert.deepEqual(r.stages[1].events[1].requirements,[{mechanic:'paralysis',turns:5}]);
});
test('a trailing unreadable zero is not silently treated as one-star difficulty',()=>{
 const o=fixture(0),row=o.lines.find((l:any)=>l.text==='Difficulty');row.words.push({text:'1',x:533,y:269,width:12,height:30},{text:'()',x:564,y:269,width:24,height:30});assert.equal(modalIdentity(o).difficulty,null);
 row.words[2].text='0';assert.equal(modalIdentity(o).difficulty,10);
});
test('a page containing only BEHAVIOR joins the following first battle without guessing',()=>{
 assert.deepEqual(mergeTokens([{kind:'heading',text:'BEHAVIOR'}],[battle(3),pre,line('3 turns Bind')]).slice(1),[battle(3),pre,line('3 turns Bind')]);
 const o=fixture(0),id=modalIdentity(o);o.lines.push({words:[{text:'CLEARED CAPTAIN',x:120,y:bodyTop(id)-20,width:230,height:12}]});assert.ok(!pageTokens(o,id).some((t:any)=>t.text==='CLEARED CAPTAIN'));
});
test('real Bartolomeo marquee overlaps keep 3-1 and 3-2 without losing a partially clipped row',()=>{
 let tokens:any[]=[];for(const file of ['barto-start','barto-middle','barto-next']){const o=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/'+file+'.json',import.meta.url),'utf8'));tokens=mergeTokens(tokens,pageTokens(o,modalIdentity(o)));}
 assert.deepEqual(tokens.filter(t=>t.kind==='battle').map(t=>t.text),['BATTLE 1','BATTLE 3-1','BATTLE 3-2']);
 assert.ok(tokens.some(t=>t.text.includes('6 turn(s) Crewmate')));
 const old=[battle(1),line('Street Punk: Blade'),line('99 turns Hit Barrier'),pre,line('3 turns Paralysis')],changed=[line('Street Punk: Blade'),line('99 turns Hit Barrier'),pre,line('5 turns Paralysis'),battle(2)];
 assert.throws(()=>mergeTokens(old,changed),/birleştir/);
});
function bodyTop(id:any){return id.body.top;}
test('identical effects across real Bartolomeo subsections cannot duplicate Battle 3-2',()=>{
 let tokens:any[]=[];
 const files=['duplicate-start','duplicate-second','duplicate-third','duplicate-fourth','duplicate-fifth','duplicate-bottom'];
 const pages=files.map(file=>JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/'+file+'.json',import.meta.url),'utf8')));
 for(const o of pages){tokens=mergeTokens(tokens,pageTokens(o,modalIdentity(o)));const headings=tokens.filter(t=>t.kind==='battle').map(t=>t.text);assert.equal(new Set(headings).size,headings.length);}
 const result=encounterFromTokens({...modalIdentity(pages[0]),difficulty:10},tokens,{...meta,startVerified:true});
 assert.deepEqual(result.stages.map((s:any)=>s.battleNumber),[1,2,3,4,5]);
 assert.deepEqual(result.stages[2].sourceSections,['Battle 3-1','Battle 3-2']);
 assert.equal(result.stages[4].specialLimit,2);
 assert.ok(result.stages[4].events[0].text.includes('Damage Barrier'));
 assert.equal(tokens.filter(t=>t.text==='BATTLE 3-2').length,1);
});
test('shared heading cannot discard later scanned stages or hide a duplicate in one page',()=>{
 assert.throws(()=>mergeTokens([battle(1),pre,line('3 turns Bind'),battle(2),pre,line('5 turns Paralysis')],[battle(1),pre,line('3 turns Bind')]),/birleştir/);
 assert.throws(()=>mergeTokens([battle(1),pre,line('3 turns Bind')],[battle(1),pre,line('3 turns Bind'),battle(1)]),/birleştir/);
 assert.throws(()=>encounterFromTokens(modalIdentity(fixture(0)),[battle(1),battle(1)],meta),/tekrarlandı/);
});
test('minor pixel noise passes header guard, changed difficulty does not',()=>{
 const a=Buffer.alloc(1000,100),b=Buffer.from(a);b[0]+=5;assert.equal(sameHeader(a.toString('base64'),b.toString('base64')),true);
 b.fill(150,0,50);assert.equal(sameHeader(a.toString('base64'),b.toString('base64')),false);
});
function readerFixture(){let index=0,header='same',wrong=false;const inputs:string[]=[];const pages=[fixture(0),fixture(2),fixture(4),fixture(6),fixture(8)];const io={capture:async()=>({image:Buffer.from([index]),width:900,height:1600}),ocr:async(b:Buffer)=>wrong?{...pages[0],lines:[]}:pages[b[0]],scrollbar:async(b:Buffer)=>({known:true,top:b[0]===0,bottom:b[0]===4}),headerHash:async()=>header,difficulty:async()=>9,input:async(_exe:string,_device:string,action:string)=>{inputs.push(action);index=Math.min(4,index+1);},wait:async()=>{}};return {reader:createBehaviorReader(io),io,inputs,setHeader:(s:string)=>header=s,setWrong:()=>wrong=true};}
test('guarded scanner reaches observed bottom and makes only bounded list swipes',async()=>{
 const f=readerFixture(),result=await f.reader.read('adb','device');assert.equal(result.observation.complete,true);assert.equal(result.stages.length,5);assert.deepEqual(f.inputs,['down','down','down','down']);
});

test('a progressing guide continues beyond thirty-two pages to the observed bottom',async()=>{
 let index=0;const pages=Array.from({length:35},(_,n)=>{const page=fixture(0),row=page.lines.find((r:any)=>r.text==='Retreat');row.words[0].text='Retreat '+String.fromCharCode(65+n);row.text=row.words[0].text;return page;});
 const reader=createBehaviorReader({capture:async()=>({image:Buffer.from([index]),width:900,height:1600}),ocr:async(b:Buffer)=>pages[b[0]],scrollbar:async(b:Buffer)=>({known:true,top:b[0]===0,bottom:b[0]===34}),headerHash:async()=>'same',difficulty:async()=>10,input:async()=>{index++;},wait:async()=>{}});
 const result=await reader.read('adb','device');assert.equal(result.observation.complete,true);assert.equal(result.observation.pages,35);assert.equal(index,34);
});
test('guarded reader completes recorded duplicate-heading failure without extra swipes',async()=>{
 const files=['duplicate-start','duplicate-second','duplicate-third','duplicate-fourth','duplicate-fifth','duplicate-bottom'];
 const pages=files.map(file=>JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/'+file+'.json',import.meta.url),'utf8')));
 let index=0;const inputs:string[]=[];
 const reader=createBehaviorReader({capture:async()=>({image:Buffer.from([index]),width:900,height:1600}),ocr:async(b:Buffer)=>pages[b[0]],scrollbar:async(b:Buffer)=>({known:true,top:b[0]===0,bottom:b[0]===5}),headerHash:async()=>'same',difficulty:async()=>10,input:async(_exe:string,_device:string,action:string)=>{inputs.push(action);index++;},wait:async()=>{}});
 const result=await reader.read('adb','device');
 assert.equal(result.observation.complete,true);assert.equal(result.observation.pages,6);
 assert.deepEqual(result.stages[2].sourceSections,['Battle 3-1','Battle 3-2']);
 assert.deepEqual(inputs,['down','down','down','down','down']);
});
test('changed boss and wrong screen abort before any swipe, cancellation also stops inputs',async()=>{
 for(const action of ['header','screen','cancel']){const f=readerFixture();await assert.rejects(f.reader.read('adb','device',(status:string)=>{if(status.includes('sayfası 1')){if(action==='header')f.setHeader('different');if(action==='screen')f.setWrong();if(action==='cancel')f.reader.cancel();}}));assert.deepEqual(f.inputs,[]);}
});
test('unknown scrollbar never certifies complete capture when content stops moving',async()=>{
 const f=readerFixture();f.io.scrollbar=async()=>({known:false,top:false,bottom:false});f.io.input=async()=>{};const r=await f.reader.read('adb','device');assert.equal(r.observation.complete,false);assert.ok(r.observation.warnings.some((s:string)=>s.includes('sonu doğrulanamadı')));
});
test('Battle 4 letter correction requires its measured numeral pixels',async()=>{
 const {correctBattleDigits}=require('../electron/boss-glyph.cjs'),sharp=require('sharp'),img=fs.readFileSync(new URL('./fixtures/boss-behavior/digit-4.png',import.meta.url)),m=await sharp(img).metadata();
 const o={lines:[{text:'BATTLE a-1',words:[{text:'BATTLE',x:-100,y:0,width:50,height:25},{text:'a-1',x:3,y:3,width:m.width-6,height:m.height-6}]}]};
 const corrected=await correctBattleDigits(img,structuredClone(o));assert.equal(corrected.lines[0].words[1].text,'4-1');
 const blank=await sharp({create:{width:m.width,height:m.height,channels:3,background:'black'}}).png().toBuffer();assert.equal((await correctBattleDigits(blank,structuredClone(o))).lines[0].words[1].text,'a-1');
});
test('uncertain Battle heading is never assigned to the previous stage',()=>{
 const o=fixture(0),id=modalIdentity(o),tokens=pageTokens(o,id);tokens.push({kind:'invalidBattle',text:'BATTLE ?-1'});assert.throws(()=>encounterFromTokens(id,tokens,meta),/başlığı okunamadı/);
});
test('recorded Luffytaro merge failure joins after pixel-verified Battle 4 correction',async()=>{
 const {correctBattleDigits}=require('../electron/boss-glyph.cjs');
 const pages=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-merge-failure.json',import.meta.url),'utf8'));
 const frames=[4,5,7,9,11,13,15,17];let tokens:any[]=[];
 // Position evidence may align a dropped heading, but cannot identify its digit.
 let original:any[]=[];
 for(const o of pages)original=mergeTokens(original,pageTokens(o,modalIdentity(o)));
 assert.throws(()=>encounterFromTokens(modalIdentity(pages[0]),original,{...meta,startVerified:true}),/başlığı okunamadı/);
 for(let i=0;i<pages.length;i++){
  const image=fs.readFileSync(new URL(`./fixtures/boss-behavior/luffytaro-headings-${frames[i]}.png`,import.meta.url));
  const o=await correctBattleDigits(image,structuredClone(pages[i]));
  const next=pageTokens(o,modalIdentity(o));assert.ok(!next.some((t:any)=>t.kind==='invalidBattle'));
  tokens=mergeTokens(tokens,next);
 }
 assert.deepEqual(tokens.filter(t=>t.kind==='battle').map(t=>t.text),['BATTLE 1','BATTLE 3','BATTLE 4','BATTLE 5']);
 const result=encounterFromTokens({...modalIdentity(pages[0]),difficulty:10},tokens,{...meta,startVerified:true});
 assert.equal(result.stages[1].behaviorStatus,'notListed');
 assert.deepEqual(result.stages[3].requirements,[{mechanic:'burn',turns:5},{mechanic:'despair',turns:8},{mechanic:'bind',turns:6}]);
 assert.ok(result.stages[3].events.some((e:any)=>e.trigger==='defeated'&&e.text.includes('30000 damage')));
});
test('a missing Battle numeral requires its pixels and cannot discard a variant suffix',async()=>{
 const {correctBattleDigits}=require('../electron/boss-glyph.cjs'),sharp=require('sharp');
 const pages=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-merge-failure.json',import.meta.url),'utf8'));
 const page=pages[5],image=fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-headings-13.png',import.meta.url));
 const uncertain=page.lines.find((l:any)=>l.text==='BATTLE');assert.ok(uncertain);
 assert.ok((await correctBattleDigits(image,structuredClone(page))).lines.some((l:any)=>l.text==='BATTLE 4'&&l.battleDigitVerified));
 const blank=await sharp({create:{width:page.width,height:page.height,channels:3,background:'black'}}).png().toBuffer();
 assert.ok((await correctBattleDigits(blank,structuredClone(page))).lines.some((l:any)=>l.text==='BATTLE'));
 const label=uncertain.words[0],suffix=Buffer.from('<svg width="48" height="36"><text x="0" y="28" fill="white" font-size="30">-1</text></svg>');
 const variant=await sharp(image).composite([{input:suffix,left:Math.round(label.x+label.width+45),top:Math.round(label.y)}]).png().toBuffer();
 assert.ok((await correctBattleDigits(variant,structuredClone(page))).lines.some((l:any)=>l.text==='BATTLE'));
});
test('recorded moving rows join by an unambiguous measured scroll; repeated enemies remain separate',()=>{
 const pages=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-marquee-failure.json',import.meta.url),'utf8'));
 let tokens:any[]=[];for(const o of pages)tokens=mergeTokens(tokens,pageTokens(o,modalIdentity(o)));
 assert.deepEqual(tokens.filter(t=>t.kind==='battle').map(t=>t.text),['BATTLE 1','BATTLE 3','BATTLE 4','BATTLE 5']);
 assert.equal(tokens.filter(t=>t.text==='Land of wano Official').length,2);
 assert.equal(tokens.filter(t=>/Tap-Timino Barrier/.test(t.text)).length,2);
 assert.equal(tokens.filter(t=>t.text==='to [BL').length,1);
 assert.ok(tokens.some(t=>/^98 turn\(s\) Non-Norma/.test(t.text)));
 assert.ok(tokens.some(t=>/^5 turn\(s\) Damaoe over 1000 99%/.test(t.text)));
 assert.ok(!tokens.some(t=>/turmsy|turrnsy/.test(t.text)),'clipped top-edge OCR must not create a duplicate effect');
 const changed=structuredClone(pages.at(-1));
 const row=changed.lines.find((l:any)=>l.text==='98 turn(s) Immunity');
 const number=row.words.find((w:any)=>w.text==='98');number.text='99';row.text=row.text.replace('98','99');
 assert.throws(()=>mergeTokens(tokens,pageTokens(changed,modalIdentity(changed))),/sayıları çelişiyor/);
 const result=encounterFromTokens(modalIdentity(pages[0]),tokens,{...meta,startVerified:true});
 assert.match(result.stages[4].notes,/98 turn\(s\) Non-Norma[lI] Attacks deal 1 damage/);
 assert.equal(result.stages[4].normalAttackOnly,true,'literal overlapping captures complete the damage word without inventing unseen text');
 // Positions are transient stitching evidence, not saved behavior or identity.
 assert.ok(!JSON.stringify(tokens).includes('position'));
});
test('equally plausible physical overlaps cannot pick one of two repeated effect blocks',()=>{
 const page=Symbol(),mark=(t:any,y:number)=>Object.defineProperty({...t},'position',{value:{top:y,height:25,page},enumerable:false});
 const group=(top:number)=>[mark(pre,top),mark(line('3 turns Bind'),top+55),mark(line('5 turns Paralysis'),top+110)];
 const old=[mark(battle(1),450),...group(600),...group(900),mark(line('30000 damage'),1200)];
 const nextPage=Symbol(),next=group(600).map(t=>Object.defineProperty({...t},'position',{value:{...t.position,page:nextPage},enumerable:false}));
 assert.throws(()=>mergeTokens(old,next),/Kaydırma konumu belirsiz/);
});
test('real effect-icon OCR is excluded from numbers without discarding actual duration or damage',()=>{
 const pages=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-number-gutter.json',import.meta.url),'utf8'));
 const o=structuredClone(pages[4]);
 const poison=o.lines.find((l:any)=>/Progressive Poison/.test(l.text));
 const icon=poison.words.find((w:any)=>w.x<170);assert.ok(icon);
 icon.text='0';const first=pageTokens(o,modalIdentity(o));
 icon.text='8';const second=pageTokens(o,modalIdentity(o));
 const joined=mergeTokens(first,second);
 assert.ok(joined.some((t:any)=>t.text==='98 turn(s) Progressive Poison damage'));
 assert.ok(joined.some((t:any)=>t.text==='5 turn(s) 5000 damage Burn'));
 assert.ok(!joined.some((t:any)=>/^[08@] 98/.test(t.text)));
 const changed=structuredClone(o);changed.lines.find((l:any)=>/Progressive Poison/.test(l.text)).words.find((w:any)=>w.text==='98').text='99';
 assert.throws(()=>mergeTokens(joined,pageTokens(changed,modalIdentity(changed))),/sayıları çelişiyor/);
 const damage=structuredClone(o);damage.lines.find((l:any)=>/damage Burn/.test(l.text)).words.find((w:any)=>w.text==='5000').text='4000';
 assert.throws(()=>mergeTokens(joined,pageTokens(damage,modalIdentity(damage))),/sayıları çelişiyor/);
 let all:any[]=[];for(const page of pages)all=mergeTokens(all,pageTokens(page,modalIdentity(page)));
 const result=encounterFromTokens(modalIdentity(pages[0]),all,{...meta,startVerified:true});
 assert.deepEqual(result.stages.map((s:any)=>s.battleNumber),[1,2,3,4,5]);
 assert.deepEqual(result.stages[3].requirements,[{mechanic:'burn',turns:5},{mechanic:'despair',turns:8},{mechanic:'bind',turns:6}]);
});
test('a partial numeric glyph at the viewport top keeps the full row; interior conflicts still fail',()=>{
 const page=Symbol(),nextPage=Symbol();
 const mark=(t:any,y:number,p: symbol,edge=false)=>Object.defineProperty({...t},'position',{value:{top:y,height:25,page:p,edge},enumerable:false});
 const old=[mark(line('8 turns Despair'),550,page),mark(battle(4),630,page),mark(pre,700,page),mark(line('5 turns Burn'),750,page),mark(line('30000 damage'),810,page)];
 const next=old.map(t=>mark(t,t.position.top-130,nextPage));
 next[0]=mark(line('3 turns Despair'),420,nextPage,true);
 const joined=mergeTokens(old,next);assert.equal(joined[0].text,'8 turns Despair');assert.equal(joined.length,old.length);
 next[0]=mark(line('3 turns Despair'),420,nextPage,false);
 assert.throws(()=>mergeTokens(old,next),/sayıları çelişiyor/);
});
test('Luffytaro screen defenses remain distinct; three physical anchors join literal marquee fragments',()=>{
 assert.deepEqual(durationEffects('5 turn(s) Reduce damage taken 80%\n5 turn(s) Damage over 1000 99% Reductio').effects,[{mechanic:'threshold',turns:5},{mechanic:'damageReduction',turns:5}].reverse());
 assert.deepEqual(durationEffects('5 turn(s) Damaoe over 1000 99% Reduction').effects,[{mechanic:'threshold',turns:5}]);
 const marker=(rows:any[])=>{const page=Symbol();return rows.map((t,i)=>Object.defineProperty({...t},'position',{value:{page,top:600+i*60,height:25,edge:false},enumerable:false}));};
 const old=marker([battle(1),pre,line('Retreat'),line('5 turn(s) Damage over')]);
 const next=marker([battle(1),pre,line('Retreat'),line('turn(s) Damage over 1000 99% Reduction')]);
 assert.equal(mergeTokens(old,next).at(-1).text,'5 turn(s) Damage over 1000 99% Reduction');
 assert.deepEqual(durationEffects(mergeTokens(old,next).at(-1).text).effects,[{mechanic:'threshold',turns:5}]);
});
