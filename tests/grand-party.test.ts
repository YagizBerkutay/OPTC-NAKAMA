import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import { newOwned, validateState, emptyState, type Character } from '../src/model';
import { candidates, skillAt, type PlannerData, type PlannerUnit } from '../src/planning';
import { OCTOBER_GP_SEASON, NEUTRAL_SEASON, gpLeader, gpAura, gpBurstValue, gpConditionText, grandObjective, planGrandParty, gpCandidates, rumbleEXPotential } from '../src/grand-party';
import { tagged } from '../src/rumble-planner';

function fixture() {
  const characters:Character[]=Array.from({length:24},(_,i)=>({id:String(i+1),name:'Character '+(i+1),types:[['STR','PSY','DEX'][Math.floor(i/8)]],classes:[['Fighter','Striker','Powerhouse'][Math.floor(i/8)]],stars:'6',cost:20,maxLevel:99,hp:3000,atk:1800+i,rcv:300,global:true,captain:'',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
  const units:Record<string,PlannerUnit>={};
  for(const c of characters)units[c.id]={families:[c.id==='9'?'1':c.id],tags:c.id==='9'?['World Government']:[],captain:'',special:'',cooldown:[15,10],limit:[],llb:[],evolutions:[],rumble:{cost:20,stats:{def:140,spd:140},ability:[{effects:[{effect:'buff',attributes:['ATK','DEF'],level:3,targeting:{targets:c.types}}]}],special:[{cooldown:25,effects:[{effect:'damage',type:'fixed',amount:1500,targeting:{targets:['enemies']}}]}],llbability:[],llbspecial:[],resilience:[]}};
  units['1'].rumble!.gpability=[{effects:[{effect:'buff',attributes:['ATK','HP','DEF'],level:3,targeting:{targets:['crew']}}]},...Array.from({length:4},()=>({}))];
  units['9'].rumble!.gpability=[{effects:[{effect:'buff',attributes:['ATK'],level:1,targeting:{targets:['PSY']}}]},...Array.from({length:4},()=>({}))];
  for(const id of ['1','9']){units[id].rumble!.gpspecial=[{uses:2,effects:[{effect:'damage',type:'atkbase',amount:2,targeting:{targets:['enemies']},leader:true}]},...Array.from({length:4},()=>({}))];units[id].rumble!.gpcondition=[{type:'hitreceived',count:20}];}
  return {box:characters.map(c=>({...newOwned(c.id),level:99,rumbleAbility:5,rumbleSpecial:10})),characters,data:{metadata:{source:'fixture',url:'https://github.com',sha:'fixture',builtAt:''},units,locations:{}} as PlannerData};
}

test('October boost requires an eligible leader and supplies a shared third Burst',()=>{
  const f=fixture(),members=candidates(f.box,f.characters,f.data,'power');
  const normal=gpLeader(members[0],f.data,'power',OCTOBER_GP_SEASON)!,eligible=gpLeader(members[8],f.data,'power',OCTOBER_GP_SEASON)!;
  assert.equal(normal.seasonal,false);assert.equal(normal.uses,2);assert.equal(eligible.seasonal,true);assert.equal(eligible.uses,3);
  assert.equal(gpAura(normal,members.slice(8,13),members,f.data,OCTOBER_GP_SEASON),gpAura(normal,members.slice(8,13),members,f.data,NEUTRAL_SEASON));
  assert.ok(gpAura(eligible,members.slice(8,13),members,f.data,OCTOBER_GP_SEASON)>gpAura(eligible,members.slice(8,13),members,f.data,NEUTRAL_SEASON)+200);
  assert.equal(gpLeader(members[8],f.data,'power',{...OCTOBER_GP_SEASON,leaderMatch:'all'})!.seasonal,false);
});

test('live GP leader classes gate both Burst and teammate tag bonuses independently',()=>{
  const {parseGrandPartyRules}=createRequire(import.meta.url)('../electron/grand-party-rules-core.cjs');
  const season=parseGrandPartyRules('If leader is Driven/Slasher, [Elbaph Arc] [Revolutionary Army] [Royalty] teammates DEF Up Lv.5, Special CT Speed Up Lv.5, team HP, ATK, SPD, RCV Up Lv.5, GP Burst Launch Requirement -40%, GP Burst Uses +1 (Special Rule will only affect the Combat Power); During the last 30 s of battle, Special CT Speed Up & Damage Up!').season;
  const f=fixture();f.characters[0].classes=['Driven'];f.data.units['2'].tags=['Royalty'];
  const members=candidates(f.box,f.characters,f.data,'power'),eligible=gpLeader(members[0],f.data,'power',season)!,ineligible=gpLeader(members[8],f.data,'power',season)!;
  assert.equal(eligible.uses,3);assert.equal(ineligible.uses,2);
  assert.equal(gpAura(ineligible,members.slice(0,5),members,f.data,season),gpAura(ineligible,members.slice(0,5),members,f.data,NEUTRAL_SEASON));
  const bonus=(index:number)=>gpAura(eligible,[members[index]],members,f.data,season)-gpAura(eligible,[members[index]],members,f.data,NEUTRAL_SEASON);
  assert.equal(bonus(1)-bonus(2),35,'only the observed teammate tag receives DEF and CT bonuses');
});

test('GP levels and uses are separate from Rumble special levels; LLB unlock is respected',()=>{
  const f=fixture();f.box[0].rumbleAbility=5;f.box[0].rumbleSpecial=10;f.box[0].gpAbility=2;f.box[0].gpSpecial=1;
  f.data.units['1'].rumble!.gpability![1]={effects:[{override:{level:4}}]};f.data.units['1'].rumble!.llbgpability=[{effects:[{effect:'buff',level:10,attributes:['DEF'],targeting:{targets:['crew']}}]}];f.data.units['1'].llb=[null,{gpAbility:true}];
  let m=candidates(f.box,f.characters,f.data,'current')[0],l=gpLeader(m,f.data,'current')!;assert.equal(l.abilityLevel,2);assert.equal(l.burstLevel,1);assert.equal(l.ability.effects![0].level,4);
  f.box[0].llb=2;m=candidates(f.box,f.characters,f.data,'current')[0];assert.equal(gpLeader(m,f.data,'current')!.ability.effects![0].level,10);
  assert.equal(skillAt([{uses:1},{uses:3}],2).uses,3);
});

test('GP Burst damage uses the leader base ATK; damage-count condition is not damage amount',()=>{
  const f=fixture(),m=candidates(f.box,f.characters,f.data,'power'),l=gpLeader(m[0],f.data,'power')!;
  const first=gpBurstValue(l,m.slice(0,5),f.data);l.member={...l.member,attack:l.member.attack*2};assert.equal(gpBurstValue(l,m.slice(0,5),f.data),first*2);
  assert.equal(gpConditionText({type:'damage',count:16}),'16 kez hasar verildiğinde');
  assert.equal(tagged({...m[0],character:{...m[0].character,types:['PSY']},families:['1']},['[PSY] [World Government]'],f.data),false);
});

test('Grand Party jointly selects three unique crews, benches and the chosen leader without changing the box',()=>{
  const f=fixture(),before=structuredClone(f.box);
  const result=planGrandParty({...f,costLimit:160,season:OCTOBER_GP_SEASON},'power');
  assert.ok(result.plans.length);const p=result.plans[0];assert.equal(p.leader.member.character.id,'9');assert.equal(p.leader.uses,3);assert.equal(p.teams.length,3);
  const roster=p.teams.flatMap(t=>[...t.members,...t.reserves||[]]);assert.equal(new Set(roster.map(m=>m.sourceId)).size,roster.length);assert.ok(roster.some(m=>m.sourceId===p.leader.member.sourceId&&m.character.id===p.leader.member.character.id));
  assert.ok(roster.every(m=>m.estimatedLevel===100&&m.owned.level===100));assert.equal(p.leader.member.estimatedLevel,100);
  for(const t of p.teams){assert.equal(t.members.length,5);assert.ok(t.reserves!.length<=3);assert.ok(t.cost!<=160);const families=[...t.members,...t.reserves||[]].flatMap(m=>m.families);assert.equal(new Set(families).size,families.length);}
  assert.deepEqual(f.box,before);
  const locked=planGrandParty({...f,costLimit:160,leaderId:'1'},'current');assert.ok(locked.plans.every(p=>p.leader.member.sourceId==='1'&&p.leader.burstLevel===1));
});

test('Sparse box remains legal, missing GP data is explicit, and two-win scoring prefers a strong second crew',()=>{
  const f=fixture();f.box=f.box.slice(0,3);const result=planGrandParty({...f,costLimit:20},'current');assert.ok(result.plans.length);assert.ok(result.plans[0].teams.every(t=>t.members.length===1&&t.cost===20));
  assert.ok(!planGrandParty({...f,leaderId:'2',costLimit:300},'current').plans.length);
  assert.ok(grandObjective([90,80,40])>grandObjective([140,30,20]));
});

test('Old v1 boxes load and optional GP levels are validated',()=>{
  const state=emptyState();state.box=[newOwned('1')];assert.deepEqual(validateState(state,new Set(['1'])),state);
  state.box[0].gpAbility=5;state.box[0].gpSpecial=5;assert.doesNotThrow(()=>validateState(state,new Set(['1'])));
  state.box[0].gpSpecial=6;assert.throws(()=>validateState(state,new Set(['1'])));
});

test('Real upstream GP LLB unlock and inherited Rumble records survive data import',()=>{
  const d=JSON.parse(fs.readFileSync('public/data/planner.json','utf8')) as PlannerData;
  assert.equal(d.units['4068'].llb[1]?.gpAbility,true);assert.ok(d.units['4068'].rumble!.llbgpability!.length);
  assert.deepEqual(d.units['227'].rumble?.stats,d.units['226'].rumble?.stats);
  assert.equal(d.units['4432'].rumble!.gpspecial![0].uses,2);
  assert.equal(d.units['4432'].rumble!.gpcondition![0]&&typeof d.units['4432'].rumble!.gpcondition![0],'object');
});

test('VS forms retain their actual type, class and identity and cannot be allocated twice',()=>{
  const data=JSON.parse(fs.readFileSync('public/data/planner.json','utf8')) as PlannerData,characters=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8')).characters;
  const pool=gpCandidates({box:[newOwned('4529')],characters,data,costLimit:300},'power');assert.equal(pool.length,2);assert.ok(pool.every(m=>m.sourceId==='4529'));assert.deepEqual(pool[0].character.types,['DEX']);assert.deepEqual(pool[1].character.classes,['Cerebral','Slasher']);assert.deepEqual(pool[0].families,['RoronoaZoro']);assert.deepEqual(pool[1].families,['EthanbaronVNusjuro']);assert.ok(data.units[pool[1].character.id].tags!.includes('World Government'));
  assert.ok(pool.every(m=>m.estimatedLevel===100&&m.owned.level===100));
});
test('Conditional Rumble EX gets an estimated contribution and shared damage is not multiplied by five',()=>{
  const f=fixture(),pool=candidates(f.box,f.characters,f.data,'power'),source=pool[0];
  const skill={condition:{type:'specialreceived',team:'enemy',count:2},effects:[{effect:'damage',type:'atk',amount:10,targeting:{targets:['enemies']},spread:true}]};
  const result=rumbleEXPotential(source,skill,pool.slice(0,5),pool.slice(0,5),f.data);assert.ok(result>0);
  assert.equal(rumbleEXPotential(source,{...skill,condition:{type:'unsupported'}},pool.slice(0,5),pool.slice(0,5),f.data),0);
  const leader=gpLeader(source,f.data,'power')!;leader.burst={effects:skill.effects};const spread=gpBurstValue(leader,pool.slice(0,5),f.data);leader.burst={effects:[{...skill.effects[0],spread:false}]};assert.equal(gpBurstValue(leader,pool.slice(0,5),f.data),spread*5);
});
