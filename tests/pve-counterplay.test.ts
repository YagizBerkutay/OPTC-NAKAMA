import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {damageSkills,damageBlocker,skillDamage} from '../src/pve-offense';
import {makeCombatHooks} from '../src/pve-combat';
import {evaluatePve} from '../src/engine';
import {candidates,plan,type PlannerData} from '../src/planning';
import {newOwned,type Character,type Boss,type Stage} from '../src/model';

const real=JSON.parse(fs.readFileSync(new URL('../public/data/planner.json',import.meta.url),'utf8'));
const gunko=real.units['4612'].special,peter=real.units['4577'].special;
function fixture(special=gunko){
 const characters:Character[]=Array.from({length:6},(_,i)=>({id:i===2?'4612':String(i+1),name:i===2?'Gunko':'Unit '+(i+1),types:['STR'],classes:['Fighter'],stars:'6',cost:20,maxLevel:99,hp:5000,atk:1000,rcv:200,global:true,captain:'Boosts ATK of all characters by 4x.',special:i===2?special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
 const data:PlannerData={metadata:{source:'fixture',url:'fixture',sha:'fixture',builtAt:'2026-10-10'},locations:{},units:Object.fromEntries(characters.map(c=>[c.id,{families:[c.id],captain:c.captain,special:c.special,cooldown:[2,2],limit:[],llb:[],evolutions:[],rumble:null}]))};
 const owned=characters.map(c=>({...newOwned(c.id),level:99,cooldown:2,readyTurn:0,ability:{...newOwned(c.id).ability,verified:true}}));
 const crew=candidates(owned,characters,data,'current');
 const stage:Stage={id:'four',name:'Battle 4',battleNumber:4,turn:0,hp:1500000,enemyAttack:1000,enemyDefense:0,enemyType:'STR',requirements:[{mechanic:'resilience',turns:98}],events:[{trigger:'preemptive',label:'PREEMPTIVE',text:'98 turn(s) Resilience',requirements:[{mechanic:'resilience',turns:98}]}]};
 const boss:Boss={id:'counter',name:'Counterplay fixture',source:'fixture',training:true,stages:[stage]};return {characters,data,owned,crew,boss,stage};
}
test('real Gunko and Peter/Warcury preserve damage amount, ATK basis and distinct NAO permission',()=>{
 const g=damageSkills(gunko),p=damageSkills(peter);assert.equal(g.length,1);assert.equal(g[0].amount,2000000);assert.equal(g[0].trueDamage,true);assert.equal(g[0].ignoreNAO,true);assert.equal(g[0].all,false);
 assert.equal(p.length,1);assert.equal(p[0].kind,'attack');assert.equal(p[0].amount,150);assert.equal(p[0].ignoreNAO,false);assert.equal(p[0].all,true);assert.equal(skillDamage(p[0],2400),360000);
 const {stage}=fixture();stage.normalAttackOnly=true;assert.equal(damageBlocker(g[0],stage,stage.requirements),'');assert.equal(damageBlocker(p[0],stage,stage.requirements),'Normal Attack Only');
 assert.deepEqual(damageSkills('If HP is below 20%, deals 2000000 Fixed True damage to one enemy.'),[]);assert.deepEqual(damageSkills('Deals random damage to all enemies.'),[]);assert.deepEqual(damageSkills('Recovers 5000 HP at the end of each turn.'),[]);
});
test('known lethal True damage defeats 98-turn Resilience, DEF, reduction, threshold and barrier without inventing removal',()=>{
 const {crew,boss,stage,data}=fixture();stage.normalAttackOnly=true;stage.enemyDefense=999999;stage.requirements.push({mechanic:'defenseUp',turns:98},{mechanic:'damageReduction',turns:98},{mechanic:'threshold',turns:98});stage.events![0].text+='\n5 PERFECT Barrier\nNormal Attack Only';
 const hooks=makeCombatHooks(crew,boss,data),result=evaluatePve(crew,boss,{combat:hooks});assert.deepEqual(result.missing,[]);assert.ok(result.schedule[0].used.some(s=>s.includes('#4612')));
 const w=result.combatWindows![0];assert.equal(w.specialDamage,2000000);assert.equal(w.completedPerfects,0);assert.equal(w.enemyRemainingHP,0);assert.equal(w.status,'estimated');assert.ok(w.counterplay?.some(c=>c.mechanic==='resilience'&&c.status==='verified'&&c.condition.includes('Debuff kaldırılmış sayılmadı')));assert.deepEqual(w.remainingDefenses,[]);
});
test('special damage alone being insufficient never pretends Resilience has disappeared after normal attacks',()=>{
 const {crew,boss,stage,data}=fixture();stage.hp=2100000;
 const hooks=makeCombatHooks(crew,boss,data),r=hooks.step(stage,[2],hooks.initial,stage.requirements);assert.equal(r.window.specialDamage,2000000);assert.ok(r.window.enemyRemainingHP!>0);assert.deepEqual(r.neutralized,[]);assert.ok(r.window.counterplay?.some(c=>c.status==='conditional'));assert.notEqual(r.window.status,'estimated');
});
test('NAO, percentage immunity, unavailable cooldown and special limits cannot authorize a bypass',()=>{
 const {crew,boss,stage,data}=fixture(peter);stage.normalAttackOnly=true;
 let hooks=makeCombatHooks(crew,boss,data);assert.equal(hooks.step(stage,[2],hooks.initial,stage.requirements).window.specialDamage,0);
 crew[2].specialText=real.units['4441'].special;stage.events![0].text+='\nPercentage damage resistant';hooks=makeCombatHooks(crew,boss,data);assert.equal(hooks.step(stage,[2],hooks.initial,stage.requirements).window.specialDamage,0);
 crew[2].specialText=gunko;crew[2].owned.readyTurn=99;hooks=makeCombatHooks(crew,boss,data);let r=evaluatePve(crew,boss,{combat:hooks});assert.ok(r.missing.some(s=>s.includes('Resilience')));assert.ok(!r.schedule[0].used.some(s=>s.includes('#4612')));
 crew[2].owned.readyTurn=0;stage.specialLimit=0;hooks=makeCombatHooks(crew,boss,data);r=evaluatePve(crew,boss,{combat:hooks});assert.ok(r.missing.length);assert.deepEqual(r.schedule[0].used,[]);
});
test('normal attacks can leave 1 HP and permitted end-of-turn damage or Poison finish Resilience',()=>{
 for(const special of ['Deals 5000 Fixed True damage to all enemies at the end of each turn for 2 turns.','Poisons all enemies.']){
  const {crew,boss,stage,data}=fixture(special);stage.hp=1000;
  const hooks=makeCombatHooks(crew,boss,data),r=hooks.step(stage,[2],hooks.initial,stage.requirements);assert.ok(r.window.endDamage!>0);assert.equal(r.window.enemyRemainingHP,0);assert.ok(r.neutralized?.includes('resilience'));assert.equal(r.window.incoming,0);
  stage.normalAttackOnly=true;const blocked=makeCombatHooks(crew,boss,data),no=blocked.step(stage,[2],blocked.initial,stage.requirements);assert.equal(no.window.endDamage,0);assert.ok(!no.neutralized?.length);
 }
 const {crew,boss,stage,data}=fixture('Poisons all enemies.');stage.hp=1000;stage.events![0].text+='\n99 turn(s) Immunity';const hooks=makeCombatHooks(crew,boss,data);assert.equal(hooks.step(stage,[2],hooks.initial,stage.requirements).window.endDamage,0);
});
test('a saved ready special finishes 1 HP on the next explicit turn; cooldown and earlier missing report follow the actual sequence',()=>{
 const {crew,boss,stage,data}=fixture();stage.hp=1000;crew[2].owned.readyTurn=1;
 boss.stages.push({...stage,id:'four:turn:2',name:'Battle 4 · Tur 2 (kalırsan)',conditionalTurn:2,turn:1,requirements:[],events:[]});
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.deepEqual(r.schedule[0].used,[]);assert.ok(r.schedule[1].used.some(s=>s.includes('#4612')));assert.equal(r.combatWindows![0].enemyRemainingHP,1);assert.equal(r.combatWindows![1].enemyHP,1);assert.deepEqual(r.missing,[]);
});
test('defeat hits still kill; shields must be used before a lethal damage special, and later specials cannot heal retroactively',()=>{
 const {crew,boss,stage,data}=fixture();stage.events!.push({trigger:'defeated',label:'DEFEATED',text:'100000 damage',requirements:[]});crew[3].specialText='Reduces damage received by 90% for 1 turn.';
 const hooks=makeCombatHooks(crew,boss,data),bad=hooks.step(stage,[2,3],hooks.initial,stage.requirements);assert.deepEqual(bad.used,[2]);assert.equal(bad.window.status,'blocked');assert.ok(bad.window.hpAfter<=0);
 const r=evaluatePve(crew,boss,{combat:hooks});assert.equal(r.combatWindows![0].status,'estimated');assert.ok(r.schedule[0].used[0].includes('#4'));assert.ok(r.schedule[0].used[1].includes('#4612'));assert.ok(r.combatWindows![0].hpAfter>0);
});
test('unknown HP, revival and multiple targets remain conditional, while all three searches prioritize a legal counter',()=>{
 const {crew,boss,stage,data,owned,characters}=fixture();delete stage.hp;
 const hooks=makeCombatHooks(crew,boss,data),r=hooks.step(stage,[2],hooks.initial,stage.requirements);assert.ok(!r.neutralized?.length);assert.ok(r.window.counterplay?.some(c=>c.status==='conditional'&&c.condition.includes('Düşman HP okunmadı')));
 stage.hp=1500000;stage.events![0].text+='\nRevives to Full HP';const revived=makeCombatHooks(crew,boss,data);assert.ok(!revived.step(stage,[2],revived.initial,stage.requirements).neutralized?.length);
 stage.events![0].text='98 turn(s) Resilience\nGunman x3';const multi=makeCombatHooks(crew,boss,data);assert.ok(!multi.step(stage,[2],multi.initial,stage.requirements).neutralized?.length);
 stage.events![0].text='98 turn(s) Resilience';const groups=plan({kind:'boss',characters,box:owned,data,boss,preparation:0});assert.equal(groups.length,3);for(const g of groups){assert.ok(g.teams.length);assert.ok(g.teams.some(t=>t.members.some(m=>m.sourceId==='4612')&&!t.missing?.some(s=>s.includes('Resilience'))&&t.combat?.windows.some(w=>w.counterplay?.some(c=>c.status==='verified'))));}
});

test('unremoved Resilience persists into a later trigger even if that page lists no new Resilience',()=>{
 const {crew,boss,stage,data}=fixture();stage.hp=1000;crew[2].owned.readyTurn=99;
 boss.stages.push({...stage,id:'four:turn:2',name:'Battle 4 · Tur 2 (kalırsan)',conditionalTurn:2,turn:1,requirements:[],events:[]});
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.ok(r.missing.some(s=>s.includes('Resilience')));assert.equal(r.combatWindows![1].enemyRemainingHP,1);assert.ok(r.combatWindows![1].incoming>=1000);
});

test('missing DEF cannot turn ordinary ATK damage or a normal-plus-EOT estimate into a certified kill',()=>{
 const {crew,boss,stage,data}=fixture('Deals 3000000 in [STR] damage to one enemy.');delete stage.enemyDefense;
 const hooks=makeCombatHooks(crew,boss,data),r=hooks.step(stage,[2],hooks.initial,stage.requirements);assert.equal(r.window.specialDamage,0);assert.ok(!r.neutralized?.length);
});

test('a captain end-of-turn damage ability is a passive counter and costs no special launch',()=>{
 const {crew,boss,stage,data}=fixture('');stage.hp=1000;crew[0].captainText+=' Deals 5000 Fixed True damage to all enemies at the end of each turn.';
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.deepEqual(r.missing,[]);assert.deepEqual(r.schedule[0].used,[]);assert.equal(r.combatWindows![0].endDamage,5000);
});

test('an unknown early battle does not spend the only damage counter before a later 98-turn Resilience window',()=>{
 const {crew,boss,stage,data}=fixture();delete stage.hp;stage.turn=1;
 boss.stages.unshift({...stage,id:'three',name:'Battle 3',battleNumber:3,turn:0,requirements:[],events:[]});
 const hooks=makeCombatHooks(crew,boss,data),r=evaluatePve(crew,boss,{combat:hooks});assert.ok(!r.schedule[0].used.some(s=>s.includes('#4612')));assert.ok(r.combatWindows![1].counterplay?.some(c=>c.status==='conditional'&&c.sources.includes('#4612')));
});

test('immunity and NAO survive an omitted later guide line but never transfer to a new enemy',()=>{
 for(const [special,warning] of [['Poisons all enemies.','99 turn(s) Immunity'],[peter,'99 turn(s) Non-Normal Attacks deal 1'],[real.units['4441'].special,'99 turn(s) Percentage damage resistant']]){
  const {crew,boss,stage,data}=fixture(special);stage.hp=1000;stage.events![0].text+='\n'+warning;
  const next={...stage,id:'four:turn:2',conditionalTurn:2,turn:1,requirements:[],events:[]};
  const hooks=makeCombatHooks(crew,boss,data),first=hooks.step(stage,[],hooks.initial,stage.requirements),later=hooks.step(next,[2],first.state,[]);
  assert.equal(later.window.specialDamage,0);assert.equal(later.window.endDamage,0);assert.ok(!later.neutralized?.length);assert.equal(later.window.enemyRemainingHP,1);
  const fresh=hooks.step({...next,id:'five',conditionalTurn:undefined,requirements:stage.requirements},[2],first.state,stage.requirements);
  assert.ok((fresh.window.specialDamage||0)+(fresh.window.endDamage||0)>0);
 }
});
