import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {newOwned,type Character} from '../src/model';
import {plan,candidates,type PlannerData} from '../src/planning';
import {makeRumbleContext} from '../src/rumble-planner';
import {rulesValid,ruleMemberValue,type RumbleRules} from '../src/rumble-rules';
const require=createRequire(import.meta.url);
const {phaseName,rulesButton,homePhase,phaseSection,parseRules}=require('../electron/rumble-rules-core.cjs');
const {createRuleReader}=require('../electron/rumble-rules.cjs');
const ruleC='PSY-type HP Up Lv.4; Slasher class ATK Up Lv.4; Striker class SPD Up Lv.4; [Giant] [Straw Hat Pirates] [Animal Kingdom Pirates] damage dealt to all classes 20% Up and damage taken from all classes 20% Down (Special Rule will only affect the Combat Power); During the last 30 s of battle, Special CT Speed Up & Damage Up!';
function fixture(){
 const characters:Character[]=Array.from({length:8},(_,i)=>({id:String(i+1),name:'Unit '+(i+1),types:[i<5?'STR':'PSY'],classes:['Fighter'],stars:'6',cost:20,maxLevel:99,hp:3000,atk:i<5?1000:950,rcv:200,global:true,captain:'',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
 const units=Object.fromEntries(characters.map(c=>[c.id,{families:[c.id],tags:['Giant'],captain:'',special:'',cooldown:[15,10],limit:[],llb:[],evolutions:[],rumble:{cost:20,stats:{def:100,spd:100},ability:[{effects:[{effect:'buff',attributes:['ATK'],level:1,targeting:{targets:['crew']}}]}],special:[{cooldown:30,effects:[]}],llbability:[],llbspecial:[],resilience:[]}}]));
 return {characters,data:{metadata:{source:'test',url:'https://github.com',sha:'test',builtAt:''},units,locations:{}} as PlannerData,box:characters.map(c=>newOwned(c.id))};
}
function ocr(lines:{text:string;y:number;x?:number}[]){return {text:lines.map(l=>l.text).join('\n'),width:900,height:1600,lines:lines.map(l=>({...l,words:[{text:l.text,x:l.x??150,y:l.y,width:110,height:25}]}))};}
test('Rules parser separates current block buffs from final bonuses and retains CP-only scope',()=>{
 const page=ocr([{text:'Block B',y:550},{text:'DEX-type ATK Up Lv.4;',y:610},{text:'Block C',y:770},{text:ruleC,y:850},{text:'Championship/Exhibition',y:1100},{text:'DEX-type DEF Up Lv.5; PSY-type ATK Up Lv.5;',y:1190}]);
 const section=phaseSection(page,'Block C');assert.ok(section.complete);const rules=parseRules(section.text,'Block C') as RumbleRules;
 assert.equal(rulesValid(rules),true);assert.deepEqual(rules.effects.slice(0,3),[{kind:'stat',targets:['PSY'],attributes:['HP'],level:4},{kind:'stat',targets:['Slasher'],attributes:['ATK'],level:4},{kind:'stat',targets:['Striker'],attributes:['SPD'],level:4}]);
 assert.equal(rules.effects[3].kind,'damage');assert.ok(rules.effects[3].kind==='damage'&&rules.effects[3].combatPowerOnly);assert.ok(rules.effects.every(e=>e.kind!=='stat'||!e.targets.includes('DEX')));
 assert.equal(phaseName('BLOCK(C\''),'Block C');assert.equal(phaseName('Block B'),'Block B');assert.ok(!phaseSection(page,'Block A'));
});
test('Home identifies the phase nearest its active Ends marker and rejects shop/ambiguous screens',()=>{
 const home=ocr([{text:'RUMBLE',y:917},{text:'RULES',y:977,x:340}]),phases=ocr([{text:'CHAMPIONSHIP',y:280},{text:'BLOCK(C\'',y:340},{text:'Ends in: 1d',y:385},{text:'BLOCK B',y:440},{text:'BLOCK A',y:507}]);
 assert.equal(homePhase(home,phases),'Block C');assert.ok(rulesButton(home));assert.equal(homePhase({...home,text:home.text+' Select character to display'},phases),null);
 assert.equal(homePhase(home,ocr([...phases.lines.map(l=>({text:l.text,y:l.y})),{text:'Ends in: 1d',y:450}])),null);
 assert.equal(homePhase(ocr([{text:'RUMBLE',y:1400}]),phases),null);
  assert.equal(homePhase(home,ocr([{text:'CHAMPIONSHIP',y:280},{text:'BLOCKE',y:340},{text:'Ends in: 23:01',y:385},{text:'BLOCK B',y:440},{text:'BLOCK A',y:507}])),null,'Unreadable Block C must not become Championship');
  assert.equal(homePhase(home,ocr([{text:'CHAMPIONSHIP',y:340},{text:'Ends in: 23:01',y:385}])), 'Championship');
});
test('Unreadable levels and unknown modes never yield a partial trusted profile',()=>{
 assert.throws(()=>parseRules(ruleC.replace('Lv.4','Lv.a'),'Block C'));
 assert.throws(()=>parseRules(ruleC,'Grand Party'));
 const rules=parseRules(ruleC,'Block C');rules.effects[0].level=500;assert.equal(rulesValid(rules),false);
});
test('The OCR letter-to-level correction requires matching the verified numeral shape',async()=>{
 const {correctLevels}=require('../electron/rule-glyph.cjs');
 for(const numeral of [4,5]){
   const image='tests/fixtures/rumble-lv'+numeral+'.png',meta=await sharp(image).metadata();
   const result=await correctLevels(image,{lines:[{text:'Lv.a;',words:[{text:'Lv.a;',x:0,y:0,width:meta.width,height:meta.height}]}]});
   assert.equal(result.text,numeral===4?'Lv.4;':'Lv.a;');assert.equal(result.corrections,numeral===4?1:0);
 }
});
test('Matching rules change active and reserve choice in every level scenario, without altering the box',()=>{
 const f=fixture(),before=structuredClone(f.box),rules=parseRules('PSY-type ATK Up Lv.10; During the last 30 s of battle, Special CT Speed Up & Damage Up!','Block C');
 const base=plan({...f,kind:'rumble',costLimit:100}),boosted=plan({...f,kind:'rumble',costLimit:100,rumbleRules:rules});
 assert.ok(base.every(g=>g.teams[0].members.every(m=>m.character.types.includes('STR'))));
 assert.ok(boosted.every(g=>g.teams[0].members.filter(m=>m.character.types.includes('PSY')).length===3));
 assert.ok(boosted.every(g=>g.teams[0].reasons.some(r=>r.includes('Block C'))));assert.deepEqual(f.box,before);
 const withBench=plan({...f,kind:'rumble',costLimit:160,rumbleRules:rules});assert.ok(withBench.every(g=>g.teams[0].reserves?.length===3&&g.teams[0].cost===160));
 const pool=candidates(f.box,f.characters,f.data,'power'),ctx=makeRumbleContext(pool,f.data,'attack','',300,rules);
 assert.ok(ctx.score([pool[5]])>ctx.score([pool[0]]));
});
test('Percentage alternatives are not multiplied for a character with multiple matching tags; late unknowns add no value',()=>{
 const f=fixture(),m=candidates(f.box,f.characters,f.data,'power')[0],rules=parseRules(ruleC,'Block C');f.data.units['1'].tags=['Giant','Straw Hat Pirates'];
 assert.equal(ruleMemberValue(m,f.data,{...rules,effects:[rules.effects[3]]},{ATK:3}),6);
 assert.equal(ruleMemberValue(m,f.data,{...rules,effects:[rules.effects[4]]},{ATK:3}),0);
});
test('Dual colours do not receive type Rules bonuses, while their classes remain eligible',()=>{
 const f=fixture(),m=candidates(f.box,f.characters,f.data,'power')[5];f.data.units[m.character.id].abilities={swap:'Swap'};
 const rules=parseRules('PSY-type HP Up Lv.4; Fighter class ATK Up Lv.4;','Block C');
 assert.equal(ruleMemberValue(m,f.data,{...rules,effects:[rules.effects[0]]},{HP:2}),0);
 assert.equal(ruleMemberValue(m,f.data,{...rules,effects:[rules.effects[1]]},{ATK:3}),24);
});
test('Reader stops before input outside Rumble and supports cancellation without unknown Back input',async()=>{
 let moves=0;const reader=createRuleReader({capture:async()=>({image:Buffer.alloc(1),width:900,height:1600}),ocr:async()=>ocr([{text:'Character Box',y:500}]),input:async()=>{moves++;}});
 await assert.rejects(reader.read('adb','device'),/Aktif Rumble/);assert.equal(moves,0);
 let release:any;const gate=new Promise(r=>release=r);const cancelReader=createRuleReader({capture:async()=>{await gate;return {image:Buffer.alloc(1),width:900,height:1600};},ocr:async()=>ocr([{text:'Character Box',y:500}]),input:async()=>{moves++;}});
 const pending=cancelReader.read('adb','device');cancelReader.cancel();release();await assert.rejects(pending,/iptal/);assert.equal(moves,0);
});
function settlingReader(returnPhase='Block C',neverReadable=false){
 const home=(label:string)=>ocr([{text:'CHAMPIONSHIP',y:280},{text:label,y:340},{text:'Ends in: 23:01',y:385},{text:'BLOCK B',y:440},{text:'BLOCK A',y:507},{text:'RUMBLE',y:917},{text:'RULES',y:977,x:340}]);
 const rulePage=ocr([{text:'PREVIOUS RANKING',y:220},{text:'UNDERWAY',y:380},{text:'Block C',y:550},{text:ruleC,y:650},{text:'Championship/Exhibition',y:1250}]);
 const frames:Record<string,ReturnType<typeof ocr>>={initial0:home('BLOCKE'),initial1:home('BLOCK C'),initial2:home('BLOCK C'),rules:rulePage,returned0:ocr([{text:'CONNECTING',y:500}]),returned1:home('BLOCKE'),returned2:home(returnPhase),returned3:home(returnPhase)};
 let stage='initial',index=0;const moves:string[]=[];
 const reader=createRuleReader({wait:async()=>{},capture:async()=>({image:Buffer.from(stage==='rules'?'rules':stage+Math.min(index++,3)),width:900,height:1600}),ocr:async(image:Buffer)=>stage==='returned'&&neverReadable?frames.returned0:frames[image.toString()]||frames.initial2,input:async(_exe:string,_device:string,action:string)=>{moves.push(action);if(action==='back'){stage='returned';index=0;}else stage='rules';}});
 return {reader,moves};
}
test('Reader survives unreadable Block C and loading frames on return, with two confirmed observations',async()=>{
 const {reader,moves}=settlingReader();
 const result=await reader.read('adb','device');assert.equal(result.phase,'Block C');
 assert.deepEqual(moves,['tap','tap','back']);assert.equal(result.effects[0].targets[0],'PSY');
});
test('Block B is read with a small anchored swipe instead of jumping its heading past the viewport',async()=>{
 const home=ocr([{text:'BLOCK B',y:340},{text:'Ends in: 23:01',y:385},{text:'RUMBLE',y:917},{text:'RULES',y:977,x:340}]);
 const partial=ocr([{text:'PREVIOUS RANKING',y:220},{text:'UNDERWAY',y:380},{text:'Block B',y:550},{text:'DEX-type ATK Up Lv.4; Powerhouse class DEF Up Lv.4;',y:620},{text:'Striker class ATK Up Lv.4; [Giant] damage dealt to all classes',y:850}]);
 const complete=ocr([{text:'PREVIOUS RANKING',y:220},{text:'UNDERWAY',y:380},{text:'Block B',y:550},{text:'DEX-type ATK Up Lv.4; Powerhouse class DEF Up Lv.4; Striker class ATK Up Lv.4;',y:620},{text:'[Giant] damage dealt to all classes 20% Up and damage taken from all classes 20% Down',y:850},{text:'During the last 30 s of battle, Special CT Speed Up & Damage Up!',y:1000},{text:'Block C',y:1220}]);
 let stage='home',scrolls:any[]=[];const reader=createRuleReader({wait:async()=>{},capture:async()=>({image:Buffer.from(stage),width:900,height:1600}),ocr:async(image:Buffer)=>image.toString()==='home'?home:image.toString()==='partial'?partial:complete,input:async(_e:string,_d:string,action:string,_snap:any,rect:any)=>{if(action==='scroll'){scrolls.push(rect);assert.equal(rect?.fraction,.12);assert.equal(rect?.duration,450);stage='complete';}else stage=action==='back'?'home':stage==='home'?'partial':stage;}});
 const result:any=await reader.read('adb','device');assert.equal(result.phase,'Block B');assert.equal(result.effects.filter((e:any)=>e.kind==='stat').length,3);assert.equal(scrolls.length,1);
});
test('Reader stops after Block B leaves view instead of making more blind scrolls',async()=>{
 const home=ocr([{text:'BLOCK B',y:340},{text:'Ends in: 23:01',y:385},{text:'RUMBLE',y:917},{text:'RULES',y:977,x:340}]);
 const partial=ocr([{text:'PREVIOUS RANKING',y:220},{text:'UNDERWAY',y:380},{text:'Block B',y:550},{text:'DEX-type ATK Up Lv.4;',y:620}]);
 const lost=ocr([{text:'PREVIOUS RANKING',y:220},{text:'UNDERWAY',y:380},{text:'Block C',y:550},{text:ruleC,y:620}]);let stage='home',scrolls=0;
 const reader=createRuleReader({wait:async()=>{},capture:async()=>({image:Buffer.from(stage),width:900,height:1600}),ocr:async(image:Buffer)=>image.toString()==='home'?home:image.toString()==='partial'?partial:lost,input:async(_e:string,_d:string,action:string)=>{if(action==='scroll'){scrolls++;stage='lost';}else stage=action==='back'?'home':stage==='home'?'partial':stage;}});
 await assert.rejects(reader.read('adb','device'),/Block B başlığı görünür alandan çıktı/);assert.equal(scrolls,1);
});
test('An actual new phase still discards the rules; unreadable return gives a distinct retry message',async()=>{
 const changed=settlingReader('Block B');await assert.rejects(changed.reader.read('adb','device'),/Aktif bölüm değişti/);
 const unreadable=settlingReader('Block C',true);await assert.rejects(unreadable.reader.read('adb','device'),/dönüş doğrulanamadı/);
 assert.deepEqual(changed.moves,['tap','tap','back']);assert.deepEqual(unreadable.moves,['tap','tap','back']);
});
test('Exhibition recovers a missing Underway tab on every page and keeps only its own bonuses',async()=>{
 const home=ocr([{text:'EXHIBITION',y:280},{text:'Ends in: 1d',y:330},{text:'RUMBLE',y:1400},{text:'RULES',y:977,x:340}]);
 const rules=ocr([{text:'PREVIOUS RANKING',y:300},{text:'Block C',y:650},{text:ruleC,y:700},{text:'Championship/Exhibition',y:1100},{text:'DEX-type DEF Up Lv.5; PSY-type ATK Up Lv.5; Powerhouse class HP Up Lv.5; Striker class Special CT Speed Up Lv.3; During the last 30 s of battle, Special CT Speed Up & Damage Up!',y:1190}]);
 let stage='home',tabReads=0;const inputs:string[]=[];
 const reader=createRuleReader({wait:async()=>{},capture:async()=>({image:Buffer.from(stage),width:900,height:1600}),ocr:async(image:Buffer,options:any)=>{if(image.toString()==='rules'&&options?.crop){tabReads++;return ocr([{text:'UNDERWAY',y:420,x:170}]);}return image.toString()==='rules'?rules:home;},input:async(_e:any,_d:any,action:string)=>{inputs.push(action);stage=action==='back'?'home':'rules';}});
 const result=await reader.read('adb','device');assert.equal(result.phase,'Exhibition');assert.equal(result.effects.filter((e:any)=>e.kind==='stat').length,4);assert.ok(result.effects.every((e:any)=>!e.targets.includes('Slasher')));assert.ok(tabReads>=3);assert.deepEqual(inputs,['tap','tap','back']);
});
