import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {newOwned,emptyState,validateState,type Boss,type Character,type Owned} from '../src/model';
import {candidates,createPlannerSession,plan,type PlannerData,type PlanRequest,type PlanTeam,type PlanGroup} from '../src/planning';
import {evaluatePve} from '../src/engine';
import {makeCombatHooks} from '../src/pve-combat';
import {bossTimeline} from '../src/boss-timeline';
import type {Encounter} from '../src/boss-library';
import {parseEffects} from '../src/planning';
import {inspectSkills,applyAuxiliary} from '../src/skill-analysis';
import {chargeFor,eventStats,kizunaBoss,kizunaCrewCharge,kizunaMember,kizunaProblem,kizunaReport,legacyKizunaHP,newKizunaBonus,newKizunaSetup,rankKizunaTeams,validateKizunaSetup} from '../src/kizuna';

function fixture(){
 const characters:Character[]=Array.from({length:6},(_,i)=>({id:String(i+1),name:'Test '+(i+1),types:['STR'],classes:['Fighter'],stars:'5',cost:20,maxLevel:99,hp:1000,atk:1000,rcv:200,global:true,captain:'Boosts ATK of all characters by 2x.',special:'',specialName:'',support:'',sailor:'',limit:'',llb:'',rumble:null}));
 const data:PlannerData={metadata:{source:'fixture',url:'fixture',sha:'test',builtAt:'2026-10-21'},locations:{},units:Object.fromEntries(characters.map(c=>[c.id,{captain:c.captain,special:'',cooldown:[10,10],limit:[],llb:[],evolutions:[],rumble:null,families:['test-'+c.id]}]))};
 const box:Owned[]=characters.map(c=>({...newOwned(c.id),level:99,cooldown:10,readyTurn:0}));
 const boss:Boss={id:'kizuna-fixture',name:'Kizuna fixture',source:'fixture',training:false,restrictions:{status:'verified',source:'fixture',text:'No character restrictions',quest:'fixture',difficulty:10,warnings:[]},stages:[{id:'one',name:'Battle 1',battleNumber:1,turn:0,requirements:[],hp:100000000,enemyDefense:0,enemyAttack:0,enemyType:'DEX'}]};
 const setup={...newKizunaSetup(),event:'Test season',variant:'Normal DEX 10★',source:'Global test evidence',profileId:boss.id,confirmed:true,enemyType:'DEX',level:31,levelMin:31,levelMax:40,maxHP:'100000000',bonusesConfirmed:true,statOrder:'after-flat' as const,rewardSource:'Fixture: after flat stats, rewards multiply',rewardStack:'multiply' as const};
 const crew=candidates(box,characters,data,'power').map(m=>({...m,captainText:'',owned:{...m.owned,ability:{...m.owned.ability,verified:true}}}));
 return {characters,data,box,boss,setup,crew};
}

test('left-column Bind cannot be removed by an already bound special user',()=>{
 const {crew,boss}=fixture();const stage={...boss.stages[0],requirements:[{mechanic:'bind' as const,turns:7}],events:[{trigger:'preemptive' as const,label:'PREEMPTIVE',text:'7 turn(s) Left-Column Bind',requirements:[{mechanic:'bind' as const,turns:7}]}]};
 const members=crew.map((m,i)=>({...m,owned:{...m.owned,ability:{...m.owned.ability,effects:i===0?[{mechanic:'bind' as const,turns:7}]:[]}}}));
 assert.ok(evaluatePve(members,{...boss,stages:[stage]}).missing.length);
 members[1].owned.ability.effects=[{mechanic:'bind',turns:7}];assert.equal(evaluatePve(members,{...boss,stages:[stage]}).missing.length,0);
});

test('crew HP alternatives apply the active branch before selecting specials',()=>{
 const {crew,boss,data}=fixture();const stage={...boss.stages[0],hp:1,requirements:[],events:[{trigger:'hp' as const,label:'Crew HP below 70%',text:'6 turn(s) ATK Down',requirements:[{mechanic:'atkDown' as const,turns:6}]},{trigger:'hp' as const,label:'Crew HP at least 70%',text:'3 turn(s) Paralysis',requirements:[{mechanic:'paralysis' as const,turns:3}]}]};
 data.units[crew[0].character.id].captain="Reduces crew's current HP by 50% at the start of the fight.";crew[0].captainText=data.units[crew[0].character.id].captain as string;
 const target={...boss,stages:[stage]},hooks=makeCombatHooks(crew,target,data),r=evaluatePve(crew,target,{combat:hooks});
 assert.ok(r.missing.some(s=>s.includes('ATK Down')));assert.ok(!r.missing.some(s=>s.includes('Paralysis')));
 const h=makeCombatHooks(crew.map(m=>({...m,captainText:''})),target,data),full=evaluatePve(crew,target,{combat:h});assert.ok(full.missing.some(s=>s.includes('Paralysis')));assert.ok(!full.missing.some(s=>s.includes('ATK Down')));
});

