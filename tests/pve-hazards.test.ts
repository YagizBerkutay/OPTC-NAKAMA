import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {makeCombatHooks} from '../src/pve-combat';
import {hpChanges,changeHP,removalTurns,stageHazards} from '../src/pve-hazards';
import {candidates,parseEffects,type PlannerData} from '../src/planning';
import {evaluatePve} from '../src/engine';
import {applyAuxiliary} from '../src/skill-analysis';
import {newOwned,type Boss,type Character} from '../src/model';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
function fixture(text:string){
 const characters:Character[]=Array.from({length:6},(_,i)=>({id:String(i+1),name:'Unit '+(i+1),types:['STR'],classes:['Fighter'],stars:'5',cost:20,maxLevel:99,hp:1000,atk:1000,rcv:200,global:true,captain:'Boosts ATK of all characters by 2x.',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
 const data:PlannerData={metadata:{source:'fixture',url:'fixture',sha:'fixture',builtAt:'2026-10-09'},locations:{},units:Object.fromEntries(characters.map(c=>[c.id,{captain:c.captain,special:'',cooldown:[10,10],limit:[],llb:[],evolutions:[],rumble:null}]))};
 const crew=candidates(characters.map(c=>({...newOwned(c.id),level:99,cooldown:10,readyTurn:0})),characters,data,'power').map(m=>({...m,owned:{...m.owned,ability:{...m.owned.ability,verified:true}}}));
 const boss:Boss={id:'test',name:'Test',source:'fixture',training:true,stages:[{id:'four',name:'Battle 4',battleNumber:4,turn:3,requirements:[],hp:1e9,enemyAttack:0,enemyDefense:0,enemyType:'STR',events:[{trigger:'preemptive',label:'İlk saldırı',text,requirements:[]}]}]};
 return {crew,data,boss};
}
test('real friend captain Brook #4426 starts with 20% HP before the first enemy hit, only once',()=>{
 const {crew,data,boss}=fixture('100 damage');const brook=catalog.characters.find((c:Character)=>c.id==='4426');crew[1].captainText=brook.captain;crew[1].friend=true;crew.forEach(m=>m.character.classes=['Slasher']);
 const hooks=makeCombatHooks(crew,boss,data);assert.equal(hooks.initial.hp,Math.floor(hooks.report([]).maxHP*.2));assert.ok(hooks.report([]).startEffects[0].includes('Arkadaş kaptan'));
 const first=hooks.step(boss.stages[0],[],hooks.initial,[]),next=hooks.step({...boss.stages[0],turn:4,events:[]},[],first.state,[]);
 assert.equal(first.window.hpBefore,hooks.initial.hp-100);assert.equal(next.window.hpBefore,first.window.hpAfter);
 crew[0].captainText=brook.captain;const both=makeCombatHooks(crew,boss,data);assert.equal(both.initial.hp,changeHP(changeHP(both.report([]).maxHP,both.report([]).maxHP,hpChanges(brook.captain,true)[0]),both.report([]).maxHP,hpChanges(brook.captain,true)[0]));
});
test('by, to and fixed HP costs stay distinct and enemy cuts never consume crew HP',()=>{
 assert.equal(changeHP(6000,10000,hpChanges("Reduces crew's current HP by 20%.")[0]),4800);
 assert.equal(changeHP(6000,10000,hpChanges("Reduces crew's current HP to 20% of MAX HP.")[0]),2000);
 assert.equal(changeHP(6000,10000,hpChanges("Reduces crew's current HP to 1.")[0]),1);
 assert.deepEqual(hpChanges("Deals 20% of enemies' current HP in damage."),[]);
 assert.deepEqual(hpChanges("If HP is high, reduces crew's current HP by 80%."),[]);
});
test('the real owned Momonosuke crew’s guaranteed Burn replacement is usable, unlike an HP-gated immunity',()=>{
 const c=catalog.characters.find((c:Character)=>c.id==='4213');assert.equal(removalTurns(c.captain,'burn'),99);assert.ok(parseEffects(c.captain).some(e=>e.mechanic==='burn'&&e.turns===99));
 const {crew,boss,data}=fixture('turn(s) 10000 damage Burn');crew[1].captainText=c.captain;const hooks=makeCombatHooks(crew,boss,data);assert.equal(hooks.step(boss.stages[0],[],hooks.initial,[]).window.burnDamage,0);
 assert.equal(removalTurns('If HP is high, removes Burn duration completely.','burn'),0);
});
test('unknown Burn duration retains observed PERFECT damage; a partial remover never certifies full removal',()=>{
 const {crew,boss,data}=fixture('turn(s) 10000 damage Burn (take damage when performing PERFECT attack)');
 const plain=makeCombatHooks(crew,boss,data),r=plain.step(boss.stages[0],[],plain.initial,[]);assert.equal(r.window.status,'blocked');assert.equal(r.window.burnDamage,10000);assert.equal(r.window.completedPerfects,0);assert.equal(r.window.damageHigh,0);
 crew[2].specialText='Reduces Burn duration by 5 turns.';let hooks=makeCombatHooks(crew,boss,data),partial=hooks.step(boss.stages[0],[2],hooks.initial,[]);assert.ok(partial.window.issues.some(s=>s.includes('tur sayısı')));assert.equal(partial.window.status,'blocked');
 crew[2].specialText='Removes Burn duration completely.';hooks=makeCombatHooks(crew,boss,data);const cleared=hooks.step(boss.stages[0],[2],hooks.initial,[]);assert.equal(cleared.window.burnDamage,0);assert.equal(cleared.window.completedPerfects,6);assert.ok(cleared.window.damageHigh>0);
});
test('real Crocus full Poison recovery and partial Burn recovery are separate effects, even in one sentence',()=>{
 const crocus=catalog.characters.find((c:Character)=>c.id==='3182');assert.equal(removalTurns(crocus.special,'poison'),99);assert.equal(removalTurns(crocus.special,'burn'),5);
 const {crew,boss,data}=fixture('turn(s) 10000 damage Burn\nAll Slots to [POISON] Slots');crew[2].specialText=crocus.special;const hooks=makeCombatHooks(crew,boss,data),r=hooks.step(boss.stages[0],[2],hooks.initial,[]);assert.equal(r.window.poisonSlotDamage,0);assert.ok(r.window.issues.some(s=>s.includes('Burn tur sayısı')));assert.ok(r.window.burnDamage>0);
 assert.equal(removalTurns('Removes Poison duration completely and reduces Burn duration by 5 turns.','burn'),5);
 assert.equal(removalTurns('Removes Burn duration completely and reduces Poison duration by 5 turns.','poison'),5);
});
test('a clipped PERFECT damage explanation with no numeric amount remains unverified and earns no guaranteed damage',()=>{
 const {crew,boss,data}=fixture('urn (take damage when performing PERFECI');delete boss.stages[0].hp;const hooks=makeCombatHooks(crew,boss,data),r=hooks.step(boss.stages[0],[],hooks.initial,[]);
 assert.equal(r.window.damageLow,0);assert.equal(r.window.status,'unverified');assert.ok(r.window.issues.some(s=>s.includes('hasar miktarı eksik')));
});
test('poison slots use neutral orbs and 8% maximum HP damage; a BLOCK orb converter cannot cure them',()=>{
 const {crew,boss,data}=fixture('All Slots to [POISON] Slots');crew[2].specialText='Changes all orbs, including [BLOCK] orbs, into Matching orbs. Reduces damage received by 90% for 1 turn.';
 const hooks=makeCombatHooks(crew,boss,data),plain=hooks.step(boss.stages[0],[],hooks.initial,[]),convert=hooks.step(boss.stages[0],[2],hooks.initial,[]);
 assert.equal(plain.window.poisonSlotCount,6);assert.equal(plain.window.poisonSlotDamage,2880);assert.equal(plain.window.damageLow,plain.window.damageHigh);assert.equal(convert.window.poisonSlotDamage,2880);assert.equal(convert.window.damageHigh,plain.window.damageHigh);
 crew[3].specialText='Removes Poison duration completely.';const cure=makeCombatHooks(crew,boss,data),r=cure.step(boss.stages[0],[3],cure.initial,[]);assert.equal(r.window.poisonSlotDamage,0);assert.equal(r.window.poisonSlotCount,0);assert.ok(r.window.damageHigh>plain.window.damageHigh);
 assert.equal(removalTurns("Removes enemies' Poison duration completely.",'poison'),0);
});
test('Brook’s starting HP plus poison slots kills before a six-hit attack; a poison remover is scheduled even without a Poison status requirement',()=>{
 const {crew,boss,data}=fixture('All Slots to [POISON] Slots');crew[1].captainText="Reduces crew's current HP by 80% at the start of the fight. Boosts ATK of all characters by 2x.";
 let hooks=makeCombatHooks(crew,boss,data),r=hooks.step(boss.stages[0],[],hooks.initial,[]);assert.equal(hooks.initial.hp,1200);assert.equal(r.window.completedPerfects,2);assert.equal(r.window.status,'blocked');assert.equal(r.window.poisonSlotDamage,1440);
 crew[2].specialText='Removes Poison duration completely.';hooks=makeCombatHooks(crew,boss,data);const plan=evaluatePve(crew,boss,{combat:hooks});assert.ok(plan.schedule[0].used.some(s=>s.includes('#3 ')));assert.equal(plan.combatWindows![0].poisonSlotDamage,0);assert.equal(plan.combatWindows![0].completedPerfects,6);
});
test('HP costs precede healing in a legal special schedule, and end-of-turn healing cannot pay attack damage',()=>{
 const {crew,boss,data}=fixture('5 turn(s) 500 damage Burn');boss.stages[0].hp=300000;
 crew[2].specialText='Recovers 4500 HP.';crew[3].specialText="Reduces crew's current HP by 80%. Boosts ATK of all characters by 10x for 1 turn.";
 const hooks=makeCombatHooks(crew,boss,data),bad=hooks.step(boss.stages[0],[2,3],hooks.initial,[]),good=hooks.step(boss.stages[0],[3,2],hooks.initial,[]);assert.equal(bad.window.status,'blocked');assert.equal(good.window.hpAttack,5700);assert.ok(good.window.hpAfter>0);
 const plan=evaluatePve(crew,boss,{combat:hooks});assert.ok(plan.schedule[0].used[0].includes('#4 '));assert.ok(plan.schedule[0].used[1].includes('#3 '));assert.equal(plan.combatWindows![0].selfCost,4800);
 crew[2].specialText='Recovers 4500 HP at the end of each turn for 3 turns.';const late=makeCombatHooks(crew,boss,data);assert.equal(late.step(boss.stages[0],[3,2],late.initial,[]).window.hpAttack,1200);
});
test('remaining Burn follows the crew into the next battle, but a dead path cannot be healed alive',()=>{
 const {crew,boss,data}=fixture('2 turn(s) 100 damage Burn');const hooks=makeCombatHooks(crew,boss,data),first=hooks.step(boss.stages[0],[],hooks.initial,[]),next=hooks.step({...boss.stages[0],turn:4,events:[]},[],first.state,[]);assert.equal(next.window.burnDamage,600);
 crew[2].specialText='Recovers 10000 HP.';const heal=makeCombatHooks(crew,boss,data),dead=heal.step({...boss.stages[0],events:[{trigger:'preemptive',label:'İlk saldırı',text:'10000 damage',requirements:[]}]},[],heal.initial,[]),after=heal.step({...boss.stages[0],turn:4,events:[]},[2],dead.state,[]);assert.equal(after.window.completedPerfects,0);assert.ok(after.window.hpAfter<0);assert.equal(after.window.status,'blocked');
});
test('poison-slot targeting and status-triggered Supports cannot be invented from a truncated guide row',()=>{
 const {crew,boss,data}=fixture('Slots to [POISON] Slots');delete boss.stages[0].hp;const hook=makeCombatHooks(crew,boss,data),r=hook.step(boss.stages[0],[],hook.initial,[]);assert.equal(r.window.status,'unverified');assert.equal(r.window.damageLow,0);assert.ok(r.window.issues.some(s=>s.includes('0–6')));
 const support={id:'6',name:'Support',text:'Removes Poison duration completely.',effects:[{mechanic:'poison' as const,turns:99}],oneUse:true,passive:true,allowedStages:[]};assert.equal(applyAuxiliary(boss,[support]).schedule[0].used.length,0);
});
test('an active auxiliary poison recovery is explicitly carried into combat, while captain status immunity cannot convert poison slots',()=>{
 const {crew,boss,data}=fixture('All Slots to [POISON] Slots'),action={id:'1',name:'Super',text:'Removes Poison duration completely.',effects:[{mechanic:'poison' as const,turns:99}],oneUse:true};
 const aux=applyAuxiliary(boss,[action]);assert.ok(aux.schedule[0].used.length);const hooks=makeCombatHooks(crew,aux.boss,data);assert.equal(hooks.step(aux.boss.stages[0],[],hooks.initial,[]).window.poisonSlotDamage,0);
 crew[0].captainText+=' Removes Poison duration completely.';const passive=makeCombatHooks(crew,boss,data);assert.equal(passive.step(boss.stages[0],[],passive.initial,[]).window.poisonSlotDamage,2880);
});
test('a verified early kill consumes only its required poisonous taps and retains the untouched slots',()=>{
 const {crew,boss,data}=fixture('All Slots to [POISON] Slots');boss.stages[0].hp=1000;const hooks=makeCombatHooks(crew,boss,data),r=hooks.step(boss.stages[0],[],hooks.initial,[]);assert.equal(r.window.completedPerfects,1);assert.equal(r.window.poisonSlotDamage,480);assert.equal(r.state.poisonSlots!.length,5);assert.ok(!r.window.issues.some(s=>s.includes('HP saldırı sırasında bitti')));
});
test('real PKA captured marquee retains its 10000 Burn damage and known duration is parsed despite the PERFECT explanation',()=>{
 const require=createRequire(import.meta.url),core=require('../electron/boss-behavior-core.cjs'),pka=require('../electron/pka-guide.cjs');let tokens:any[]=[];
 for(let n=5;n<=12;n++){const o=JSON.parse(fs.readFileSync(new URL(`./fixtures/pka-guide/page-${n}.json`,import.meta.url),'utf8'));tokens=core.mergeTokens(tokens,pka.clipBand(o,core.modalIdentity(o),n===5?803:undefined));}
 const identity={title:'Vs. Crocodile',difficulty:null,level:null};const result=core.encounterFromTokens(identity,[{kind:'heading',text:'BEHAVIOR'},...tokens],{observedAt:'2026-10-09T16:00:00Z',complete:false,pages:8,startVerified:true});assert.equal(stageHazards(result.stages[3]).burnDamage,10000);
 assert.deepEqual(core.durationEffects('5 turn(s) 10000 damage Burn (take damage when performing PERFECT attacks)').effects,[{mechanic:'burn',turns:5}]);assert.deepEqual(core.durationEffects('3 turn(s) All Slots to [POISON] Slots').effects,[]);
 // Persisted old scans with no number retain the risk without fabricating it.
 const old=fixture('urn (take damage when performing PERFECI').boss;assert.equal(stageHazards(old.stages[0]).burn,true);assert.equal(stageHazards(old.stages[0]).burnDamage,0);
});
