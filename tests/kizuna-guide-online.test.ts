import {test,beforeEach,afterEach,mock} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {applyAutomaticKizuna,type KizunaAutoResult} from '../src/kizuna-auto';import {newKizunaSetup,kizunaProblem} from '../src/kizuna';const require=createRequire(import.meta.url),g=require('../electron/kizuna-guide-online.cjs');
beforeEach(()=>mock.timers.enable({apis:['Date'],now:new Date('2026-10-22T00:00:00Z')}));afterEach(()=>mock.timers.reset());
const event={title:'Pirate Alliance Kizuna Clash!! Vs. Koala',url:'https://e9wiki.com/optc/en/notices/14729',startsAt:'2026-10-21T03:00:00.000Z',endsAt:'2026-10-25T13:59:00.000Z',fetchedAt:'2026-10-22T00:00:00Z',warnings:[],groups:[]};
test('an expired event stops matching even when its publication and title are unchanged',()=>{assert.equal(g.matchesEvent(event),true);mock.timers.setTime(new Date('2026-10-26T00:00:00Z').getTime());assert.equal(g.matchesEvent(event),false);});
const section=(name:string,superBoss=false)=>'<aside>'+name+'</aside><li>Stage 1</li>'+(superBoss?'<p>Se sono presenti 2 o più [Revolutionary Army]:</p>':'')+'<p>- CD (10), Super Switch (10) e VS (10) ridotti a Free Spirit, Cerebral, Powerhouse.</p><li>Stage 2</li><p>- NAO;</p><p>- 3 turni di Barriera da 2 DEX Slots.</p>'+(superBoss?'':'<blockquote>Dopo una certa soglia HP (Boss Lv. 31+):</blockquote>')+'<li>Stage 3</li><p>- NAO;</p><p>- '+(superBoss?'7':'10')+' turni di Bind alla colonna sinistra;</p><p>- '+(superBoss?'3':'10')+' turni di Paralisi;</p><p>Interrupt - quando il NAO non è attivo (ogni volta):</p><p>- Il nemico recupera tutti gli HP;</p><p>- 99 turni di Silence;</p>';
const html='<meta property="article:author" content="OPTC NEWS | CDR"><time datetime="2026-10-17T10:51:21+0000"></time><h1>KIZUNA CLASH VS KOALA &quot;SUPERBOSS&quot;</h1><article id="_tl_editor">'+section('VS QCK')+section('VS INT')+section('VS &quot;SUPER BOSS&quot; QCK',true)+section('VS &quot;SUPER BOSS&quot; INT',true)+'</article>';
const context=(difficulty=10,level=31,enemyType='QCK')=>({target:{title:'Vs. Koala',level,difficulty,enemyType,battles:3,maxHP:'15000000',remainingHP:'12000000',observedAt:'2026-10-22T00:00:00Z'},restrictions:{status:'verified',source:'MuMu',text:'No requirements',quest:'Vs. Koala',difficulty,warnings:[]}});
function gameResult(c=context(10,3)){
 return {...c,bonusPages:[],bonusComplete:false,boss:{id:'native-qa',name:c.target.title,source:'MuMu · Kizuna seçili Lv. rehberi',observation:{complete:true,textComplete:true,level:c.target.level,difficulty:c.target.difficulty},stages:[1,2,3].map(battleNumber=>({battleNumber,requirements:battleNumber===3?[{mechanic:'paralysis',turns:6}]:[]}))}};
}
test('missing internet event uses the actual selected game guide and collects bonuses there',async()=>{
 const optionsSeen:any[]=[];const native=gameResult(),reader={read:async(_exe:string,_device:string,options:any)=>{optionsSeen.push(options);return options.targetOnly?context(10,3):native;}};
 const r=await g.readFromTarget(reader,'qa','qa',{difficulty:10,collectBonuses:true},()=>{},()=>assert.fail('unmatched guide must not be fetched'));
 assert.equal(optionsSeen.length,2);assert.equal(optionsSeen[0].collectBonuses,false);assert.equal(optionsSeen[1].targetOnly,false);assert.equal(optionsSeen[1].collectBonuses,true);assert.equal(r.mechanics.mode,'game');assert.equal(r.mechanics.complete,true);assert.equal(r.boss,native.boss);
});

test('every difficulty and uncovered level resolves its own game mechanics instead of borrowing another variant',async()=>{
 for(const c of [context(3,1,'STR'),context(7,150,'STR'),context(10,3,'INT'),context(10,21,'INT'),context(10,30,'INT'),context(10,31,'STR')]){
  const native=gameResult(c),calls:any[]=[];
  const r=await g.readFromTarget({read:async(_e:string,_d:string,o:any)=>{calls.push(o);return o.targetOnly?c:native;}},'qa','qa',{difficulty:c.target.difficulty,event},()=>{},async()=>html);
  assert.equal(calls.length,2);assert.equal(r.target.level,c.target.level);assert.equal(r.target.difficulty,c.target.difficulty);assert.equal(r.mechanics.mode,'game');assert.deepEqual(r.boss.stages[2].requirements,[{mechanic:'paralysis',turns:6}]);
 }
});

