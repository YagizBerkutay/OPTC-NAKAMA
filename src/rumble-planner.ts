import type { RumbleEffect } from './model';
import { skillAt, type PlannerData, type PlanMember, type PlanTeam } from './planning';
import {ruleMemberValue,ruleDescription,rulesValid,type RumbleRules} from './rumble-rules';
import {assaultRuleBounds,type AssaultRequest,type AssaultEnemy} from './assault-rumble';
import {pkaBuddyFactor,type PkaRumbleRequest} from './pka-rumble';
export type RumbleBattleContext={mode:'Assault Rumble'|'Pirate King Adventures';enemies:AssaultEnemy[];completeEnemies:boolean};

const norm = (v: string) => v.replace(/[\[\]]/g, '').toLowerCase();
const family = (v: string) => v.replace(/\([^)]*\)/g, '').replace(/[^a-z]/gi, '').toLowerCase();
export function tagged(m: PlanMember, values: string[], data: PlannerData) {
  const tags = [...m.character.types, ...m.character.classes, ...(data.units[m.character.id]?.tags || [])].map(norm);
  return values.some(v => { const parts=[...v.matchAll(/\[([^\]]+)\]/g)].map(m=>norm(m[1])); const matches=(token:string)=>tags.includes(token)||tags.some(t=>t.split(' / ').includes(token)); return parts.length>1?parts.every(matches):matches(norm(v)); });
}
function named(m: PlanMember, values: string[]) { return values.some(v => m.families.some(f => family(f) === family(v)) || family(m.character.name.split(/\s+-\s+|:/)[0]).includes(family(v))); }
type Condition = { mode?:string;type?: string; comparator?: string; count?: number; targets?: string[]; families?: string[]; composition?: boolean; team?: string; conditions?: Condition[] };
export function rumbleCondition(condition: unknown, active: PlanMember[], roster: PlanMember[], data: PlannerData,battle?:RumbleBattleContext): number {
  if (!condition) return 1;
  if (Array.isArray(condition)) return condition.reduce((v, c) => v * rumbleCondition(c, active, roster, data,battle), 1);
  if (typeof condition !== 'object') return 0;
  const c = condition as Condition, comparator = c.comparator?.toLowerCase(), count = Number(c.count) || 0;
  if(c.type==='mode')return Number(!!battle&&c.mode===battle.mode);
  if (c.type === 'time') {
    if (comparator === 'first' || comparator === 'remaining') return Math.min(1, Math.max(0, count / 100));
    if (comparator === 'after') return Math.min(1, Math.max(0, (100 - count) / 100));
    return 0;
  }
  if (c.team === 'enemies' || c.team === 'enemy') {
    if(!battle)return 0;
    const matching=battle.enemies.filter(e=>(!c.targets?.length||c.targets.some(t=>[...e.types,...e.classes,...e.tags].map(norm).includes(norm(t))))&&(!c.families?.length||c.families.some(f=>(data.units[e.id||'']?.families||[e.name.split(':')[0]]).some(v=>family(v)===family(f)))));
    if(c.type==='character')return Number(matching.length>0);
    if(c.type==='crew'){const knownTargets=!c.families?.length&&(c.targets||[]).every(t=>['STR','DEX','QCK','PSY','INT','Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'].includes(t))&&battle.enemies.every(e=>e.types.length>0&&(!(c.targets||[]).some(t=>!['STR','DEX','QCK','PSY','INT'].includes(t))||e.classes.length>0));return comparator==='more'?Number(matching.length>=count):battle.completeEnemies&&knownTargets?comparator==='less'?Number(matching.length<=count):comparator==='equal'?Number(matching.length===count):0:0;}
    return 0;
  }
  if (c.type === 'character' && c.families?.length) return roster.some(m => named(m, c.families!)) ? 1 : 0;
  if (c.type === 'crew') {
    const crew = c.composition ? roster : active;
    const n = crew.filter(m => (!c.targets?.length || tagged(m, c.targets, data)) && (!c.families?.length || named(m, c.families))).length;
    return comparator === 'more' ? Number(n >= count) : comparator === 'less' ? Number(n <= count) : comparator === 'equal' ? Number(n === count) : 0;
  }
  // HP, hit counters, opponent, status and other mode conditions require battle state.
  return 0;
}
export function targetSet(e: RumbleEffect, source: PlanMember, active: PlanMember[], data: PlannerData) {
  const t = e.targeting as { targets?: string[]; types?:string[]; classes?:string[]; families?: string[]; count?:number; priority?:string; stat?:string; excludes?:string[]; status?:unknown; switch?:unknown } | undefined;
  if (!t || t.status || t.switch) return [];
  let targets = active.filter(m => (t.targets || []).some(v => norm(v) === 'crew' || (norm(v) === 'self' && m === source) || tagged(m, [v], data)) && (!t.types?.length || m.character.types.some(v=>t.types!.some(type=>norm(type)===norm(v)))) && (!t.classes?.length || m.character.classes.some(v=>t.classes!.some(c=>norm(c)===norm(v)))) && (!t.families?.length || named(m, t.families)) && !(t.excludes || []).some(v => norm(v) === 'self' ? m === source : tagged(m, [v], data)));
  if (t.stat && t.priority) targets = targets.sort((a, b) => {
    const stat = (m: PlanMember) => t.stat === 'ATK' ? m.attack : t.stat === 'HP' ? m.character.hp : data.units[m.character.id]?.rumble?.stats[t.stat!.toLowerCase() as 'def'|'spd'] || 0;
    return (stat(b) - stat(a)) * (t.priority === 'lowest' ? -1 : 1);
  });
  if (t.count) targets = targets.slice(0, t.count);
  return targets;
}
const key = (team: PlanMember[]) => team.map(m => `${m.sourceId}:${m.character.id}`).sort().join(',');
const distinct = (team: PlanMember[], m: PlanMember) => !team.some(t => t.sourceId === m.sourceId || t.character.id === m.character.id || t.families.some(f => m.families.includes(f)));
export function conditionText(value:unknown):string {
  if(!value)return 'Koşulsuz';if(Array.isArray(value))return value.map(conditionText).join(' ve ');
  const c=value as Record<string,unknown>;
  if(c.type==='time')return `${c.comparator==='first'?'İlk':c.comparator==='after'?'Geçen süre':'Kalan süre'} ${c.count} saniye`;
  if(c.type==='crew')return `${c.composition?'Tüm kadro':'Sahadaki üye'} ${c.comparator==='less'?'en fazla':'en az'} ${c.count} · ${(c.targets as string[]||[]).join(' / ')}`;
  if(c.type==='stat')return `${c.stat} ${c.comparator==='below'?'altında':'üstünde'} %${c.count}`;
  if(c.type==='character')return `${c.team==='enemies'?'Rakip':'Kadro'}: ${(c.families as string[]||[]).join(' / ')}`;
  if(c.type==='mode')return `Mod: ${c.mode}`;
  return `Tetik: ${c.stat||c.type} · ${c.count||''}`;
}
export function skillDescription(e:RumbleEffect){return `${e.effect||'Etki'} · ${(e.attributes||[]).join(' / ')}${e.level!==undefined?' Lv.'+e.level:''}${e.amount!==undefined?' · '+e.amount+' '+(e.type||''):''} → ${(e.targeting?.targets||[]).join(' / ')||'kaynak hedefi'}${e.targeting?.count?' · '+e.targeting.count+' hedef':''}${e.duration?' · '+e.duration+' saniye':''}${e.chance!==undefined?' · %'+e.chance+' şans':''} · ${conditionText(e.condition||e.conditions)}`;}

