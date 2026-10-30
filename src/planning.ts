import { inspectSkills, crewCriterion, applyAuxiliary, rewindResistance,statusResistance } from './skill-analysis';
import {resolveCrewText} from './crew-conditions';
import {scopeMatches,sentences} from './pve-targets';
import {makeAdventureContext,captainCooldown,type PveSynergy} from './pve-synergy';
import { solveRumble, type RumbleOffense } from './rumble-planner';
import { MECHANICS, type Boss, type Character, type Effect, type Owned, type RumbleEffect, type RumbleSkill } from './model';
import { evaluatePve } from './engine';
import {bossTimeline} from './boss-timeline';
import {crewCost,memberCost,crewCostProblem} from './crew-cost';
import {eligibleForQuest,questCrewFits,questRestrictionProblem,questPlanningWarning,restrictionSummary} from './quest-restrictions';
import type {RumbleRules} from './rumble-rules';
import type {AssaultReport} from './assault-rumble';
import {makeCombatHooks,enemyThreats,type CombatReport} from './pve-combat';
import {hpChanges,removalTurns,stageHazards} from './pve-hazards';
import {counterRelevance} from './pve-offense';
import {barrierRelevance,crewBarrierPotential,stageBarriers} from './pve-barriers';
import {chargeFor,eventStats,kizunaBoss,kizunaCrewCharge,kizunaMember,kizunaRewardPriority,rankKizunaTeams,validateKizunaSetup,type KizunaSetup,type KizunaMemberBonus,type KizunaReport} from './kizuna';
import {validatePka,pkaProblem,pkaMember,pkaRewardPriority,describePka,rankPkaTeams,type PkaSetup,type PkaReport} from './pka';

export const TYPES = ['STR', 'DEX', 'QCK', 'PSY', 'INT'];
export const CLASSES = ['Fighter', 'Slasher', 'Striker', 'Shooter', 'Free Spirit', 'Cerebral', 'Powerhouse', 'Driven'];
export const TARGET_LEVEL = 100;
export const SCENARIOS = [{ id: 'current', name: 'Mevcut hâl' }, { id: 'power', name: 'Lv.100 hedefi · evrimsiz' }, { id: 'evolve', name: 'Lv.100 hedefi + evrim' }] as const;
export type Scenario = typeof SCENARIOS[number]['id'];
type SkillText = string | { [key: string]: SkillText | number[] } | { description: SkillText; cooldown?: number[] }[];
export type EvolutionEdge = { to: string; materials: string[] };
export type PlannerUnit = {
  rumbleForms?:Pick<Character,'id'|'name'|'types'|'classes'|'hp'|'atk'|'rcv'>[];
  families?: string[]; tags?: string[]; abilities?: Record<string, unknown>;
  captain: SkillText; special: SkillText; cooldown: number[] | null; limit: string[];
  llb: ({ captain?: SkillText; special?: SkillText; sailor?:unknown;support?:unknown;rAbility?: boolean; rSpecial?: boolean; rResilience?:boolean; rSuperSpecial?:boolean; gpAbility?:boolean; gpSpecial?:boolean } | null)[];
  evolutions: EvolutionEdge[];
  rumble: null | { ability: RumbleSkill[]; special: RumbleSkill[]; llbability: RumbleSkill[]; llbspecial: RumbleSkill[]; stats: { def?: number; spd?: number; rumbleType?: string }; cost: number; resilience: unknown[]; llbresilience?:unknown[]; superspecial?:RumbleSkill[]; llbsuperspecial?:RumbleSkill[]; gpability?:RumbleSkill[]; gpspecial?:RumbleSkill[]; gpcondition?:unknown[]; llbgpability?:RumbleSkill[]; llbgpspecial?:RumbleSkill[]; llbgpcondition?:unknown[]; pattern?:unknown[] };
};
export type MaterialRecord = { rewards: { group: string; island: string; stage: string }[]; shops: string[]; image?: string };
export type PlannerData = { metadata: { source: string; url: string; sha: string; builtAt: string }; units: Record<string, PlannerUnit>; locations: Record<string, string[]>; materialSources?: Record<string, MaterialRecord> };
export type PlanMember = { coopBonus?:{atk:number;hp:number;cooldown:number};pkaBonus?:KizunaMemberBonus;kizunaBonus?:KizunaMemberBonus; character: Character; owned: Owned; sourceId: string; families: string[]; path: ({ from: string } & EvolutionEdge)[]; friend?: boolean; targeted?:boolean; health?:number; recovery?:number; notes: string[]; captainText: string; specialText: string; effects: Effect[]; roles: string[]; estimatedLevel: number; attack: number; abilityLevel: number; specialLevel: number };
export type PlanTeam = { pka?:PkaReport;provisional?:boolean;assault?:AssaultReport;kizuna?:KizunaReport; members: PlanMember[]; reserves?: PlanMember[]; score: number; reasons: string[]; warnings: string[]; cost?: number; costLimit?:number; costBreakdown?:{active:number;support:number;total:number}; offense?:RumbleOffense; synergy?:PveSynergy;combat?:CombatReport;benchmark?:{low:number;high:number;turn:number;used:string[]}; skillAudit?: { id:string; name:string; status:string; text:string; condition:string }[]; schedule?: { stage: string; turn: number; used: string[] }[]; missing?: string[] };
export type PlanGroup = { scenario: Scenario; title: string; teams: PlanTeam[]; diagnostic: string;provisional?:boolean };
export type PlanRequest = { kind: 'teams' | 'boss' | 'rumble' | 'kizuna'|'pka'; pka?:PkaSetup;kizuna?:KizunaSetup; box: Owned[]; characters: Character[]; data: PlannerData; scenario?:Scenario; category?: string; boss?: Boss & { blockedSpecialPatterns?: string[] }; preparation?: number; sockets?: number; costLimit?: number; crewCostLimit?:number; mode?: 'attack' | 'defense'; rumbleRules?:RumbleRules };