test('complete internet variants keep the short path; internet failures recover through the game guide',async()=>{
 let calls=0;const reader={read:async()=>{calls++;return context();}};
 const r=await g.readFromTarget(reader,'qa','qa',{difficulty:10,event},()=>{},async()=>html);assert.equal(calls,1);assert.equal(r.mechanics.mode,'online');
 calls=0;const recovered=await g.readFromTarget({read:async(_e:string,_d:string,o:any)=>{calls++;return o.targetOnly?context():gameResult(context());}},'qa','qa',{difficulty:10,event},()=>{},async()=>{throw Error('HTTP 503');});assert.equal(calls,2);assert.equal(recovered.mechanics.mode,'game');
});

test('game recovery rejects incomplete text and any target change before replacing a saved guide',async()=>{
 for(const mutate of [(r:any)=>{r.boss.observation.textComplete=false;},(r:any)=>{r.boss.observation.complete=false;},(r:any)=>{r.target.level++;},(r:any)=>{r.target.enemyType='QCK';},(r:any)=>{r.target.difficulty=7;},(r:any)=>{r.target.maxHP='15000001';},(r:any)=>{r.boss.stages.pop();}]){
  const native=gameResult(context(10,3,'INT'));mutate(native);
  await assert.rejects(()=>g.readFromTarget({read:async(_e:string,_d:string,o:any)=>o.targetOnly?context(10,3,'INT'):native},'qa','qa',{difficulty:10,event},()=>{},async()=>html),/rehber|hedef|tamam/i);
 }
});
test('source intake rejects zero HP, inverted remaining HP, and missing observation time',()=>{
 for(const patch of [{maxHP:'0'},{remainingHP:'0'},{remainingHP:'15000001'},{observedAt:''}])assert.throws(()=>g.build(event,{...context(),target:{...context().target,...patch}},html));
});
test('internet source validates event, publication, author, all variants and stage order',()=>{
 assert.equal(g.parse(html).size,4);assert.equal(g.matchesEvent({...event,url:'https://e9wiki.com/optc/en/notices/14775'}),true);assert.equal(g.matchesEvent({...event,startsAt:'2025-10-21T03:00:00.000Z'}),false);for(const bad of [html.replace('2026-10-17T','2025-10-17T'),html.replace('OPTC NEWS | CDR','Unknown'),html.replace('<li>Stage 2</li>','<li>Stage 3</li>')])assert.throws(()=>g.parse(bad));
 assert.throws(()=>g.build({...event,url:'https://evil.test/optc/en/notices/14729'},context(),html));assert.throws(()=>g.build(event,{...context(),target:{...context().target,title:'Vs. Other'}},html));
});
test('normal Lv31 internet mechanics retain scoped bind, paralysis, interruption and exact HP',()=>{
 const r=g.build(event,context(),html);assert.equal(r.mechanics.complete,true);assert.equal(r.boss.source,g.URL_GUIDE);assert.equal(r.boss.stages.length,3);assert.equal(r.boss.stages[2].hp,15000000);
 assert.deepEqual(r.boss.stages[2].requirements,[{mechanic:'bind',turns:10},{mechanic:'paralysis',turns:10}]);assert.equal(r.boss.stages[2].events.at(-1).trigger,'interrupt');assert.match(r.boss.stages[2].events.at(-1).text,/Full HP Recovery/);assert.ok(!r.boss.stages[2].requirements.some((e:any)=>e.mechanic==='specialBind'));
});