test('enemy opening HP cut reaches the following crew-HP branch',()=>{
 const {crew,boss,data}=fixture(),first={...boss.stages[0],hp:1,events:[{trigger:'preemptive' as const,label:'PREEMPTIVE',text:"Reduce crew's current HP by 50%",requirements:[]}]},last={...first,id:'last',name:'Battle 3',battleNumber:3,turn:1,events:[{trigger:'hp' as const,label:'Crew HP below 70%',text:'6 turn(s) ATK Down',requirements:[{mechanic:'atkDown' as const,turns:6}]},{trigger:'hp' as const,label:'Crew HP at least 70%',text:'',requirements:[]}]};
 const target={...boss,stages:[first,last]},h=makeCombatHooks(crew,target,data),r=evaluatePve(crew,target,{combat:h});assert.equal(r.combatWindows?.[0].hpAttack,3000);assert.ok(r.missing.some(s=>s.includes('ATK Down')));
});

test('an inactive NAO interruption does not become an unconditional full-HP revival',()=>{
 const {crew,boss,data}=fixture(),stage={...boss.stages[0],hp:1,normalAttackOnly:true,events:[{trigger:'preemptive' as const,label:'PREEMPTIVE',text:'Non-Normal Attacks deal 1 damage',requirements:[]},{trigger:'interrupt' as const,label:'NAO etkin değilse · her seferinde',text:'Full HP Recovery\n99 turn(s) Silence',requirements:[]}]};
 for(const source of ['https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17','MuMu · Global Koala doğrulanmış seviye rehberi']){const target={...boss,source,stages:[stage]},h=makeCombatHooks(crew,target,data),r=evaluatePve(crew,target,{combat:h});assert.ok(!r.combatWindows?.[0].issues.some(s=>/Canlanma|karşı saldırı koşulları/.test(s)));assert.equal(r.combatWindows?.[0].enemyRemainingHP,0);}
});

test('damage nullification is a removable mandatory defense, never positive normal damage',()=>{
 const {crew,boss,data}=fixture(),core=createRequire(import.meta.url)('../electron/boss-behavior-core.cjs');
 const effects=core.durationEffects('2 turn(s) Damage Nullification').effects;assert.equal(effects.length,1);
 const stage={...boss.stages[0],hp:1,requirements:effects,events:[{trigger:'preemptive' as const,label:'PREEMPTIVE',text:'2 turn(s) Damage Nullification',requirements:effects}]},hooks=makeCombatHooks(crew,{...boss,stages:[stage]},data);
 const blocked=hooks.step(stage,[],hooks.initial,effects).window;assert.equal(blocked.damageHigh,0);assert.equal(blocked.status,'blocked');assert.deepEqual(parseEffects("Reduces enemies' Damage Nullification duration by 2 turns."),effects);
});

test('slot-specific enemy reduction is applied to matching slots and is not removable as a percent shield',()=>{
 const {crew,boss,data}=fixture(),core=createRequire(import.meta.url)('../electron/boss-behavior-core.cjs');
 const text='2 turn(s) Slot Damage Reduction 50% for STR DEX QCK PSY INT';assert.equal(core.durationEffects(text).effects.length,0);
 const make=(notes:string)=>{const stage={...boss.stages[0],notes};const h=makeCombatHooks(crew,{...boss,stages:[stage]},data);return h.step(stage,[],h.initial,[]).window;};
 const plain=make('Change all Slots to [STR] Slots'),reduced=make('Change all Slots to [STR] Slots\n'+text);assert.ok(reduced.damageHigh<=Math.ceil(plain.damageHigh*.5));
});