export type RumbleOffense = {
  directSources:number; areaSources:number; cutSources:number; dotSources:number; cycleIndex:number;
  risk:'high'|'elevated'|'lower'; balance:number;
  members:{id:string;name:string;cooldown:number|null;direct:number;baseDirect?:number;cut:boolean;dot:boolean;uncertain:number;effects:string[]}[];
};
// Comparison indices, not HP damage or an exact combat simulation. Cuts and DoT
// contribute pressure separately; they do not stand in for a ready direct special.
function enemyCoverage(e:RumbleEffect,battle?:RumbleBattleContext):number {
  const t=e.targeting as {targets?:string[];types?:string[];classes?:string[];families?:string[];status?:unknown;switch?:unknown;count?:number}|undefined;
  if(!t||t.status||t.switch)return 0;
  if(battle){
    const enemies=battle.enemies.filter(m=>t.targets?.some(v=>['enemy','enemies'].includes(norm(v))||[...m.types,...m.classes,...m.tags].some(tag=>norm(tag)===norm(v)))&&(!t.types?.length||t.types.some(v=>m.types.includes(v)))&&(!t.classes?.length||t.classes.some(v=>m.classes.includes(v)))&&(!t.families?.length||t.families.some(v=>family(m.name.split(':')[0])===family(v))));
    return Math.min(t.count??enemies.length,e.spread?Math.min(1,enemies.length):enemies.length);
  }
  if(!t.targets?.some(v=>['enemy','enemies'].includes(norm(v)))||t.types?.length||t.classes?.length||t.families?.length)return 0;
  if(e.spread)return 1; // Total damage shared among targets, not a full hit per enemy.
  const range=e.range as {size?:string}|undefined;
  return Math.min(5,Math.max(0,t.count??(range?range.size==='large'?3:range.size==='small'?1.5:2:5)));
}
function damageMagnitude(e:RumbleEffect,m:PlanMember):number {
  const amount=Number(e.amount)||0,random=e.amountrange as number[]|undefined;
  return e.type==='fixed'?amount/350:e.type==='atk'||e.type==='atkbase'?amount*m.attack/1800:e.type==='random'&&random?.length===2?(random[0]+random[1])/700:0;
}

