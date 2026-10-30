import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stageBarriers,slotChanges,applySlotChanges,barrierRelevance,barrierRemoval} from '../src/pve-barriers';
import {makeCombatHooks} from '../src/pve-combat';
import {evaluatePve} from '../src/engine';
import {candidates,plan,type PlannerData} from '../src/planning';
import {applyAuxiliary} from '../src/skill-analysis';
import {newOwned,type Character,type Stage,type Boss} from '../src/model';
import {bossTimeline} from '../src/boss-timeline';

function fixture(text='2 turn(s) Slot Barrier ([STR] 2 time(s))',size=6){
 const characters:Character[]=Array.from({length:size},(_,i)=>({id:String(i+1),name:'Unit '+(i+1),types:['STR'],classes:['Fighter'],stars:'6',cost:20,maxLevel:99,hp:5000,atk:1000+i*100,rcv:200,global:true,captain:'Boosts ATK of all characters by 4x.',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
 const data:PlannerData={metadata:{source:'fixture',url:'fixture',sha:'fixture',builtAt:'2026-10-10'},locations:{},units:Object.fromEntries(characters.map(c=>[c.id,{families:[c.id],captain:c.captain,special:c.special,cooldown:[2,2],limit:[],llb:[],evolutions:[],rumble:null}]))};
 const owned=characters.map(c=>({...newOwned(c.id),level:99,cooldown:2,readyTurn:0,ability:{...newOwned(c.id).ability,verified:true}}));
 const crew=candidates(owned,characters,data,'current');
 const stage:Stage={id:'boss',name:'Battle 5',battleNumber:5,turn:0,hp:500000,enemyAttack:1000,enemyDefense:0,enemyType:'STR',requirements:[],events:[{trigger:'preemptive',label:'PREEMPTIVE',text,requirements:[]}]};
 const boss:Boss={id:'barrier-test',name:'Barrier test',source:'test fixture',training:true,stages:[stage]};return {characters,data,owned,crew,stage,boss};
}
test('guide barriers keep timing, exact slot, count and duration separate; hit / damage stay distinct',()=>{
 const {stage}=fixture('98 turn(s) Tap-Timing Barrier (PERFECT 3 time(s))\nBarrier (Orb): [RCV] 2 times (4 turns)\n99 turn(s) Hit Barrier (15 hits)\n2 turn(s) Damage Barrier (900000 damage)');
 const b=stageBarriers(stage);assert.deepEqual(b.map(v=>v.kind),['timing','slot','hit','damage']);assert.equal(b[0].count,3);assert.equal(b[0].turns,98);assert.equal(b[1].slot,'RCV');assert.equal(b[1].count,2);assert.equal(b[1].turns,4);assert.equal(b[2].count,15);
 stage.events![0].text='98 turn(s) Slot Barrier ([STR])';assert.equal(stageBarriers(stage)[0].count,undefined);
});
test('timing barriers need manual taps, use later attack damage, and do not prefer a remover / slot provider',()=>{
 const {crew,boss,stage,data}=fixture('98 turn(s) Tap-Timing Barrier (PERFECT 3 time(s))');
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks}),w=r.combatWindows![0];
 assert.deepEqual(r.schedule[0].used,[]);assert.equal(w.barriers![0].status,'manual');assert.ok(w.damageLow>0);assert.ok(w.instructions.some(s=>s.includes('İlk 3 saldırıyı PERFECT')));assert.ok(!w.issues.some(s=>s.includes('Bariyer var')));
 assert.equal(barrierRelevance(stage,'Reduces Barriers duration by 99 turns. Changes all orbs, including [BLOCK] orbs, into [STR] orbs.',crew[2].character),0);
});
test('GREAT timing counts real PERFECTs and Burn only on the remaining PERFECT taps',()=>{
 const {crew,boss,stage,data}=fixture('98 turn(s) Tap-Timing Barrier (GREAT 3 time(s))\n5 turn(s) 1000 damage Burn');
 const hooks=makeCombatHooks(crew,boss,data),w=hooks.step(stage,[],hooks.initial,[]).window;
 assert.equal(w.completedAttacks,6);assert.equal(w.completedPerfects,3);assert.equal(w.burnDamage,3000);assert.ok(w.damageLow>0);
 stage.events![0].text=stage.events![0].text.replace('GREAT','PERFECT');const p=makeCombatHooks(crew,boss,data);assert.equal(p.step(stage,[],p.initial,[]).window.burnDamage,6000);
});
test('an actual requested-slot converter opens a slot barrier and charges its cooldown',()=>{
 const {crew,boss,stage,data}=fixture();stage.events![0].text+='\nChanges all Slots to [BLOCK] Slots';crew[2].specialText='Changes all orbs, including [BLOCK] orbs, into [STR] orbs.';
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks}),w=r.combatWindows![0];
 assert.ok(r.schedule[0].used.some(s=>s.includes('#3 ')));assert.equal(w.barriers![0].status,'resolved');assert.ok(w.damageLow>0);assert.ok(w.barriers![0].detail.includes('[STR] × 2'));
 crew[2].owned.readyTurn=99;const late=makeCombatHooks(crew,boss,data),no=evaluatePve(crew,boss,{combat:late});assert.equal(no.combatWindows![0].barriers![0].status,'conditional');assert.equal(no.combatWindows![0].damageLow,0);
});
test('beneficial orbs, wrong colors, random conversion, conditions and absent BLOCK permission cannot invent the required slot',()=>{
 for(const special of ['Makes [STR] orbs beneficial for all characters.','Changes all orbs, including [BLOCK] orbs, into Matching orbs.','Changes all orbs, including [BLOCK] orbs, into [QCK] orbs.','If HP is high, changes all orbs, including [BLOCK] orbs, into [RCV] orbs.','Randomly changes all orbs into [RCV] orbs.','Changes all orbs into [RCV] orbs.']){
  const {crew,boss,stage,data}=fixture('2 turn(s) Slot Barrier ([RCV] 2 time(s))\nChanges all Slots to [BLOCK] Slots');crew[2].specialText=special;
  const hooks=makeCombatHooks(crew,boss,data),w=hooks.step(stage,[2],hooks.initial,[]).window;assert.equal(w.barriers![0].status,'conditional',special);assert.equal(w.damageLow,0,special);
 }
});
test('candidate relevance respects the initial BLOCK slots rather than promising a RCV-only conversion',()=>{
 const {crew,stage}=fixture('2 turn(s) Slot Barrier ([STR] 2 time(s))\nChange Slots: [BLOCK]');
 assert.equal(barrierRelevance(stage,'Changes [RCV] orbs into [STR] orbs.',crew[2].character),0);
 assert.ok(barrierRelevance(stage,'Changes all orbs, including [BLOCK] orbs, into [STR] orbs.',crew[2].character)>0);
});
test('self-only conversion cannot satisfy two slots, while adjacent / class conversion respects its real targets',()=>{
 const {crew,boss,stage,data}=fixture('2 turn(s) Slot Barrier ([RCV] 2 time(s))\nChange Slots: [EMPTY]');crew[2].specialText='Changes own orb into [RCV] orb.';
 const hooks=makeCombatHooks(crew,boss,data);assert.equal(hooks.step(stage,[2],hooks.initial,[]).window.barriers![0].status,'conditional');
 const chars=crew.map(m=>m.character),empty=Array(6).fill('EMPTY');assert.deepEqual(applySlotChanges(empty,slotChanges('Changes orbs of adjacent characters into [RCV] orbs.'),2,chars,data),['RCV','EMPTY','EMPTY','RCV','RCV','EMPTY']);
 chars[4]={...chars[4],classes:['Slasher']};const classSlots=applySlotChanges(empty,slotChanges('Changes orbs of Slasher characters into [RCV] orbs.'),2,chars,data);assert.equal(classSlots.filter(v=>v==='RCV').length,1);
});
test('mandatory wrong-color conversion goes before the needed-slot provider, not after it',()=>{
 const {crew,boss,stage,data}=fixture('2 turn(s) Slot Barrier ([STR] 2 time(s))\nChanges all Slots to [BLOCK] Slots');stage.requirements=[{mechanic:'damageReduction',turns:5}];
 crew[2].specialText='Changes all orbs, including [BLOCK] orbs, into [STR] orbs.';
 crew[3].specialText='Changes all orbs, including [BLOCK] orbs, into [QCK] orbs. Reduces Damage Reduction duration by 5 turns.';crew[3].owned.ability.effects=[{mechanic:'damageReduction',turns:5}];
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.ok(r.schedule[0].used[0].includes('#4 '));assert.ok(r.schedule[0].used[1].includes('#3 '));assert.equal(r.combatWindows![0].barriers![0].status,'resolved');assert.deepEqual(r.missing,[]);
});
test('barrier duration removal is distinct from count / DEF removal and needs enough known turns',()=>{
 assert.equal(barrierRemoval('Reduces Barriers duration by 2 turns.'),2);assert.equal(barrierRemoval('Reduces Barrier count by 3.'),0);assert.equal(barrierRemoval('Reduces defense of all enemies by 100% for 1 turn.'),0);assert.equal(barrierRemoval('If HP is high, reduces Barriers duration by 99 turns.'),0);
 const {crew,boss,stage,data}=fixture();crew[2].specialText='Reduces Barriers duration by 2 turns.';let h=makeCombatHooks(crew,boss,data);assert.equal(h.step(stage,[2],h.initial,[]).window.barriers![0].status,'resolved');
 crew[2].specialText='Reduces Barriers duration by 1 turn.';h=makeCombatHooks(crew,boss,data);assert.equal(h.step(stage,[2],h.initial,[]).window.barriers![0].status,'conditional');
 stage.events![0].text='Slot Barrier ([STR] 2 time(s))';crew[2].specialText='Reduces Barriers duration by 99 turns.';h=makeCombatHooks(crew,boss,data);assert.equal(h.step(stage,[2],h.initial,[]).window.barriers![0].status,'conditional');
 crew[2].specialText='Removes all Barriers completely.';h=makeCombatHooks(crew,boss,data);assert.equal(h.step(stage,[2],h.initial,[]).window.barriers![0].status,'resolved');
});
test('bariyer expires by its read duration; generated slots do not persist as fresh next-turn slots',()=>{
 const {crew,boss,stage,data}=fixture();stage.hp=5000000;crew[2].specialText='Changes all orbs, including [BLOCK] orbs, into [STR] orbs.';
 const h=makeCombatHooks(crew,boss,data),one=h.step(stage,[2],h.initial,[]),two=h.step({...stage,id:'boss:turn:2',turn:1,conditionalTurn:2,events:[]},[],one.state,[]),three=h.step({...stage,id:'boss:turn:3',turn:2,conditionalTurn:3,events:[]},[],two.state,[]);
 assert.equal(one.window.barriers![0].status,'resolved');assert.equal(two.window.barriers![0].status,'conditional');assert.deepEqual(three.window.barriers,[]);assert.ok(three.window.damageLow>0);
});
test('hit / damage / unreadable barriers remain unsupported, and locked / poison slots are not ordinary conversion targets',()=>{
 for(const text of ['99 turn(s) Hit Barrier (15 hits)','2 turn(s) Damage Barrier (900000 damage)','2 turn(s) Slot Barrier ([STR])','2 turn(s) Slot Barrier ([STR] 2 time(s))\n5 turn(s) Slot Bind','2 turn(s) Slot Barrier ([STR] 2 time(s))\nChanges all Slots to [POISON] Slots']){
  const {crew,boss,stage,data}=fixture(text);crew[2].specialText='Changes all orbs, including [BLOCK] orbs, into [STR] orbs.';const h=makeCombatHooks(crew,boss,data),w=h.step(stage,[2],h.initial,[]).window;assert.ok(w.barriers?.some(b=>b.status==='conditional'));assert.equal(w.damageLow,0);
 }
});
test('verified advanced actions supply slots only on the needed legal stage and remain blocked by orb-change interrupts',()=>{
 const {boss,stage}=fixture();const action={id:'3',name:'Super / EX special',text:'Changes all orbs, including [BLOCK] orbs, into [STR] orbs.',effects:[],oneUse:true};
 const result=applyAuxiliary(boss,[action]);assert.equal(result.boss.stages[0].plannedAbilities?.length,1);
 stage.blockedSpecialPatterns=['changes?.*orbs'];assert.equal(applyAuxiliary(boss,[action]).boss.stages[0].plannedAbilities?.length,0);
});
test('poison recovery before a later conversion does not leave the matching slot from the earlier effect',()=>{
 for(const [slot,status]of [['STR','conditional'],['RCV','resolved']] as const){
  const {crew,boss,stage,data}=fixture('2 turn(s) Slot Barrier (['+slot+'] 2 time(s))\nChanges all Slots to [POISON] Slots');
  crew[2].specialText='Removes Poison duration completely. Changes all orbs, including [BLOCK] orbs, into [RCV] orbs.';
  const h=makeCombatHooks(crew,boss,data),w=h.step(stage,[2],h.initial,[]).window;assert.equal(w.barriers![0].status,status);assert.equal(w.poisonSlotDamage,0);
 }
});
test('future turn barriers and slot changes cannot be applied before their explicit trigger',()=>{
 const {stage,boss}=fixture('98 turn(s) Tap-Timing Barrier (PERFECT 3 time(s))');
 stage.events!.push({trigger:'turn',label:'TURN 2',battleTurn:2,text:'2 turn(s) Slot Barrier ([RCV] 2 time(s))\nChanges all Slots to [RCV] Slots',requirements:[]});
 const timed=bossTimeline(boss);assert.deepEqual(stageBarriers(timed.stages[0]).map(b=>b.kind),['timing']);assert.deepEqual(stageBarriers(timed.stages[1]).map(b=>b.kind),['slot']);
});
test('unresolved paralysis cannot open a timing barrier and authorize ordinary end damage',()=>{
 const {crew,boss,stage,data}=fixture('98 turn(s) Tap-Timing Barrier (PERFECT 3 time(s))');stage.hp=1;stage.requirements=[{mechanic:'paralysis',turns:5}];
 crew[0].captainText+=' Deals 5000 Fixed damage to all enemies at the end of each turn.';
 const h=makeCombatHooks(crew,boss,data),r=h.step(stage,[],h.initial,stage.requirements);assert.equal(r.window.damageLow,0);assert.equal(r.window.endDamage,0);assert.deepEqual(r.neutralized,[]);assert.equal(r.window.status,'blocked');
});
test('all three searches retain a weak slot provider among more than 24 much stronger alternatives',()=>{
 const {characters,owned,data,boss,stage}=fixture('2 turn(s) Slot Barrier ([RCV] 2 time(s))\nChanges all Slots to [BLOCK] Slots',30);stage.hp=1000;
 for(const c of characters)c.atk=20000;const last=characters.at(-1)!;last.atk=1;last.captain='';last.special='Changes all orbs, including [BLOCK] orbs, into [RCV] orbs.';data.units[last.id].captain='';data.units[last.id].special=last.special;
 const before=structuredClone(owned),groups=plan({kind:'boss',characters,box:owned,data,boss,preparation:0});
 for(const group of groups){assert.ok(group.teams.length);assert.ok(group.teams.some(t=>t.members.some(m=>m.sourceId===last.id)&&t.combat?.windows[0].barriers?.some(b=>b.kind==='slot'&&b.status==='resolved')));}
 assert.deepEqual(owned,before);
});