test('Kizuna cannot call a crew unblocked while its required slot barrier is unresolved',()=>{
 const {crew,boss,data}=fixture(),stage={...boss.stages[0],hp:undefined,notes:'Change all Slots to [RCV] Slots\n2 turn(s) Slot Barrier (DEX 1 time(s))'},target={...boss,stages:[stage]};
 const h=makeCombatHooks(crew,target,data,undefined,true,true),blocked=h.step(stage,[],h.initial,[]).window;assert.equal(blocked.status,'blocked');
});

test('Kizuna keeps the weak converter and its real DEX companion together to solve the slot barrier',()=>{
 const {characters,data,box,boss,setup}=fixture();
 for(const [id,type,special]of [['7','DEX',''],['8','STR','Changes orbs of adjacent characters into Matching orbs.']]){const c={...characters[0],id,name:'Barrier '+id,types:[type],atk:10,special};characters.push(c);box.push({...newOwned(id),level:99,cooldown:0,readyTurn:0});data.units[id]={captain:c.captain,special,cooldown:[0,0],limit:[],llb:[],evolutions:[],rumble:null,families:['barrier-'+id]};}
 const stage={...boss.stages[0],hp:1,notes:'Change all Slots to [RCV] Slots\n2 turn(s) Slot Barrier (DEX 1 time(s))'},target={...boss,stages:[stage]};
 const result=plan({kind:'kizuna',kizuna:{...setup,maxHP:'1'},box,characters,data,boss:target,scenario:'power',sockets:0})[0];
 assert.ok(result.teams.length);assert.ok(result.teams.some(t=>t.combat?.status!=='blocked'&&t.members.some(m=>m.character.id==='7')&&t.members.some(m=>m.character.id==='8')&&t.combat?.windows[0].barriers?.every(b=>b.status!=='conditional')));
});

test('Kizuna search keeps counters for the crew-HP branch even when many stronger cards have no answer',()=>{
 const {characters,data,box,boss,setup}=fixture();
 for(let i=10;i<42;i++){const id=String(i),c={...characters[0],id,name:'Strong filler '+id,atk:20000};characters.push(c);box.push({...newOwned(id),level:99,cooldown:0,readyTurn:0});data.units[id]={captain:c.captain,special:'',cooldown:[0,0],limit:[],llb:[],evolutions:[],rumble:null,families:['filler-'+id]};}
 for(const [id,special]of [['100',"Reduces enemies' Damage Nullification duration by 1 turn."],['101',"Reduces enemies' Increased Defense duration by 2 turns."],['102','Reduces ATK Down duration by 4 turns.']]){const c={...characters[0],id,name:'Branch counter '+id,atk:1,captain:'',special};characters.push(c);box.push({...newOwned(id),level:99,cooldown:0,readyTurn:0});data.units[id]={captain:'',special,cooldown:[0,0],limit:[],llb:[],evolutions:[],rumble:null,families:['counter-'+id]};}
 const requirements=[{mechanic:'damageNullification' as const,turns:1},{mechanic:'defenseUp' as const,turns:2},{mechanic:'atkDown' as const,turns:4}];
 const target={...boss,stages:[{...boss.stages[0],hp:1,events:[{trigger:'preemptive' as const,label:'PREEMPTIVE',text:"Reduce crew's current HP by 50%",requirements:[]}]},{...boss.stages[0],id:'two',name:'Battle 2',battleNumber:2,turn:1,hp:1,events:[{trigger:'hp' as const,label:'Crew HP below 70%',text:'1 turn(s) Damage Nullification\n2 turn(s) DEF Up\n4 turn(s) ATK Down',requirements},{trigger:'hp' as const,label:'Crew HP at least 70%',text:'Full Immunity',requirements:[]}]}]};
 const teams=plan({kind:'kizuna',kizuna:{...setup,maxHP:'1'},box,characters,data,boss:target,scenario:'power',sockets:0})[0].teams;
 assert.ok(teams.some(t=>!t.missing?.length&&t.combat?.status!=='blocked'&&['100','101','102'].every(id=>t.members.some(m=>m.character.id===id))));
});

