import {captainBoost,parseEffects,specialBoosts,type PlanMember,type PlannerData,type PlanTeam} from './planning';
import {crewCriterion,namedMember} from './skill-analysis';
import {resolveCrewText} from './crew-conditions';
import {scopeMatches,sentences} from './pve-targets';
import {abilityText,passiveSailor,selectedLevel,targetMaximum,abilitiesAt} from './skill-levels';
import {MECHANICS,type Boss,type Effect} from './model';
import {eligibleForQuest} from './quest-restrictions';
import {supportTargetMatches} from './support-targets';
import {crewCost,memberCost} from './crew-cost';

type Stat={scope:string;atk:number;hp:number;rcv:number};
type Features={stats:Stat[];hp:{scope:string;amount:number}[];orbs:{scope:string;types:string[]}[];reduction:number;heal:number;chain:number;mechanics:Effect[]};
export type SupportPlan={member:PlanMember;targetId:string;targetScope:string;text:string;level:number;attack:number;health:number;recovery:number;effects:Effect[];stages:string[];score:number};
export type PveSynergy={captainHP:number;damageReduction:number;passiveAttack:number;passiveHP:number;passiveRCV:number;orbCoverage:number;chain:number;conditional:string[];development:string[];supports:SupportPlan[];score:number};
function features(text:string):Features{
  const out:Features={stats:[],hp:[],orbs:[],reduction:0,heal:0,chain:0,mechanics:parseEffects(text)};
  for(const line of sentences(text.replace(/<[^>]*>/g,' ')).flatMap(line=>line.split(/,\s*(?:and\s+)?(?=(?:boosts?|makes?|reduces?|recovers?|restores?|heals?|changes?|If|When)\b)/i))){
    if(/\bif\b|\bwhen\b|\bafter\b|depending|chance|HP is|Launch Status/i.test(line))continue;
    for(const m of line.matchAll(/boosts? base (ATK(?:, HP)?(?: and RCV)?|HP|RCV) of (.{1,160}?) by (\d[\d,]*)(?![\d,x%]|\.\d)/gi))out.stats.push({scope:m[2],atk:/ATK/.test(m[1])?Number(m[3].replace(/,/g,'')):0,hp:/HP/.test(m[1])?Number(m[3].replace(/,/g,'')):0,rcv:/RCV/.test(m[1])?Number(m[3].replace(/,/g,'')):0});
    for(const m of line.matchAll(/boosts? HP of (.{1,160}?) by ([\d.]+)x/gi))out.hp.push({scope:m[1],amount:Number(m[2])});
    for(const m of line.matchAll(/makes? (.{1,100}?) orbs beneficial for (.{1,120}?)(?: characters|\.|$)/gi))out.orbs.push({scope:m[2]+' characters',types:[...m[1].matchAll(/\[([^\]]+)\]/g)].map(v=>v[1])});
    const reduction=line.match(/reduces? damage (?:taken|received) by (\d+)%/i);if(reduction&&!/for \d+ turns?|first \d+ turns?|start of (?:fight|adventure)|decreases|decreasing|following/i.test(line))out.reduction=Math.max(out.reduction,Math.min(.95,Number(reduction[1])/100));
    const heal=line.match(/(?:recovers?|heals?|restores?) (\d[\d,]*) HP/i);if(heal)out.heal=Math.max(out.heal,Number(heal[1].replace(/,/g,'')));
    const chain=line.match(/adds? ([\d.]+)x to (?:the )?chain (?:multiplier|coefficient)/i),boundary=line.match(/sets? (?:the )?Chain (?:Multiplier|Boundaries) (?:to|at) ([\d.]+)x/i),multiplier=line.match(/boosts? (?:the )?Chain Multiplier by ([\d.]+)x/i);if(chain||boundary||multiplier)out.chain=Math.max(out.chain,chain?Number(chain[1]):boundary?Math.max(0,Number(boundary[1])-1):Number(multiplier![1])-1);
  }
  return out;
}
export function supportMatches(source:PlanMember,target:PlanMember,scope:string,data:PlannerData){
  if(target.friend||source.sourceId===target.sourceId||source.character.id===target.character.id||source.families.some(f=>target.families.includes(f)))return false;
  return supportTargetMatches(scope,target,data);
}
export function captainCooldown(source:PlanMember,target:PlanMember,data?:PlannerData){
  let turns=0;
  for(const line of sentences(source.captainText)){
    if(/^\s*(If|When|After)/i.test(line))continue;
    for(const m of line.matchAll(/reduces? (?:base )?Special Cooldown of (.{1,160}?) by (\d+) (turns?|% of Max Cooldown)[^.;]*?(?:at (?:the )?start|start of fight)/gi))if(scopeMatches(m[1],target.character,data,source.character))turns+=m[3].startsWith('%')?Math.floor((target.owned.cooldown||0)*Number(m[2])/100):Number(m[2]);
    // Some descriptions put "at start of fight" before the percentage clause.
    if(/at start of fight/i.test(line))for(const m of line.matchAll(/reduces? Special Cooldown of (.{1,120}?) by (\d+)% of Max Cooldown/gi))if(!/by \d+% of Max Cooldown[^.;]*at (?:the )?start/i.test(line)&&scopeMatches(m[1],target.character,data,source.character))turns+=Math.floor((target.owned.cooldown||0)*Number(m[2])/100);
  }
  return turns;
}
export function makeAdventureContext(pool:PlanMember[],data:PlannerData,boss?:Boss,crewCostLimit=Infinity){
  const names=new WeakMap<PlanMember,Map<string,boolean>>();
  const matchesName=(m:PlanMember,name:string)=>{let cache=names.get(m);if(!cache){cache=new Map();names.set(m,cache);}let result=cache.get(name);if(result===undefined){result=namedMember(m,name);cache.set(name,result);}return result;};
  const criterion=(criteria:string,m:PlanMember[],source:PlanMember)=>crewCriterion(criteria,source,m,matchesName);
  const profiles=new Map(pool.map(m=>{
    const a=abilitiesAt(m,data),sailor=passiveSailor(m,data);
    const advanced=['superSpecial','swap','VSSpecial','lastTap','superTandem','superTandemBoost','rush'].filter(k=>a[k]).flatMap(key=>{
      const value=a[key] as Record<string,unknown>,leveled=['lastTap','superTandem','superTandemBoost','rush'].includes(key),levels=leveled?selectedLevel(m,key,value.description):1;
      if(key==='swap'&&value?.base){const text=abilityText(value.base);return [{key,text,criteria:'',levels:1,f:features(text)},...(value.super?[{key:'superSwap',text:abilityText(value.super),criteria:`Super Switch sayacı: ${value.superTurns??'kaynak koşulu'}; birleşik formun süre sınırı geçerli.`,levels:1,f:features(abilityText(value.super))}]:[])];}
      const text=abilityText(value,levels||1),criteria=key==='superSpecial'?String(a.superSpecialCriteria||''):key==='VSSpecial'?String(a.VSCondition||''):abilityText(value?.characterCondition||value?.condition,levels||1);
      return [{key,text,criteria,levels,f:features(text)}];
    });
    const potentials=Array.isArray(a.potential)?a.potential.flatMap(p=>{const level=m.owned.lb?selectedLevel(m,'potential:'+p.Name,p.description):0;return level?[{name:String(p.Name),text:abilityText(p.description,level),level}]:[];}):[];
    return [m,{captain:features(m.captainText),sailor:features(sailor),sailorText:sailor,special:features(m.specialText),advanced,potentials}];
  }));
  const sourceProfiles=new Map(pool.map(m=>[m.sourceId+':'+m.character.id,profiles.get(m)!]));
  const profileOf=(m:PlanMember)=>profiles.get(m)||sourceProfiles.get(m.sourceId+':'+m.character.id)!;
  const captainCache=new Map<string,number>(),buffCache=new Map<string,ReturnType<typeof specialBoosts>>(),scopeCache=new Map<string,boolean>(),cooldownCache=new Map<string,number>();
  const cachedCooldown=(source:PlanMember,target:PlanMember)=>{const key=source.sourceId+':'+source.character.id+'|'+target.sourceId+':'+target.character.id;let value=cooldownCache.get(key);if(value===undefined){value=captainCooldown(source,target,data);cooldownCache.set(key,value);}return value;};
  const cachedCaptain=(text:string,target:PlanMember)=>{const key=text+'|'+target.character.id;let value=captainCache.get(key);if(value===undefined){value=captainBoost(text,target.character,data);captainCache.set(key,value);}return value;};
  const cachedBuff=(text:string,target:PlanMember)=>{const key=text+'|'+target.character.id;let value=buffCache.get(key);if(!value){value=specialBoosts(text,target.character,data);buffCache.set(key,value);}return value;};
  const scoped=(scope:string,target:PlanMember,source?:PlanMember)=>{const key=scope+'|'+target.character.id+'|'+(/this character|self/i.test(scope)?source?.character.id:'');let value=scopeCache.get(key);if(value===undefined){value=scopeMatches(scope,target.character,data,source?.character);scopeCache.set(key,value);}return value;};
  const sailorPairs=new Map<string,{atk:number;hp:number;rcv:number;orbs:string[]}>();
  const sailorPair=(source:PlanMember,target:PlanMember)=>{const key=source.sourceId+':'+source.character.id+'|'+target.sourceId+':'+target.character.id;let result=sailorPairs.get(key);if(!result){const f=profileOf(source).sailor,stats=f.stats.filter(s=>scoped(s.scope,target,source));result={atk:stats.reduce((n,s)=>n+s.atk,0),hp:stats.reduce((n,s)=>n+s.hp,0),rcv:stats.reduce((n,s)=>n+s.rcv,0),orbs:f.orbs.filter(o=>scoped(o.scope,target,source)).flatMap(o=>o.types)};sailorPairs.set(key,result);}return result;};
  const supporters=pool.flatMap(m=>{
    if(!eligibleForQuest(m.character,boss?.restrictions,true))return [];
    const a=abilitiesAt(m,data).support;if(!Array.isArray(a))return [];
    return a.flatMap(s=>{const level=selectedLevel(m,'support',s.description);if(!level)return [];const text=abilityText(s.description,level),stat=text.match(/Adds (\d+(?:\.\d+)?)% of this character's base ([^.]+?) to/i),event=text.match(/^Once per adventure, when an enemy inflicts you with ([^,]+),\s*/i);
      const effects=event?parseEffects(text.slice(event[0].length)):[];
      const stages=boss?.stages.filter(stage=>effects.some(e=>stage.requirements.some(r=>r.mechanic===e.mechanic&&new RegExp(MECHANICS[r.mechanic],'i').test(event?.[1]||'')))).map(stage=>stage.id)||[];
      const percent=stat?Number(stat[1])/100:0;
      return [{m,scope:String(s.Characters||''),text,level,attack:stat&&/ATK/.test(stat[2])?m.attack*percent:0,health:stat&&/HP/.test(stat[2])?(m.health??m.character.hp)*percent:0,recovery:stat&&/RCV/.test(stat[2])?(m.recovery??m.character.rcv)*percent:0,effects:stages.length?effects:[],stages}];
    });
  });
  const options=new Map(pool.map(target=>[target,supporters.filter(s=>supportMatches(s.m,target,s.scope,data)).map(s=>({...s,score:s.attack/30+s.health/200+s.recovery/20+s.effects.reduce((n,e)=>n+e.turns*20,0)})).sort((a,b)=>b.score-a.score)]));
  const availableSupport=(source:PlanMember,crew:PlanMember[])=>!crew.some(m=>!m.friend&&(m.sourceId===source.sourceId||m.character.id===source.character.id||m.families.some(f=>source.families.includes(f))));
  const bestSupports=(crew:PlanMember[]):SupportPlan[]=>{
    const targets=crew.filter(m=>!m.friend),used=new Set(targets.map(m=>m.sourceId));
    const families=new Set(targets.flatMap(m=>m.families));
    const budget=crewCostLimit-crewCost(crew).total;
    const legal=new Map(targets.map(target=>{const list=(options.get(target)||[]).filter(s=>availableSupport(s.m,crew)&&memberCost(s.m)<=budget);return [target,[...new Set([...list.slice(0,12),...Number.isFinite(budget)?[...list].sort((a,b)=>memberCost(a.m)-memberCost(b.m)).slice(0,4):[]])]];}));
    let beams:{used:Set<string>;families:Set<string>;rows:SupportPlan[];score:number;cost:number}[]=[{used,families,rows:[],score:0,cost:0}];
    for(const target of [...targets].sort((a,b)=>legal.get(a)!.length-legal.get(b)!.length)){
      const next=[...beams];
      for(const b of beams)for(const s of legal.get(target)||[]){const cost=b.cost+memberCost(s.m);if(cost>budget||b.used.has(s.m.sourceId)||s.m.families.some(f=>b.families.has(f))||s.score<=0)continue;next.push({used:new Set([...b.used,s.m.sourceId]),families:new Set([...b.families,...s.m.families]),rows:[...b.rows,{member:s.m,targetId:target.character.id,targetScope:s.scope,text:s.text,level:s.level,attack:s.attack,health:s.health,recovery:s.recovery,effects:s.effects,stages:s.stages,score:s.score}],score:b.score+s.score,cost});}
      beams=next.sort((a,b)=>b.score-a.score).slice(0,16);
    }
    return beams[0].rows;
  };
  const assessmentCache=new Map<string,PveSynergy>();
  const assess=(crew:PlanMember[],withSupports=false):PveSynergy=>{
    // Context owns a fixed scenario snapshot; preserve slot order and friend role.
    const key=Number(withSupports)+'|'+crew.map(m=>m.sourceId+':'+m.character.id+':'+Number(!!m.friend)).join('/'),cached=assessmentCache.get(key);if(cached)return cached;
    let health=0,attack=0,recovery=0,orbCoverage=0,chain=0,score=0,lateBonus=0;const conditional:string[]=[];
    const captainHP=crew.slice(0,2).map(m=>profileOf(m).captain),captainReduction=1-captainHP.reduce((n,p)=>n*(1-p.reduction),1);
    const captainTexts=crew.slice(0,2).map(m=>/^\s*If.*(?:Captain|crew)/im.test(m.captainText)?resolveCrewText(m.captainText,crew[0].character,crew.map(t=>t.character)):m.captainText);
    const extraTexts:string[]=[];
    for(const m of crew){const p=profileOf(m);
      for(const a of p.advanced){
        const ready=a.key==='superSpecial'&&criterion(a.criteria,crew,m)==='ready'||a.key==='swap'&&m.owned.pveForm!=='combined'&&!/super switch|after|times|\bif\b/i.test(a.text)&&!a.criteria;
        if(ready)extraTexts.push(a.text);
        else if(a.levels&&['lastTap','superTandem','superTandemBoost','rush','superSwap'].includes(a.key)){
          if(a.key==='superTandemBoost'){
            const scope=a.criteria.match(/When (?:a |an )?(.+?) character performs Super Tandem/i)?.[1];
            if(!crew.some(t=>profileOf(t).advanced.some(skill=>skill.key==='superTandem'&&skill.levels>0&&criterion(skill.criteria,crew,t)!=='unmet')&&(!scope||scoped(scope,t))))continue;
          }
          const named=a.criteria.includes('following')?criterion(a.criteria,crew,m):'unknown';
          if(named!=='unmet'){
            const amount=a.f.stats.reduce((n,s)=>n+s.atk,0)/100+Math.max(0,...crew.map(t=>{const b=cachedBuff(a.text,t);return b.atk+b.orb+b.affinity-3;}))*5;
            // This is opportunity value with an explicit activation plan, not certified damage.
            lateBonus=Math.max(lateBonus,Math.min(35,amount+3));if(withSupports)conditional.push(`#${m.character.id} ${a.key} Lv.${a.levels}: ${a.criteria||'Kaynak tetik koşulu'}; aynı saldırı zincirinde uygun sıra / orb gerekir.`);
          }
        }
      }
    }
    const passives=crew.filter(m=>!m.friend&&crew.indexOf(m)>1).map(m=>({m,f:profileOf(m).sailor}));
    for(const target of crew){
      const added=passives.map(({m})=>sailorPair(m,target));
      const atk=added.reduce((n,s)=>n+s.atk,0),hp=added.reduce((n,s)=>n+s.hp,0),rcv=added.reduce((n,s)=>n+s.rcv,0);
      attack+=atk;health+=hp;recovery+=rcv;
      const captainMultiplier=captainTexts.reduce((n,text)=>n*cachedCaptain(text,target),1),baseMultiplier=crew.slice(0,2).reduce((n,c)=>n*cachedCaptain(c.captainText,target),1);
      score+=target.attack*Math.max(0,captainMultiplier-baseMultiplier)/1000;
      score+=atk*captainMultiplier/1000;
      const hpMultiplier=captainHP.reduce((n,p)=>n*Math.max(1,...p.hp.filter(h=>scoped(h.scope,target)).map(h=>h.amount)),1);
      score+=((target.health??target.character.hp)+hp)*(hpMultiplier-1)/1000;
      const orbTypes=new Set([...captainHP.flatMap(p=>p.orbs.filter(o=>scoped(o.scope,target)).flatMap(o=>o.types)),...added.flatMap(s=>s.orbs)]);
      orbCoverage+=orbTypes.size?1:0;score+=Math.min(7,orbTypes.size)*2;
      if(extraTexts.length){const base=crew.map(m=>cachedBuff(m.specialText,target)),extra=extraTexts.map(text=>cachedBuff(text,target));score+=(['atk','orb','affinity'] as const).reduce((n,k)=>n+Math.max(0,Math.max(1,...extra.map(v=>v[k]))-Math.max(1,...base.map(v=>v[k]))),0)*5;}
      const bestBaseATK=Math.max(0,...crew.flatMap(m=>profileOf(m).special.stats.filter(s=>scoped(s.scope,target,m)).map(s=>s.atk)));
      score+=bestBaseATK*captainMultiplier/1000*.35;
      for(const p of profileOf(target).potentials){
        const crit=p.text.match(/(\d+)% chance to deal (\d+)% of this character's attack in extra damage/i);
        if(crit){score+=(target.attack*captainMultiplier/1000)*Number(crit[1])/100*Number(crit[2])/100*.25;if(withSupports)conditional.push(`#${target.character.id} ${p.name} Lv.${p.level}: PERFECT ve %${crit[1]} şans; beklenen katkı ağırlığı kullanıldı, garanti hasar sayılmadı.`);}
        else if(/normal attack will ignore barriers$/i.test(p.text.trim()))score+=boss?5:1;
      }
    }
    chain=Math.max(0,...crew.map(m=>profileOf(m).special.chain));
    const heal=Math.max(0,...crew.map(m=>profileOf(m).special.heal));
    score+=captainReduction*70+chain*8+Math.min(12,heal/1000)+health/1000+recovery/150+lateBonus+crew.reduce((n,m)=>n+crew.slice(0,2).reduce((v,c)=>v+cachedCooldown(c,m),0),0)*1.5;
    const supports=withSupports?bestSupports(crew):[];
    if(withSupports)score+=supports.reduce((n,s)=>n+s.score,0);
    else score+=crew.filter(m=>!m.friend).reduce((n,m)=>n+(options.get(m)?.find(s=>availableSupport(s.m,crew))?.score||0),0)*.3;
    const development=crew.some(targetMaximum)?['Lv.100 hedefi (kartın erişilebilir sınırına kadar); special, LB / extension, uygulanabilir LLB ve açılabilen Potential / Last Tap / Tandem / Rush seviyeleri maksimum.','Seçilen desteklerde kaynakta erişilebilir en yüksek Support seviyesi hedeflenir. Kopya / poster / tablet, LB materyali ve varsa anahtar gereklidir.','Gemi, Cotton Candy, sockets ve bilinmeyen aktif dual form / HP / tap koşulları için tam savaş simülasyonu yapılmaz.']:['Yalnız kayıtlı mevcut geliştirmeler kullanılır. Support ve Potential / tap yeteneği seviyeleri bilinmiyorsa maksimum kabul edilmez.'];
    const result={captainHP:crew.reduce((n,m)=>n+(m.health??m.character.hp)*captainHP.reduce((v,p)=>v*Math.max(1,...p.hp.filter(h=>scoped(h.scope,m)).map(h=>h.amount)),1),0),damageReduction:Math.round(captainReduction*100),passiveAttack:attack,passiveHP:health,passiveRCV:recovery,orbCoverage,chain,conditional:[...new Set(conditional)],development,supports,score};if(assessmentCache.size>=20000)assessmentCache.clear();assessmentCache.set(key,result);return result;
  };
  return {assess,bestSupports,profiles};
}
