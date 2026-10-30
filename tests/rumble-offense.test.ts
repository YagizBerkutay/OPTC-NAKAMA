import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidates,plan,type PlannerData,type PlannerUnit} from '../src/planning';
import {newOwned,type Character,type RumbleEffect,type RumbleSkill} from '../src/model';
import {makeRumbleContext} from '../src/rumble-planner';

const damage=(amount=2500):RumbleEffect=>({effect:'damage',type:'fixed',amount,targeting:{targets:['enemies']}});
const support:RumbleEffect={effect:'buff',attributes:['ATK','Special CT','DEF'],level:8,duration:30,targeting:{targets:['crew']}};
function fixture(skills:RumbleSkill[]){
  const characters:Character[]=skills.map((_,i)=>({id:String(i+1),name:'Unit '+(i+1),types:['STR'],classes:['Fighter'],stars:'6',cost:20,maxLevel:99,hp:3000,atk:1800,rcv:300,global:true,captain:'',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
  const units:Record<string,PlannerUnit>=Object.fromEntries(characters.map((c,i)=>[c.id,{families:[c.id],captain:'',special:'',cooldown:[15,10],limit:[],llb:[],evolutions:[],rumble:{cost:20,stats:{def:100,spd:100},ability:[{effects:[]}],special:[skills[i]],llbability:[],llbspecial:[],resilience:[]}}]));
  const data:PlannerData={metadata:{source:'fixture',url:'https://example.com',sha:'fixture',builtAt:''},units,locations:{}};
  const box=characters.map(c=>({...newOwned(c.id),level:99,rumbleAbility:5,rumbleSpecial:10}));
  const pool=candidates(box,characters,data,'current');return {characters,box,data,pool,ctx:()=>makeRumbleContext(pool,data,'attack')};
}
test('support loops lose to a feasible damaging core in all three scenarios, while useful supports survive',()=>{
  const f=fixture([...Array.from({length:5},()=>({cooldown:25,effects:[support,{effect:'recharge',type:'Special CT',amount:30,targeting:{targets:['crew']}}]})),...Array.from({length:3},()=>({cooldown:25,effects:[damage(4000)]}))]);
  const before=structuredClone(f.box),groups=plan({kind:'rumble',...f,costLimit:100});
  for(const group of groups){const t=group.teams[0];assert.ok(t.offense!.directSources>=2);assert.ok(t.members.some(m=>Number(m.character.id)<=5),'beneficial support is retained');assert.equal(t.cost,100);assert.equal(t.members.length,5);assert.ok(t.offense!.cycleIndex>70);}
  assert.deepEqual(f.box,before);
});
test('cooldown, target coverage, repeats and chance affect direct special throughput',()=>{
  const f=fixture([{cooldown:20,effects:[damage()]},{cooldown:50,effects:[damage()]},{cooldown:20,effects:[{...damage(),targeting:{targets:['enemies'],count:1}}]},{cooldown:20,effects:[{...damage(),repeat:2}]},{cooldown:20,effects:[{...damage(),chance:25}]}]);
  const ctx=f.ctx(),index=(i:number)=>ctx.offense([f.pool[i]]).cycleIndex;
  assert.ok(index(0)>index(1));assert.ok(index(0)>index(2));assert.ok(Math.abs(index(3)-2*index(0))<.2);assert.ok(index(4)<index(0)/3);assert.ok(ctx.score([f.pool[0]])>ctx.score([f.pool[1]]));
});
test('shared damage is not multiplied by target count and random direct damage is supported',()=>{
  const f=fixture([{cooldown:30,effects:[{...damage(),spread:true}]},{cooldown:30,effects:[{...damage(),targeting:{targets:['enemies'],count:1}}]},{cooldown:30,effects:[{effect:'damage',type:'random',amountrange:[2000,3000],targeting:{targets:['enemies'],count:1}}]}]);
  const ctx=f.ctx();assert.equal(ctx.offense([f.pool[0]]).cycleIndex,ctx.offense([f.pool[1]]).cycleIndex);assert.equal(ctx.offense([f.pool[0]]).areaSources,0);assert.equal(ctx.offense([f.pool[2]]).directSources,1);
});
test('HP cuts, DoT, healing, binding and CT recharge cannot masquerade as direct finishers',()=>{
  const f=fixture([{cooldown:30,effects:[{...damage(50),type:'cut'},{effect:'damage',type:'time',level:3,duration:30,targeting:{targets:['enemies']}}]},...Array.from({length:4},()=>({cooldown:20,effects:[support,{effect:'recharge',type:'Special CT',amount:50,targeting:{targets:['crew']}},{effect:'hinderance',attributes:['Action Bind'],duration:10,targeting:{targets:['enemies']}}]}))]);
  const o=f.ctx().offense(f.pool);assert.equal(o.directSources,0);assert.equal(o.cutSources,1);assert.equal(o.dotSources,1);assert.equal(o.risk,'high');
  assert.ok(plan({kind:'rumble',...f,costLimit:100})[0].teams[0].warnings.some(w=>w.includes('süre riski yüksek')));
});
test('unknown combat/mode/target restrictions are excluded, but actual crew conditions unlock damage',()=>{
  const f=fixture([{cooldown:30,effects:[{...damage(),condition:{type:'mode',mode:'Assault Rumble'}}]},{cooldown:30,effects:[{...damage(),condition:{type:'stat',stat:'HP',comparator:'below',count:50}}]},{cooldown:30,effects:[{...damage(),targeting:{targets:['enemies'],classes:['Fighter']}}]},{cooldown:30,effects:[{...damage(),condition:{type:'crew',composition:true,comparator:'more',count:6,targets:['Fighter']}}]},...Array.from({length:2},()=>({cooldown:30,effects:[support]}))]);
  const ctx=f.ctx();assert.equal(ctx.offense(f.pool.slice(0,5)).directSources,0);assert.equal(ctx.offense(f.pool.slice(0,5),f.pool).directSources,1);assert.equal(ctx.offense(f.pool.slice(0,3)).members.reduce((n,m)=>n+m.uncertain,0),3);
});
test('a bench damage dealer does not conceal a support-only starting five',()=>{
  const f=fixture([...Array.from({length:5},()=>({cooldown:30,effects:[support]})),{cooldown:20,effects:[damage(10000)]}]);
  const ctx=f.ctx();assert.equal(ctx.offense(f.pool.slice(0,5),f.pool).directSources,0);assert.equal(ctx.offense(f.pool.slice(0,5),f.pool).risk,'high');assert.ok(ctx.score([...f.pool.slice(0,4),f.pool[5]],f.pool)>ctx.score(f.pool.slice(0,5),f.pool));
});
test('strength matters: one substantial finisher beats two negligible damage sources',()=>{
  const f=fixture([{cooldown:20,effects:[damage(12000)]},{cooldown:30,effects:[damage(10)]},{cooldown:30,effects:[damage(10)]},...Array.from({length:4},()=>({cooldown:30,effects:[support]}))]);
  const ctx=f.ctx(),strong=[f.pool[0],...f.pool.slice(3)],weak=[f.pool[1],f.pool[2],...f.pool.slice(3,6)];assert.ok(ctx.score(strong)>ctx.score(weak));assert.equal(ctx.offense(weak).risk,'high');
});
test('CT/ATK support scores higher when its target includes the actual ATK damage carrier',()=>{
  const f=fixture([{cooldown:30,effects:[{effect:'damage',type:'atk',amount:3,targeting:{targets:['enemies']}}]},...Array.from({length:4},()=>({cooldown:30,effects:[support]}))]);
  f.pool[0].character.types=['DEX'];
  const ctx=f.ctx(),team=f.pool;
  f.data.units['2'].rumble!.ability=[{effects:[{...support,targeting:{targets:['DEX']}}]}];const matching=f.ctx().score(team);
  f.data.units['2'].rumble!.ability=[{effects:[{...support,targeting:{targets:['STR'],count:1}}]}];const nonCarrier=f.ctx().score(team);
  assert.ok(matching>nonCarrier);assert.equal(ctx.offense(team).directSources,1);
});
test('LLB special unlock uses the selected skill without changing the owned record',()=>{
  const f=fixture([{cooldown:40,effects:[support]}]);f.data.units['1'].llb=[{rSpecial:true}];f.data.units['1'].rumble!.llbspecial=[{cooldown:20,effects:[damage(8000)]}];
  assert.equal(f.ctx().offense(f.pool).directSources,0);f.pool[0].owned.llb=1;
  assert.equal(f.ctx().offense(f.pool).directSources,1);assert.equal(f.ctx().offense(f.pool).members[0].cooldown,20);assert.equal(f.box[0].llb,0);
});
test('whole-special unknown conditions exclude damage and zero-chance effects count no ready source',()=>{
  const f=fixture([{cooldown:20,condition:{type:'stat',stat:'HP',comparator:'below',count:50},effects:[damage(12000)]},{cooldown:20,effects:[{...damage(12000),chance:0}]}]);
  assert.equal(f.ctx().offense(f.pool).directSources,0);assert.equal(f.ctx().offense(f.pool).cycleIndex,0);
});
test('limited ally CT targets honor their stat priority instead of borrowing a different carrier',()=>{
  const f=fixture([{cooldown:30,effects:[damage()]},{cooldown:30,effects:[{effect:'recharge',type:'Special CT',amount:50,targeting:{targets:['crew'],count:1,stat:'ATK',priority:'highest'}}]},{cooldown:30,effects:[]}]);
  f.pool[0].attack=3000;f.pool[2].attack=500;
  const matching=f.ctx().score(f.pool);f.data.units['2'].rumble!.special[0].effects![0].targeting!.priority='lowest';
  const nonCarrier=f.ctx().score(f.pool);assert.ok(matching>nonCarrier);
});