test('verified Kizuna opening reduction unlocks only the matching VS form and Super Switch counter',()=>{
 const {crew,boss,data}=fixture();crew[0].character.classes=['Free Spirit'];data.units[crew[0].character.id].abilities={VSSpecial:{character1:'Reduces Bind duration by 7 turns.',character2:'Reduces Paralysis duration by 20 turns.'},VSCondition:'When the crew consumes/uses 10 [TND], [RCV] or [SEMLA] orbs with normal attacks.',swap:{base:'Reduces Bind duration by 2 turns.',super:'Reduces Bind duration by 7 turns.',superTurns:10}};
 const source={...boss,source:'https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17',stages:[{...boss.stages[0],events:[{trigger:'preemptive' as const,label:'PREEMPTIVE',text:'Reduce Special Charge by 10 turns for Free Spirit, Cerebral, Powerhouse; Super Switch requirement reduction 10; VS requirement reduction 10',requirements:[]}]}]};
 const normal=inspectSkills(crew,data,[],source);assert.ok(normal.actions.some(a=>a.name==='VS special'&&a.effects[0].mechanic==='bind'));assert.ok(normal.actions.some(a=>a.name==='Super Switch'&&a.oneUse));assert.ok(!normal.actions.some(a=>a.effects.some(e=>e.mechanic==='paralysis')));
 const conditional={...source,stages:[{...source.stages[0],events:[{...source.stages[0].events[0],trigger:'unknown' as const,text:'If at least 2 Revolutionary Army: '+source.stages[0].events[0].text}]}]};assert.ok(!inspectSkills(crew,data,[],conditional).actions.some(a=>a.name==='VS special'));
 data.units[crew[0].character.id].tags=['Revolutionary Army'];data.units[crew[1].character.id].tags=['Revolutionary Army'];assert.ok(inspectSkills(crew,data,[],conditional).actions.some(a=>a.name==='VS special'));
 crew[0].character.classes=['Fighter'];assert.ok(!inspectSkills(crew,data,[],source).actions.some(a=>a.name==='VS special'));
});

test('an advanced active ability cannot remove Bind from its own bound source position',()=>{
 const {crew,boss,data}=fixture();data.units[crew[0].character.id].abilities={superSpecial:'Reduces Bind duration by 7 turns.',superSpecialCriteria:'This character must be captain and your crew must consist of any 1 of the following, excluding Supports and counting only 1 per unit: Test 2.'};
 crew[1].families=['Test2'];const source={...boss,stages:[{...boss.stages[0],requirements:[{mechanic:'bind' as const,turns:7}],events:[{trigger:'preemptive' as const,label:'PREEMPTIVE',text:'7 turn(s) Left-Column Bind',requirements:[{mechanic:'bind' as const,turns:7}]}]}]};
 const actions=inspectSkills(crew,data,[],source).actions;assert.ok(actions.length);assert.equal(applyAuxiliary(source,actions).boss.stages[0].requirements.length,1);
});

test('source opening orb boost requires two active tags, lasts five turns, and reaches the damage model',()=>{
 const {crew,boss,data}=fixture();for(const m of crew)m.character.classes=['Free Spirit'];for(const m of crew.slice(0,2))data.units[m.character.id].tags=['Revolutionary Army'];
 const source={...boss,source:'https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17',stages:[{...boss.stages[0],events:[{trigger:'unknown' as const,label:'If at least 2 Revolutionary Army',text:'If at least 2 Revolutionary Army: Reduce Special Charge by 10 turns for Free Spirit, Cerebral, Powerhouse; Super Switch requirement reduction 10; VS requirement reduction 10\nIf at least 2 Revolutionary Army: Boosts Orb Effects of Free Spirit, Cerebral, Powerhouse by 3x for 5 turns',requirements:[]}]}]};
 const target=kizunaCrewCharge(source,crew,data),plain=makeCombatHooks(crew,source,data),boosted=makeCombatHooks(crew,target,data),baseline=plain.step(source.stages[0],[],plain.initial,[]).window;
 const first=boosted.step(target.stages[0],[],boosted.initial,[]);assert.ok(first.window.damageHigh>=baseline.damageHigh*2.99);assert.ok(first.state.buffs.some(b=>b.expires===5));
 const expired=boosted.step({...target.stages[0],id:'later',turn:5,plannedAbilities:[]},[],first.state,[]);assert.equal(expired.window.damageHigh,baseline.damageHigh);
});

