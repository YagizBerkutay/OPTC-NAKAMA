import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeCombatHooks,enemyThreats} from '../src/pve-combat';
import {evaluatePve} from '../src/engine';
import {candidates,plan,parseEffects,solveAdventure,type PlannerData} from '../src/planning';
import {crewCriterion} from '../src/skill-analysis';
import {bossTimeline} from '../src/boss-timeline';
import {applyAuxiliary} from '../src/skill-analysis';
import {newOwned,type Boss,type Character,type Effect} from '../src/model';

function fixture(){
 const characters:Character[]=Array.from({length:6},(_,i)=>({id:String(i+1),name:'Unit '+(i+1),types:['STR'],classes:['Fighter'],stars:'5',cost:20,maxLevel:99,hp:1000,atk:1000,rcv:200,global:true,captain:'Boosts ATK of all characters by 2x.',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
 const data:PlannerData={metadata:{source:'fixture',url:'fixture',sha:'fixture',builtAt:'2026-10-09'},locations:{},units:Object.fromEntries(characters.map(c=>[c.id,{captain:c.captain,special:'',cooldown:[10,10],limit:[],llb:[],evolutions:[],rumble:null}]))};
 const owned=characters.map(c=>({...newOwned(c.id),level:99,cooldown:10,readyTurn:0}));
 const crew=candidates(owned,characters,data,'power').map(m=>({...m,owned:{...m.owned,ability:{...m.owned.ability,verified:true}}}));
 const boss:Boss={id:'test',name:'Test',source:'fixture',training:true,stages:[{id:'one',name:'Battle 4',battleNumber:4,turn:0,requirements:[],hp:1000,enemyAttack:1000,enemyDefense:0,enemyType:'STR',events:[{trigger:'defeated',label:'Yenilince',text:'10000 damage',requirements:[]}]}]};
 return {characters,data,owned,crew,boss};
}

test('a damage or healing score cannot replace a required DEF Up removal in the special schedule',()=>{
 const {crew,boss,data}=fixture();for(const m of crew)m.health=5000;
 for(const m of crew.slice(0,2))m.captainText='Boosts ATK of all characters by 4x and boosts HP of all characters by 3x.';
 crew[2].specialText="Reduces crew's current HP by 90%. Reduces enemies' Increased Defense duration by 5 turns.";crew[2].owned.ability.effects=[{mechanic:'defenseUp',turns:5}];
 const stage=boss.stages[0];delete stage.hp;delete stage.enemyDefense;stage.enemyAttack=0;stage.requirements=[{mechanic:'defenseUp',turns:5}];stage.events=[{trigger:'preemptive',label:'PREEMPTIVE',text:'5 turn(s) DEF x 1000',requirements:stage.requirements}];
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});
 assert.deepEqual(r.missing,[]);assert.ok(r.schedule[0].used.some(s=>s.includes('#3 ')));assert.ok(r.combatWindows![0].hpAfter>0);assert.notEqual(r.combatWindows![0].status,'blocked');
});

test('known blocked crews are not offered as alternatives when a legal defense-removing crew exists',()=>{
 const {characters,owned,boss,data}=fixture();
 for(const c of characters){c.captain=Number(c.id)<=3?'Boosts ATK of all characters by '+(c.id==='3'?6:4)+'x.':'';data.units[c.id].captain=c.captain;data.units[c.id].families=[['3','6'].includes(c.id)?'shared':c.id];data.units[c.id].cooldown=[2,2];}
 data.units['6'].special="Reduces enemies' Increased Defense duration by 5 turns.";
 const stage=boss.stages[0];delete stage.hp;delete stage.enemyDefense;stage.enemyAttack=0;stage.requirements=[{mechanic:'defenseUp',turns:5}];stage.events=[{trigger:'preemptive',label:'PREEMPTIVE',text:'5 turn(s) DEF x 1000',requirements:stage.requirements}];
 const result=solveAdventure(candidates(owned,characters,data,'power'),'',boss,16,0,data);assert.ok(result.length);
 assert.ok(result.every(t=>!t.missing?.length&&t.combat?.status!=='blocked'),JSON.stringify(result.map(t=>({captain:t.members[0].character.id,missing:t.missing,status:t.combat?.status}))));
});

test('unmodeled map effects prevent an otherwise complete damage window from certifying survival',()=>{
 const {crew,boss,data}=fixture();boss.stages[0].events=[];boss.stages[0].enemyAttack=0;
 const base=makeCombatHooks(crew,boss,data),known=base.step(boss.stages[0],[],base.initial,[]);assert.equal(known.window.status,'estimated');
 boss.restrictions={status:'partial',source:'MuMu',quest:'Test',difficulty:11,text:'Map Effect: Inferno Hell',mapEffect:'Inferno Hell',warnings:[]};
 const hooks=makeCombatHooks(crew,boss,data),unknown=hooks.step(boss.stages[0],[],hooks.initial,[]);
 assert.equal(unknown.window.status,'unverified');assert.equal(hooks.report([unknown.window]).status,'unverified');assert.equal(hooks.report([]).status,'unverified');
 assert.ok(unknown.window.issues.some(s=>s.includes('Gösterilen HP / hasar tahmini bu etkiyi kapsamaz')));
 assert.equal(unknown.window.hpAfter,known.window.hpAfter);assert.equal(unknown.window.damageHigh,known.window.damageHigh);
});

test('Weakness Class prioritizes matching members without fabricating a damage multiplier',()=>{
 const {crew,boss,data}=fixture();boss.stages[0].events=[];boss.stages[0].hp=10000000;
 const base=makeCombatHooks(crew,boss,data),before=base.step(boss.stages[0],[],base.initial,[]);
 boss.stages[0].weaknessClasses=['Fighter'];const matching=makeCombatHooks(crew,boss,data),after=matching.step(boss.stages[0],[],matching.initial,[]);
 assert.equal(after.window.damageLow,before.window.damageLow);assert.equal(after.window.damageHigh,before.window.damageHigh);assert.ok(after.score>before.score);assert.ok(after.window.instructions.some(s=>s.includes('Weakness Class: Fighter')));assert.ok(after.window.issues.some(s=>s.includes('katsayısı')));
 boss.stages[0].weaknessClasses=['Cerebral'];const wrong=makeCombatHooks(crew,boss,data),unmatched=wrong.step(boss.stages[0],[],wrong.initial,[]);assert.equal(unmatched.score,before.score);assert.ok(unmatched.window.instructions.some(s=>s.includes('uygun üyeler: yok')));
});

test('the crew search prefers the boss weakness class among equally capable units',()=>{
 const {characters,data,boss}=fixture();const extra=characters.slice(0,4).map((c,i)=>({...c,id:String(10+i),name:'Cerebral '+i,classes:['Cerebral']}));
 const all=[...characters,...extra];for(const c of extra)data.units[c.id]={...data.units['1']};
 const pool=candidates(all.map(c=>({...newOwned(c.id),level:99,cooldown:0,readyTurn:0})),all,data,'power');
 boss.stages[0].weaknessClasses=['Cerebral'];boss.stages[0].events=[];boss.stages[0].hp=1000;boss.stages[0].enemyAttack=0;
 const teams=solveAdventure(pool,'',boss,0,0,data);assert.ok(teams.length);assert.ok(teams[0].members.filter(m=>m.character.classes.includes('Cerebral')).length>=4);
});

test('slot-change interrupt excludes triggering specials and active auxiliary effects, but permits beneficial-slot buffs',()=>{
 const {crew,boss,data}=fixture();boss.stages[0].hp=400000;boss.stages[0].events=[{trigger:'interrupt',label:'INTERRUPTION Slot Change',text:'Remove Beneficial Effects\n10 turns Despair',requirements:[{mechanic:'despair',turns:10}]}];
 crew[2].specialText='Changes all orbs into Matching orbs. Boosts ATK of all characters by 10x for 1 turn.';
 crew[3].specialText='Makes [STR] orbs beneficial for all characters. Boosts ATK of all characters by 3x for 1 turn.';
 const guarded=bossTimeline(boss),hooks=makeCombatHooks(crew,guarded,data),r=evaluatePve(crew,guarded,{combat:hooks});
 assert.ok(!r.schedule[0].used.some(s=>s.includes('#3 ')));assert.ok(r.schedule[0].used.some(s=>s.includes('#4 ')));assert.deepEqual(r.missing,[]);
 const after=applyAuxiliary({...guarded,stages:[{...guarded.stages[0],requirements:[{mechanic:'bind',turns:3}]}]},[{id:'x',name:'Orb switch',text:'Changes all orbs into [STR] orbs.',effects:[{mechanic:'bind',turns:3}],oneUse:true}]);
 assert.deepEqual(after.schedule[0].used,[]);assert.equal(after.boss.stages[0].requirements[0].turns,3);
});

test('an untriggered interrupt cannot remove active buffs, and unknown HP produces an explicit next-turn contingency',()=>{
 const {crew,boss,data}=fixture();crew[2].specialText='Boosts ATK of all characters by 3x for 2 turns.';delete boss.stages[0].hp;
 boss.stages[0].events=[{trigger:'interrupt',label:'INTERRUPTION Slot Change',text:'Remove Beneficial Effects',requirements:[]}];
 const hooks=makeCombatHooks(crew,boss,data),first=hooks.step(boss.stages[0],[2],hooks.initial,[]),next=hooks.step({...boss.stages[0],turn:1},[],first.state,[]);
 assert.equal(next.window.damageHigh,first.window.damageHigh);assert.ok(first.window.instructions.some(s=>s.includes('tekrar hazır kabul edilmez')));assert.equal(first.window.status,'unverified');
});

test('Ship Bind and Slot Bind removal never certify character Bind removal',()=>{
 assert.deepEqual(parseEffects('Reduces Ship Bind duration by 7 turns.'),[]);assert.deepEqual(parseEffects('Reduces Slot Bind duration by 6 turns.'),[]);
 assert.deepEqual(parseEffects('Reduces Despair, No Healing, Ship Bind duration by 7 turns.'),[{mechanic:'despair',turns:7}]);
 assert.deepEqual(parseEffects('Reduces Bind and Ship Bind duration by 7 turns.'),[{mechanic:'bind',turns:7}]);
});

test('a row-bound unit cannot clear its own Bind; an unbound remover must act first',()=>{
 const {crew,boss}=fixture(),s=boss.stages[0];s.requirements=[{mechanic:'bind',turns:6},{mechanic:'burn',turns:5}];s.events=[{trigger:'preemptive',label:'İlk saldırı',text:'6 turn(s) Middle-Row Bind\n5 turns Burn',requirements:s.requirements}];
 crew[2].owned.ability.effects=[{mechanic:'bind',turns:6}];crew[3].owned.ability.effects=[{mechanic:'burn',turns:5}];
 assert.equal(evaluatePve(crew,boss).missing.length,2);
 crew[4].owned.ability.effects=[{mechanic:'bind',turns:6}];const r=evaluatePve(crew,boss);assert.deepEqual(r.missing,[]);assert.ok(r.schedule[0].used[0].includes('#5 '));assert.ok(r.schedule[0].used[1].includes('#4 '));
 const resistant=crew.map((m,i)=>({...m,bindResistance:i===2?6:0}));assert.deepEqual(evaluatePve(resistant,boss).missing,[]);
});

test('a planned Support current-HP cost reduces actual available HP before healing or the defeat hit',()=>{
 const {crew,boss,data}=fixture();boss.stages[0].events=[];
 const support={member:crew[5],targetId:crew[2].character.id,text:"Once per adventure, when an enemy inflicts Bind, reduces crew's current HP by 20%.",stages:['one'],attack:0,health:0,recovery:0};
 const hooks=makeCombatHooks(crew,boss,data,{supports:[support]} as any),r=hooks.step(boss.stages[0],[],hooks.initial,[]);assert.equal(r.window.hpAfter,4800);assert.equal(r.window.incoming,1200);assert.ok(r.window.instructions.some(s=>s.includes('Support tetiği')));
});
test('a known defeat hit makes even full HP fatal; a scheduled shield can prevent it without removing a debuff',()=>{
 const {crew,boss,data}=fixture(),plain=makeCombatHooks(crew,boss,data);
 const noShield=evaluatePve(crew,boss,{combat:plain});assert.equal(plain.report(noShield.combatWindows!).status,'blocked');assert.ok(noShield.combatWindows![0].hpAfter<0);
 crew[2].specialText='Reduces damage taken by 80% for 1 turn.';
 const shield=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:shield});
 assert.ok(r.schedule[0].used.some(s=>s.includes('#3 ')));assert.equal(r.combatWindows![0].incoming,2000);assert.equal(r.combatWindows![0].hpAfter,4000);assert.equal(r.combatWindows![0].status,'estimated');
 assert.deepEqual(evaluatePve(crew,boss).schedule[0].used,[],'the legacy mechanical scheduler remains unchanged');
});
test('this turn’s protection cannot stop a preemptive hit; healing cannot revive an already dead path',()=>{
 const {crew,boss,data}=fixture();boss.stages[0].events![0].trigger='preemptive';
 crew[2].specialText='Reduces damage taken by 80% for 1 turn. Recovers 10000 HP.';
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.equal(hooks.report(r.combatWindows!).status,'blocked');assert.equal(r.combatWindows![0].incoming,10000);
});
test('damage specials are scheduled jointly and equal-category boosts never multiply together',()=>{
 const {crew,boss,data}=fixture();Object.assign(boss.stages[0],{hp:400000,events:[],enemyAttack:0});
 crew[2].specialText='Boosts ATK of all characters by 2x for 1 turn.';crew[3].specialText='Boosts ATK of all characters by 3x for 1 turn.';crew[4].specialText='Boosts Orb Effects of all characters by 2x for 1 turn.';
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});
 assert.ok(r.schedule[0].used.some(s=>s.includes('#4 ')));assert.ok(r.schedule[0].used.some(s=>s.includes('#5 ')));assert.ok(!r.schedule[0].used.some(s=>s.includes('#3 ')));
 const one=hooks.step(boss.stages[0],[3,4],hooks.initial,[]),both=hooks.step(boss.stages[0],[2,3,4],hooks.initial,[]);assert.equal(one.window.damageHigh,both.window.damageHigh);
});
test('cooldown and special limit constrain offensive, healing and shield uses too',()=>{
 const {crew,boss,data}=fixture();Object.assign(boss.stages[0],{hp:400000,events:[],enemyAttack:0,specialLimit:1});
 crew[2].specialText='Boosts ATK of all characters by 3x for 1 turn.';crew[3].specialText='Boosts Orb Effects of all characters by 3x for 1 turn.';
 boss.stages.push({...boss.stages[0],id:'two',name:'Battle 5',turn:1});
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.ok(r.schedule.every(s=>s.used.length<=1));
 assert.equal(new Set(r.schedule.flatMap(s=>s.used)).size,r.schedule.flatMap(s=>s.used).length);
});
test('carried buffs expire, and the boss’s remove-beneficial-effects action clears prior protection',()=>{
 const {crew,boss,data}=fixture();crew[2].specialText='Reduces damage taken by 80% for 1 turn.';
 const hooks=makeCombatHooks(crew,boss,data),first=hooks.step({...boss.stages[0],events:[]},[2],hooks.initial,[]);
 const expired=hooks.step({...boss.stages[0],turn:1},[],first.state,[]);assert.equal(expired.window.incoming,10000);
 const removed=hooks.step({...boss.stages[0],events:[...boss.stages[0].events!,{trigger:'preemptive',label:'İlk saldırı',text:'Remove Beneficial Effects',requirements:[]}]},[],first.state,[]);assert.equal(removed.window.incoming,10000);
});
test('real Luffytaro defenses and 30000 defeat damage affect the combat report independently',()=>{
 const real=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/luffytaro-combat-10star.json',import.meta.url),'utf8'));
 const {crew,data}=fixture(),fourth=real.stages[3],fifth=real.stages[4];
 assert.equal(enemyThreats(fourth).defeated,30000);assert.equal(enemyThreats(fifth).reduction,.8);assert.deepEqual(enemyThreats(fifth).threshold,{amount:1000,percent:.99});
 crew[0].captainText+=' Removes Burn duration completely.';
 const hooks=makeCombatHooks(crew,real,data),w4=hooks.step(fourth,[],hooks.initial,[]);assert.equal(w4.window.status,'blocked');assert.equal(w4.window.incoming,30000);
 const remaining:Effect[]=[{mechanic:'damageReduction',turns:5},{mechanic:'threshold',turns:5}],w5=hooks.step(fifth,[],hooks.initial,remaining);
 assert.deepEqual(w5.window.remainingDefenses,['Damage Reduction','Threshold']);assert.ok(w5.window.damageHigh<10000);assert.equal(w5.window.status,'blocked');
});
test('unknown enemy HP / attack, barrier and missing current Tandem level never certify a one-turn win',()=>{
 const {crew,boss,data}=fixture();delete boss.stages[0].hp;delete boss.stages[0].enemyAttack;boss.stages[0].events=[];
 crew[0].targeted=false;data.units['1'].abilities={superTandem:{characterCondition:['Your crew must consist of any 1 of the following, excluding Supports and counting only 1 per unit: Unit 2'],description:['Ignores Debuff Protection and reduces the defense of all enemies by 100% for 1 turn.']}};
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks}),report=hooks.report(r.combatWindows!);
 assert.equal(report.status,'unverified');assert.ok(report.windows[0].issues.some(s=>s.includes('tek turda geçiş')));assert.ok(report.windows[0].issues.some(s=>s.includes('stall')));assert.ok(report.tandem[0].includes('seviye bilinmiyor'));assert.ok(report.tandem[0].includes('Threshold'));
 const barrier=hooks.step({...boss.stages[0],events:[{trigger:'starting',label:'STARTING STATE',text:'98 turn(s) Tap-Timing Barrier (PERFECT 3 time(s))',requirements:[]}]},[],hooks.initial,[]);assert.ok(barrier.window.damageLow>0);assert.equal(barrier.window.barriers?.[0].status,'manual');assert.equal(barrier.window.status,'unverified');
});
test('healing is reserved for the damaged state before a later defeat hit rather than spent at full HP',()=>{
 const {crew,boss,data}=fixture();crew[2].specialText='Recovers 2000 HP.';boss.stages[0].events![0].text='2000 damage';boss.stages.push({...boss.stages[0],id:'two',name:'Battle 5',turn:1,events:[{trigger:'defeated',label:'Yenilince',text:'5000 damage',requirements:[]}]});
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.deepEqual(r.schedule[0].used,[]);assert.ok(r.schedule[1].used.some(s=>s.includes('#3 ')));assert.ok(r.combatWindows![1].hpAfter>0);
});
test('boss plans expose the combined combat report while automatic teams and Rumble stay separate',()=>{
 const {characters,owned,boss,data}=fixture();data.units['3'].special='Reduces damage taken by 80% for 1 turn.';const before=structuredClone(owned);
 const groups=plan({kind:'boss',characters,box:owned,data,boss,preparation:0});assert.ok(groups.every(g=>g.teams.length));for(const group of groups)assert.ok(group.teams.every(t=>t.combat?.windows.length===1&&t.combat.maxHP>0));
 assert.ok(plan({kind:'teams',characters,box:owned,data}).every(g=>g.teams.every(t=>!t.combat)));assert.deepEqual(owned,before);
});
test('complete Poison removal covers the long guide duration; self-only and runtime conditions do not',()=>{
 assert.deepEqual(parseEffects('Removes Poison duration completely.'),[{mechanic:'poison',turns:99}]);
 assert.deepEqual(parseEffects('If HP is high, removes Poison duration completely.'),[]);
 assert.deepEqual(parseEffects('Removes Poison on this character duration completely.'),[]);
});
test('every Tandem partner clause must be satisfied, including the required Zoro-or-Sanji clause',()=>{
 const {crew}=fixture();crew[1].families=['Nami'];crew[2].families=['Usopp'];crew[3].families=['Sanji'];
 const condition='1 of the following is required: Roronoa Zoro, Sanji. Your crew must consist of any 2 of the following, excluding Supports and counting only 1 per unit: Roronoa Zoro, Sanji, Nami, Usopp.';
 assert.equal(crewCriterion(condition,crew[0],crew),'ready');
 assert.equal(crewCriterion(condition,crew[0],crew.slice(0,3)),'unmet');
 const twoLists='Your crew must consist of any 2 of the following, excluding Supports and counting only 1 per unit: Nami, Usopp; and your crew must consist of any 1 of the following, excluding Supports and counting only 1 per unit: Sanji, Roronoa Zoro';
 assert.equal(crewCriterion(twoLists,crew[0],crew),'ready');assert.equal(crewCriterion(twoLists,crew[0],crew.slice(0,3)),'unmet');
});
