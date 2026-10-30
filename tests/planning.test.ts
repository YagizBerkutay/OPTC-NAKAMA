import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidates, captainBoost, parseEffects, plan, skillAt, specialBoosts, targetsMember, type PlannerData, type PlannerUnit } from '../src/planning';
import { newOwned, type Character } from '../src/model';
import { BOSS_LIBRARY, materialInfo } from '../src/boss-library';
import {rumbleCondition} from '../src/rumble-planner';
import {crewCriterion,inspectSkills,applyAuxiliary} from '../src/skill-analysis';
const chars: Character[] = Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1), name: `Unit ${i + 1}`, types: [i === 7 ? 'DEX' : 'STR'], classes: ['Fighter'], stars: i === 6 ? '6+' : '6', cost: 20, maxLevel: 99, hp: 3000, atk: 1000 + i * 20, rcv: 200, global: true, captain: 'Boosts ATK of [STR] and Fighter characters by 4x', special: 'Reduces Bind and Paralysis duration by 5 turns.', specialName: '', support: '', sailor: '', limit: '', llb: '', rumble: { cost: 20, stats: { spd: 100, def: 100 }, raw: '', ability: '', special: '', abilityLevels: [{ effects: [{ effect: 'buff', level: 2, attributes: ['ATK'], targeting: { targets: ['[STR]'] } }] }], specialLevels: [{ cooldown: 30, effects: [{ effect: 'damage', amount: 2500, type: 'fixed', targeting: { targets: ['enemies'] } }] }] } }));
const unit = (c: Character): PlannerUnit => ({ captain: c.captain, special: c.special, cooldown: [15, 10], limit: [], llb: [], evolutions: [], rumble: { cost: 20, stats: { spd: 100, def: 100 }, ability: c.rumble!.abilityLevels, special: c.rumble!.specialLevels, llbability: [], llbspecial: [], resilience: [] } });
const data = (): PlannerData => ({ metadata: { source: 'fixture', url: 'https://example.com', sha: 'test', builtAt: '2026-10-04' }, units: Object.fromEntries(chars.map(c => [c.id, unit(c)])), locations: {} });
const box = () => chars.slice(0, 6).map(c => newOwned(c.id));

test('Lv.100 targets retain forms and full skills, respect lower caps, and preserve actual levels', () => {
  const d = data(), cs = structuredClone(chars), b = box();
  b[0].level = 150; b[0].llb = 5;
  cs[1].stars = '4'; cs[2].maxLevel = 50;
  d.units['1'].evolutions = [{to: '7', materials: ['7-skull']}];
  d.units['1'].llb = [null, {captain: 'Boosts ATK of all characters by 5x.'}];
  const before = structuredClone(b);
  assert.equal(candidates(b, cs, d, 'current')[0].estimatedLevel, 150);
  for (const scenario of ['power', 'evolve'] as const) {
    const pool = candidates(b, cs, d, scenario);
    assert.ok(pool.every(m => m.estimatedLevel <= 100 && m.owned.level === m.estimatedLevel));
    assert.equal(pool.find(m => m.character.id === '1')!.estimatedLevel, 100);
    assert.equal(pool.find(m => m.character.id === '1')!.owned.llb, 5);
    assert.equal(pool.find(m => m.character.id === '1')!.captainText, 'Boosts ATK of all characters by 5x.');
    assert.equal(pool.find(m => m.character.id === '2')!.estimatedLevel, 99);
    assert.equal(pool.find(m => m.character.id === '3')!.estimatedLevel, 50);
    assert.equal(pool.some(m => m.character.id === '7'), scenario === 'evolve');
    if (scenario === 'evolve') assert.equal(pool.find(m => m.character.id === '7')!.estimatedLevel, 100);
  }
  assert.deepEqual(b, before);
});