test('Kizuna setup is optional in legacy state and survives validated save/export without changing box',()=>{
 const {characters,setup}=fixture(),ids=new Set(characters.map(c=>c.id)),state=emptyState();
 const before=structuredClone(state);assert.deepEqual(validateState(state,ids),before);
 state.kizuna=setup;const saved=validateState(JSON.parse(JSON.stringify(state)),ids);
 assert.deepEqual(saved.kizuna,setup);assert.deepEqual(saved.box,before.box);
 for(const value of [{...setup,level:NaN},{...setup,remainingHP:'1e99'},{...setup,statOrder:'invented'},{...setup,bonuses:[{...newKizunaBonus('999'),atk:2}]}])assert.throws(()=>validateKizunaSetup(value,ids));
});

test('large exact HP stays a decimal string; unsupported legacy values and imprecise inputs reject',()=>{
 const {characters,setup}=fixture(),huge='900719925474099312345678901';
 assert.equal(validateKizunaSetup({...setup,maxHP:huge},new Set(characters.map(c=>c.id))).maxHP,huge);
 assert.equal(legacyKizunaHP('1000000000000000'),1000000000000000);
 for(const value of [huge,'1.5M','123,456','1e9','0','-1'])assert.throws(()=>legacyKizunaHP(value));
});

test('SOS changes only remaining HP, retaining level-31 guide and original setup; invalid ranges and HP reject',()=>{
 const {boss,setup}=fixture();setup.access='sos';setup.remainingHP='1234';setup.observedAt='2026-10-21T18:00:00.000Z';
 const before=structuredClone({boss,setup}),adapted=kizunaBoss(boss,setup);
 assert.equal(adapted.stages[0].hp,1234);assert.equal(setup.level,31);assert.equal(setup.maxHP,'100000000');assert.deepEqual({boss,setup},before);
 assert.match(kizunaProblem({...setup,level:30},boss),/aralığının dışında/);
 assert.match(kizunaProblem({...setup,maxHP:'',remainingHP:'100000001'},boss),/aşamaz/);
 assert.match(kizunaProblem({...setup,confirmed:false},boss),/eşleştiğini/);
 assert.match(kizunaProblem({...setup,profileId:'another'},boss),/eşleştiğini/);
});

test('incomplete boss text blocks planning while legacy observations without textComplete remain compatible',()=>{
 const {boss,setup}=fixture();
 const observation={observedAt:'2026-10-21T19:00:00.000Z',quest:'Kizuna fixture',difficulty:10,level:31,complete:true,pages:1,fingerprint:'fixture',warnings:[]};
 const encounter=(reading:Encounter['observation']):Encounter=>({...boss,stages:boss.stages.map(stage=>({...stage,notes:stage.notes||''})),difficulty:'10★',reviewed:'2026-10-21',notes:'fixture',observation:reading});
 const observed=encounter({...observation,textComplete:false});
 const legacy=encounter(observation);
 assert.match(kizunaProblem(setup,observed),/kayan|tamam|okun/i);
 assert.equal(kizunaProblem(setup,legacy),'');
});

test('card bonuses are exact-ID / starting-form / scope specific and do not mutate base or Support stats',()=>{
 const {crew,setup}=fixture();setup.bonuses=[{...newKizunaBonus('1'),atk:2,hp:3,rcv:2,cooldown:5,tickets:1.3,source:'Exact ID and first form',confirmed:true}];
 crew[0].owned.readyTurn=null;
 const before=structuredClone(crew[0]),m=kizunaMember(crew[0],setup);
 assert.equal(m.attack,1000);assert.equal(m.health,1000);assert.deepEqual(crew[0],before);
 assert.deepEqual(eventStats(m),{atk:2,hp:3,rcv:2,cooldown:5,tickets:1.3,tokens:1});
 assert.equal(eventStats({...m,friend:true}).atk,1);
 assert.equal(eventStats(kizunaMember({...crew[0],character:{...crew[0].character,id:'7'}},setup)).atk,1);
 assert.equal(eventStats(kizunaMember({...crew[0],owned:{...crew[0].owned,pveForm:'character2'}},setup)).atk,1);
 assert.equal(eventStats(kizunaMember(crew[0],{...setup,bonusesConfirmed:false})).atk,1);
 assert.equal(eventStats(kizunaMember(crew[0],{...setup,statOrder:'unknown'})).atk,1);
 assert.equal(eventStats(kizunaMember(crew[0],{...setup,rewardSource:''})).atk,1);
 assert.equal(eventStats(kizunaMember({...crew[0],owned:{...crew[0].owned,readyTurn:0}},setup)).cooldown,0);
 assert.throws(()=>validateKizunaSetup({...setup,bonuses:[...setup.bonuses,{...setup.bonuses[0],form:'any'}]},new Set(['1'])),/çakışıyor/);
});