function textAt(value: SkillText | undefined, upgraded: boolean,form?:string): string {
  if (typeof value === 'string') return value;
  if (!value) return '';
  if (Array.isArray(value)) return textAt(value.at(-1)?.description, upgraded,form);
  if (typeof value.description === 'string') return value.description;
  if(form&&value[form])return textAt(value[form] as SkillText,upgraded,form);
  const keys = Object.keys(value).sort((a, b) => (Number(a.match(/\d+/)?.[0]) || 0) - (Number(b.match(/\d+/)?.[0]) || 0));
  const selected = value[upgraded ? keys.at(-1)! : (keys.includes('base') ? 'base' : keys[0])];
  if (Array.isArray(selected) && selected.some(v => typeof v === 'number')) return '';
  return textAt(selected as SkillText | undefined, upgraded);
}
export function parseEffects(text: string): Effect[] {
  const found = new Map<Effect['mechanic'], number>();
  if(/If (?:the )?crew is inflicted with Burn from a Special, Support Ability or Enemy Action, replaces that debuff/i.test(text))found.set('burn',99);
  const patterns: [Effect['mechanic'], RegExp][] = [
    ['bind', /\bBind\b/i], ['despair', /\bDespair\b/i], ['paralysis', /\bParalysis\b/i],
    ['specialBind', /Special Bind|Silence/i], ['atkDown', /ATK Down|ATK Reduction/i], ['burn', /\bBurn\b/i], ['poison', /\bPoison\b/i],
    ['threshold', /Threshold Damage Reduction|Damage Threshold/i], ['damageReduction', /Percent Damage Reduction/i],
    ['defenseUp', /Increased DEF|DEF Up|Defense Up|Increased Defense/i], ['resilience', /Resilience/i], ['damageNullification', /Damage Nullification|Damage Negation|Nullify Damage/i],
  ];
  // Conditional, delayed, self-only, and chance effects do not certify crew coverage.
  for (const sentence of text.split(/\.\s+|\n/)) {
    if (/^\s*(?:If|After|When)|chance|Special Launch Status|depending on the outcome/i.test(sentence)) continue;
    for (const match of sentence.matchAll(/(?:reduces?|removes?)\s+([^.;]{1,220}?)\s+(?:duration\s+)?by\s+(\d+)\s+turns?/gi)) {
      const label = match[1], turns = Number(match[2]);
      if (/on (?:this|the supported) character|of this character/i.test(label) || /\bif\b|\bafter\b/i.test(sentence.slice(0, match.index))) continue;
      for (const [mechanic, pattern] of patterns) {
        if (mechanic === 'bind' && !/\bBind\b/i.test(label.replace(/Special Bind|Slot Bind|Orb Bind|Ship Bind/gi, ''))) continue;
        if (pattern.test(label)) found.set(mechanic, Math.max(found.get(mechanic) || 0, turns));
      }
    }
    for(const match of sentence.matchAll(/removes?\s+([^.;]{1,120}?)\s+(?:duration\s+)?completely/gi)){
      if(/on (?:this|the supported) character|of this character/i.test(match[1])||/\bif\b|\bwhen\b|\bafter\b/i.test(sentence.slice(0,match.index)))continue;
      for(const [mechanic,pattern]of patterns)if(pattern.test(match[1])&&!(mechanic==='bind'&&/Special|Slot|Orb|Ship/i.test(match[1])))found.set(mechanic,99);
    }
  }
  return [...found].map(([mechanic, turns]) => ({ mechanic, turns }));
}
const captainClauses=new Map<string,{scope:string;base:number;high?:number;classes:string[]}[]>(),specialClauses=new Map<string,{kind:'atk'|'orb'|'affinity';scope:string;amount:number}[]>();
export function captainBoost(text: string, member: Character,data?:PlannerData): number {
 let clauses=captainClauses.get(text);if(!clauses){clauses=[];for(const sentence of sentences(text)){if(/^\s*(If|When)|crew consists|crew contains|must consist|following a chain/i.test(sentence))continue;for(const m of sentence.matchAll(/boosts?\s+(?:the\s+)?ATK\s+of\s+(.{1,220}?)\s+by\s+([\d.]+)x(?:-([\d.]+)x)?/gi))clauses.push({scope:m[1],base:Number(m[2]),high:m[3]&&/depending on if the character has 2 matching Classes/i.test(sentence)?Number(m[3]):undefined,classes:CLASSES.filter(c=>m[1].toLowerCase().includes(c.toLowerCase()))});}if(captainClauses.size>=8192)captainClauses.clear();captainClauses.set(text,clauses);}
 let result=1;for(const c of clauses)if(scopeMatches(c.scope,member,data))result=Math.max(result,c.high&&member.classes.filter(v=>c.classes.includes(v)).length>=2?c.high:c.base);return result;
}
export function specialBoosts(text: string, member: Character,data?:PlannerData): { atk: number; orb: number; affinity: number } {
  const result = { atk: 1, orb: 1, affinity: 1 };
  let clauses=specialClauses.get(text);if(!clauses){clauses=[];for (const sentence of sentences(text)) {
    if (/^\s*(If|When|After)|chance/i.test(sentence)) continue;
    for (const [key, pattern] of [
      ['atk', /boosts? (?:the )?ATK of (.{1,130}?) by ([\d.]+)x/gi],
      ['orb', /boosts? (?:the )?(?:Orb Effects|effectiveness of orbs) of (.{1,130}?) by ([\d.]+)x/gi],
      ['affinity', /boosts? (?:the )?Color Affinity of (.{1,130}?) by ([\d.]+)x/gi],
    ] as const) for (const match of sentence.matchAll(pattern)) {
      if (!/\bif\b|\bafter\b/i.test(sentence.slice(0, match.index)))clauses.push({kind:key,scope:match[1],amount:Number(match[2])});
    }
  }if(specialClauses.size>=8192)specialClauses.clear();specialClauses.set(text,clauses);}
  for(const c of clauses)if(scopeMatches(c.scope,member,data))result[c.kind]=Math.max(result[c.kind],c.amount);
  return result;
}
function rolesOf(text: string): string[] {
  const roles: string[] = [];
  if(/\bTrue damage\b/i.test(text))roles.push('Savunmayı aşan special hasarı');
  if(/damage[^.;]*at (?:the )?end of (?:the |each )?turn|Poisons all enemies/i.test(text))roles.push('Tur sonu bitirme');
  if (/boosts? (?:the )?ATK of|boosts? (?:crew|all characters).*ATK|ATK boost/i.test(text)) roles.push('ATK güçlendirme');
  if (/orb effects|effectiveness of.*orbs|Orb Boost|Orb Amplification/i.test(text)) roles.push('Orb güçlendirme');
  if (/Color Affinity/i.test(text)) roles.push('Renk avantajı');
  if (/chain multiplier|chain coefficient|chain boundary/i.test(text)) roles.push('Chain');
  if (/changes?.*orbs|matching orbs|beneficial orbs/i.test(text)) roles.push('Orb düzenleme');
  if (/recovers?|heals?|restores.*HP/i.test(text)) roles.push('İyileştirme');
  if (/reduces.*damage taken|damage received/i.test(text)) roles.push('Koruma');
  return roles;
}
export function candidates(box: Owned[], characters: Character[], data: PlannerData, scenario: Scenario): PlanMember[] {
  const map = new Map(characters.map(c => [c.id, c]));
  const all: PlanMember[] = [];
  for (const owned of box) {
    const queue: { id: string; path: PlanMember['path'] }[] = [{ id: owned.id, path: [] }];
    const visited = new Set<string>();
    while (queue.length) {
      const { id, path } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const c = map.get(id); if (!c) continue;
      if (path.length && c.global !== true) continue;
      const u = data.units[id];
      const upgraded = scenario !== 'current';
      const lb = (upgraded && !!u?.limit.length) || owned.lb;
      const canLLB = c.maxLevel === 99 && Number.parseFloat(c.stars) >= 5;
      const llb = upgraded ? (canLLB ? 5 : 0) : owned.llb;
      const keyIndex = u?.limit.findIndex(line => /LOCKED WITH KEY/i.test(line)) ?? -1;
      const limit = !upgraded && keyIndex >= 0 ? u!.limit.slice(0, keyIndex) : u?.limit || [];
      const form=owned.pveForm||'character1';
      let captain = textAt(u?.captain, lb,form) || c.captain.split('\n')[0].replace(/^base: /, '');
      let special = textAt(u?.special, lb,form) || c.special.split('\n')[0].replace(/^base: /, '');
      const notes: string[] = [];
      if(u?.special&&typeof u.special==='object'&&!Array.isArray(u.special)&&'character1' in u.special){
        notes.push('Special formu: '+({character1:'1. karakter',character2:'2. karakter',combined:'Birleşik form'}[form])+'.');
        notes.push(form==='combined'?'Birleşik formun önceden etkin ve special’ın yeniden hazır olduğu kayıtlı varsayılıyor; dönüşüm ve süre koşulları ayrıca doğrulanmalı.':'Special başlangıçtaki bu formun etkilerini kullanır; aynı kullanımda birleşik forma dönüşmek birleşik special etkilerini vermez.');
      }
      if (Array.isArray(u?.special)) notes.push('Çok kademeli special: en üst kademe ve onun cooldown’u planlanıyor.');
      if (c.types.length > 1) notes.push('Dual / VS formunun aktif tipi, switch ve birleşik form süresi ayrıca kontrol edilmeli.');
      for (const tier of u?.llb.slice(0, llb) || []) {
        if (tier?.captain) captain = textAt(tier.captain, true,form);
        if (tier?.special) special = textAt(tier.special, true,form);
      }
      const level = upgraded ? Math.min(TARGET_LEVEL, canLLB ? 150 : c.maxLevel) : owned.level ?? 1;
      if (!upgraded && owned.level === null) notes.push('Seviye bilinmiyor: sıralamada Lv.1 varsayıldı.');
      if (upgraded) notes.push(`Lv.${level}, special ve uygulanabilir LB / LLB maks. hedefleniyor. LLB yetenek açılımı karakter seviyesinden ayrı değerlendirilir; LLB için kopya / poster gerekir. Kaynakta Lv.${c.maxLevel} üzeri stat tablosu yoksa ek seviye artışı puana eklenmez.`);
      if (upgraded && keyIndex >= 0) notes.push('LB extension için anahtar / karakter materyali gerekiyor; bu hedefte kilitli düğümler de dahil.');
      if (!upgraded && lb && keyIndex >= 0) notes.push('LB extension durumu kayıtlı değil; anahtarla kilitli düğümler mevcut hâl puanına eklenmedi.');
      const minCooldown = u?.cooldown?.at(-1) ?? owned.ability.maxCooldown;
      const lbCooldown = lb ? limit.reduce((n, line) => n + (Number(line.match(/^Reduce base Special Cooldown by (\d+)/i)?.[1]) || 0), 0) : 0;
      const cooldown = upgraded && minCooldown !== null && minCooldown !== undefined ? Math.max(0, minCooldown - lbCooldown) : owned.cooldown ?? (u?.cooldown?.[0] ?? null);
      if (!upgraded && owned.cooldown === null) notes.push('Special cooldown bilinmiyor: kaynak başlangıç cooldown’u kullanıldı.');
      if (/\bif\b|following a chain|crew consists|crew contains/i.test(captain)) notes.push('Kaptanın koşullu çarpanları ve özel takım koşulları oyun içinde kontrol edilmeli.');
      if (/\bif\b|\bafter\b|depending|chance/i.test(special)) notes.push('Koşullu special etkileri tam mekanik karşılandı sayılmaz.');
      let attack = c.atk * (upgraded ? 1 : Math.max(0.2, Math.min(1, level / c.maxLevel)));
      if (lb) attack += limit.reduce((n, line) => n + (Number(line.match(/^Boosts base ATK by (\d+)/i)?.[1]) || 0), 0);
      const r = u?.rumble;
      const tiers = u?.llb.slice(0, llb) || [];
      const abilityMax = Math.min(5, (tiers.some(t => t?.rAbility) && r?.llbability.length ? r.llbability : r?.ability || c.rumble?.abilityLevels || []).length);
      const specialMax = Math.min(10, (tiers.some(t => t?.rSpecial) && r?.llbspecial.length ? r.llbspecial : r?.special || c.rumble?.specialLevels || []).length);
      if (!upgraded && (owned.rumbleAbility === null || owned.rumbleSpecial === null)) notes.push('Bilinmeyen Rumble yetenekleri Lv.1 kabul edildi.');
      const effects = !upgraded && owned.ability.verified ? owned.ability.effects : parseEffects(special);
      const families = u?.families?.length ? u.families : c.name.split(/\s+-\s+|:/)[0].split(/\s*&\s*/).map(name => 'name:' + name.trim().toLowerCase());
      if (!u?.families?.length) notes.push('Kaynakta karakter kimliği yok; tekrar kontrolünde kart adı kullanıldı.');
      const scale=upgraded?1:Math.max(.2,Math.min(1,level/c.maxLevel));
      const extraStat=(stat:string)=>lb?limit.reduce((n,line)=>n+(Number(line.match(new RegExp('^Boosts base '+stat+' by (\\d+)','i'))?.[1])||0),0):0;
      all.push({ character: c, sourceId: owned.id, families, path, targeted:upgraded,health:c.hp*scale+extraStat('HP'),recovery:c.rcv*scale+extraStat('RCV'),owned: { ...structuredClone(owned), id, cooldown, level, lb, llb,pveForm:form as Owned['pveForm'] }, captainText: captain, specialText: special, effects, roles: rolesOf(special), notes, estimatedLevel: level, attack, abilityLevel: upgraded ? abilityMax : Math.min(owned.rumbleAbility ?? 1, abilityMax), specialLevel: upgraded ? specialMax : Math.min(owned.rumbleSpecial ?? 1, specialMax) });
      if (scenario === 'evolve' && path.length < 6) for (const edge of u?.evolutions || []) queue.push({ id: edge.to, path: [...path, { from: id, ...edge }] });
    }
  }
  return all;
}
const matches = (m: PlanMember, category: string) => !category || m.character.types.includes(category) || m.character.classes.includes(category);
export const pveCrewKey = (members: PlanMember[]) => JSON.stringify([members.slice(0,2).map(m=>[m.sourceId,m.character.id,!!m.friend]),members.slice(2).map(m=>`${m.sourceId}:${m.character.id}`).sort()]);
const uniqueKey=pveCrewKey;
function distinct(team: PlanMember[], next: PlanMember) { return !team.some(m => !m.friend && (m.sourceId === next.sourceId || m.character.id === next.character.id || m.families.some(family => next.families.includes(family)))); }
function rankTeams(results: PlanTeam[]): PlanTeam[] {
  const out: PlanTeam[] = [];
  const usable=results.filter(t=>!t.missing?.length&&t.combat?.status!=='blocked');
  const choices=usable.length?usable:results;
  for (const result of choices.sort((a, b) => (a.missing?.length||0)-(b.missing?.length||0)||b.score - a.score || uniqueKey(a.members).localeCompare(uniqueKey(b.members)))) {
    if (out.some(t => uniqueKey(t.members) === uniqueKey(result.members))) continue;
    // Alternatives should change a captain or at least two owned slots.
    if (out.some(t => t.members[0].character.id === result.members[0].character.id && result.members.filter(m => !m.friend && t.members.some(x => !x.friend && x.sourceId === m.sourceId && x.character.id === m.character.id)).length > 3)) continue;
    out.push(result); if (out.length === 3) break;
  }
  return out;
}
export function solveAdventure(pool: PlanMember[], category: string, boss?: PlanRequest['boss'], preparation = 16, sockets = 0, data?: PlannerData,preparedContext?:ReturnType<typeof makeAdventureContext>,preview?:(teams:PlanTeam[])=>void,kizuna?:KizunaSetup,quick=false,pka?:PkaSetup,coopCaptain?:PlanMember,crewCostLimit?:number): PlanTeam[] {
  if(crewCostLimit!==undefined&&crewCostProblem(crewCostLimit))throw Error(crewCostProblem(crewCostLimit));
  if(questRestrictionProblem(boss))return [];
  const limit=crewCostLimit??Infinity;
  const available = pool.filter(m => matches(m, category)&&eligibleForQuest(m.character,boss?.restrictions)&&memberCost(m)<=limit);
  const synergyContext=preparedContext||(data?makeAdventureContext(pool,data,boss,limit):undefined);
  // Rank counters for every possible HP branch; combat still selects only the
  // branch reached by this crew, without applying alternative effects together.
  const requirements = boss?.stages.flatMap(s => {
    const turns=new Map<Effect['mechanic'],number>();
    for(const r of [...s.requirements,...(s.events?.filter(e=>e.trigger==='hp').flatMap(e=>e.requirements)||[])])turns.set(r.mechanic,Math.max(turns.get(r.mechanic)||0,r.turns));
    return [...turns].map(([mechanic,turns])=>({mechanic,turns}));
  }) || [];
  const weaknessStages=boss?.stages.filter(s=>s.weaknessClasses?.length)||[];
  const weaknessPriority=(m:PlanMember)=>weaknessStages.length?weaknessStages.reduce((n,s)=>n+(m.character.classes.some(c=>s.weaknessClasses!.includes(c))?1:0),0)/weaknessStages.length:0;
  const hazards=boss?.stages.map(stageHazards)||[];
  const barrierStages=boss?.stages.map(stage=>new Map(pool.map(m=>[m,barrierRelevance(stage,m.specialText,m.character,data)])))||[];
  const barrierValues=new Map(pool.map(m=>[m,barrierStages.reduce((n,values)=>n+(values.get(m)||0),0)]));
  const counterStages=boss?.stages.map((stage,i)=>new Map(pool.map(m=>[m,counterRelevance(stage,m.specialText)+(barrierStages[i].get(m)||0)])))||[];
  const passiveCounters=boss?.stages.map(stage=>new Map(pool.map(m=>[m,counterRelevance(stage,m.captainText,true)])))||[];
  const counterValues=new Map(pool.map(m=>[m,counterStages.reduce((n,values)=>n+(values.get(m)||0),0)]));
  const captainCounterValues=new Map(pool.map(m=>[m,passiveCounters.reduce((n,values)=>n+(values.get(m)||0),0)]));
  const hazardProfiles=new Map(pool.map(m=>[m.character.id,{poison:removalTurns(m.specialText,'poison'),burn:removalTurns(m.specialText,'burn'),captainBurn:removalTurns(m.captainText,'burn')}]));
  const hazardValues=new Map(pool.map(m=>[m,hazards.reduce((n,h)=>n+(h.poison&&removalTurns(m.specialText,'poison')>0?1:0)+(h.burn?Math.min(1,removalTurns(m.specialText,'burn')/(h.burnTurns||99)):0),0)]));
  const knownIncoming=Math.max(0,...(boss?.stages.map(s=>{const t=enemyThreats(s);return t.preemptive+t.defeated+t.turnDamage;})||[]));
  const protectionValue=(m:PlanMember)=>knownIncoming?Math.max(0,...sentences(resolveCrewText(m.specialText,m.character,[m.character])).filter(s=>!/^\s*(If|When|After)/i.test(s)).map(s=>Number(s.match(/reduces? damage (?:received|recieved|taken) by (\d+)%/i)?.[1]||0)/100))*Math.min(60,knownIncoming/500):0;
  const relevance = (m: PlanMember) => requirements.reduce((n, r) => n + Math.min(1, (m.effects.find(e => e.mechanic === r.mechanic)?.turns || 0) / Math.max(1, r.turns - (['bind', 'despair'].includes(r.mechanic) ? sockets : 0))), 0)+(hazardValues.get(m)||0)+(counterValues.get(m)||0);
  const specialBuffs = new Map(pool.map(m => {
    const scopes = new Map<string, ReturnType<typeof specialBoosts>>();
    return [m, new Map(available.map(target => {
      const key = target.character.id;
      if (!scopes.has(key)) scopes.set(key, specialBoosts(m.specialText, target.character,data));
      return [target, scopes.get(key)!];
    }))];
  }));
  const captainValue=(m:PlanMember)=>captainBoost(m.captainText,m.character,data)*20+(captainCounterValues.get(m)||0)*40+weaknessPriority(m)*12+(synergyContext?.profiles.get(m)?.captain.mechanics.length||0)*10+(boss?Math.min(3,relevance(m))*30+protectionValue(m)*.5-hpChanges(m.captainText,true).reduce((n,c)=>n+(c.basis==='fixed'?1:c.kind==='cut'?c.amount:1-c.amount)*60,0):0);
  const rankedCaptains = available.filter(m => (!coopCaptain||distinct([coopCaptain],m))&&captainBoost(m.captainText, m.character,data) > 1).sort((a, b) => captainValue(b)-captainValue(a) || b.attack - a.attack);
  const captains=[...new Set([...rankedCaptains.slice(0,quick?4:18),...Number.isFinite(limit)?[...rankedCaptains].sort((a,b)=>memberCost(a)-memberCost(b)||captainValue(b)-captainValue(a)).slice(0,quick?2:6):[]])];
  const results: PlanTeam[] = [];
  let previewed=false;
  const combatInputs=new Map<PlanTeam,{boss:Boss;members:Parameters<typeof evaluatePve>[0];auxiliary:ReturnType<typeof applyAuxiliary>['schedule'];baseScore:number;totalRequirements:number}>();
  for (const captain of captains) {
    const friendOptions=coopCaptain?[coopCaptain]:[captain,...(captains.indexOf(captain)<4?captains.filter(m=>m!==captain&&captainBoost(captain.captainText,m.character,data)>1&&captainBoost(m.captainText,captain.character,data)>1).slice(0,2):[])];
    for(const friendSource of friendOptions){
    // A friend using the same form is a recommendation, never another owned copy.
    const friend = coopCaptain?friendSource:{ ...friendSource, friend: true, notes: ['Bu formda arkadaş kaptan bulunmalı; arkadaşın gerçek geliştirmelerini ayrıca kontrol et.'] };
    const boost = new Map(available.map(m => [m, captainBoost(captain.captainText, m.character,data)]));
    boost.set(friend,captainBoost(captain.captainText,friend.character,data));
    const friendBoost=new Map(available.map(m=>[m,captainBoost(friend.captainText,m.character,data)]));friendBoost.set(friend,captainBoost(friend.captainText,friend.character,data));
    const compatible = available.filter(m => distinct(coopCaptain?[captain,friend]:[captain], m) && (boost.get(m)!>1&&(!!coopCaptain||friendBoost.get(m)!>1)||!!boss&&relevance(m)>0));
    // This is a bounded class preference for search, not an invented game
    // multiplier. The combat report keeps the unverified bonus separate.
    const strength = (m: PlanMember) => m.attack * eventStats(m).atk * boost.get(m)! *friendBoost.get(m)! / 1000*(1+.25*weaknessPriority(m));
    const value = (m: PlanMember) => strength(m) + (kizunaRewardPriority(m,kizuna?.objective)+pkaRewardPriority(m,pka))*30 + relevance(m) * 80 + m.roles.length * 5 + protectionValue(m) + (synergyContext?.assess([captain,friend,m]).score||0) + (data && typeof data.units[captain.character.id]?.abilities?.superSpecialCriteria === 'string' && crewCriterion(String(data.units[captain.character.id].abilities!.superSpecialCriteria), captain, [captain,friend,m]) === 'ready' ? 45 : 0);
    const memberValues=new Map(compatible.map(m=>[m,value(m)]));
    const rankedSubs=compatible.sort((a,b)=>memberValues.get(b)!-memberValues.get(a)!||a.character.id.localeCompare(b.character.id));
    const barrierCandidates:PlanMember[]=[];
    for(const candidate of rankedSubs.filter(m=>(barrierValues.get(m)||0)>0).sort((a,b)=>(barrierValues.get(b)||0)-(barrierValues.get(a)||0)||memberValues.get(b)!-memberValues.get(a)!)){
      if(!barrierCandidates.some(m=>m.sourceId===candidate.sourceId))barrierCandidates.push(candidate);
      if(barrierCandidates.length===6)break;
    }
    // Keep a real solution to every required mechanic before ranking damage.
    const requiredCandidates:PlanMember[]=[];
    for(const requirement of requirements){
      const turns=Math.max(0,requirement.turns-(['bind','despair'].includes(requirement.mechanic)?sockets:0));if(!turns)continue;
      const options=rankedSubs.filter(m=>m.effects.some(e=>e.mechanic===requirement.mechanic)).sort((a,b)=>Math.min(turns,b.effects.find(e=>e.mechanic===requirement.mechanic)!.turns)-Math.min(turns,a.effects.find(e=>e.mechanic===requirement.mechanic)!.turns)||memberValues.get(b)!-memberValues.get(a)!);
      for(const m of options.slice(0,2))if(!requiredCandidates.includes(m))requiredCandidates.push(m);
    }
    const buffCandidates:PlanMember[]=[];
    for(const kind of ['atk','orb','affinity'] as const){
      const potential=new Map(rankedSubs.map(m=>[m,Math.max(1,...available.map(target=>specialBuffs.get(m)?.get(target)?.[kind]||1))]));
      for(const m of rankedSubs.filter(m=>potential.get(m)!>1).sort((a,b)=>potential.get(b)!-potential.get(a)!||memberValues.get(b)!-memberValues.get(a)!).slice(0,2))buffCandidates.push(m);
    }
    const rewardCandidates=kizuna?rankedSubs.filter(m=>kizunaRewardPriority(m,kizuna.objective)>0).sort((a,b)=>kizunaRewardPriority(b,kizuna.objective)-kizunaRewardPriority(a,kizuna.objective)).slice(0,6):pka?rankedSubs.filter(m=>pkaRewardPriority(m,pka)>0).sort((a,b)=>pkaRewardPriority(b,pka)-pkaRewardPriority(a,pka)).slice(0,6):[];
    const tagCharge=kizuna?.mode==='super'&&boss?.source==='https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17'&&boss.stages.some(s=>s.events?.some(e=>/If at least 2 Revolutionary Army: Reduce Special Charge/.test(e.text)));
    const tagCandidates=tagCharge?rankedSubs.filter(m=>data?.units[m.character.id]?.tags?.includes('Revolutionary Army')).slice(0,6):[];
    const slotCandidates=kizuna&&boss?rankedSubs.filter(m=>boss.stages.some(s=>stageBarriers(s).some(b=>b.kind==='slot'&&m.character.types.length===1&&m.character.types[0]===b.slot))).sort((a,b)=>Number(!!data?.units[b.character.id]?.tags?.includes('Revolutionary Army'))-Number(!!data?.units[a.character.id]?.tags?.includes('Revolutionary Army'))||memberValues.get(b)!-memberValues.get(a)!).slice(0,6):[];
    const protectedMembers=[...new Set([...requiredCandidates,...barrierCandidates,...slotCandidates,...buffCandidates,...rewardCandidates,...tagCandidates])];
    const economical=Number.isFinite(limit)?[...rankedSubs].sort((a,b)=>memberCost(a)-memberCost(b)||memberValues.get(b)!-memberValues.get(a)!).slice(0,12):[];
    const subs = [...new Set([...protectedMembers,...rankedSubs.filter(m=>!protectedMembers.includes(m))].slice(0,Math.max(24,protectedMembers.length)).concat(economical))];
    let beams: PlanMember[][] = [[captain, friend]];
    const crewScores=new Map<string,number>();
    const first=boss?.stages[0],conditionalText=kizuna&&tagCharge?first?.events?.filter(e=>e.trigger==='unknown').map(e=>e.text).join('\n')||'':'';
    const conditionalCharge=conditionalText.match(/If at least 2 Revolutionary Army: Reduce Special Charge by (\d+) turns for ([^;\n]+)/);
    const initialReady=new Map([...available,friend].map(m=>[m,Math.max(0,(m.owned.readyTurn??(m.owned.cooldown===null?Infinity:m.owned.cooldown-eventStats(m).cooldown-membersStart(m)))-(first?chargeFor(first,m.character):0))]));
    function membersStart(m:PlanMember){return data?[captain,friend].reduce((n,c)=>n+captainCooldown(c,m,data),0):0;}
    const earliest=(m:PlanMember,members:PlanMember[])=>{
      const tags=members.filter(v=>data?.units[v.character.id]?.tags?.includes('Revolutionary Army')).length;
      // Partial crews may still add the required tags; full crews must have them.
      const grant=conditionalCharge&&2-tags<=6-members.length&&[...m.character.types,...m.character.classes].some(v=>conditionalCharge[2].split(/,\s*/).includes(v))?Number(conditionalCharge[1]):0;
      return Math.max(0,(initialReady.get(m)??Infinity)-grant);
    };
    const barrierPotential=(members:PlanMember[])=>boss?.stages.reduce((n,s)=>n+crewBarrierPotential(s,members,members.filter(m=>earliest(m,members)<=s.turn),data),0)||0;
    const requiredCoverage=(members:PlanMember[])=>requirements.reduce((n,r)=>n+Math.min(1,members.reduce((sum,m)=>sum+(m.effects.find(e=>e.mechanic===r.mechanic)?.turns||0),0)/Math.max(1,r.turns-(['bind','despair'].includes(r.mechanic)?sockets:0))),0)
      +counterStages.reduce((n,values,s)=>n+Math.max(0,...members.map((m,i)=>{const source=m.friend?friendSource:m;return (!kizuna||earliest(m,members)<=boss!.stages[s].turn?(values.get(source)||0)-(kizuna?barrierStages[s].get(source)||0:0):0)+(i<2?(passiveCounters[s].get(source)||0):0);})),0)+(kizuna?barrierPotential(members):0);
    const teamValue = (members: PlanMember[]) => {
      const cacheKey=uniqueKey(members);const cached=crewScores.get(cacheKey);if(cached!==undefined)return cached;
      const roles = new Set(members.flatMap(m => m.roles));
      const coverage = requirements.reduce((n, r) => n + Math.min(1, members.reduce((turns, m) => turns + (m.effects.find(e => e.mechanic === r.mechanic)?.turns || 0), 0) / Math.max(1, r.turns - (['bind', 'despair'].includes(r.mechanic) ? sockets : 0))), 0)+hazards.reduce((n,h)=>n+(h.poison&&members.some(m=>(hazardProfiles.get(m.character.id)?.poison||0)>0)?1:0)+(h.burn&&members.some((m,i)=>(i<2?hazardProfiles.get(m.character.id)?.captainBurn:hazardProfiles.get(m.character.id)?.burn||0)!>=(h.burnTurns||99))?1:0),0);
      const counterCoverage=counterStages.reduce((n,values,s)=>n+Math.max(0,...members.map((m,i)=>{const source=m.friend?friendSource:m;return (values.get(source)||0)+(i<2?passiveCounters[s].get(source)||0:0);})),0);
      // A stronger ATK stat cannot replace the slot that opens a barrier. Keep
      // legal counter candidates alive until actual attacks / cooldowns rank them.
      const barrierCoverage=kizuna?barrierPotential(members):barrierStages.reduce((n,values)=>n+Math.max(0,...members.map(m=>values.get(m.friend?friendSource:m)||0)),0);
      const specialSynergy = members.reduce((sum, target) => {
        const buffs = members.map(m => specialBuffs.get(m.friend ? friendSource : m)?.get(target.friend?friendSource:target) || { atk: 1, orb: 1, affinity: 1 });
        // Same-category boosts don't stack. This is a ranking bonus, not a damage calculation.
        return sum + strength(target)*(Math.max(...buffs.map(b => b.atk))*Math.max(...buffs.map(b => b.orb))*Math.max(...buffs.map(b => b.affinity))-1);
      }, 0);
      const value=members.reduce((n, m) => n + strength(m)+pkaRewardPriority(m,pka)*80, 0) + roles.size * 12 + specialSynergy + (coverage+counterCoverage) * 200+barrierCoverage*1000+Math.max(0,...members.map(protectionValue))+(tagCharge?Math.min(2,members.filter(m=>data?.units[m.character.id]?.tags?.includes('Revolutionary Army')).length)*150:0)+(synergyContext?.assess(members).score||0);crewScores.set(cacheKey,value);return value;
    };
    for (let slot = 0; slot < 4; slot++) {
      const seen = new Set<string>();
      const next = beams.flatMap(team => subs.filter(m => distinct(team, m)).map(m => [...team, m])).filter(t => {if(!questCrewFits(t,boss?.restrictions)||crewCost(t).total>limit)return false;if(Number.isFinite(limit)){const cheapest=subs.filter(m=>distinct(t,m)).map(memberCost).sort((a,b)=>a-b).slice(0,6-t.length);if(cheapest.length<6-t.length||crewCost(t).total+cheapest.reduce((a,b)=>a+b,0)>limit)return false;} const key = uniqueKey(t); if (seen.has(key)) return false; seen.add(key); return true; });
      const coverage=boss?new Map(next.map(m=>[m,requiredCoverage(m)])):undefined;
      beams = next.sort((a, b) => (coverage?coverage.get(b)!-coverage.get(a)!:0)||teamValue(b) - teamValue(a)).slice(0, quick?8:22);
    }
    for (const originalMembers of beams.slice(0, 8)) {
      const members=[...originalMembers];
      // Seed a usable position before ranking candidates; finalists subsequently
      // compare all 24 orders. Otherwise a useful remover initially in the
      // bound row could be eliminated before its legal placement is evaluated.
      if(boss)for(const stage of boss.stages)for(const kind of ['bind','specialBind']as const){
       const label=kind==='bind'?'Bind':'Special Bind',text=stage.events?.filter(e=>['preemptive','starting','turn'].includes(e.trigger)).map(e=>e.text).join('\n')||'';
       const row=text.match(new RegExp('(Middle|Bottom)[ -]Row '+label,'i')),column=text.match(new RegExp('(Left|Right)[ -]Column '+label,'i'));if(!row&&!column)continue;
       const blocked=row?(row[1].toLowerCase()==='middle'?[2,3]:[4,5]):column![1].toLowerCase()==='left'?[2,4]:[3,5],safe=[2,3,4,5].filter(i=>!blocked.includes(i));
       const best=[2,3,4,5].sort((a,b)=>(members[b].effects.find(e=>e.mechanic===kind)?.turns||0)-(members[a].effects.find(e=>e.mechanic===kind)?.turns||0))[0];
       if(blocked.includes(best)&&members[best].effects.some(e=>e.mechanic===kind)){const target=safe.sort((a,b)=>(members[a].effects.find(e=>e.mechanic===kind)?.turns||0)-(members[b].effects.find(e=>e.mechanic===kind)?.turns||0))[0];[members[best],members[target]]=[members[target],members[best]];}
      }
      const extras = data ? inspectSkills(members, data, pool, boss) : { audit: [], actions: [], bonus: 0 };
      const warnings = [...new Set(members.flatMap(m => m.notes))];
      const environmentWarning=questPlanningWarning(boss);if(environmentWarning)warnings.push(environmentWarning);
      if(boss?.restrictions?.status==='unverified'||boss&&!boss.restrictions)warnings.push('Görevin katılım koşulları doğrulanmadı. REQUIREMENT bölümünü kontrol et; bu öneri yalnız bilinen kuralları kapsar.');
      const synergy=synergyContext?.assess(members,true);
      const score = teamValue(members)+(synergy?synergy.score-synergyContext!.assess(members).score:extras.bonus);
      for(const support of synergy?.supports||[])extras.audit.push({id:support.targetId,name:`Support: #${support.member.character.id} → #${support.targetId}`,status:`Lv.${support.level} · stat / doğrulanabilir boss tetiği puanlandı`,text:support.text,condition:support.stages.length?'İlgili boss etkisi geldiğinde bir kez; destek kendi aktif kadro slotunu kullanmaz.':'Koşulsuz stat aktarımı; diğer tetikler varsa kesin mekanik çözümü sayılmadı.'});
      const reasons = [`${category || 'Karma'} kadro: 5 sahip olunan karakter + önerilen arkadaş kaptan.`, `Kaptan temel ATK çarpanı: ${captainBoost(captain.captainText, captain.character)}×; koşullu tavan çarpanları puana eklenmedi.`, 'Special ATK / orb / renk buff’ları hedef kapsamıyla değerlendirildi; aynı tür buff’lar üst üste çarpılmadı.', `Roller: ${[...new Set(members.flatMap(m => m.roles))].join(', ') || 'Kaynakta okunabilen buff rolü yok.'}`];
      if(boss?.restrictions?.status==='verified')reasons.push(...restrictionSummary(boss.restrictions),'Katılım koşulları kaptan, 4 üye ve arkadaş kaptanda uygulandı.');
      if(synergy)reasons.splice(1,0,'Captain HP / hasar azaltma / başlangıç CT, crewmate base stat / faydalı orb, special base ATK / chain, Support ataması ve açılabilir ileri yetenekler kadro aramasına dahil edildi.','Supportlar kendi kaptanın, üyelerin ve diğer Supportlarla karakter kimliği çakışmayan kartlardan seçilir. Çift karakterlerin iki kimliği de kontrol edilir.');
      const costs=crewCost(members,synergy?.supports);if(costs.total>limit)continue;
      const costReport={cost:costs.total,costLimit:crewCostLimit,costBreakdown:costs};
      if (!boss) {const team={ members, score, reasons, warnings,synergy, skillAudit: extras.audit,...costReport };results.push(team);if(preview&&!previewed){previewed=true;preview([team]);}}
      else {
        const adjusted = { ...boss, stages: boss.stages.map(s => ({ ...s, turn: s.turn + preparation, requirements: s.requirements.map(e => ({ ...e, turns: e.turns - (['bind', 'despair'].includes(e.mechanic) ? sockets : 0) })).filter(e => e.turns > 0) })) };
        const blocked = (m: PlanMember) => boss.blockedSpecialPatterns?.some(pattern => new RegExp(pattern, 'i').test(m.specialText));
        const passives=members.map((m,index)=>{const text=index<2?resolveCrewText(m.captainText,captain.character,members.map(t=>t.character)):synergyContext?.profiles.get(m)?.sailorText||'';return {id:m.character.id,name:index<2?'Captain pasif azaltma':'Crewmate pasif azaltma',text,effects:parseEffects(text),oneUse:false,passive:true};});
        const supportActions=(synergy?.supports||[]).filter(s=>s.effects.length).map(s=>({id:s.member.character.id,name:`Support → #${s.targetId}`,text:s.text,effects:s.effects,oneUse:true,passive:true,allowedStages:s.stages}));
        const auxiliary = applyAuxiliary(adjusted, [...passives,...supportActions,...extras.actions], boss.blockedSpecialPatterns);
        if(kizuna?.mode==='super'&&data){const charged=kizunaCrewCharge(auxiliary.boss,members,data);if(charged!==auxiliary.boss)warnings.push('Kadrodaki en az 2 Revolutionary Army etiketi doğrulandı; kaynakta belirtilen Battle 1 special CD indirimi hedef tip / sınıflara uygulandı.');auxiliary.boss=charged;}
        const startReduction=(m:PlanMember)=>eventStats(m).cooldown+members.slice(0,2).reduce((n,c)=>n+captainCooldown(c,m,data),0);
        const evaluatedMembers=members.map(m => ({ character: m.character, specialText:m.specialText, bindResistance:statusResistance(m,'bind',data,members.indexOf(m)<2),specialBindResistance:statusResistance(m,'specialBind',data,members.indexOf(m)<2),rewindResistance:members.indexOf(m)>1?rewindResistance(m,data):0, friend: m.friend, owned: { ...m.owned, readyTurn: m.owned.readyTurn ?? (m.owned.cooldown === null ? null : Math.max(0, m.owned.cooldown - startReduction(m))), ability: { ...m.owned.ability, verified: true, effects: blocked(m) ? [] : (!m.owned.ability.verified ? parseEffects(resolveCrewText(m.specialText,captain.character,members.map(t=>t.character))) : m.effects) } } }));
        const evaluated = evaluatePve(evaluatedMembers, auxiliary.boss);
        if (members.some(blocked)) warnings.push('Karşı saldırı tetikleyen special içeren üyeler var; bu special’lar mekanik çözüm planında kullanılmadı.');
        warnings.push(`Hazırlık: ${preparation} ek tur; Bind/Despair socket azaltması: ${sockets} tur. Bu kadar stall yapabilmen gerekir.`);
        if(boss.stages.some(s=>s.conditionalTurn))warnings.push('Plan, rehberde açık numarası görülen sonraki tur tetiklerine kadar aynı aşamada kaldığın senaryoyu kapsar. Daha erken geçersen bu etkiler gelmez; gecikme sonraki aşamaların toplam turuna ve special cooldownlarına yansır. Sınırsız bekleme ve hasarla kaç turda geçileceği simüle edilmez.');
        warnings.push('Captain / crewmate pasif azaltmaları, doğrulanabilen Super / switch ve seçilen Support boss tetikleri aşama planına dahil. Last Tap / Tandem / Rush fırsat katkıları ayrıca gösterilir; eksik orb / HP / sayaç koşulları kesin çözüm sayılmaz. Hasar ve tüm savaş akışı simüle edilmez.');
        warnings.push('Bind / Silence altındaki üyelerin special kullanabilmesi için konum ve sailor / direnç gerekir; bunlar ayrıca doğrulanmalı.');
        const solved=adjusted.stages.reduce((n,s)=>n+s.requirements.length,0)-evaluated.missing.length;
        const result:PlanTeam={ members, score: score + solved * 1000 - evaluated.schedule.reduce((n,s)=>n+s.used.length*10,0), reasons, warnings,synergy, skillAudit: extras.audit, schedule: evaluated.schedule.map((s,i)=>({...s,used:[...(auxiliary.schedule[i]?.used||[]),...s.used]})), missing: evaluated.missing };
        Object.assign(result,costReport);results.push(result);combatInputs.set(result,{boss:auxiliary.boss,members:evaluatedMembers,auxiliary:auxiliary.schedule,baseScore:score,totalRequirements:adjusted.stages.reduce((n,s)=>n+s.requirements.length,0)});
      }
    }
    }
  }
  if(boss&&data){
    // Re-evaluate diverse finalists jointly: a buff / heal / shield can be
    // necessary even when it removes no debuff. Its use still consumes cooldown
    // and the stage's special limit. Ordinary automatic teams keep their scorer.
    const seen=new Set<string>(),ranked=results.sort((a,b)=>(a.missing?.length||0)-(b.missing?.length||0)||b.score-a.score).filter(t=>{const key=uniqueKey(t.members)+'|'+t.members[1].character.id;if(seen.has(key))return false;seen.add(key);return true;});
    const finalists=ranked.slice(0,quick?3:6),finalistLimit=quick?3:12,captainIds=new Set(finalists.map(t=>t.members[0].character.id));
    for(const team of ranked){if(finalists.length>=finalistLimit)break;if(captainIds.has(team.members[0].character.id))continue;captainIds.add(team.members[0].character.id);finalists.push(team);}
    for(const team of ranked){if(finalists.length>=finalistLimit)break;if(!finalists.includes(team))finalists.push(team);}
    for(const team of finalists){
      const input=combatInputs.get(team)!;
      let positions=[0,1,2,3,4,5],positionScore=-Infinity;
      if(input.boss.stages.some(s=>s.events?.some(e=>/(?:(?:Top|Middle|Bottom)[ -]Row|(?:Left|Right)[ -]Column) (?:Bind|Special Bind)/i.test(e.text)))){
       for(const a of [2,3,4,5])for(const b of [2,3,4,5].filter(i=>i!==a))for(const c of [2,3,4,5].filter(i=>i!==a&&i!==b)){
        const p=[0,1,a,b,c,...[2,3,4,5].filter(i=>i!==a&&i!==b&&i!==c)],r=evaluatePve(p.map(i=>input.members[i]),input.boss,{beamLimit:32}),score=r.score-r.missing.length*10000;
        if(score>positionScore){positionScore=score;positions=p;}
       }
       team.members=positions.map(i=>team.members[i]);team.reasons.push('Satır / sütun Bind ve Special Bind koşulları için dört üyenin 24 konumu karşılaştırıldı; önce serbest üyenin kaldırma special’ı kullanılır.');
      }
      const hooks=makeCombatHooks(team.members,input.boss,data,team.synergy,kizuna?.mode==='super',!!kizuna);
      const evaluated=evaluatePve(positions.map(i=>input.members[i]),input.boss,{combat:hooks,beamLimit:32});
      team.combat=hooks.report(evaluated.combatWindows||[]);team.missing=evaluated.missing;
      team.schedule=evaluated.schedule.map((s,i)=>({...s,used:[...(input.auxiliary[i]?.used||[]),...s.used]}));
      const unresolvedBarriers=team.combat.windows.flatMap(w=>w.barriers||[]).filter(b=>b.status==='conditional').length;
      team.score=input.baseScore+(input.totalRequirements-evaluated.missing.length)*1000+evaluated.score-team.schedule.reduce((n,s)=>n+s.used.length*10,0)-(team.combat.status==='blocked'?100000:0)-unresolvedBarriers*10000;
      team.reasons.push('Boss hasarı ve bilinen ölüm / saldırı hasarı, planlanan buff, iyileştirme ve koruma kullanımlarıyla yeniden karşılaştırıldı. Düşman HP / ATK eksikse tek turda geçiş veya güvenli bekleme doğrulanmış sayılmaz.');
      if(preview&&!previewed&&!team.missing?.length&&team.combat.status!=='blocked'){previewed=true;preview([team]);}
    }
    return rankTeams(finalists);
  }
  if(data){
    const finalists=[...results].sort((a,b)=>b.score-a.score).slice(0,18);
    for(const team of finalists){
      const target:Boss={id:'benchmark',name:'Kıyas hedefi',source:'Yerel ortak karşılaştırma',training:true,stages:[{id:'burst',name:'Tek saldırı',turn:40,requirements:[],enemyDefense:0,enemyAttack:0}]};
      const hooks=makeCombatHooks(team.members,target,data,team.synergy),members=team.members.map(m=>({character:m.character,specialText:m.specialText,friend:m.friend,owned:{...m.owned,readyTurn:m.owned.cooldown===null?null:Math.max(0,m.owned.cooldown-team.members.slice(0,2).reduce((n,c)=>n+captainCooldown(c,m,data),0)),ability:{...m.owned.ability,verified:true,effects:m.effects}}}));
      const result=evaluatePve(members,target,{combat:hooks,beamLimit:8}),window=result.combatWindows?.[0];if(!window)continue;
      team.benchmark={low:window.damageLow,high:window.damageHigh,turn:40,used:result.schedule[0]?.used||[]};
      if(window.hpAfter<=0)team.missing=['Kıyas saldırısında HP tükeniyor.'];
      team.score=Math.log10(1+window.damageLow)*1000+Math.log10(1+window.damageHigh)*10+team.score*.001;
      team.reasons.push('Genel sıralama: DEF 0 ve gelen hasar 0 olan ortak hedefte Tur 40 special hazır oluşu, gerçek kaptan kapsamı ve aynı saldırıda planlanan bufflarla normal saldırı aralığı. Orb / rakip tipi bilinmediğinden aralık gösterilir; boss kazanma kanıtı değildir.');
    }
    return rankTeams(finalists);
  }
  return rankTeams(results);
}
export function skillAt(levels: RumbleSkill[], level: number): RumbleSkill {
  const skill = structuredClone(levels[0] || {});
  for (let i = 1; i < Math.min(level, levels.length); i++) {
    if (levels[i].uses !== undefined) skill.uses = levels[i].uses;
    if (levels[i].cooldown !== undefined) skill.cooldown = levels[i].cooldown;
    for (const [index, effect] of (levels[i].effects || []).entries()) {
      const old = skill.effects?.[index] || {};
      (skill.effects ??= [])[index] = { ...old, ...effect, ...(effect.override as Partial<RumbleEffect> || {}) };
    }
  }
  return skill;
}
const normalize = (value: string) => value.replace(/[\[\]]/g, '').toLowerCase();
export function targetsMember(effect: RumbleEffect, source: PlanMember, target: PlanMember): boolean {
  const targeting = effect.targeting;
  if (!targeting || effect.condition || effect.conditions || Object.keys(targeting).some(k => !['targets', 'types', 'classes'].includes(k))) return false;
  const tags = [...target.character.types, ...target.character.classes].map(normalize);
  const targets = (targeting.targets || []).map(normalize);
  const inTargets = targets.some(t => t === 'crew' || (t === 'self' && source.sourceId === target.sourceId && source.character.id === target.character.id) || tags.includes(t));
  return inTargets && (!targeting.types?.length || targeting.types.some(t => tags.includes(normalize(t)))) && (!targeting.classes?.length || targeting.classes.some(t => tags.includes(normalize(t))));
}
export function solveAutoRumble(pool: PlanMember[], data: PlannerData, costLimit: number, mode: 'attack' | 'defense', category: string,rules?:RumbleRules): PlanTeam[] { return solveRumble(pool, data, costLimit, mode, category,rules); }
export function createPlannerSession(request:PlanRequest,onPreview?:(category:string,group:PlanGroup)=>void){
  if(request.crewCostLimit!==undefined&&crewCostProblem(request.crewCostLimit))throw Error(crewCostProblem(request.crewCostLimit));
  if(!['teams','boss','rumble','kizuna','pka'].includes(request.kind))throw Error('Bilinmeyen kadro işi.');
  const pka=request.kind==='pka'?validatePka(request.pka):undefined;if(pka){const problem=pkaProblem(pka,request.boss);if(problem)throw Error(problem);}
  const kizuna=request.kind==='kizuna'?validateKizunaSetup(request.kizuna,new Set(request.characters.map(c=>c.id))):undefined;
  if(kizuna&&!request.boss)throw Error('Kizuna karşılaşması eksik.');
  const timedBoss=kizuna?bossTimeline(kizunaBoss(request.boss!,kizuna)):['boss','pka'].includes(request.kind)&&request.boss?bossTimeline(request.boss):undefined;
  const prepared=new Map<Scenario,{pool:PlanMember[];context?:ReturnType<typeof makeAdventureContext>}>(),results=new Map<string,PlanGroup>();
  return (scenario:Scenario,category=request.category||''):PlanGroup=>{
    const key=scenario+'|'+category,cached=results.get(key);if(cached)return cached;
    let entry=prepared.get(scenario);if(!entry){const base=candidates(request.box,request.characters,request.data,scenario),pool=kizuna?base.map(m=>kizunaMember(m,kizuna)):pka?base.map(m=>pkaMember(m,pka)):base;entry={pool,context:request.kind==='rumble'?undefined:makeAdventureContext(pool,request.data,timedBoss,request.crewCostLimit)};prepared.set(scenario,entry);}
    const {pool,context}=entry,title=SCENARIOS.find(s=>s.id===scenario)!.name;
    if((kizuna||pka)&&onPreview){
      const early=solveAdventure(pool,category,timedBoss,kizuna?0:request.preparation,request.sockets,request.data,context,undefined,kizuna,true,pka,undefined,request.crewCostLimit).filter(t=>kizuna?.mode==='super'?!!t.combat:!t.missing?.length&&t.combat?.status!=='blocked');
      if(early.length)onPreview(category,{scenario,title,teams:pka?rankPkaTeams(early.map(t=>describePka(t,pka,request.data,request.box,request.boss)),pka):rankKizunaTeams(early,kizuna!),diagnostic:'',provisional:true});
    }
    const report=(teams:PlanTeam[])=>pka?rankPkaTeams(teams.map(t=>describePka(t,pka,request.data,request.box,request.boss)),pka):kizuna?rankKizunaTeams(teams,kizuna):teams;
    const found = request.kind === 'rumble' ? solveAutoRumble(pool, request.data, Math.min(300,request.costLimit || 300), request.mode || 'attack', category,request.rumbleRules) : solveAdventure(pool, category, timedBoss, kizuna?0:request.preparation, request.sockets, request.data,context,teams=>onPreview?.(category,{scenario,title,teams:report(teams),diagnostic:'',provisional:true}),kizuna,false,pka,undefined,request.crewCostLimit);
    const teams=report(found);
    const sources = new Set(pool.filter(m => matches(m, category)&&eligibleForQuest(m.character,timedBoss?.restrictions)).map(m => m.sourceId)).size;
    const rumbleSources = new Set(pool.filter(m => matches(m, category) && (request.data.units[m.character.id]?.rumble?.ability.length || m.character.rumble?.abilityLevels.length)).map(m => m.sourceId)).size;
    const count = request.kind === 'rumble' ? rumbleSources : sources;
    const diagnostic = count < 5 ? `${category || 'Bu seçim'} için ${count} farklı karakter var. Tam kadro için ${5 - count} karakter daha gerekli.` : request.kind === 'rumble' ? 'Bu maliyetle 5 aktif üye oluşturulamadı. Maliyet sınırını artır veya tip / sınıf filtresini kaldır.' : (request.crewCostLimit!==undefined?'Cost sınırı '+request.crewCostLimit+' içinde uygun kadro bulunamadı. Daha düşük costlu kartlarını ekle veya tip filtresini kaldır. ':'')+'Metninden kapsamı okunabilen bir kaptan ve uyumlu 4 üye bulunamadı. Karma kadro seç veya karakterlerin kaynak kaptan metnini kontrol et.';
    const problem=questRestrictionProblem(timedBoss),prefix=timedBoss?.restrictions?.status==='verified'?'Görevin katılım koşulları uygulandı. ':'';
    const result={scenario,title,teams,diagnostic:teams.length?'':problem||prefix+diagnostic};results.set(key,result);return result;
  };
}
export function plan(request: PlanRequest): PlanGroup[] {
  const solve=createPlannerSession(request);return SCENARIOS.filter(s=>!request.scenario||s.id===request.scenario).map(s=>solve(s.id));
}