test('Rumble shares cost across five active and three reserves, without changing box levels',()=>{
 const d=data(),b=chars.map(c=>newOwned(c.id)),before=structuredClone(b);
 const groups=plan({kind:'rumble',box:b,characters:chars,data:d,costLimit:160});
 for(const g of groups){const t=g.teams[0],roster=[...t.members,...t.reserves||[]];assert.equal(t.members.length,5);assert.equal(t.reserves?.length,3);assert.equal(t.cost,160);assert.equal(new Set(roster.map(m=>m.sourceId)).size,8);if(g.scenario!=='current')assert.ok(roster.every(m=>m.estimatedLevel===100));}
 assert.deepEqual(b,before);
});
test('Rumble special ally buffs and recharge affect ranking independently of damage',()=>{
 const d=data();d.units['6'].rumble!.special=[{cooldown:15,effects:[{effect:'buff',level:9,attributes:['ATK','Special CT'],duration:30,targeting:{targets:['crew']}},{effect:'recharge',type:'Special CT',amount:50,targeting:{targets:['crew']}}]}];
 const groups=plan({kind:'rumble',box:box(),characters:chars,data:d,costLimit:100});assert.ok(groups.every(g=>g.teams[0].members.some(m=>m.character.id==='6')));
});
test('Rumble composition counts reserves and tags but unknown HP/opponent conditions give no credit',()=>{
 const d=data(),p=candidates(chars.map(c=>newOwned(c.id)),chars,d,'power');for(const c of chars)d.units[c.id].tags=['Straw Hat Pirates'];
 assert.equal(rumbleCondition({type:'crew',composition:true,comparator:'more',count:6,targets:['[Straw Hat Pirates]']},p.slice(0,5),p,d),1);
 assert.equal(rumbleCondition({type:'crew',composition:true,comparator:'more',count:9,targets:['[Straw Hat Pirates]']},p.slice(0,5),p,d),0);
 assert.equal(rumbleCondition({type:'stat',stat:'HP',comparator:'below',count:50},p,p,d),0);
 assert.equal(rumbleCondition({type:'character',team:'enemies',families:['Monkey D. Luffy']},p,p,d),0);
 assert.equal(rumbleCondition({type:'time',comparator:'first',count:40},p,p,d),.4);
});
test('Super criteria require captain and partners; one-use Super cannot cover two stages',()=>{
 const d=data(),p=candidates(box(),chars,d,'power');p[1].families=['MonkeyDLuffy'];
 const criterion='This character must be captain and your crew must consist of any 1 of the following, excluding Supports and counting only 1 per unit: Monkey D. Luffy, Roronoa Zoro.';
 assert.equal(crewCriterion(criterion,p[0],p),'ready');assert.equal(crewCriterion(criterion,p[2],p),'unmet');
 d.units['1'].abilities={superSpecial:'Reduces Bind duration by 5 turns.',superSpecialCriteria:criterion,lastTap:{condition:'On the last stage with a TND orb',description:['Boosts ATK by 3x.']}};
 const inspected=inspectSkills(p,d);assert.equal(inspected.actions.length,1);assert.ok(inspected.audit.some(a=>a.name==='Last Tap'&&a.status.includes('belirsiz')));
 const result=applyAuxiliary({id:'test',name:'test',source:'test',training:true,stages:[{id:'a',name:'a',turn:5,requirements:[{mechanic:'bind',turns:5}]},{id:'b',name:'b',turn:6,requirements:[{mechanic:'bind',turns:5}]}]},inspected.actions);
 assert.equal(result.boss.stages[0].requirements.length,0);assert.equal(result.boss.stages[1].requirements[0].turns,5);
});

