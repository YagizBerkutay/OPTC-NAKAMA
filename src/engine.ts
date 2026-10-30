import { type Character, type Owned, type Boss, type Effect, type RumbleEffect, MECHANICS } from './model';
import {eligibleForQuest,questCrewFits,questRestrictionProblem} from './quest-restrictions';
import type {CombatHooks,CombatState,CombatWindow} from './pve-combat';
import {hpChanges} from './pve-hazards';
import {stageBarriers,slotChanges} from './pve-barriers';
import {chargeFor} from './kizuna';
import {statusTargets} from './pve-status';
export const accepts = (captain: Owned, member: Character) => captain.ability.captainVerified && ((!captain.ability.captainTypes.length && !captain.ability.captainClasses.length) || member.types.some(t => captain.ability.captainTypes.includes(t)) || member.classes.some(c => captain.ability.captainClasses.includes(c)));
type Member = { character: Character; owned: Owned; friend?: boolean; specialText?:string; rewindResistance?:number;bindResistance?:number;specialBindResistance?:number };
function usableOrder(members:Member[],stage:Boss['stages'][number],indices:number[],slotSources:Set<number>){
  const durations={bind:stage.requirements.find(e=>e.mechanic==='bind')?.turns||0,specialBind:stage.requirements.find(e=>e.mechanic==='specialBind')?.turns||0};
  const target=(kind:'bind'|'specialBind',i:number)=>statusTargets(stage,kind,i);
  // Preserve legality first. Among currently usable skills, pay HP costs before
  // healing so the plan cannot silently heal at full HP then cut that heal away.
  const priority=(i:number)=>hpChanges(members[i].specialText||'').length?0:slotSources.has(i)?3:/\bDeals?\s+\d[^.;]*damage\b/i.test(members[i].specialText||'')?2:1;
  const ordered:number[]=[],pending=new Set([...indices].sort((a,b)=>priority(a)-priority(b)||a-b));
  for(let pass=0;pass<members.length&&pending.size;pass++)for(const i of [...pending]){
    const m=members[i];if(target('bind',i)&&durations.bind>(m.bindResistance||0)||target('specialBind',i)&&durations.specialBind>(m.specialBindResistance||0))continue;
    ordered.push(i);pending.delete(i);for(const kind of ['bind','specialBind']as const)durations[kind]=Math.max(0,durations[kind]-(m.owned.ability.effects.find(e=>e.mechanic===kind)?.turns||0));
  }
  return pending.size?null:ordered;
}
export type PveResult = { members: Member[]; schedule: { stage: string; turn: number; used: string[] }[]; missing: string[]; score: number;combatWindows?:CombatWindow[] };
export function evaluatePve(members: Member[], boss: Boss,options:{combat?:CombatHooks;beamLimit?:number}={}): Omit<PveResult, 'members'> {
  if(questRestrictionProblem(boss)||!questCrewFits(members,boss.restrictions))return {schedule:[],missing:[questRestrictionProblem(boss)||'Kadro görevin katılım koşullarını karşılamıyor.'],score:-10000};
  type Path = { next: number[]; schedule: PveResult['schedule']; missing: string[]; score: number;combatState?:CombatState;combatWindows?:CombatWindow[] };
  // Damage / healing bonuses rank paths only after their mandatory mechanics.
  const comparePaths=(a:Path,b:Path)=>Number(!!a.combatState?.dead)-Number(!!b.combatState?.dead)||a.missing.length-b.missing.length||b.score-a.score;
  let paths: Path[] = [{ next: members.map(m => m.owned.readyTurn ?? Infinity), schedule: [], missing: [], score: 0,combatState:options.combat?.initial,combatWindows:options.combat?[]:undefined }];
  const slotProfiles=members.map(m=>slotChanges(m.specialText||''));
  for (const sourceStage of boss.stages) {
   const expanded: Path[] = [];
   for (const p of paths) {
    const stage=options.combat?.resolveStage?.(sourceStage,p.combatState!)||sourceStage;
    const desiredSlots=stageBarriers(stage).filter(b=>b.kind==='slot'&&b.slot).map(b=>b.slot);
    const slotSources=new Set(members.flatMap((m,i)=>slotProfiles[i].some(s=>desiredSlots.includes(s.to)||s.to==='MATCHING'&&m.character.types.length===1&&desiredSlots.includes(m.character.types[0]))?[i]:[]));
    for (let mask = 0; mask < (stage.requirements.length||options.combat ? 1 << members.length : 1); mask++) {
      const ready=p.next.map((previous,i)=>{const n=Math.max(0,previous-chargeFor(stage,members[i].character));const rewind=Math.max(0,(stage.cooldownRewind||0)-(members[i].rewindResistance||0));return rewind?Math.max(n,stage.turn)+rewind:n;});
      const selected = members.filter((_, i) => mask & (1 << i));
      if (selected.length > (stage.specialLimit ?? members.length)) continue;
      if (members.some((m, i) => (mask & (1 << i)) && (ready[i] > stage.turn || p.combatState?.switched?.includes(m.character.id) || stage.plannedAbilities?.some(a=>a.changesForm&&a.sourceId===m.character.id) || !m.owned.ability.verified || m.owned.cooldown === null || stage.blockedSpecialPatterns?.some(pattern=>new RegExp(pattern,'i').test(m.specialText || ''))))) continue;
      const order=usableOrder(members,stage,members.flatMap((_,i)=>mask&(1<<i)?[i]:[]),slotSources);if(!order)continue;
      let missing = stage.requirements.filter(req => selected.reduce((turns, m) => turns + (m.owned.ability.effects.find(e => e.mechanic === req.mechanic)?.turns || 0), 0) < req.turns);
      const remaining=stage.requirements.map(req=>({...req,turns:Math.max(0,req.turns-selected.reduce((n,m)=>n+(m.owned.ability.effects.find(e=>e.mechanic===req.mechanic)?.turns||0),0))})).filter(e=>e.turns>0);
      const combat=options.combat?.step(stage,order,p.combatState!,remaining,ready);
      const used=combat?.used||order,next=ready.map((n,i)=>used.includes(i)?stage.turn+members[i].owned.cooldown!:n);
      missing=stage.requirements.filter(req=>used.reduce((n,i)=>n+(members[i].owned.ability.effects.find(e=>e.mechanic===req.mechanic)?.turns||0),0)<req.turns&&!combat?.neutralized?.includes(req.mechanic));
      const key=(s:Boss['stages'][number])=>s.id.split(':turn:')[0];
      const previous=p.missing.filter(text=>!boss.stages.filter(s=>key(s)===key(stage)).some(s=>combat?.neutralized?.some(m=>text.startsWith(s.name+': '+MECHANICS[m]+' '))));
      expanded.push({ next, schedule: [...p.schedule, { stage: stage.name, turn: stage.turn, used: used.map(i=>{const m=members[i];return `${m.friend ? 'Arkadaş: ' : ''}#${m.character.id} ${m.character.name}`;}) }], missing: [...previous, ...missing.map(e => `${stage.name}: ${MECHANICS[e.mechanic]} ${e.turns} tur${combat?.window.counterplay?.some(c=>c.mechanic===e.mechanic&&c.status==='conditional')?' · alternatif bitirme için doğrulama gerekli':''}`)], score: p.score + (stage.requirements.length - missing.length+p.missing.length-previous.length) * 100 - used.length+(combat?.score||0),combatState:combat?.state,combatWindows:combat?[...p.combatWindows||[],combat.window]:undefined });
    }
   }
    paths = expanded.sort(comparePaths).slice(0, options.beamLimit||100);
  }
  const best = paths.sort(comparePaths)[0];
  return best || { schedule: [], missing: ['Yetenek planı bulunamadı.'], score: 0 };
}
export function solvePve(box: Owned[], characters: Character[], boss: Boss, friendId: string, friendOverride?: Owned): PveResult[] {
  if(questRestrictionProblem(boss))return [];
  const map = new Map(characters.map(c => [c.id, c]));
  // A friend's actual state must be entered, even when using the same character ID.
  const friend = friendOverride || box.find(o => o.id === friendId);
  if (!friend?.ability.captainVerified || !map.has(friendId)||!eligibleForQuest(map.get(friendId)!,boss.restrictions)) return [];
  const available = box.filter(o => map.has(o.id)&&eligibleForQuest(map.get(o.id)!,boss.restrictions));
  const captains = available.filter(o => o.ability.captainVerified).slice(0, 12);
  const results: PveResult[] = [];
  for (const captain of captains) {
    const captainChar = map.get(captain.id)!;
    if (!accepts(captain, captainChar) || !accepts(friend, captainChar) || !accepts(captain, map.get(friendId)!)) continue;
    const pool = available.filter(o => o.id !== captain.id && accepts(captain, map.get(o.id)!) && accepts(friend, map.get(o.id)!));
    const relevance = (o: Owned) => o.ability.verified ? boss.stages.flatMap(s => s.requirements).filter(r => o.ability.effects.some(e => e.mechanic === r.mechanic && e.turns >= r.turns)).length : 0;
    pool.sort((a,b) => relevance(b)-relevance(a) || map.get(b.id)!.atk-map.get(a.id)!.atk);
    if (pool.length < 4) continue;
    // Bounded search: try combinations from the 14 most relevant compatible units.
    const p = pool.slice(0,14);
    for (let a=0;a<p.length-3;a++) for(let b=a+1;b<p.length-2;b++) for(let c=b+1;c<p.length-1;c++) for(let d=c+1;d<p.length;d++) {
      const members: Member[] = [ { character: captainChar, owned: captain }, { character: map.get(friendId)!, owned: friend, friend: true }, ...[p[a],p[b],p[c],p[d]].map(o => ({ character: map.get(o.id)!, owned: o })) ];
      if(!questCrewFits(members,boss.restrictions))continue;
      // A cheap ranking keeps expensive stage scheduling bounded.
      const coverage = boss.stages.flatMap(s => s.requirements).filter(r => members.some(m => m.owned.ability.verified && m.owned.ability.effects.some(e => e.mechanic === r.mechanic && e.turns >= r.turns))).length;
      results.push({ members, schedule: [], missing: [], score: coverage * 100 });
    }
  }
  return results.sort((a,b)=>b.score-a.score).slice(0, 35).map(r => ({ ...r, ...evaluatePve(r.members,boss) })).sort((a,b)=>b.score-a.score).filter((r,i,all)=>all.findIndex(x=>x.members.map(m=>m.character.id).sort().join(',')===r.members.map(m=>m.character.id).sort().join(','))===i).slice(0,3);
}
export function upgrades(box: Owned[], characters: Character[], boss?: Boss) {
  const map = new Map(characters.map(c=>[c.id,c]));
  const needs = boss?.stages.flatMap(s => s.requirements) || [];
  return box.flatMap(o => {
    const c=map.get(o.id); if(!c) return [];
    const relevance = needs.filter(r=>o.ability.verified && o.ability.effects.some(e=>e.mechanic===r.mechanic && e.turns>=r.turns));
    const jobs: { character: Character; title: string; reason: string; score: number }[]=[];
    if(o.level===null) jobs.push({character:c,title:'Seviyeyi kaydet',reason:'Geliştirme ihtiyacını hesaplamak için mevcut seviye gerekli.',score:5});
    else if(o.level<c.maxLevel) jobs.push({character:c,title:`Seviye ${o.level} → ${c.maxLevel}`,reason:`Temel statların artar.${relevance.length ? ' Hedef boss için doğrulanmış bir mekanik karşılıyor.' : ''}`,score:20+relevance.length*20});
    if(o.cooldown!==null && o.ability.maxCooldown!==null && o.cooldown>o.ability.maxCooldown) jobs.push({character:c,title:`Special cooldown ${o.cooldown} → ${o.ability.maxCooldown}`,reason:relevance.length ? `Hedefte ${[...new Set(relevance.map(r=>MECHANICS[r.mechanic]))].join(', ')} karşılıyor; daha erken veya tekrar kullanım sağlayabilir. İlk hazır turunu da güncelle.` : 'Doğruladığın hedef cooldown’a ulaşarak special bekleme süresini azalt.',score:30+relevance.length*25});
    if(!o.ability.verified || !o.ability.captainVerified) jobs.push({character:c,title:'PvE kurallarını doğrula',reason:'Kaynak yetenek metnini kontrol edip kaldırdığı etkileri ve kaptan kapsamını kaydet.',score:10+relevance.length*5});
    if(c.rumble?.abilityLevels.length && o.rumbleAbility!==null && o.rumbleAbility<Math.min(5,c.rumble.abilityLevels.length)) jobs.push({character:c,title:`Rumble ability ${o.rumbleAbility} → ${Math.min(5,c.rumble.abilityLevels.length)}`,reason:'Kaynakta daha yüksek ability seviyesi mevcut. Rumble kullanıyorsan değerlendir.',score:15});
    return jobs;
  }).sort((a,b)=>b.score-a.score);
}
function levelEffects(levels: { effects?: RumbleEffect[] }[], level: number): RumbleEffect[] {
  const base=structuredClone(levels[0]?.effects || []);
  for(let i=1;i<Math.min(level,levels.length);i++) for(const [j,e] of (levels[i].effects||[]).entries()) {
    const override=e.override as Partial<RumbleEffect>|undefined;
    base[j]={...base[j],...e,...override};
  }
  return base;
}
function buffValue(source: Member, target: Member, mode: 'attack'|'defense') {
  const r=source.character.rumble; if(!r || !source.owned.rumbleAbility) return 0;
  let value=0;
  for(const e of levelEffects(r.abilityLevels,source.owned.rumbleAbility)) {
    if(e.effect!=='buff' || !e.targeting || e.conditions || e.condition) continue;
    const t=e.targeting;
    if(t.targets?.includes('self') && source.character.id!==target.character.id) continue;
    if(!t.targets?.some(x=>x==='crew'||x==='self'||target.character.types.includes(x)||target.character.classes.includes(x))) continue;
    if(t.types?.length && !target.character.types.some(x=>t.types!.includes(x))) continue;
    if(t.classes?.length && !target.character.classes.some(x=>t.classes!.includes(x))) continue;
    // Unknown targeting keys/conditions are excluded rather than guessed.
    if(Object.keys(t).some(k=>!['targets','types','classes'].includes(k))) continue;
    const weight=(e.attributes||[]).reduce((sum,a)=>sum+((mode==='attack'?{ATK:3,SPD:2,HP:1,DEF:1}:{ATK:1,SPD:1,HP:2,DEF:3})[a as 'ATK']||0),0);
    value+=(e.level||0)*weight;
  }
  return value;
}
export function solveRumble(box: Owned[], characters: Character[], costLimit:number, mode:'attack'|'defense') {
  const map=new Map(characters.map(c=>[c.id,c]));
  const pool=box.filter(o=>{const c=map.get(o.id);return !c?.supportOnly&&c?.rumble?.abilityLevels.length && c.rumble.specialLevels.length && o.rumbleAbility!==null && o.rumbleSpecial!==null;}).map(o=>({character:map.get(o.id)!,owned:o}));
  const score=(team:Member[])=>team.reduce((sum,m)=>sum+(m.character.rumble!.stats.spd||0)/100+(m.character.rumble!.stats.def||0)/100,0)+team.reduce((sum,s)=>sum+team.reduce((v,t)=>v+buffValue(s,t,mode),0),0);
  let beams:{members:Member[];cost:number;score:number}[]=[{members:[],cost:0,score:0}];
  for(let size=0;size<5;size++) {
    const next=[]; const seen=new Set<string>();
    for(const b of beams) for(const m of pool) {
      if(b.members.some(x=>x.character.id===m.character.id)) continue;
      const cost=b.cost+m.character.rumble!.cost; if(cost>costLimit) continue;
      const members=[...b.members,m]; const key=members.map(x=>x.character.id).sort().join(','); if(seen.has(key))continue; seen.add(key);
      next.push({members,cost,score:score(members)});
    }
    beams=next.sort((a,b)=>b.score-a.score).slice(0,60);
  }
  return beams.slice(0,3).map(b=>({...b,reasons:[`Koşulsuz buff uyumu: ${Math.round(b.score)} puan (tahmini sıralama).`,...b.members.map(m=>`${m.character.name}: ability ${m.owned.rumbleAbility}, special ${m.owned.rumbleSpecial}; ${m.character.rumble!.stats.rumbleType||'rol bilinmiyor'}`)]}));
}