test('event ATK and HP apply once in real combat; hand-calculated chain oracle includes reordering',()=>{
 const {crew,boss,data,setup}=fixture();setup.bonuses=[{...newKizunaBonus('1'),atk:2,hp:3,source:'Fixture effect',confirmed:true}];
 const members=crew.map(m=>kizunaMember(m,setup)),hooks=makeCombatHooks(members,boss,data),result=hooks.step(boss.stages[0],[],hooks.initial,[]).window;
 // Five 1900 low hits at chains 1,1.3,1.6,1.9,2.2; boosted 3800 at 2.5.
 assert.equal(result.damageLow,24700);assert.equal(result.damageHigh,98800);
 assert.equal(hooks.report([result]).maxHP,8000);
});

test('event ATK affects ATK specials without captain or orb multipliers',()=>{
 const {crew,boss,data,setup}=fixture();setup.bonuses=[{...newKizunaBonus('1'),atk:2,source:'Fixture',confirmed:true}];
 crew[0].specialText="Deals 100x character's ATK in non-type damage to all enemies.";
 const members=crew.map(m=>kizunaMember(m,setup)),hooks=makeCombatHooks(members,boss,data);
 assert.equal(hooks.step(boss.stages[0],[0],hooks.initial,[]).window.specialDamage,200000);
});