export function makeRumbleContext(pool: PlanMember[], data: PlannerData, mode: 'attack'|'defense', category = '', limit = 300, rules?:RumbleRules,assault?:AssaultRequest,pka?:PkaRumbleRequest) {
  if(pka&&(rules||assault))throw Error('PKA Rumble standart Rules veya Assault bağlamıyla birleştirilemez.');
  if(rules&&!rulesValid(rules))throw Error('Rumble kural profili geçersiz; ekranı yeniden okut.');
  const prepared = pool.filter(m => !m.character.supportOnly&&(!category || m.character.types.includes(category) || m.character.classes.includes(category))).map(m => {
    const r = data.units[m.character.id]?.rumble, tiers = data.units[m.character.id]?.llb.slice(0, m.owned.llb) || [];
    const ability = tiers.some(t => t?.rAbility) && r?.llbability.length ? r.llbability : r?.ability || m.character.rumble?.abilityLevels || [];
    const special = tiers.some(t => t?.rSpecial) && r?.llbspecial.length ? r.llbspecial : r?.special || m.character.rumble?.specialLevels || [];
    const extras=tiers.some(t=>t?.rSuperSpecial)&&r?.llbsuperspecial?.length?r.llbsuperspecial:r?.superspecial||[];
    const stats=r?.stats||m.character.rumble?.stats||{},factor=pkaBuddyFactor(m.character.types,pka);
    return { m, ability:skillAt(ability,m.abilityLevel), special:skillAt(special,m.specialLevel),extras, valid:ability.length>0&&special.length>0, cost:r?.cost ?? m.character.rumble?.cost ?? 999, stats:{...stats,def:(stats.def||0)*factor,spd:(stats.spd||0)*factor}, resilience:(tiers.some(t=>t?.rResilience)&&r?.llbresilience?.length?r.llbresilience:r?.resilience||[]) as {type?:string;attribute?:string;chance?:number;percentage?:number}[] };
  }).filter(p => p.valid && p.cost <= limit);
  const byMember = new Map(prepared.map(p => [p.m,p]));
  const enemy=assault?.context.enemies[assault.boss],battle:RumbleBattleContext|undefined=pka?{mode:'Pirate King Adventures',enemies:pka.context.enemies.filter(e=>e.slot<5),completeEnemies:true}:assault?{mode:'Assault Rumble',enemies:enemy?[enemy]:[{name:assault.boss,types:[],classes:[],tags:[],level:null,abilityLevel:null,specialLevel:null,stats:{},details:{},complete:false}],completeEnemies:false}:undefined;
  const resistanceTexts=(pka?battle!.enemies:enemy?[enemy]:[]).map(e=>(e.details.resistance||'').split(/ADDITIONAL RESISTANCES|UNLOCK REQUIREMENT/i)[0]);
  const cutFactor=resistanceTexts.length?resistanceTexts.reduce((n,t)=>{const m=t.match(/reduce[sd]?\s+percentage damage by\s*(\d+)\s*%/i);return n+(m?1-Math.min(100,Number(m[1]))/100:/percentage damage/i.test(t)?0:1);},0)/resistanceTexts.length:1;
  const protections=new Map<string,number>();
  const protection=(attribute:string)=>{const saved=protections.get(attribute);if(saved!==undefined)return saved;const re=new RegExp('Completely evades[^.;]*\\b'+attribute.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i'),value=resistanceTexts.length?resistanceTexts.filter(t=>!re.test(t)).length/resistanceTexts.length:1;protections.set(attribute,value);return value;};
  const damageAgainst=new Map(pool.map(m=>{const enemies=pka?battle!.enemies:[],factors=enemies.map(e=>{const text=(e.details.resistance||'').split(/ADDITIONAL RESISTANCES|UNLOCK REQUIREMENT/i)[0];let factor=1;for(const type of m.character.types){const match=text.match(new RegExp('reduce[sd]?\\s+damage\\s+(?:taken\\s+)?from\\s+\\[?'+type+'\\]?\\s+(?:characters?\\s+)?by\\s*(\\d+)\\s*%','i'));if(match)factor=Math.min(factor,1-Math.min(100,Number(match[1]))/100);}return factor;});return [m,factors.length?factors.reduce((n,f)=>n+f,0)/factors.length:1] as const;}));
  const magnitude=(e:RumbleEffect,m:PlanMember)=>damageMagnitude(e,m)*(damageAgainst.get(m)??1);
  const compiledConditions=new Map<unknown,(active:PlanMember[],roster:PlanMember[])=>number>();
  const compileCondition=(value:unknown):((active:PlanMember[],roster:PlanMember[])=>number)=>{
    if(!value)return ()=>1;const cached=compiledConditions.get(value);if(cached)return cached;
    let fn:(active:PlanMember[],roster:PlanMember[])=>number;
    if(Array.isArray(value)){const parts=value.map(compileCondition);fn=(active,roster)=>parts.reduce((n,f)=>n*f(active,roster),1);}
    else if(typeof value==='object'){
      const c=value as Condition;
      if(c.type==='crew'&&c.team!=='enemy'&&c.team!=='enemies'){
        const matching=new Set(prepared.filter(p=>(!c.targets?.length||tagged(p.m,c.targets,data))&&(!c.families?.length||named(p.m,c.families))).map(p=>p.m)),count=Number(c.count)||0;
        fn=(active,roster)=>{const n=(c.composition?roster:active).reduce((n,m)=>n+Number(matching.has(m)),0);return c.comparator==='more'?Number(n>=count):c.comparator==='less'?Number(n<=count):c.comparator==='equal'?Number(n===count):0;};
      }else if(c.type==='character'&&c.team!=='enemy'&&c.team!=='enemies'&&c.families?.length){const matching=new Set(prepared.filter(p=>named(p.m,c.families!)).map(p=>p.m));fn=(_active,roster)=>Number(roster.some(m=>matching.has(m)));}
      else {const constant=rumbleCondition(value,[],[],data,battle);fn=()=>constant;}
    }else fn=()=>0;
    compiledConditions.set(value,fn);return fn;
  };
  const condition=(value:unknown,active:PlanMember[],roster:PlanMember[])=>compileCondition(value)(active,roster);
  const ruleBounds=new Map(prepared.map(p=>[p.m,assault?assaultRuleBounds(p.m,data.units[p.m.character.id]?.tags||[],assault.context.rules,assault.boss):{low:1,high:1,clauses:[],uncertain:false}]));
  const ruleFactor=(m:PlanMember)=>assault?.ruleInterpretation==='upper'?ruleBounds.get(m)!.high:ruleBounds.get(m)!.low;
  const weights:Record<string,number> = mode === 'attack' ? { ATK:3, SPD:2, HP:1, DEF:1.5, 'Special CT':3, Guard:1, CRIT:1, Shield:2, Accuracy:1 } : { ATK:1.5, SPD:1, HP:2, DEF:3, 'Special CT':2, Guard:2, CRIT:1, Shield:3, Accuracy:1 };
  const allMembers=prepared.map(p=>p.m);
  const ruleValues=new Map(prepared.map(p=>[p.m,ruleMemberValue(p.m,data,rules,weights)]));
  const targetCache=new Map<RumbleEffect,Set<PlanMember>>();
  const constantCache=new Map<RumbleEffect,{chance:number;duration:number;enemies:number;attrs:number;amount:number;repeat:number}>();
  for(const p of prepared)for(const [skill,isSpecial] of [[p.ability,false],[p.special,true],...p.extras.map(s=>[s,true] as const)] as const)for(const e of skill.effects||[]){
    targetCache.set(e,new Set(targetSet({...e,targeting:{...e.targeting,count:undefined}},p.m,allMembers,data)));
    constantCache.set(e,{chance:Math.max(0,Math.min(1,Number(e.chance ?? 100)/100)),duration:isSpecial?Math.min(1,Number(e.duration??10)/Math.max(15,skill.cooldown||30)):1,enemies:enemyCoverage(e,battle),attrs:(e.attributes||[]).reduce((n,a)=>n+(weights[a]||1),0),amount:Number(e.amount)||0,repeat:Math.max(1,Math.min(10,Number(e.repeat)||1))});
  }
  const conditionWeight=(value:unknown,active:PlanMember[],roster:PlanMember[],conditional:boolean)=>conditional?condition(value,active,roster):value&&!['time','mode'].includes((value as Condition).type||'')?0:condition(value,active,roster);
  const extraWeight=(condition:unknown,source:PlanMember,active:PlanMember[],roster:PlanMember[]):number=>{
    if(!condition)return 0;if(Array.isArray(condition))return condition.reduce((n,c)=>n*extraWeight(c,source,active,roster),1);
    const known=rumbleCondition(condition,active,roster,data,battle);if(known)return known;
    const c=condition as {type?:string;count?:number;team?:string;targets?:string[]};
    if(c.type==='specialreceived'){
      if(c.team==='enemy'||c.team==='enemies')return Math.min(.3,.6/Math.max(1,c.count||1));
      const casters=active.filter(m=>(!c.targets?.length||tagged(m,c.targets,data))&&(byMember.get(m)?.special.effects||[]).some(e=>targetSet(e,m,active,data).includes(source)));
      return Math.min(.5,casters.length/Math.max(1,c.count||1)*.25);
    }
    if(c.type==='healreceived')return Math.min(.4,active.filter(m=>(byMember.get(m)?.special.effects||[]).some(e=>e.effect==='recharge'&&e.type!=='Special CT'&&targetSet(e,m,active,data).includes(source))).length/Math.max(1,c.count||1)*.2);
    return 0;
  };
  const damageEffects=new Map(prepared.map(p=>[p.m,(p.special.effects||[]).filter(e=>e.effect==='damage')]));
  const memberDamage=(m:PlanMember,active:PlanMember[],roster:PlanMember[],conditional=true)=>{
    const p=byMember.get(m)!;let direct=0,baseDirect=0,area=false,cut=0,dot=0,attackScaling=false;
    for(const e of damageEffects.get(m)||[]){
      const c=constantCache.get(e)!;
      const weight=conditionWeight(p.special.condition,active,roster,conditional)*conditionWeight(e.condition||e.conditions,active,roster,conditional)*c.chance;
      if(!weight||!c.enemies)continue;
      const rate=30/Math.max(15,p.special.cooldown||30),base=magnitude(e,m)*c.enemies*c.repeat*weight*rate,d=base*ruleFactor(m);baseDirect+=base;
      direct+=d;area ||= d>0&&!e.spread&&c.enemies>1;attackScaling ||= d>0&&(e.type==='atk'||e.type==='atkbase');
      if(e.type==='cut'||e.type==='percentage')cut+=c.amount/8*c.enemies*c.repeat*weight*rate*cutFactor;
      if(e.type==='time')dot+=(e.level||1)*2*c.enemies*weight*rate*protection('Damage Over Time');
    }
    return {direct,baseDirect,area,cut,dot,attackScaling};
  };
  const balanceCache=new Map<string,number>();
  const metrics=(active:PlanMember[],roster=active,conditional=true)=>{
    const members=active.map(m=>({m,...memberDamage(m,active,roster,conditional)}));
    const direct=members.reduce((n,m)=>n+m.direct,0),sources=members.filter(m=>m.direct>0).length;
    const coverage=Math.min(1,sources/2),capacity=direct/(direct+20*Math.max(1,active.length));
    const full=mode==='attack'?.18+.47*coverage+.35*capacity:.45+.3*coverage+.25*capacity;
    // Partial beams must retain useful supports before their damage carrier arrives.
    const balance=1-Math.min(1,active.length/5)*(1-full);
    if(conditional){if(balanceCache.size>100000)balanceCache.clear();balanceCache.set(key(active)+'|'+key(roster),balance);}
    return {members,direct,sources,balance};
  };
  const offense=(active:PlanMember[],roster=active):RumbleOffense=>{
    const result=metrics(active,roster),risk=result.sources===0||result.direct<20?'high':result.sources<2||result.direct<70?'elevated':'lower';
    return {directSources:result.sources,areaSources:result.members.filter(m=>m.area).length,cutSources:result.members.filter(m=>m.cut>0).length,dotSources:result.members.filter(m=>m.dot>0).length,cycleIndex:Math.round(result.direct*10)/10,risk,balance:result.balance,members:result.members.map(row=>{
      const p=byMember.get(row.m)!;
      const uncertain=(damageEffects.get(row.m)||[]).filter(e=>!enemyCoverage(e,battle)||!condition(p.special.condition,active,roster)||!condition(e.condition||e.conditions,active,roster)).length;
      return {id:row.m.character.id,name:row.m.character.name,cooldown:p.special.cooldown??null,direct:Math.round(row.direct*10)/10,baseDirect:row.baseDirect,cut:row.cut>0,dot:row.dot>0,uncertain,effects:(damageEffects.get(row.m)||[]).map(skillDescription)};
    })};
  };
  const damagePotential=(m:PlanMember)=> (damageEffects.get(m)||[]).reduce((n,e)=>{const c=constantCache.get(e)!;return n+magnitude(e,m)*c.enemies*c.repeat*c.chance*30/Math.max(15,byMember.get(m)!.special.cooldown||30)*ruleFactor(m);},0);
  const scoreCache=new Map<string,number>();
  const score = (active:PlanMember[], roster=active, conditional=true):number => {
    const cacheKey=(assault?active.map(m=>m.sourceId+':'+m.character.id).join(','):key(active))+(conditional?'|'+key(roster):'|base');
    const cached=scoreCache.get(cacheKey);if(cached!==undefined)return cached;
    const offenseMetrics=metrics(active,roster,conditional),carriers=new Set(offenseMetrics.members.filter(m=>m.direct>0).map(m=>m.m)),attackCarriers=new Set(offenseMetrics.members.filter(m=>m.attackScaling).map(m=>m.m));
    const result=active.reduce((total,m) => {
    const p=byMember.get(m)!;
    let value=m.attack/250+(m.health??m.character.hp)/2000+(p.stats.def||0)*(mode==='defense'?.08:.03)+(p.stats.spd||0)*.025+p.resilience.reduce((n,r)=>n+(r.type==='debuff'?(r.chance||0)/100*(mode==='defense'?3:1.5):0),0)+(ruleValues.get(m)||0);
    for(const [skill,isSpecial,isExtra] of [[p.ability,false,false],[p.special,true,false],...p.extras.map(s=>[s,true,true] as const)] as const) for(const e of skill.effects||[]) {
      const condition=e.condition||e.conditions;
      const weight=conditionWeight(condition,active,roster,conditional)*(isExtra?extraWeight(skill.condition,m,active,roster):conditionWeight(skill.condition,active,roster,conditional));
      if(!weight)continue;
      const {chance,duration,enemies,attrs,amount,repeat}=constantCache.get(e)!;
      const allyTargets=e.targeting?.count?targetSet(e,m,active,data):active.filter(t=>targetCache.get(e)!.has(t));
      const allies=allyTargets.length;
      let contribution=0;
      const compatibleCarriers=allyTargets.filter(t=>carriers.has(t)).length;
      if(e.effect==='buff'||e.effect==='penalty'){
        const compatibleAttackCarriers=allyTargets.filter(t=>attackCarriers.has(t)).length;
        const effectiveAttrs=(e.attributes||[]).reduce((n,a)=>n+(weights[a]||1)*(a==='Special CT'?(allies?(.15+.85*compatibleCarriers/allies):0):a==='ATK'?(allies?(.4+.6*compatibleAttackCarriers/allies):0):1),0);
        contribution=allies*(e.level||0)*effectiveAttrs*duration*(e.effect==='penalty'?-1:1);
      }
      else if(e.effect==='damage') {
        const damage=magnitude(e,m)||(e.type==='cut'||e.type==='percentage'?amount/8*cutFactor:e.type==='time'?(e.level||1)*2*protection('Damage Over Time'):0);
        contribution=damage*enemies*repeat*(mode==='attack'?1:.7)*30/Math.max(15,skill.cooldown||30)*ruleFactor(m);
      }
      else if(e.effect==='recharge') contribution=(e.type==='Special CT'?(.15*allies+.85*compatibleCarriers):allies)*(e.type==='Special CT'?amount/5:e.type==='fixed'?amount/400:e.type==='RCV'?amount*(m.recovery??m.character.rcv)/400:e.type==='percentage'?amount/8:0)*(mode==='defense'?1.2:1);
      else if(e.effect==='debuff') contribution=enemies*(e.level||1)*(e.attributes||[]).reduce((n,a)=>n+(weights[a]||1)*protection(a+' Down'),0)*duration*.7;
      else if(e.effect==='hinderance') contribution=enemies*((e.attributes||[]).reduce((n,a)=>n+(/Special Bind|Action Bind|Forced Out|Half Stats|Haste/i.test(a)?5:3)*protection(a),0)+(e.type==='Special CT'?amount/5:0))*Math.max(.2,duration);
      else if(e.effect==='boon') contribution=allies*(e.attributes||[]).reduce((n,a)=>n+(a==='Revive'?12:a==='Haste'?8:/Provoke|Counter/.test(a)?4:2),0)*Math.max(.3,duration);
      else if(e.effect==='cleanse'||e.effect==='evade') contribution=allies*attrs*2*Math.max(.3,duration);
      value+=contribution*weight*chance;
    }
    if(assault?.objective==='progression')value+=(m.health??m.character.hp)/3000+(p.stats.def||0)*.03;
    return total+value;
    },0)*offenseMetrics.balance+Math.sqrt(offenseMetrics.direct)*(mode==='attack'?18:9);
    if(scoreCache.size>100000)scoreCache.clear();scoreCache.set(cacheKey,result);return result;
  };
  return { prepared, byMember, score, offense, damagePotential, balance:(active:PlanMember[],roster=active)=>balanceCache.get(key(active)+'|'+key(roster))??metrics(active,roster).balance };
}

export function solveRumble(pool: PlanMember[], data: PlannerData, limit: number, mode: 'attack'|'defense', category: string, rules?:RumbleRules,options?:{assault?:AssaultRequest;pka?:PkaRumbleRequest;onPreview?:(teams:PlanTeam[])=>void;deep?:boolean;budgetMs?:number}): PlanTeam[] {
  if(!Number.isInteger(limit)||limit<1)throw Error('Rumble maliyet sınırı pozitif tam sayı olmalı.');
  if(!options?.assault)limit=Math.min(300,limit);
  const started=performance.now(),{prepared,byMember,score,offense,damagePotential}=makeRumbleContext(pool,data,mode,category,limit,rules,options?.assault,options?.pka);
  const potential=new Map(prepared.map(p=>[p.m,score([p.m], [p.m],false)+score([p.m,...prepared.filter(t=>t!==p).slice(0,4).map(t=>t.m)],undefined,false)/5]));
  const ranked=[...prepared].sort((a,b)=>potential.get(b.m)!-potential.get(a.m)!);
  const affordable=[...prepared].sort((a,b)=>potential.get(b.m)!/Math.max(1,b.cost)-potential.get(a.m)!/Math.max(1,a.cost)).slice(0,35);
  const damageCandidates=[...prepared].sort((a,b)=>damagePotential(b.m)-damagePotential(a.m)).slice(0,16);
  const fast=!!(options?.assault||options?.pka)&&!options?.deep,bonusTargets=options?.assault?[...new Set(options.assault.context.rules.filter(r=>r.boss==='all'||r.boss===options.assault!.boss).flatMap(r=>r.targets))]:[];
  const diverse=bonusTargets.flatMap(target=>ranked.filter(p=>tagged(p.m,[target],data)).slice(0,2));
  const shortlist=[...new Set([...ranked.slice(0,fast?36:65),...affordable.slice(0,fast?20:35),...damageCandidates,...diverse].map(p=>p.m))];
  type Beam={members:PlanMember[];cost:number;value:number};
  let seed:Beam|undefined;
  if((options?.assault||options?.pka)&&options.onPreview){
    let seeds:Beam[]=[{members:[],cost:0,value:0}];
    for(let slot=0;slot<5;slot++){
      const next:Beam[]=[],seen=new Set<string>();for(const b of seeds)for(const m of shortlist){const cost=b.cost+byMember.get(m)!.cost;if(cost>limit||!distinct(b.members,m))continue;const members=[...b.members,m],id=key(members);if(seen.has(id))continue;seen.add(id);next.push({members,cost,value:score(members,members)});}
      seeds=next.sort((a,b)=>b.value-a.value).slice(0,6);
    }
    seed=seeds[0];if(seed)options.onPreview([{members:seed.members,reserves:[],cost:seed.cost,score:seed.value,provisional:true,offense:offense(seed.members),reasons:['İlk geçerli beşli · yedekler ve alternatifler karşılaştırılıyor.'],warnings:[...new Set(seed.members.flatMap(m=>m.notes))]}]);
  }
  let beams:Beam[]=[{members:[],cost:0,value:0}];
  for(let n=0;n<5;n++) {
    const seen=new Set<string>(), next:Beam[]=[];
    for(const b of beams)for(const m of shortlist) {
      const cost=b.cost+byMember.get(m)!.cost;
      if(cost>limit||!distinct(b.members,m))continue;
      const members=[...b.members,m],id=key(members);if(seen.has(id))continue;seen.add(id);
      next.push({members,cost,value:score(members,members)});
    }
    // Keep lower-cost active alternatives so an expensive fifth member cannot crowd out useful reserves.
    const top=next.sort((a,b)=>b.value-a.value).slice(0,fast?24:42);
    const efficient=next.sort((a,b)=>b.value/Math.max(1,b.cost)-a.value/Math.max(1,a.cost)).slice(0,fast?12:18);
    beams=[...new Map([...top,...efficient].map(b=>[key(b.members),b])).values()];
  }
  const results:PlanTeam[]=[];
  const activeCandidates=[...new Map([...beams.sort((a,c)=>c.value-a.value).slice(0,12),...beams.sort((a,c)=>c.value/Math.max(1,c.cost)-a.value/Math.max(1,a.cost)).slice(0,8),...seed?[seed]:[]].map(b=>[key(b.members),b])).values()];
  for(const b of activeCandidates) {
    const replacementValue=(reserves:PlanMember[])=> {
      const roster=[...b.members,...reserves];let active=[...b.members], value=score(active,roster);
      for(const [index,m] of reserves.entries()) {
        const possibilities=active.map((_,i)=>active.map((t,j)=>j===i?m:t));
        // Average replacement outcome; the knocked-out slot is not known in advance.
        value+=possibilities.reduce((n,t)=>n+score(t,roster),0)/5*[.28,.16,.09][index];
        active=possibilities.sort((a,c)=>score(c,roster)-score(a,roster))[0];
      }
      return value;
    };
    let reserveBeams:{reserves:PlanMember[];cost:number;value:number}[]=[{reserves:[],cost:b.cost,value:replacementValue([])}], best=reserveBeams[0];
    const reservePool=[...ranked.slice(0,18),...affordable.slice(0,18),...damageCandidates.slice(0,8)].map(p=>p.m).filter((m,i,a)=>a.indexOf(m)===i&&distinct(b.members,m));
    for(let n=0;n<3;n++) {
      const next:typeof reserveBeams=[];
      for(const rb of reserveBeams)for(const m of reservePool) {
        const cost=rb.cost+byMember.get(m)!.cost;if(cost>limit||!distinct([...b.members,...rb.reserves],m))continue;
        const reserves=[...rb.reserves,m];next.push({reserves,cost,value:replacementValue(reserves)});
      }
      reserveBeams=next.sort((a,c)=>c.value-a.value).slice(0,3);
      if(reserveBeams[0]?.value>best.value)best=reserveBeams[0];
    }
    const roster=[...b.members,...best.reserves];
    const conditionalEffects=roster.flatMap(m=>[...(byMember.get(m)!.ability.effects||[]),...(byMember.get(m)!.special.effects||[])]).filter(e=>e.condition||e.conditions);
    results.push({members:b.members,reserves:best.reserves,cost:best.cost,score:best.value,reasons:[`${mode==='attack'?'Hücum':'Savunma'}: 5 aktif + ${best.reserves.length} yedek. Toplam ${best.cost}/${limit} maliyet; kalan ${limit-best.cost}.`, 'Ability ve special buff hedefleri, hasar / HP kesme, CT, iyileştirme, debuff, engelleme, direnç ve tekrar sayısı puanlandı.', 'Yedekler başlangıçta aktif buff vermiyor; sahaya girdikleri farklı kayıp senaryoları ve tüm kadronun kompozisyon koşulları karşılaştırıldı.',...roster.map(m=>`#${m.character.id}: A${m.abilityLevel} / S${m.specialLevel} · CT ${byMember.get(m)!.special.cooldown??'?'} · maliyet ${byMember.get(m)!.cost}`)],warnings:[...new Set(roster.flatMap(m=>m.notes)),`${conditionalEffects.length} koşullu etki incelendi. Süre ve kadro koşulları hesaplandı; HP, rakip, isabet sayısı ve özel oyun modu koşulları belirsizse puan verilmedi.`, 'Sınırlı aday araması ve tahmini alan / yedek ağırlıkları kullanılır. Rakip kadro ve gerçek savaş hareketleri simüle edilmez.'],skillAudit:roster.flatMap(m=>['ability','special'].map(k=>({id:m.character.id,name:k==='ability'?'Rumble ability':'Rumble special',status:'Hedef / süre / şans ve doğrulanabilir koşullar puanlandı',condition:'HP / rakip / tetik / aktif form bilinmiyorsa ilgili etki hariç tutuldu.',text:(byMember.get(m)![k as 'ability'|'special'].effects||[]).map(skillDescription).join('\n')+(k==='ability'&&byMember.get(m)!.resilience.length?'\nDirençler: '+byMember.get(m)!.resilience.map(r=>r.attribute+' · %'+(r.chance??r.percentage)+' · '+(r.type==='damage'?'Rakip tipi belirsiz; puan dışı':'debuff direnci')).join(' / '):'')})))});
    if(results.length===1&&options?.onPreview){results[0].offense=offense(b.members,roster);options.onPreview(results);}
    if((options?.assault||options?.pka)&&performance.now()-started>(options.budgetMs??(options.deep?40000:14000)))break;
  }
  for(const result of results){
    const roster=[...result.members,...result.reserves||[]];
    result.skillAudit!.push(...roster.flatMap(m=>byMember.get(m)!.extras.map(s=>({id:m.character.id,name:'Rumble EX special',status:'Tetik koşulu uygunsa tahmini katkı ile puanlandı; hazır normal hasar kaynağı sayılmadı',condition:conditionText(s.condition),text:(s.effects||[]).map(skillDescription).join('\n')}))));
    result.reasons.push('Captain / normal crewmate / Support / Last Tap gibi PvE etkileri Rumble buffı sayılmaz. Rumble ability, special, EX ve dirençlerin bu moda ait kayıtları kullanıldı.');
    result.offense=offense(result.members,[...result.members,...result.reserves||[]]);
    result.reasons.splice(1,0,`Başlangıç beşlisinde ${result.offense.directSources} doğrudan hasar special'ı, ${result.offense.areaSources} alan / çoklu hedef hasarı kaynağı. Hasar miktarı, hedef sayısı, tekrar, şans ve temel CT birlikte değerlendirildi; ATK / CT desteğinin hasar kullanan üyelere ulaşması ayrıca puanlandı.`);
    if(result.offense.risk!=='lower')result.warnings.unshift(result.offense.risk==='high'?'Hücumda süre riski yüksek: başlangıç special hasarı yetersiz. HP kesme, DoT ve yedekler bu açığı tek başına kapatmış sayılmadı.':'Hücumda süre riski var: doğrudan special hasarı tek üyeye bağımlı veya döngü gücü düşük.');
  }
  const alternatives:PlanTeam[]=[];
  for(const result of results.sort((a,b)=>b.score-a.score)) {
    if(rules){result.reasons[0]+=` · ${rules.phase} kuralları`;result.reasons.splice(1,0,`MuMu · ${rules.phase} · güncel Rules bonusları kadro ve yedek seçiminde kullanıldı.`,...rules.effects.map(ruleDescription));result.warnings.push(...rules.warnings);}
    if(alternatives.some(t=>key([...t.members,...t.reserves||[]])===key([...result.members,...result.reserves||[]])))continue;
    alternatives.push(result);if(alternatives.length===3)break;
  }
  return alternatives;
}
