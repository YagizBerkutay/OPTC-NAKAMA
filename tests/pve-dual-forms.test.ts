import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {candidates,type PlannerData} from '../src/planning';import {newOwned,type Character,type Boss} from '../src/model';import {evaluatePve} from '../src/engine';import {makeCombatHooks} from '../src/pve-combat';
const real:PlannerData=JSON.parse(fs.readFileSync(new URL('../public/data/planner.json',import.meta.url),'utf8')),catalog:Character[]=JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json',import.meta.url),'utf8')).characters,zoro=catalog.find(c=>c.id==='4062')!;
test('real Zoro/Sanji targets retain Zoro or Sanji instead of granting the combined special and captain',()=>{
 const original=newOwned('4062'),before=structuredClone(original),unit=real.units['4062'];
 for(const scenario of ['current','power','evolve'] as const){
  const first=candidates([original],[zoro],real,scenario)[0];assert.equal(first.owned.pveForm,'character1');assert.equal(first.specialText,(unit.special as Record<string,string>).character1);assert.equal(first.captainText,(unit.captain as Record<string,string>).character1);assert.deepEqual(first.effects,[{mechanic:'defenseUp',turns:7}]);
  const second=candidates([{...original,pveForm:'character2'}],[zoro],real,scenario)[0];assert.equal(second.owned.pveForm,'character2');assert.equal(second.specialText,(unit.special as Record<string,string>).character2);assert.deepEqual(second.effects,[{mechanic:'threshold',turns:7}]);
 }
 assert.deepEqual(original,before);
});
test('Marco DEF Up plus Threshold cannot both be solved by a first Zoro activation; another remover is needed',()=>{
 const generic:Character[]=Array.from({length:5},(_,i)=>({...structuredClone(zoro),id:'test-'+i,name:'Test '+i,types:['STR'],classes:['Fighter'],captain:'Boosts ATK of all characters by 4x.',special:'',hp:5000}));
 const data:PlannerData={...real,units:{'4062':real.units['4062'],...Object.fromEntries(generic.map(c=>[c.id,{captain:c.captain,special:'',cooldown:[0,0],limit:[],llb:[],evolutions:[],rumble:null}]))}};
 const characters=[...generic,zoro],box=characters.map(c=>({...newOwned(c.id),cooldown:0,readyTurn:0}));
 const boss:Boss={id:'marco-dual',name:'Marco Battle 4',source:'observed Marco mechanics',training:true,stages:[{id:'four',name:'Battle 4',battleNumber:4,turn:30,normalAttackOnly:true,requirements:[{mechanic:'defenseUp',turns:5},{mechanic:'threshold',turns:5}],events:[{trigger:'preemptive',label:'PREEMPTIVE',text:'5 turn(s) DEF x 1000\n5 turn(s) Damage over 1000 90% Reduction\n98 turn(s) Non-Normal Attacks deal 1 damage',requirements:[]}]}]};
 const crew=candidates(box,characters,data,'power').map(m=>({...m,owned:{...m.owned,ability:{...m.owned.ability,verified:true,effects:m.effects}}})),hooks=makeCombatHooks(crew,boss,data),result=evaluatePve(crew,boss,{combat:hooks});
 assert.deepEqual(result.missing,['Battle 4: Threshold 5 tur']);assert.ok(result.combatWindows![0].remainingDefenses.includes('Threshold'));
 crew[2].specialText="Reduces enemies' Threshold Damage Reduction duration by 5 turns.";crew[2].owned.ability.effects=[{mechanic:'threshold',turns:5}];const complete=makeCombatHooks(crew,boss,data),fixed=evaluatePve(crew,boss,{combat:complete});
 assert.deepEqual(fixed.missing,[]);assert.deepEqual(fixed.combatWindows![0].remainingDefenses,[]);assert.ok(fixed.schedule[0].used.some(s=>s.includes('#4062 ')));assert.ok(fixed.schedule[0].used.some(s=>s.includes('#test-2 ')));
});