test('Battle 1 charge targets classes/types, is not fake elapsed time and is not repeated on later windows',()=>{
 const {crew,boss}=fixture(),members=crew.map(m=>({character:m.character,specialText:'Reduces Bind duration by 3 turns.',owned:{...m.owned,cooldown:10,readyTurn:10,ability:{...m.owned.ability,verified:true,effects:m===crew[0]?[{mechanic:'bind' as const,turns:3}]:[]}}}));
 const first={...boss.stages[0],requirements:[{mechanic:'bind' as const,turns:3}],specialCharge:[{amount:15,types:[],classes:['Fighter']}],events:[{trigger:'turn' as const,battleTurn:2,label:'TURN 2',text:'3 turn(s) Bind',requirements:[{mechanic:'bind' as const,turns:3}]}]};
 const timeline=bossTimeline({...boss,stages:[first]}),result=evaluatePve(members,timeline);
 assert.equal(chargeFor(timeline.stages[0],crew[0].character),15);assert.equal(chargeFor(timeline.stages[1],crew[0].character),0);
 const immediate=evaluatePve(members,{...boss,stages:[{...first,events:[]}]});
 assert.equal(immediate.schedule[0].turn,0);assert.match(immediate.schedule[0].used.join(' '),/#1 /);
 // One use can solve either window, never both; the evaluator may save it.
 assert.equal(result.schedule.filter(s=>s.used.length).length,1);assert.equal(result.missing.length,1);
 members[0].character={...members[0].character,types:['DEX'],classes:['Slasher']};
 assert.ok(evaluatePve(members,{...boss,stages:[first]}).missing.length);
});

test('event starting cooldown changes ready plans without rewriting owned cooldown or startup state',()=>{
 const {characters,box,boss,data,setup}=fixture();data.units['1'].special='Reduces Bind duration by 3 turns.';
 boss.stages[0].requirements=[{mechanic:'bind',turns:3}];box.forEach(o=>o.readyTurn=null);
 setup.bonuses=[{...newKizunaBonus('1'),cooldown:10,source:'Starting CD',confirmed:true}];
 const before=structuredClone(box),[result]=plan({kind:'kizuna',kizuna:setup,boss,box,characters,data,scenario:'power'});
 assert.ok(result.teams.length);assert.ok(result.teams.some(t=>!t.missing?.length));assert.equal(result.teams[0].schedule![0].turn,0);assert.deepEqual(box,before);
 const unboosted=plan({kind:'kizuna',kizuna:{...setup,bonusesConfirmed:false},boss,box,characters,data,scenario:'power'})[0];
 assert.ok(unboosted.teams.every(t=>t.missing?.length));
});

test('unknown reward rules block only reward claims, and unverified/irrelevant rows do not invent multipliers',()=>{
 const {crew,setup}=fixture();setup.bonuses=[{...newKizunaBonus('1'),tickets:1.3,tokens:1.5,source:'Fixture',confirmed:true}];
 const members=crew.map(m=>kizunaMember(m,setup));members[1]={...members[0],friend:true};
 const team:PlanTeam={members,score:1,reasons:[],warnings:[]};
 assert.equal(kizunaReport(team,setup).tickets,1.3);assert.equal(kizunaReport(team,setup).tokens,1.5);
 assert.equal(kizunaReport(team,{...setup,rewardStack:'unknown'}).tickets,undefined);
 setup.bonuses.push({...newKizunaBonus('999'),tickets:9});assert.equal(kizunaReport(team,setup).tickets,1.3);
 const partial={...setup,bonuses:setup.bonuses.map(b=>b.id==='1'?{...b,confirmed:false}:b)};
 assert.equal(kizunaReport(team,partial).tickets,undefined);
});

test('higher reward cannot outrank a model-covered clear with a blocked battle',()=>{
 const {crew,setup}=fixture();const base={members:crew,reasons:[],warnings:[]};
 const ranked=rankKizunaTeams([{...base,score:99999,kizuna:{status:'draft',tickets:10,effects:[],warnings:[]}},{...base,score:1,kizuna:{status:'modelled',tickets:1,effects:[],warnings:[]}}],{...setup,objective:'tickets'});
 assert.equal(ranked[0].kizuna?.status,'modelled');
 const partial=rankKizunaTeams([{...base,score:99999,missing:['DEF Up'],kizuna:{status:'draft',tickets:10,effects:[],warnings:[]}},{...base,score:1,missing:[],kizuna:{status:'draft',tickets:1,effects:[],warnings:[]}}],{...setup,objective:'tickets'});
 assert.equal(partial[0].score,1);
});

test('missing Kizuna context / boss and unknown job kinds never fall through to generic teams',()=>{
 const {characters,box,data,setup}=fixture(),request={characters,box,data,scenario:'power' as const};
 assert.throws(()=>plan({...request,kind:'kizuna'}),/Kizuna/);
 assert.throws(()=>plan({...request,kind:'kizuna',kizuna:setup}),/karşılaşması eksik/);
 assert.throws(()=>plan({...request,kind:'invalid'} as unknown as PlanRequest),/Bilinmeyen/);
});

test('early Kizuna results have completed combat evaluation and carry the event report through the job session',()=>{
 const {characters,box,boss,data,setup}=fixture();boss.stages[0].hp=1;setup.maxHP='1';
 const previews:PlanGroup[]=[],solve=createPlannerSession({kind:'kizuna',kizuna:setup,boss,box,characters,data},(_category,group)=>previews.push(structuredClone(group)));
 const final=solve('power');assert.ok(previews.length);assert.ok(final.teams.length);
 assert.ok(previews.every(g=>g.provisional&&g.teams.every(t=>t.combat&&t.kizuna&&!t.missing?.length)));assert.equal(final.provisional,undefined);
});

test('ambiguous Kizuna boss heading never becomes legacy Battle 5; explicit authored stage remains readable',()=>{
 const {parseGamewith}=createRequire(import.meta.url)('../electron/gamewith-guide.cjs');
 const html='<h1>絆決戦 Test 星10</h1><h3>ボスの行動パターン</h3><table><tr><th>ﾀｰﾝ 体力</th><th>頻度 ﾀｲﾐﾝｸﾞ</th><th>内容</th></tr><tr><td>先制 -</td><td>- -</td><td>痺れ(3ターン)</td></tr></table>',url='https://xn--pck6bvfc.gamewith.jp/article/show/1';
 assert.throws(()=>parseGamewith(html,url),/Battle 5 varsayılmadı/);
 assert.equal(parseGamewith(html.replace('ボスの行動パターン','3階のギミック解説'),url).stages[0].battleNumber,3);
});

test('Super contribution permits partial final-boss damage while normal clears retain the full-HP gate',()=>{
 const {crew,boss,data,setup}=fixture();const superSetup={...setup,mode:'super' as const,remainingHP:setup.maxHP,observedAt:'2026-10-22T00:00:00Z'};
 assert.equal(kizunaProblem(superSetup,boss),'');const target=kizunaBoss(boss,superSetup),s=target.stages[0];
 const normal=makeCombatHooks(crew,target,data),superHooks=makeCombatHooks(crew,target,data,undefined,true);
 const blocked=normal.step(s,[],normal.initial,[]),partial=superHooks.step(s,[],superHooks.initial,[]);
 assert.equal(blocked.window.status,'blocked');assert.notEqual(partial.window.status,'blocked');assert.ok(partial.window.damageHigh>0);assert.ok(partial.window.damageHigh<s.hp!);assert.ok(!partial.window.issues.some(s=>s.includes('tek turda geçiş önerilemez')));
 const team={members:crew,score:1,reasons:[],warnings:[],combat:superHooks.report([partial.window])};
 const report=kizunaReport(team,superSetup);assert.equal(report.status,'draft');assert.equal(report.contribution?.high,partial.window.damageHigh);assert.equal(report.contribution?.remainingHP,100000000);
 const first={...s,id:'before',battleNumber:1},last={...s,id:'last',battleNumber:3},multi={...target,stages:[first,last]},hooks=makeCombatHooks(crew,multi,data,undefined,true);
 assert.equal(hooks.step(first,[],hooks.initial,[]).window.status,'blocked');
});
test('Super keeps disabling mechanics and pre-attack death blocked, caps contribution at observed remaining HP',()=>{
 const {crew,boss,data,setup}=fixture(),hooks=makeCombatHooks(crew,boss,data,undefined,true),stage=boss.stages[0];
 const disabled=hooks.step(stage,[],hooks.initial,[{mechanic:'bind',turns:7}]);assert.equal(disabled.window.status,'blocked');
 const dead=hooks.step(stage,[],{...hooks.initial,hp:0},[]);assert.equal(dead.window.status,'blocked');
 const superSetup={...setup,mode:'super' as const,remainingHP:'100',observedAt:'2026-10-22T00:00:00Z'},adapted=kizunaBoss(boss,superSetup);assert.equal(adapted.stages[0].hp,100);assert.equal(boss.stages[0].hp,100000000);
 const window=hooks.step(stage,[],hooks.initial,[]).window,team={members:crew,score:1,reasons:[],warnings:[],combat:hooks.report([window])};
 assert.equal(kizunaReport(team,superSetup).contribution?.high,100);
 assert.match(kizunaProblem({...superSetup,remainingHP:'100000001'},boss),/aşamaz/);
});
test('Super ranks mechanically viable crews by contribution instead of ticket or unrelated score',()=>{
 const {crew,boss,data,setup}=fixture(),superSetup={...setup,mode:'super' as const,remainingHP:setup.maxHP,observedAt:'2026-10-22T00:00:00Z'},hooks=makeCombatHooks(crew,boss,data,undefined,true),window=hooks.step(boss.stages[0],[],hooks.initial,[]).window;
 const team=(damage:number,score:number,missing:string[]=[])=>({members:crew,score,reasons:[],warnings:[],missing,combat:hooks.report([{...window,damageLow:damage,damageHigh:damage+1}])});
 const high=team(200,0),low=team(100,999999),invalid=team(999,9999999,['Bind']);
 const ranked=rankKizunaTeams([low,invalid,high],superSetup);assert.equal(ranked[0].kizuna?.contribution?.low,200);assert.equal(ranked[2].missing?.length,1);
});

test('Super Battle1 CD requires two verified active crew tags and never borrows support or name evidence',()=>{
 const {crew,boss,data}=fixture();const first={...boss.stages[0],events:[{trigger:'unknown' as const,label:'If at least 2 Revolutionary Army',sourceBattle:'Battle 1',text:'If at least 2 Revolutionary Army: Reduce Special Charge by 10 turns for Free Spirit, Cerebral, Powerhouse; Super Switch requirement reduction 10',requirements:[]}]};const source={...boss,source:'https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17',stages:[first]};
 data.units[crew[0].character.id].tags=['Revolutionary Army'];assert.equal(kizunaCrewCharge(source,crew,data),source);
 data.units[crew[1].character.id].tags=['Revolutionary Army'];const charged=kizunaCrewCharge(source,crew,data);assert.equal(charged.stages[0].specialCharge?.[0].amount,10);assert.equal(source.stages[0].specialCharge,undefined);
 assert.equal(chargeFor(charged.stages[0],{...crew[0].character,classes:['Free Spirit']}),10);assert.equal(chargeFor(charged.stages[0],crew[0].character),0);assert.equal(kizunaCrewCharge({...source,source:'unverified'},crew,data).stages[0].specialCharge,undefined);
});