test('verified QCK level boundaries use observed low-level mechanics and never leak Lv31 additions',()=>{
 for(const level of [1,3,20]){
  const r=g.build(event,context(10,level),html);assert.equal(r.mechanics.complete,true);assert.equal(r.mechanics.mode,'game');assert.deepEqual(r.boss.observation.levelRange,[1,20]);
  assert.deepEqual(r.boss.stages[2].requirements,[{mechanic:'bind',turns:10},{mechanic:'paralysis',turns:6}]);assert.match(r.boss.stages[2].notes,/1 turn\(s\) Tap-Timing Barrier \(GREAT 3/);assert.doesNotMatch(r.boss.stages[2].notes,/Territory|ATK.*1\.1/);
  const applied=applyAutomaticKizuna(newKizunaSetup(),{event,live:r,warnings:[]} as KizunaAutoResult,[]);assert.equal(kizunaProblem(applied.setup,r.boss),'');
 }
 for(const level of [21,30]){const r=g.build(event,context(10,level),html);assert.deepEqual(r.boss.observation.levelRange,[21,30]);assert.match(r.boss.stages[2].notes,/3 turn\(s\) Territory/);assert.equal(r.boss.stages[2].requirements.find((e:any)=>e.mechanic==='paralysis').turns,10);assert.match(r.boss.stages[2].notes,/1 turn\(s\) Tap-Timing Barrier/);}
 assert.equal(g.build(event,context(10,31),html).mechanics.mode,'online');assert.equal(g.build(event,context(10,20,'INT'),html).mechanics.complete,false);
});

test('seven-star INT keeps its own unconditional opening and HP branches without Super-only boosts',()=>{
 for(const level of [1,4,150]){
  const r=g.build(event,context(7,level,'INT'),html);assert.equal(r.mechanics.complete,true);assert.equal(r.mechanics.mode,'game');assert.deepEqual(r.boss.observation.levelRange,[1,150]);
  assert.doesNotMatch(r.boss.stages[0].notes,/Revolutionary Army|Boosts ATK|Boosts Orb Effects/);assert.match(r.boss.stages[0].notes,/Special Charge by 10 turns for DEX PSY/);assert.equal(r.boss.stages[2].events.filter((e:any)=>e.trigger==='hp').length,2);assert.equal(r.boss.stages[2].normalAttackOnly,true);
  const s=applyAutomaticKizuna(newKizunaSetup(),{event,live:r,warnings:[]} as KizunaAutoResult,[]).setup;assert.equal(s.mode,'normal');assert.equal(s.charge.amount,10);assert.deepEqual(s.charge.types,['DEX','PSY']);assert.equal(kizunaProblem(s,r.boss),'');
 }
});

test('seven-star QCK uses its game-verified barriers and unconditional class opening',()=>{
 const r=g.build(event,context(7,5),html);assert.equal(r.mechanics.complete,true);assert.equal(r.mechanics.mode,'game');assert.deepEqual(r.boss.observation.levelRange,[1,150]);
 assert.deepEqual(r.boss.stages[2].requirements,[{mechanic:'bind',turns:7},{mechanic:'paralysis',turns:3}]);assert.match(r.boss.stages[1].notes,/2 turn\(s\) Slot Barrier \(DEX 1/);assert.match(r.boss.stages[2].notes,/1 turn\(s\) Tap-Timing Barrier \(GREAT 2/);assert.doesNotMatch(r.boss.stages[0].notes,/Revolutionary Army|Boosts Orb Effects/);
 const s=applyAutomaticKizuna(newKizunaSetup(),{event,live:r,warnings:[]} as KizunaAutoResult,[]).setup;assert.equal(s.charge.amount,10);assert.deepEqual(s.charge.classes,['Free Spirit','Cerebral','Powerhouse']);assert.equal(kizunaProblem(s,r.boss),'');
});

test('three-star QCK has its observed four-turn Bind and one-turn Paralysis without stronger barriers',()=>{
 for(const level of [1,100]){
  const r=g.build(event,context(3,level),html);assert.equal(r.mechanics.complete,true);assert.equal(r.mechanics.mode,'game');assert.deepEqual(r.boss.observation.levelRange,[1,100]);
  assert.deepEqual(r.boss.stages[2].requirements,[{mechanic:'bind',turns:4},{mechanic:'paralysis',turns:1}]);assert.match(r.boss.stages[1].notes,/1 turn\(s\) Slot Barrier \(DEX 1/);assert.doesNotMatch(r.boss.stages[2].notes,/GREAT|Territory/);
  const s=applyAutomaticKizuna(newKizunaSetup(),{event,live:r,warnings:[]} as KizunaAutoResult,[]).setup;assert.equal(s.charge.amount,10);assert.deepEqual(s.charge.types,['STR','DEX','QCK','PSY','INT']);assert.equal(kizunaProblem(s,r.boss),'');
 }
});
test('unmapped type and level variants never borrow Lv31 or Super mechanics',()=>{
 for(const c of [context(10,3,'INT'),context(3,31,'INT')]){const r=g.build(event,c,html);assert.equal(r.mechanics.complete,false);assert.equal(r.boss.observation.complete,false);assert.equal(r.boss.stages[2].requirements.length,0);const applied=applyAutomaticKizuna(newKizunaSetup(),{event,live:r,warnings:[]} as KizunaAutoResult,[]);assert.match(kizunaProblem(applied.setup,r.boss),/İnternet rehberi/);}
});
test('Super source stays separate and conditional charge cannot become unconditional',()=>{
 const r=g.build(event,context(13,1),html);assert.deepEqual(r.boss.stages[2].requirements,[{mechanic:'bind',turns:7},{mechanic:'paralysis',turns:3}]);
 const applied=applyAutomaticKizuna(newKizunaSetup(),{event,live:r,warnings:[]} as KizunaAutoResult,[]);assert.equal(applied.setup.mode,'super');assert.equal(applied.setup.charge.amount,0);assert.equal(kizunaProblem(applied.setup,r.boss),'');
});
test('unknown effects stay explicit; HP alternative branches are separate from preemptive requirements',()=>{
 const source=html.replace('- 10 turni di Bind alla colonna sinistra;', 'Quando gli HP della crew sono sotto al 70%:</p><p>- 6 turni di ATK Down;</p><p>Altrimenti :</p><p>- 10 turni di Bind alla colonna sinistra;');
 const r=g.build(event,context(),source);assert.equal(r.boss.stages[2].events.filter((e:any)=>e.trigger==='hp').length,2);assert.equal(r.boss.stages[2].requirements.length,0);assert.ok(r.mechanics.warnings.some((w:string)=>w.includes('HP')));assert.equal(g.translate('- 2 turni di nuova meccanica;'),null);
});
