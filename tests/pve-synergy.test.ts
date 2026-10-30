import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {candidates,captainBoost,plan,parseEffects,type PlannerData,type PlannerUnit,type PlanMember} from '../src/planning';
import {newOwned,emptyState,validateState,type Character,type Boss} from '../src/model';
import {makeAdventureContext,captainCooldown,supportMatches} from '../src/pve-synergy';
import {supportTargetMatches} from '../src/support-targets';
import {abilitiesAt,passiveSailor,selectedLevel} from '../src/skill-levels';
import {inspectSkills,applyAuxiliary,rewindResistance} from '../src/skill-analysis';
import {makeRumbleContext} from '../src/rumble-planner';
function fixture(){
 const characters:Character[]=Array.from({length:9},(_,i)=>({id:String(i+1),name:'Unit '+(i+1),types:['STR'],classes:['Fighter'],stars:'6',cost:70,maxLevel:99,hp:3000,atk:1800,rcv:300,global:true,captain:'Boosts ATK of all characters by 4x.',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
 const units:Record<string,PlannerUnit>=Object.fromEntries(characters.map(c=>[c.id,{families:[c.id],captain:c.captain,special:'',cooldown:[15,10],limit:['Boosts base ATK by 100'],llb:[],evolutions:[],abilities:{},rumble:{cost:20,stats:{spd:100,def:100},ability:[{effects:[]}],special:[{cooldown:25,effects:[{effect:'damage',type:'fixed',amount:2500,targeting:{targets:['enemies']}}]}],llbability:[],llbspecial:[],resilience:[]}}]));
 const data:PlannerData={metadata:{source:'fixture',url:'https://example.com',sha:'fixture',builtAt:''},units,locations:{}},box=characters.map(c=>({...newOwned(c.id),level:99,lb:true,rumbleAbility:5,rumbleSpecial:10}));
 const pool=(scenario:'current'|'power'|'evolve'='power')=>candidates(box,characters,data,scenario);return {characters,data,box,pool};
}
const crew=(p:PlanMember[])=>[p[0],{...p[0],friend:true},...p.slice(1,5)];
test('cost, tag and matching-class captain clauses use the actual target instead of a universal ceiling',()=>{
 const f=fixture(),c=f.characters[0];f.data.units[c.id].tags=['World Government'];
 assert.equal(captainBoost('Boosts ATK of Cost 70 or more characters by 6x, boosts ATK of all other characters by 4x.',c),6);
 assert.equal(captainBoost('Boosts ATK of Cost 70 or more characters by 6x, boosts ATK of all other characters by 4x.',{...c,cost:50}),4);
 assert.equal(captainBoost('Boosts ATK of [World Government] characters by 5x.',c,f.data),5);
 const text='Boosts ATK of Fighter and Powerhouse characters by 2.3x-5.29x, depending on if the character has 2 matching Classes.';
 assert.equal(captainBoost(text,c),2.3);assert.equal(captainBoost(text,{...c,classes:['Fighter','Powerhouse']}),5.29);
});
test('a sailor boosts the actual recipients only as a crewmate, with HP and orb contributions retained',()=>{
 const f=fixture();f.data.units['2'].abilities={sailor:{base:'Boosts base ATK, HP and RCV of all characters by 100. Makes [RCV] and [TND] orbs beneficial for all characters.'}};
 const p=f.pool(),ctx=makeAdventureContext(p,f.data),t=crew(p),result=ctx.assess(t,true);assert.equal(result.passiveAttack,600);assert.equal(result.passiveHP,600);assert.equal(result.passiveRCV,600);assert.equal(result.orbCoverage,6);
 const captain=[p[1],{...p[1],friend:true},...p.slice(2,6)];assert.equal(ctx.assess(captain).passiveAttack,0);
});
test('LLB sailor and support overrides are imported, unlocked by tiers, and do not require level 150',()=>{
 const f=fixture();f.data.units['2'].abilities={sailor:{base:'Boosts base ATK of all characters by 50.'}};f.data.units['2'].llb=[null,{sailor:{base:'Boosts base ATK of all characters by 300.'}}];
 const p=f.pool('current');assert.ok(passiveSailor(p[1],f.data).includes('50'));p[1].owned.llb=2;assert.ok(passiveSailor(p[1],f.data).includes('300'));assert.ok(p[1].estimatedLevel<=100);
 const upstream=JSON.parse(fs.readFileSync('public/data/planner.json','utf8'));assert.ok(Object.values(upstream.units).flatMap((u:any)=>u.llb).filter((t:any)=>t?.sailor).length>=83);assert.ok(Object.values(upstream.units).flatMap((u:any)=>u.llb).filter((t:any)=>t?.support).length>=2);
 assert.ok(abilitiesAt(p[1],f.data).sailor);
});
test('dual sailor selects one form instead of summing three mutually exclusive states',()=>{
 const f=fixture();f.data.units['2'].abilities={sailor:{character1:'Boosts base ATK of all characters by 50.',character2:'Boosts base ATK of all characters by 80.',combined:'Boosts base ATK of all characters by 200.'}};
 const current=f.pool('current');assert.ok(passiveSailor(current[1],f.data).includes('50'));assert.ok(!passiveSailor(current[1],f.data).includes('200'));current[1].owned.pveForm='character2';assert.ok(passiveSailor(current[1],f.data).includes('80'));
 const max=f.pool();assert.equal(makeAdventureContext(max,f.data).assess(crew(max)).passiveAttack,300);
 f.box[1].pveForm='character2';const second=f.pool();assert.equal(makeAdventureContext(second,f.data).assess(crew(second)).passiveAttack,480);
});
test('unknown current support/tap levels are not maximum merely because the character is level 150',()=>{
 const f=fixture();f.box[0].level=150;const current=f.pool('current')[0];assert.equal(selectedLevel(current,'support',['a','b','c','d','e']),0);assert.equal(selectedLevel(f.pool()[0],'support',['a','b','c','d','e']),5);
 current.owned.pveLevels={support:3,lastTap:2};assert.equal(selectedLevel(current,'support',[]),3);
});
test('support targeting honors type AND class, named characters and character tags',()=>{
 const f=fixture(),p=f.pool();f.data.units['2'].tags=['Navy'];assert.equal(supportMatches(p[0],p[1],'[STR] Fighter characters',f.data),true);p[1].character.types=['INT'];assert.equal(supportMatches(p[0],p[1],'[STR] Fighter characters',f.data),false);assert.equal(supportMatches(p[0],p[1],'[Navy] characters',f.data),true);assert.equal(supportMatches(p[0],p[1],'Unit 2',f.data),true);
});
test('support requirements combine type, class, tag and cost without broadening paired alternatives',()=>{
 const f=fixture(),p=f.pool(),t=p[1];f.data.units['2'].tags=['Navy'];
 assert.equal(supportTargetMatches('[STR] and Fighter characters',t,f.data),true);
 t.character.types=['INT'];assert.equal(supportTargetMatches('[STR] and Fighter characters',t,f.data),false);
 assert.equal(supportTargetMatches('[INT] [Navy] characters',t,f.data),true);
 assert.equal(supportTargetMatches('[STR] [Navy] characters',t,f.data),false);
 t.character.classes=['Slasher'];
 assert.equal(supportTargetMatches('[STR] Fighter and [DEX] Slasher characters',t,f.data),false);
 t.character.types=['STR'];assert.equal(supportTargetMatches('[STR] Fighter and [DEX] Slasher characters',t,f.data),false);
 t.character.types=['DEX'];assert.equal(supportTargetMatches('[STR] Fighter and [DEX] Slasher characters',t,f.data),true);
 assert.equal(supportTargetMatches('[INT] Slasher and Free Spirit characters',t,f.data),false);
 t.character.types=['INT'];assert.equal(supportTargetMatches('[INT] Slasher and Free Spirit characters',t,f.data),true);
 assert.equal(supportTargetMatches('Fighter and Slasher characters',t,f.data),true);
 t.character.cost=70;assert.equal(supportTargetMatches('[STR] characters with cost 99 or less',t,f.data),false);
 assert.equal(supportTargetMatches('[INT] characters with cost 40 or less',t,f.data),false);
 assert.equal(supportTargetMatches('Characters with cost 99 or more',t,f.data),false);
 t.character.cost=99;assert.equal(supportTargetMatches('Characters with cost 99 or more',t,f.data),true);
 assert.equal(supportTargetMatches('[PSY], [DEX], and [STR] characters',t,f.data),false);
 assert.equal(supportTargetMatches('[QCK] Slasher/Striker characters',t,f.data),false);
 t.character.types=['QCK'];assert.equal(supportTargetMatches('[QCK] Slasher/Striker characters',t,f.data),true);
 for(const scope of ['', 'All characters except Law','Fighter characters at Level 150','[QCK] characters if HP is full'])assert.equal(supportTargetMatches(scope,t,f.data),false);
});
test('named support requirements match complete identities and dual members, not substrings',()=>{
 const f=fixture(),p=f.pool(),t=p[1];t.character.name='Law & Bepo - Test';t.families=['TrafalgarDWaterLaw','Bepo'];
 for(const scope of ['Trafalgar Law','Bepo and Donquixote Rosinante (Corazon)','Nami, Trafalgar Law and Sabo'])assert.equal(supportTargetMatches(scope,t,f.data),true);
 assert.equal(supportTargetMatches('Nami and Nico Robin',t,f.data),false);
 t.character.name='Saboala';t.families=['Saboala'];assert.equal(supportTargetMatches('Sabo',t,f.data),false);
});
test('joint support assignment never reuses a physical source or a crew member; target levels affect score',()=>{
 const f=fixture();for(const id of ['6','7','8','9'])f.data.units[id].abilities={support:[{Characters:'All characters',description:['Adds 1% of this character\'s base ATK to the supported character\'s base ATK.','Adds 20% of this character\'s base ATK to the supported character\'s base ATK.']}]};
 const p=f.pool(),supports=makeAdventureContext(p,f.data).assess(crew(p),true).supports;assert.equal(supports.length,4);assert.equal(new Set(supports.map(s=>s.member.sourceId)).size,4);assert.ok(supports.every(s=>Number(s.member.sourceId)>5&&s.level===2));
 const current=f.pool('current');assert.equal(makeAdventureContext(current,f.data).assess(crew(current),true).supports.length,0);
});
test('Law and Bepo supports cannot enter any slot of a crew containing Law & Bepo',()=>{
 const f=fixture();f.data.units['2'].families=['TrafalgarDWaterLaw','Bepo'];
 f.data.units['6'].families=['TrafalgarDWaterLaw'];f.data.units['7'].families=['Bepo'];
 f.data.units['8'].families=['DonquixoteRosinante'];f.data.units['9'].families=['TrafalgarDWaterLaw','NicoRobin'];
 for(const id of ['6','7','8','9']){f.data.units[id].abilities={support:[{Characters:'All characters',description:["Adds 20% of this character's base ATK to the supported character's base ATK."]}]};f.box[Number(id)-1].pveLevels={support:1};}
 for(const scenario of ['current','power','evolve'] as const){
  const p=f.pool(scenario),team=crew(p),ctx=makeAdventureContext(p,f.data);
  assert.equal(supportMatches(p[5],p[1],'All characters',f.data),false);
  assert.equal(supportMatches(p[5],p[2],'All characters',f.data),true,'eligibility of another target does not bypass crew-wide conflicts');
  const supports=ctx.assess(team,true).supports;
  assert.deepEqual(supports.map(s=>s.member.sourceId),['8']);
  const withoutIllegal=makeAdventureContext(p.filter(m=>!['6','7','9'].includes(m.sourceId)),f.data);
  assert.equal(ctx.assess(team).score,withoutIllegal.assess(team).score,'illegal supports cannot boost preliminary crew ranking');
 }
 const data=JSON.parse(fs.readFileSync('public/data/planner.json','utf8'));
 assert.deepEqual(data.units['4140'].families,['TrafalgarDWaterLaw','Bepo']);
 for(const id of ['1289','3027','3102','3756','4032','4045'])assert.ok(data.units[id].families.includes('TrafalgarDWaterLaw'));
});
test('different versions and dual supports share identities even when supporting different members',()=>{
 const f=fixture();f.data.units['6'].families=['Law'];f.data.units['7'].families=['Law'];f.data.units['8'].families=['Law','Bepo'];
 for(const id of ['6','7','8','9'])f.data.units[id].abilities={support:[{Characters:'All characters',description:["Adds 20% of this character's base ATK to the supported character's base ATK."]}]};
 const p=f.pool(),supports=makeAdventureContext(p,f.data).bestSupports(crew(p));
 assert.equal(supports.length,2);const identities=supports.flatMap(s=>s.member.families);assert.equal(new Set(identities).size,identities.length);
 assert.ok(supports.some(s=>s.member.sourceId==='9'));
 assert.equal(supportMatches(p[5],{...p[2],friend:true},'All characters',f.data),false);
});
test('support evolution uses the final form identity, and valid alternatives survive the candidate limit',()=>{
 const f=fixture();f.data.units['2'].families=['Law'];f.data.units['6'].families=['Corazon'];f.data.units['7'].families=['Law'];
 f.data.units['6'].evolutions=[{to:'7',materials:[]}];
 for(const id of ['6','7','8','9'])f.data.units[id].abilities={support:[{Characters:'All characters',description:["Adds 20% of this character's base ATK to the supported character's base ATK."]}]};
 const p=f.pool('evolve'),t=crew(p.filter(m=>!m.path.length)),rows=makeAdventureContext(p,f.data).bestSupports(t);
 assert.ok(rows.some(s=>s.member.sourceId==='6'&&s.member.character.id==='6'));
 assert.ok(!rows.some(s=>s.member.character.id==='7'));
 const blocked=p.find(m=>m.sourceId==='7')!,allowed=p.find(m=>m.sourceId==='9')!;
 const extra=Array.from({length:15},(_,i)=>({...blocked,sourceId:'blocked-'+i,character:{...blocked.character,id:'blocked-'+i},attack:99999}));
 const context=makeAdventureContext([...t.filter(m=>!m.friend),...extra,allowed],f.data);
 assert.ok(context.bestSupports(t).some(s=>s.member.sourceId==='9'),'filter forbidden identities before keeping the top 12 options');
});
test('captain cooldown is scoped to recipients, percentages round down, and innately restored rewind works without LB',()=>{
 const f=fixture();f.data.units['1'].captain='Reduces Special Cooldown of Fighter characters by 2 turns at the start of the fight.';const p=f.pool();assert.equal(captainCooldown(p[0],p[1],f.data),2);p[1].character.classes=['Slasher'];assert.equal(captainCooldown(p[0],p[1],f.data),0);
 p[0].captainText='Launches the following effect at start of fight: reduces Special Cooldown of Cost 70 or more characters by 34% of Max Cooldown (rounded down).';p[1].owned.cooldown=17;assert.equal(captainCooldown(p[0],p[1],f.data),5);
 f.data.units['2'].abilities={sailor:{base:'Restores Special Cooldown of this character completely when it is rewinded.'}};p[1].owned.lb=false;assert.equal(rewindResistance(p[1],f.data),99);
});
test('captain HP/reduction and useful sailor stats change selection before final audit',()=>{
 const f=fixture();f.data.units['9'].captain='Boosts ATK of all characters by 4x, boosts HP of all characters by 2x, reduces damage taken by 20%.';f.data.units['8'].abilities={sailor:{base:'Boosts base ATK of all characters by 500.'}};
 const result=plan({kind:'teams',box:f.box,characters:f.characters,data:f.data});for(const group of result){assert.equal(group.teams[0].members[0].character.id,'9');assert.ok(group.teams[0].members.slice(2).some(m=>m.character.id==='8'));assert.ok(group.teams[0].synergy!.damageReduction>0);}
});
test('captain passive reduction repeats, but support boss triggers are restricted and one-use',()=>{
 const boss:Boss={id:'b',name:'b',source:'fixture',training:true,stages:[{id:'a',name:'a',turn:1,requirements:[{mechanic:'bind',turns:3}]},{id:'b',name:'b',turn:2,requirements:[{mechanic:'bind',turns:3}]}]};
 const passive={id:'1',name:'Captain',text:'Boosts ATK and reduces Bind duration by 3 turns.',effects:[{mechanic:'bind' as const,turns:3}],oneUse:false,passive:true};assert.ok(applyAuxiliary(boss,[passive],['Boosts ATK']).boss.stages.every(s=>s.requirements.length===0));
 const support={...passive,name:'Support',oneUse:true,allowedStages:['b']};const result=applyAuxiliary(boss,[support]);assert.equal(result.boss.stages[0].requirements.length,1);assert.equal(result.boss.stages[1].requirements.length,0);
});
test('super switch counter and alternate Launch Status never certify simultaneous base effects',()=>{
 const f=fixture();f.data.units['1'].abilities={swap:{base:'Reduces Bind duration by 2 turns.',super:'Reduces Bind duration by 10 turns.',superTurns:7}};const p=f.pool('current'),a=inspectSkills(crew(p),f.data);assert.equal(a.actions[0].effects[0].turns,2);assert.ok(a.audit.some(row=>row.name==='Super Switch'&&row.condition.includes('7')));
 assert.deepEqual(parseEffects('Launches effects depending on Special Launch Status: reduces Bind duration by 10 turns.'),[]);
});
test('PVE abilities do not leak into Rumble and EX is conditional without concealing regular damage shortage',()=>{
 const f=fixture(),p=f.pool(),base=makeRumbleContext(p,f.data,'attack').score(p.slice(0,5));f.data.units['1'].captain='Boosts ATK of all characters by 100x.';f.data.units['1'].abilities={sailor:{base:'Boosts base ATK of all characters by 99999.'},support:[]};assert.equal(makeRumbleContext(p,f.data,'attack').score(p.slice(0,5)),base);
 f.data.units['1'].rumble!.superspecial=[{condition:{type:'crew',comparator:'more',count:5,targets:['Fighter']},effects:[{effect:'damage',type:'fixed',amount:15000,targeting:{targets:['enemies']}}]}];assert.ok(makeRumbleContext(p,f.data,'attack').score(p.slice(0,5))>base);assert.equal(makeRumbleContext(p,f.data,'attack').offense(p.slice(0,5)).directSources,5);
});
test('optional PVE levels and form validate old profiles without migrating or overwriting their box',()=>{
 const f=fixture(),state=emptyState();state.box=f.box;const before=structuredClone(state);assert.deepEqual(validateState(state,new Set(f.characters.map(c=>c.id))),before);state.box[0].pveLevels={support:5,'potential:Critical Hit':3};state.box[0].pveForm='character2';assert.equal(validateState(state,new Set(f.characters.map(c=>c.id))).box[0].pveLevels!.support,5);state.box[0].pveLevels.support=6;assert.throws(()=>validateState(state,new Set(f.characters.map(c=>c.id))));
});
test('temporary captain shields and percentage sailor stats are not reported as permanent absolute bonuses',()=>{
 const f=fixture();f.data.units['1'].captain='Boosts ATK of all characters by 4x, reduces damage taken by 80% for 3 turns at the start of the fight.';f.data.units['2'].abilities={sailor:{base:'Boosts base HP of all characters by 6%.'}};const p=f.pool(),s=makeAdventureContext(p,f.data).assess(crew(p));assert.equal(s.damageReduction,0);assert.equal(s.passiveHP,0);
});
test('Tandem Boost does not score without an eligible Super Tandem initiator',()=>{
 const f=fixture();f.data.units['2'].abilities={superTandemBoost:{characterCondition:['When a Fighter character performs Super Tandem'],description:['Raises Boost Level of Fighter characters by 5.']}};let p=f.pool();assert.ok(!makeAdventureContext(p,f.data).assess(crew(p),true).conditional.some(t=>t.includes('superTandemBoost')));
 f.data.units['3'].abilities={superTandem:{condition:'On the last stage with a TND orb',description:['Boosts ATK of Fighter characters by 2x.']}};p=f.pool();assert.ok(makeAdventureContext(p,f.data).assess(crew(p),true).conditional.some(t=>t.includes('superTandemBoost')));
});
test('different friend captains can jointly solve boss mechanics instead of forcing a duplicate captain',()=>{
 const f=fixture();f.data.units['1'].captain='Boosts ATK of all characters by 5x, reduces Bind duration by 3 turns.';f.data.units['2'].captain='Boosts ATK of all characters by 5x, reduces Despair duration by 3 turns.';
 const boss:Boss={id:'mixed',name:'mixed',source:'fixture',training:true,stages:[{id:'last',name:'last',turn:5,requirements:[{mechanic:'bind',turns:3},{mechanic:'despair',turns:3}]}]};
 const groups=plan({kind:'boss',box:f.box,characters:f.characters,data:f.data,boss});for(const group of groups){const t=group.teams[0];assert.notEqual(t.members[0].character.id,t.members[1].character.id);assert.deepEqual(t.missing,[]);assert.ok(Number.isFinite(t.score));}
});
test('potential audit uses its saved individual level, while unknown potential levels stay explicit',()=>{
 const f=fixture();f.data.units['2'].abilities={potential:[{Name:'Critical Hit',description:['1% chance to deal 1% of attack.','10% chance to deal 10% of attack.','50% chance to deal 50% of attack.']}]};f.box[1].pveLevels={'potential:Critical Hit':2};
 const p=f.pool('current');const row=inspectSkills(crew(p),f.data).audit.find(a=>a.id==='2'&&a.name==='Potential')!;assert.ok(row.text.includes('Lv.2'));assert.ok(row.text.includes('10%'));assert.ok(!row.text.includes('50%'));delete p[1].owned.pveLevels;assert.ok(inspectSkills(crew(p),f.data).audit.find(a=>a.id==='2'&&a.name==='Potential')!.text.includes('Seviye bilinmiyor'));
});