test('all-unknown box produces three Rumble scenarios without changing owned state', () => {
  const b = box(), before = structuredClone(b);
  const result = plan({ kind: 'rumble', box: b, characters: chars, data: data(), costLimit: 100 });
  assert.equal(result.length, 3);
  for (const group of result) { assert.ok(group.teams.length); assert.equal(group.teams[0].members.length, 5); assert.equal(group.teams[0].cost, 100); }
  assert.equal(result[0].teams[0].members[0].abilityLevel, 1);
  assert.ok(result[0].teams[0].warnings.some(w => w.includes('Lv.1')));
  assert.deepEqual(b, before);
});
test('Rumble minimum cost failure is explicit', () => {
  const result = plan({ kind: 'rumble', box: box(), characters: chars, data: data(), costLimit: 99 });
  assert.ok(result.every(g => !g.teams.length && g.diagnostic.includes('maliyet')));
});
test('bracketed Rumble targets, self targets, and classes match correctly', () => {
  const pool = candidates(box(), chars, data(), 'power');
  assert.ok(targetsMember({ targeting: { targets: ['[STR]'] } }, pool[0], pool[1]));
  assert.ok(!targetsMember({ targeting: { targets: ['[DEX]'] } }, pool[0], pool[1]));
  assert.ok(!targetsMember({ targeting: { targets: ['self'] } }, pool[0], pool[1]));
  assert.ok(targetsMember({ targeting: { targets: ['crew'], classes: ['Fighter'] } }, pool[0], pool[1]));
  assert.ok(!targetsMember({ targeting: { targets: ['crew'] }, condition: { type: 'HP' } }, pool[0], pool[1]));
});
test('skill overrides preserve original targeting and update damage and cooldown', () => {
  const skill = skillAt([{ cooldown: 30, effects: [{ effect: 'damage', amount: 2000, targeting: { targets: ['enemies'] } }] }, { cooldown: 25, effects: [{ override: { amount: 4000 } }] }], 2);
  assert.equal(skill.cooldown, 25); assert.equal(skill.effects![0].amount, 4000); assert.deepEqual(skill.effects![0].targeting, { targets: ['enemies'] });
});
test('multi-stage specials use the top stage instead of treating the array as a string', () => {
  const d = data(); d.units['1'].special = [{ description: 'Reduces Bind duration by 2 turns.', cooldown: [10, 5] }, { description: 'Reduces Bind duration by 7 turns.', cooldown: [20, 12] }];
  const pool = candidates(box(), chars, d, 'power'); assert.equal(pool[0].effects[0].turns, 7); assert.ok(pool[0].notes.some(n => n.includes('Çok kademeli')));
});
test('special buff scope and conditional ceiling are not confused with universal boosts', () => {
  assert.equal(specialBoosts('Boosts ATK of [STR] characters by 2.5x for 1 turn.', chars[0]).atk, 2.5);
  assert.equal(specialBoosts('Boosts ATK of Shooter characters by 3x for 1 turn.', chars[0]).atk, 1);
  assert.equal(specialBoosts('If your Captain is STR, boosts ATK of all characters by 4x for 1 turn.', chars[0]).atk, 1);
  assert.equal(specialBoosts('Boosts Orb Effects of Fighter characters by 2.25x.', chars[0]).orb, 2.25);
});
test('power mode never evolves; evolution mode traverses only reachable Global forms and stops cycles', () => {
  const d = data(); d.units['1'].evolutions = [{ to: '7', materials: ['7-skull', '7-skull'] }]; d.units['7'].evolutions = [{ to: '1', materials: [] }];
  const current = candidates(box(), chars, d, 'current'), power = candidates(box(), chars, d, 'power'), evolved = candidates(box(), chars, d, 'evolve');
  assert.ok(current.every(m => !m.path.length)); assert.ok(power.every(m => !m.path.length));
  assert.equal(evolved.filter(m => m.sourceId === '1').length, 2); assert.equal(evolved.find(m => m.character.id === '7')!.sourceId, '1');
  assert.ok(!evolved.some(m => m.character.id === '8'));
  const results = plan({ kind: 'teams', box: box(), characters: chars, data: d, category: 'STR' });
  for (const g of results) for (const team of g.teams) { const members = team.members.filter(m => !m.friend); assert.equal(new Set(members.map(m => m.sourceId)).size, 5); assert.equal(new Set(members.map(m => m.character.id)).size, 5); }
  const unknown = structuredClone(chars); unknown[6].global = null; assert.ok(!candidates(box(), unknown, d, 'evolve').some(m => m.character.id === '7'));
});
test('type and class recommendations are strict and shortages report source counts', () => {
  const result = plan({ kind: 'teams', box: box(), characters: chars, data: data(), category: 'Fighter' });
  assert.ok(result.every(g => g.teams.length));
  for (const g of result) assert.ok(g.teams[0].members.every(m => m.character.classes.includes('Fighter')));
  for (const g of result.filter(g=>g.scenario!=='current')) assert.ok(g.teams.every(t=>t.members.every(m=>m.estimatedLevel===100)));
  const missing = plan({ kind: 'teams', box: box(), characters: chars, data: data(), category: 'DEX' });
  assert.ok(missing.every(g => !g.teams.length && g.diagnostic.includes('0 farklı')));
});
test('different versions and dual units cannot share a character identity in owned slots', () => {
  const d = data(); d.units['1'].families = ['Luffy']; d.units['2'].families = ['Luffy']; d.units['3'].families = ['Luffy', 'Ace'];
  const b = chars.map(c => newOwned(c.id));
  for (const kind of ['teams', 'rumble'] as const) for (const group of plan({ kind, box: b, characters: chars, data: d })) {
    assert.ok(group.teams.length);
    for (const team of group.teams) {
      const families = team.members.filter(m => !m.friend).flatMap(m => m.families);
      assert.equal(new Set(families).size, families.length);
    }
  }
});
test('mechanic parser distinguishes special/slot bind, self-only, conditional and delayed effects', () => {
  assert.deepEqual(parseEffects('Reduces Bind and Paralysis duration by 5 turns.'), [{ mechanic: 'bind', turns: 5 }, { mechanic: 'paralysis', turns: 5 }]);
  assert.deepEqual(parseEffects('Reduces Special Bind duration by 3 turns.'), [{ mechanic: 'specialBind', turns: 3 }]);
  assert.deepEqual(parseEffects('Reduces Slot Bind duration by 5 turns.'), []);
  assert.deepEqual(parseEffects('If your Captain is STR, reduces Bind duration by 9 turns.'), []);
  assert.deepEqual(parseEffects('After 1 turn, reduces Bind duration by 9 turns.'), []);
  assert.deepEqual(parseEffects('Reduces Special Bind duration on this character by 10 turns.'), []);
  assert.deepEqual(parseEffects("Reduces enemies' Percent Damage Reduction and Threshold Damage Reduction duration by 6 turns."), [{ mechanic: 'threshold', turns: 6 }, { mechanic: 'damageReduction', turns: 6 }]);
});
test('captain base scope excludes conditional ceilings and unrelated classes', () => {
  assert.equal(captainBoost('Boosts ATK of [STR] characters by 4.5x, by 5.5x instead if HP is below 30%.', chars[0]), 4.5);
  assert.equal(captainBoost('Boosts ATK of Shooter characters by 5.5x.', chars[0]), 1);
  assert.equal(captainBoost('If crew contains 6 STR characters, boosts ATK of all characters by 6x.', chars[0]), 1);
});
test('ready boss stages are sourced and automatically feed the plan', () => {
  const boss = BOSS_LIBRARY.find(b => b.id === 'arena-mihawk-11')!;
  assert.equal(boss.stages[2].requirements.find(e => e.mechanic === 'defenseUp')!.turns, 10);
  assert.ok(BOSS_LIBRARY.every(b => b.source.startsWith('https://') && b.stages.length));
  const result = plan({ kind: 'boss', box: box(), characters: chars, data: data(), boss, preparation: 20 });
  assert.ok(result[1].teams.length); assert.equal(result[1].teams[0].schedule!.length, 3); assert.ok(result[1].teams[0].missing!.length > 0);
  for (const g of result.filter(g=>g.scenario!=='current')) assert.ok(g.teams.every(t=>t.members.every(m=>m.estimatedLevel===100)));
});
test('rare materials distinguish specific skulls and show uncertain acquisition honestly', () => {
  const info = materialInfo('4579-skull', '', '4579', []); assert.ok(info.rare); assert.ok(info.name.includes('4579')); assert.ok(info.text.includes('doğrulanmış değil'));
  assert.equal(materialInfo('skullPSY', '', '7', []).name, 'PSY Crystal Skull');
  assert.ok(materialInfo('78', 'Red Penguin', '7', ['Story Island / Fushia / 3']).text.includes('Fushia'));
});
