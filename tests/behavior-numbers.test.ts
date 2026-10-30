import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),{facts,reconcileNumericRows,mergeNumericRows}=require('../electron/behavior-numbers.cjs'),{mergeTokens,positioned}=require('../electron/boss-behavior-core.cjs'),{ocrBuffer}=require('../electron/rule-ocr.cjs');
const load=(name:string)=>fs.readFileSync(new URL('./fixtures/boss-behavior/'+name,import.meta.url));
const fixture=JSON.parse(load('jinbe-number-conflict.json').toString()),beforeImage=load('jinbe-number-before.png'),afterImage=load('jinbe-number-after.png');
const context=()=>{const pages=new Map(),restore=(list:any[])=>list.map(t=>{const id=t.position.page;if(!pages.has(id))pages.set(id,Symbol());return positioned({...t}, {...t.position,page:pages.get(id)});});return {existing:restore(fixture.existing),next:restore(fixture.after),previous:restore(fixture.before),beforeImage,afterImage,evidence:fixture.evidence,body:fixture.body};};
const rangeContext=()=>{const f=JSON.parse(load('jinbe-range-conflict.json').toString()),pages=new Map(),restore=(list:any[])=>list.map(t=>{const id=t.position.page;if(!pages.has(id))pages.set(id,Symbol());return positioned({...t},{...t.position,page:pages.get(id)});});return {existing:restore(f.existing),next:restore(f.after),previous:restore(f.before),beforeImage:load('jinbe-range-before.png'),afterImage:load('jinbe-range-after.png'),evidence:f.evidence,body:f.body};};
const healContext=()=>{const f=JSON.parse(load('heal-number-conflict.json').toString()),pages=new Map(),restore=(list:any[])=>list.map(t=>{const id=t.position.page;if(!pages.has(id))pages.set(id,Symbol());return positioned({...t},{...t.position,page:pages.get(id)});});return {existing:restore(f.existing),next:restore(f.after),previous:restore(f.before),beforeImage:load('heal-number-before.png'),afterImage:load('heal-number-after.png'),evidence:f.evidence,body:f.body};};
test('actual Heal 400000/000000 conflict uses independently aligned matching numeral pixels',{skip:process.platform!=='win32'},async()=>{
 const c=healContext();assert.throws(()=>mergeTokens(c.existing,c.next,c.evidence),/sayıları çelişiyor/);
 const result=await mergeNumericRows({...c,readOCR:ocrBuffer});
 assert.equal(result.next.find((t:any)=>/Heal/.test(t.text)).text,'98 turn(s) Heal 400000 HP at end of turn');
 assert.equal(result.merged.filter((t:any)=>/Heal 400000/.test(t.text)).length,1);assert.equal(result.merged.some((t:any)=>/Heal 000000/.test(t.text)),false);
 assert.equal(result.next.find((t:any)=>/Heal/.test(t.text)).numericEvidence.method,'aligned-digit-pixels-and-source-ocr');
});
test('a real zero glyph replacing the Heal leading 4 cannot inherit the other frames value',{skip:process.platform!=='win32'},async()=>{
 const c=healContext();
 // Copy the adjacent zero from this very screenshot: same font, rasterization
 // and remaining five digits, so unchanged surrounding ink cannot mask it.
 const zero=await sharp(c.afterImage).extract({left:415,top:718,width:20,height:30}).png().toBuffer();
 const changed=await sharp(c.afterImage).composite([{input:zero,left:395,top:718}]).png().toBuffer();
 await assert.rejects(mergeNumericRows({...c,afterImage:changed,readOCR:ocrBuffer}),/sayıları çelişiyor/);
});
test('live Jinbe range alignment verifies conflicting digits after the core proves unique text anchors',{skip:process.platform!=='win32'},async()=>{
 const c=rangeContext();assert.throws(()=>mergeTokens(c.existing,c.next,c.evidence),(e:any)=>{assert.match(e.message,/sayıları çelişiyor/);assert.equal(e.cause.alignment.source,'unique-text-anchors');assert.equal(e.cause.alignment.shift,381.5);return true;});
 const result=await mergeNumericRows({...c,readOCR:ocrBuffer});assert.equal(result.evidence.source,'unique-text-anchors');assert.equal(result.evidence.shift,381.5);
 assert.equal(result.next.find((t:any)=>/DEF x/.test(t.text)).text,'3 turn(s) DEF x 450');assert.equal(result.merged.filter((t:any)=>/3 turn\(s\) DEF x 450/.test(t.text)).length,1);assert.equal(result.merged.some((t:any)=>/DEF x 050/.test(t.text)),false);
});
test('actual Jinbe 9-star 450/050 failure verifies both cropped images and merges DEF x450 once',{skip:process.platform!=='win32'},async()=>{
 const c=context();assert.throws(()=>mergeTokens(c.existing,c.next,c.evidence),/sayıları çelişiyor/);const messages:string[]=[];
 const corrected=await reconcileNumericRows({...c,readOCR:ocrBuffer,progress:(s:string)=>messages.push(s)});
 const row=corrected.find((t:any)=>/DEF x/.test(t.text));assert.equal(row.text,'3 turn(s) DEF x 450');assert.deepEqual(row.numericEvidence.values,['3','450']);assert.ok(messages.some(s=>s.includes('iki görüntüden')));
 const merged=mergeTokens(c.existing,corrected,c.evidence);assert.equal(merged.filter((t:any)=>/3 turn\(s\) DEF x 450/.test(t.text)).length,1);assert.equal(merged.some((t:any)=>/DEF x 050/.test(t.text)),false);
});
test('repeated 050 OCR of the same real 450 row must not remain a certified DEF x50',{skip:process.platform!=='win32'},async()=>{
 const c=rangeContext(),ambiguous=(t:any)=>/DEF x/.test(t.text)?positioned({...t,text:'3 turn(s) DEF x 050'},t.position):t;c.existing=c.existing.map(ambiguous);c.previous=c.previous.map(ambiguous);
 const original=mergeTokens(c.existing,c.next,c.evidence);assert.equal(original.some((t:any)=>/DEF x 050/.test(t.text)),true);
 const result=await mergeNumericRows({...c,readOCR:ocrBuffer});assert.equal(result.next.find((t:any)=>/DEF x/.test(t.text)).text,'3 turn(s) DEF x 450');assert.equal(result.merged.filter((t:any)=>/DEF x 450/.test(t.text)).length,1);assert.equal(result.merged.some((t:any)=>/DEF x 050/.test(t.text)),false);
});
test('repeated ambiguous DEF digits cannot authorize changing a separately agreed turn count',async()=>{
 const c=rangeContext(),ambiguous=(t:any)=>/DEF x/.test(t.text)?positioned({...t,text:'3 turn(s) DEF x 050'},t.position):t;c.existing=c.existing.map(ambiguous);c.previous=c.previous.map(ambiguous);
 const result=await mergeNumericRows({...c,readOCR:async()=>({text:'13 turn(s) DEF x 450',lines:[]})});assert.equal(result.next,c.next);assert.equal(result.merged.some((t:any)=>/13 turn/.test(t.text)),false);
});
test('missing independent alignment, a different mechanic and edge fragments cannot trigger numeric correction',async()=>{
 const c=context(),fail=async()=>{throw Error('must not OCR');};
 for(const evidence of [undefined,{range:{verified:true,min:370,max:385}},{shift:378,verified:false}])assert.equal(await reconcileNumericRows({...c,evidence,readOCR:fail}),c.next);
 const changed=c.next.map((t:any)=>/DEF x/.test(t.text)?positioned({...t,text:'3 turn(s) ATK x 050'},t.position):t);assert.equal(await reconcileNumericRows({...c,next:changed,readOCR:fail}),changed);
});
test('a scrollbar range without enough independent anchors cannot authorize numeric OCR',async()=>{
 const c=rangeContext(),existing=c.existing.filter((t:any)=>/DEF x/.test(t.text)),next=c.next.filter((t:any)=>/DEF x/.test(t.text));let reads=0;
 await assert.rejects(mergeNumericRows({...c,existing,next,readOCR:async()=>{reads++;throw Error('unverified alignment must not OCR');}}),/konumu belirsiz|güvenle birleştirilemedi/);assert.equal(reads,0);
});
test('a one-off OCR result cannot reconcile a number even when the original images are unchanged',async()=>{
 const c=context();let reads=0;
 const corrected=await reconcileNumericRows({...c,readOCR:async()=>{reads++;return {text:reads===2?'3 turn(s) DEF x 450':'3 turn(s) DEF x 050',lines:[]};}});
 assert.equal(corrected,c.next);assert.throws(()=>mergeTokens(c.existing,corrected,c.evidence),/sayıları çelişiyor/);
});
test('OCR consensus cannot override genuinely changed digit pixels',async()=>{
 const c=context(),row=c.next.find((t:any)=>/DEF x/.test(t.text));
 const changedImage=await sharp(afterImage).composite([{input:Buffer.from('<svg width="68" height="35"><rect width="68" height="35" fill="black"/><text x="3" y="27" font-family="Times New Roman" font-size="27" font-weight="bold" fill="white">350</text></svg>'),left:390,top:654}]).png().toBuffer();
 const changed=c.next.map((t:any)=>t===row?positioned({...t,text:'3 turn(s) DEF x 350'},t.position):t);
 const fake=async()=>({text:'3 turn(s) DEF x 450',lines:[{words:[{text:'3',x:8,y:6.5,width:17,height:22},{text:'450',x:225.5,y:6.5,width:58,height:22}]}]});
 const result=await reconcileNumericRows({...c,next:changed,afterImage:changedImage,readOCR:fake});assert.equal(result,changed);assert.throws(()=>mergeTokens(c.existing,result,c.evidence),/sayıları çelişiyor/);
});
test('repeated leading-zero transcriptions still require matching actual numeral pixels',async()=>{
 const c=context(),ambiguous=(t:any)=>/DEF x/.test(t.text)?positioned({...t,text:'3 turn(s) DEF x 050'},t.position):t;c.existing=c.existing.map(ambiguous);c.previous=c.previous.map(ambiguous);
 const changedImage=await sharp(afterImage).composite([{input:Buffer.from('<svg width="68" height="35"><rect width="68" height="35" fill="black"/><text x="3" y="27" font-family="Times New Roman" font-size="27" font-weight="bold" fill="white">350</text></svg>'),left:390,top:654}]).png().toBuffer();
 const fake=async()=>({text:'3 turn(s) DEF x 450',lines:[{words:[{text:'3',x:8,y:6.5,width:17,height:22},{text:'450',x:225.5,y:6.5,width:58,height:22}]}]});
 const result=await mergeNumericRows({...c,afterImage:changedImage,readOCR:fake});assert.equal(result.next,c.next);assert.equal(result.merged.some((t:any)=>/DEF x 450/.test(t.text)),false);
});
test('numeric facts preserve decimals and comma grouping while leading-zero integers remain ambiguous',()=>{
 assert.deepEqual(facts('3 turn(s) 1,000,000 damage').values,['3','1000000']);assert.equal(facts('3 turn(s) ATK x 0.50').valid,true);assert.equal(facts('3 turn(s) DEF x 050').valid,false);
});
