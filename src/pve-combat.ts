import type {Boss,Effect,Stage} from './model';
import {MECHANICS} from './model';
import {captainBoost,parseEffects,type PlanMember,type PlannerData,type PlanTeam} from './planning';
import {scopeMatches,sentences} from './pve-targets';
import {resolveCrewText} from './crew-conditions';
import {crewHpBranch} from './boss-timeline';
import {statusTargets} from './pve-status';
import {abilitiesAt,abilityText,passiveSailor,selectedLevel} from './skill-levels';
import {crewCriterion,statusResistance} from './skill-analysis';
import {eventStats,eventStat} from './kizuna';
import {hpChanges,changeHP,removalTurns,stageHazards,type HPChange} from './pve-hazards';
import {questPlanningWarning} from './quest-restrictions';
import {damageSkills,damageBlocker,skillDamage,offensiveText,type Counterplay} from './pve-offense';
import {stageBarriers,barrierActiveText,barrierRemoval,slotChanges,applySlotChanges,enemySlots,planBarrierAttacks,barrierLabel,type Barrier,type BarrierReport} from './pve-barriers';

type Buff={kind:'atk'|'orb'|'affinity'|'base'|'chain'|'shield'|'matching';amount:number;targets:number[];expires:number;source:number};
export type CombatState={switched?:string[];hp:number;buffs:Buff[];dead?:boolean;burn?:{damage:number;expires?:number};poisonSlots?:number[];poisonUncertain?:boolean;enemy?:{key:string;hp?:number;cleared:boolean;defenses?:{mechanic:Effect['mechanic'];until:number}[];barrierUntil?:number;barriers?:(Barrier&{until:number})[];blockers?:string}};
export type CombatWindow={stage:string;turn:number;damageLow:number;damageHigh:number;specialDamage?:number;endDamage?:number;enemyRemainingHP?:number;counterplay?:Counterplay[];barriers?:BarrierReport[];completedAttacks?:number;enemyHP?:number;hpBefore:number;hpAttack:number;hpAfter:number;incoming:number;selfCost:number;burnDamage:number;poisonSlotDamage:number;poisonSlotCount:number;completedPerfects:number;requiredHP:number;status:'blocked'|'unverified'|'estimated';issues:string[];instructions:string[];remainingDefenses:string[]};
export type CombatReport={status:'blocked'|'unverified'|'estimated';maxHP:number;initialHP:number;startEffects:string[];windows:CombatWindow[];tandem:string[];assumptions:string[];problems:string[]};
export type CombatHooks={initial:CombatState;resolveStage?:(stage:Stage,state:CombatState)=>Stage;step:(stage:Stage,selected:number[],state:CombatState,remaining:Effect[],ready?:number[])=>{state:CombatState;score:number;window:CombatWindow;used?:number[];neutralized?:Effect['mechanic'][]};report:(windows:CombatWindow[])=>CombatReport};
type Features={buffs:(Omit<Buff,'expires'|'source'>&{duration:number})[];heal:number;healRate:number;health:({kind:'heal';amount:number;rate:number}|{kind:'cost';change:HPChange})[];burnRemoval:number;poisonRemoval:number;warnings:string[]};
const numeric=(s:string)=>Number(s.replace(/[, ]/g,''));
const textOf=(s:Stage)=>s.events?.length?s.events.map(e=>e.text).join('\n'):s.notes||'';
const normalText=(s:string)=>s.replace(/Non-NormaI/gi,'Non-Normal').replace(/Damaoe/gi,'Damage');
const conditional=(s:string)=>/\bif\b|\bwhen\b|\bafter\b|depending|chance|following|Launch Status|otherwise/i.test(s);
const clauses=(text:string)=>sentences(text).flatMap(s=>/^\s*(If|When|After)\b/i.test(s)?[s]:s.split(/,\s*(?:and\s+)?(?=(?:boosts?|increases?|reduces?|recovers?|restores?|heals?|changes?|makes?|sets?|If|When)\b)/i));

// These are enemy defenses, distinct from the crew's damage protection. The
// recorded game text can omit the last characters of a scrolling Reduction word.
export function enemyThreats(stage:Stage){
 const text=normalText(offensiveText(stage)),activeText=normalText(stage.events?.length?stage.events.filter(e=>['preemptive','starting','turn','unknown'].includes(e.trigger)).map(e=>e.text).join('\n'):stage.notes||''),defenses=stage.requirements.filter(e=>['damageReduction','threshold','defenseUp','resilience','damageNullification'].includes(e.mechanic));
 const reduction=text.split('\n').filter(line=>!/Slot Damage Reduction/i.test(line)).join('\n').match(/Reduce(?:s)? damage taken\s*(\d+)%|(?:Percent )?Damage Reduction[^\n]*?(\d+)%/i);
 const threshold=text.match(/Damage (?:over|above)\s*([\d,]+)\s+(\d+)%/i);
 const type=stage.enemyType||text.match(/\b(STR|DEX|QCK|PSY|INT)\s*type change/i)?.[1];
 const damage=(trigger:string)=>Math.max(0,...(stage.events||[]).filter(e=>e.trigger===trigger).flatMap(e=>e.text.split('\n').filter(l=>!/(?:Burn|Poison|deal|Attacks|Damage over|Damage Reduction|damage taken)/i.test(l)).flatMap(l=>{const m=l.match(/^\s*([\d,]+)\s*(?:fixed )?damage\b/i);return m?[numeric(m[1])]:[];})));
 return {text,defenses,type,reduction:reduction?Number(reduction[1]||reduction[2])/100:undefined,threshold:threshold?{amount:numeric(threshold[1]),percent:Number(threshold[2])/100}:undefined,burn:numeric(activeText.match(/\b([\d,]+)\s*damage Burn/i)?.[1]||'0'),preemptive:damage('preemptive'),defeated:damage('defeated'),turnDamage:damage('turn'),barrier:/Barrier|Bariyer/i.test(activeText),block:/\[BLOCK\]/i.test(activeText),badSlots:/Unfavorable|Badly Matching/i.test(activeText),buffRemoval:/Remove Beneficial Effects|Beneficial Effects[^\n]*Removal|Effects\/Accumu[lI]ated Values Removal/i.test(activeText),immunity:/Immunity|Debuff Protection/i.test(activeText)};
}
function specialFeatures(m:PlanMember,index:number,crew:PlanMember[],data:PlannerData,override?:string):Features{
 let text=resolveCrewText(override??m.specialText,crew[0].character,crew.map(t=>t.character));
 if(index<2)text=text.replace(/If this character is your Captain or Friend\/(?:Guest )?Captain,\s*/gi,'').replace(/;[^.;]*otherwise\.?/gi,'.');
 const result:Features={buffs:[],heal:0,healRate:0,health:[],burnRemoval:removalTurns(text,'burn'),poisonRemoval:removalTurns(text,'poison'),warnings:[]};
 for(const line of clauses(text)){
  if(conditional(line)){if(/boost|HP|damage|orb/i.test(line))result.warnings.push('Koşullu special etkisi hasar / koruma hesabına eklenmedi.');continue;}
  const duration=Number(line.match(/for (\d+) turns?/i)?.[1])||1;
  result.health.push(...hpChanges(line).map(change=>({kind:'cost' as const,change})));
  const add=(kind:Buff['kind'],amount:number,scope='all characters')=>{const targets=crew.flatMap((t,i)=>scopeMatches(scope,t.character,data,m.character)?[i]:[]);if(targets.length)result.buffs.push({kind,amount,targets,duration});};
  for(const [kind,re]of [
   ['atk',/boosts? (?:the )?ATK of (.{1,180}?) by ([\d.]+)x/gi],
   ['orb',/boosts? (?:the )?(?:Orb Effects|effectiveness of orbs) of (.{1,180}?) by ([\d.]+)x/gi],
   ['affinity',/boosts? (?:the )?Color Affinity of (.{1,180}?) by ([\d.]+)x/gi],
   ['base',/boosts? base ATK of (.{1,180}?) by (\d[\d,]*)(?![\d,%]|\.\d)/gi]
  ]as const)for(const match of line.matchAll(re))add(kind,numeric(match[2]),match[1]);
  const shield=line.match(/reduces? damage (?:received|recieved|taken) by (\d+)%/i);if(shield)add('shield',Math.min(.95,Number(shield[1])/100));
  const endHeal=/at (?:the )?end of (?:the |each )?turn/i.test(line);
  const heal=line.match(/(?:recovers?|heals?|restores?) (\d[\d,]*) HP/i);if(heal&&!endHeal){result.heal+=numeric(heal[1]);result.health.push({kind:'heal',amount:numeric(heal[1]),rate:0});}
  const healRate=line.match(/recovers? (\d+)% of (?:crew's |the crew's )?MAX HP/i);if(healRate&&!endHeal){result.healRate+=Number(healRate[1])/100;result.health.push({kind:'heal',amount:0,rate:Number(healRate[1])/100});}
  const recovery=line.match(/recovers? (\d+)x (?:this )?character's RCV in HP/i);if(recovery&&!endHeal){const amount=Number(recovery[1])*(m.recovery??m.character.rcv)*eventStats(m).rcv;result.heal+=amount;result.health.push({kind:'heal',amount,rate:0});}
  const chain=line.match(/adds? ([\d.]+)x to (?:the )?chain (?:multiplier|coefficient)/i);if(chain)add('chain',Number(chain[1]));
  if(/changes? all[^.;]*?(?:into|to) Matching orbs/i.test(line)&&/\[BLOCK\]/i.test(line))add('matching',2);
  const change=line.match(/changes? all orbs[^.;]*?(?:into|to) \[(TND|STR|DEX|QCK|PSY|INT)\] orbs/i);
  if(change&&/including \[BLOCK\]/i.test(line)){
    const orb=change[1],targets=crew.flatMap((target,i)=>{
      const texts=[...crew.slice(0,2).map(c=>c.captainText),...crew.slice(2).map(c=>passiveSailor(c,data))];
      const beneficial=target.character.types.length===1&&target.character.types[0]===orb||texts.some(text=>clauses(text).filter(s=>!conditional(s)).some(s=>[...s.matchAll(/makes? (.{1,120}?) orbs beneficial for (.{1,150}?)(?: characters|\.|$)/gi)].some(v=>v[1].includes('['+orb+']')&&scopeMatches(v[2]+' characters',target.character,data))));
      return beneficial?[i]:[];
    });
    if(targets.length)result.buffs.push({kind:'matching',amount:2,targets,duration:1});
  }
 }
 return result;
}
const typeMultiplier=(types:string[],enemy?:string)=>{
 if(!enemy)return {low:.5,high:2};
 const beats:Record<string,string>={STR:'DEX',DEX:'QCK',QCK:'STR',PSY:'INT',INT:'PSY'};
 const values=types.map(t=>beats[t]===enemy?2:beats[enemy]===t?.5:1);return {low:Math.min(...values),high:Math.max(...values)};
};
export function makeCombatHooks(crew:PlanMember[],boss:Boss,data:PlannerData,synergy?:PlanTeam['synergy'],contribution=false,strictBarriers=false):CombatHooks{
 const environmentWarning=questPlanningWarning(boss);
 const captainTexts=crew.slice(0,2).map(m=>resolveCrewText(m.captainText,crew[0].character,crew.map(t=>t.character)));
 const orbTexts=[...captainTexts,...crew.slice(2).map(m=>passiveSailor(m,data))];
 const beneficialSlots=crew.map(m=>{
  const matching=new Set(m.character.types.length===1?m.character.types:[]);
  for(const text of orbTexts)for(const line of clauses(text).filter(s=>!conditional(s)))for(const v of line.matchAll(/makes? (.{1,120}?) orbs beneficial for (.{1,150}?)(?: characters|\.|$)/gi)){
   if(scopeMatches(v[2]+' characters',m.character,data))for(const slot of v[1].matchAll(/\[(STR|DEX|QCK|PSY|INT|RCV|TND)\]/gi))matching.add(slot[1].toUpperCase());
  }
  return matching;
 });
 const hpMult=crew.map(m=>captainTexts.reduce((n,text)=>n*Math.max(1,...clauses(text).filter(l=>!conditional(l)).flatMap(l=>[...l.matchAll(/boosts? HP of (.{1,160}?) by ([\d.]+)x/gi)].filter(v=>scopeMatches(v[1],m.character,data)).map(v=>Number(v[2])))),1));
 const passiveHP=crew.map(target=>crew.slice(2).reduce((n,s)=>n+clauses(passiveSailor(s,data)).filter(l=>!conditional(l)).flatMap(l=>[...l.matchAll(/boosts? base (?:ATK, HP and RCV|HP) of (.{1,160}?) by (\d[\d,]*)(?![\d,%]|\.\d)/gi)]).filter(v=>scopeMatches(v[1],target.character,data,s.character)).reduce((v,m)=>v+numeric(m[2]),0),0));
 const baseATK=crew.map(target=>target.attack+crew.slice(2).reduce((n,s)=>n+clauses(passiveSailor(s,data)).filter(l=>!conditional(l)).flatMap(l=>[...l.matchAll(/boosts? base (?:ATK(?:, HP and RCV)?) of (.{1,160}?) by (\d[\d,]*)(?![\d,%]|\.\d)/gi)]).filter(v=>scopeMatches(v[1],target.character,data,s.character)).reduce((v,m)=>v+numeric(m[2]),0),0)+(synergy?.supports.filter(s=>s.targetId===target.character.id&&!target.friend).reduce((n,s)=>n+s.attack,0)||0));
 const maxHP=Math.floor(crew.reduce((n,m,i)=>n+eventStat(m,m.health??m.character.hp,passiveHP[i]+(synergy?.supports.filter(s=>s.targetId===m.character.id&&!m.friend).reduce((v,s)=>v+s.health,0)||0),'hp')*hpMult[i],0));
 const captainReduction=captainTexts.reduce((n,text)=>n*(1-Math.max(0,...clauses(text).filter(l=>!conditional(l)).map(l=>Number(l.match(/reduces? damage (?:received|taken) by (\d+)%/i)?.[1]||0)/100))),1);
 const features=crew.map((m,i)=>specialFeatures(m,i,crew,data));
 const offense=crew.map(m=>damageSkills(resolveCrewText(m.specialText,crew[0].character,crew.map(t=>t.character))));
 const slotProfiles=crew.map(m=>slotChanges(resolveCrewText(m.specialText,crew[0].character,crew.map(t=>t.character))));
 const crewCharacters=crew.map(m=>m.character);
 const slotCache=new WeakMap(boss.stages.map(stage=>[stage,enemySlots(stage,crew.length)]));
 const barrierRemovers=crew.map(m=>barrierRemoval(resolveCrewText(m.specialText,crew[0].character,crew.map(t=>t.character))));
 const poisonBeforeSlots=crew.map(m=>{const text=m.specialText,p=text.search(/(?:removes?|recovers?|reduces?)\s+[^.;]{0,70}\bPoison\b/i),s=text.search(/(?:changes?|converts?)\s+[^.;]{0,120}\b(?:orbs?|slots?)\b/i);return p>=0&&s>=0&&p<s;});
 const barrierCache=new WeakMap(boss.stages.map(stage=>[stage,stageBarriers(stage)]));
 const captainEnd=crew.slice(0,2).flatMap((m,i)=>damageSkills(captainTexts[i]).filter(s=>s.timing==='end').map(skill=>({index:i,skill})));
 let initialHP=maxHP;const startEffects:string[]=[];
 for(const [index,text]of captainTexts.entries())for(const change of hpChanges(text,true)){
  const before=initialHP;initialHP=changeHP(initialHP,maxHP,change);startEffects.push('#'+crew[index].character.id+' '+(index===1?'Arkadaş kaptan':'Kaptan')+' başlangıç HP etkisi: '+before.toLocaleString('tr-TR')+' → '+initialHP.toLocaleString('tr-TR')+'.');
 }
 const passiveBurn=Math.max(0,...captainTexts.map(t=>removalTurns(t,'burn')));
 const tandem=crew.flatMap(m=>{const a=abilitiesAt(m,data).superTandem;if(!a||typeof a!=='object')return [];const value=a as Record<string,unknown>,level=selectedLevel(m,'superTandem',value.description),text=abilityText(value.description,level||1),criteria=abilityText(value.characterCondition,level||1),ready=crewCriterion(criteria,m,crew);return [`#${m.character.id} Super Tandem ${level?'Lv.'+level:'seviye bilinmiyor'}: ${!level?'Katkı sayılmadı.':ready==='unmet'?'Kadro koşulu sağlanmıyor.':'Kadro, TND slotu ve doğru tap sırası birlikte gerekir; garantili hasara eklenmedi.'} ${/reduces? (?:the )?defense/i.test(text)?'DEF düşürme, Percent Damage Reduction / Threshold / bariyer kaldırma sayılmaz. ':''}${text} Koşul: ${criteria}`];});
 const threats=new WeakMap(boss.stages.map(s=>[s,enemyThreats(s)]));
 const auxiliaryFeatures=new WeakMap<object,Features>();
 const supportCosts=new WeakMap(boss.stages.map(s=>[s,(synergy?.supports||[]).filter(v=>v.stages.includes(s.id)).flatMap(v=>{const rate=v.text.match(/reduces? (?:crew's|the crew's) current HP by (\d+)%/i);return rate?[{id:v.member.character.id,rate:Number(rate[1])/100}]:[];})]));
 const step:CombatHooks['step']=(stage,selected,state,remaining,ready)=>{
  const contributionEnd=contribution&&stage.id===boss.stages.at(-1)?.id;
  const rawThreat=threats.get(stage)||enemyThreats(stage),issues:string[]=[],instructions:string[]=[],defenses=remaining.filter(e=>['damageReduction','threshold','defenseUp','resilience','damageNullification'].includes(e.mechanic)).map(e=>({...e}));
  const battleKey=stage.id.split(':turn:')[0],enemyHP=stage.conditionalTurn&&state.enemy?.key===battleKey?state.enemy.hp:stage.hp;
  const carried=stage.conditionalTurn&&state.enemy?.key===battleKey?state.enemy:undefined;
  // A later guide heading need not repeat immunities. Retain these constraints
  // within this enemy, rather than allowing a poison / HP-cut bypass next turn.
  const blockerText=[carried?.blockers||'',offensiveText(stage),stage.normalAttackOnly?'Normal Attack Only':''].join('\n');
  const blockers=[...new Set(blockerText.split('\n').filter(line=>/Normal Attacks? Only|Non-Norma[lI] Attacks deal\s*1|Immunity|Debuff Protection|Percentage damage resistan|Nullify Percentage Damage|Damage Nullification|Damage Negation|Immune to damage/i.test(line)))].join('\n');
  const offenseStage:Stage={...stage,events:[{trigger:'starting',label:'Damage constraints',text:blockerText,requirements:[]}]};
  for(const defense of carried?.defenses||[]){const turns=defense.until-stage.turn-selected.reduce((n,i)=>n+(crew[i].effects.find(e=>e.mechanic===defense.mechanic)?.turns||0),0);if(turns<=0)continue;const existing=defenses.find(e=>e.mechanic===defense.mechanic);if(existing)existing.turns=Math.max(existing.turns,turns);else defenses.push({mechanic:defense.mechanic,turns});}
  let barriers=(barrierCache.get(stage)||stageBarriers(stage)).map(b=>({...b}));
  for(const b of carried?.barriers||[])if(b.until>stage.turn&&!barriers.some(v=>v.kind===b.kind&&v.slot===b.slot&&v.timing===b.timing&&v.count===b.count))barriers.push({...b,turns:Number.isFinite(b.until)?b.until-stage.turn:undefined});
  if(!barriers.length&&!carried?.barriers&&(carried?.barrierUntil??0)>stage.turn)barriers=[{kind:'unknown',text:'Önceki turun türü okunmamış bariyeri'}];
  const originalBarriers=[...barriers],threat={...rawThreat,barrier:barriers.length>0};
  const reduceBarriers=(amount:number)=>{if(!amount)return;barriers=barriers.flatMap(b=>b.turns===undefined?(amount===Infinity?[]:[b]):b.turns<=amount?[]:[{...b,turns:b.turns-amount}]);};
  let actualSlots=[...(slotCache.get(stage)||enemySlots(stage,crew.length))];
  let enemyLeft=enemyHP,specialDamage=0,endDamage=0,specialKill=false;
  const used:number[]=[],counterplay:Counterplay[]=[];
  const multipleEnemies=/\bx\s*[2-9]\b|\b[2-9] enemies\b/i.test(threat.text),revival=/reviv|resurrect|canlan/i.test(threat.text)||/reviv|resurrect|Full HP Recovery|canlan/i.test(stage.events?.filter(e=>e.trigger==='defeated').map(e=>e.text).join('\n')||'');
  if(stage.conditionalTurn&&state.enemy?.key===battleKey&&state.enemy.cleared)return {state,score:0,used:[],neutralized:remaining.map(e=>e.mechanic),window:{stage:stage.name,turn:stage.turn,damageLow:0,damageHigh:0,specialDamage:0,endDamage:0,enemyHP:0,enemyRemainingHP:0,hpBefore:state.hp,hpAttack:state.hp,hpAfter:state.hp,incoming:0,selfCost:0,burnDamage:0,poisonSlotDamage:0,poisonSlotCount:0,completedPerfects:0,requiredHP:1,status:'estimated',issues:[],instructions:['Önceki turda bu düşman bitirildi; kalınca gelen bu pencere ve special kullanımları atlanır.'],remainingDefenses:[]}};
  if(environmentWarning)issues.push(environmentWarning);
  for(const event of stage.events||[])if(/^Crew HP (below|at least) \d+%$/.test(event.label)&&event.trigger==='preemptive')instructions.push('Aşamaya girişte '+event.label+' dalı uygulandı; diğer HP dalının etkileri kullanılmadı.');
  if(stage.behaviorTextComplete===false)issues.push('Bu aşamanın kayan davranış satırları tam doğrulanmadı; listelenmeyen koşul veya sayı yok varsayılamaz.');
  const weaknessMembers=stage.weaknessClasses?.length?crew.filter(m=>m.character.classes.some(c=>stage.weaknessClasses!.includes(c))):[];
  if(stage.weaknessClasses?.length){instructions.push('Weakness Class: '+stage.weaknessClasses.join(' / ')+' · uygun üyeler: '+(weaknessMembers.map(m=>'#'+m.character.id).join(', ')||'yok')+'. Sınıf avantajı kadro seçiminde önceliklendirildi.');issues.push('Weakness Class bonusunun katsayısı rehberde okunmadı; hasara varsayımsal çarpan eklenmedi.');}
  let buffs=state.buffs.filter(b=>b.expires>stage.turn),hp=state.hp,dead=!!state.dead||hp<=0;
  const hazard=stageHazards(stage),auxiliaryBurn=(stage.plannedAbilities||[]).reduce((n,a)=>n+removalTurns(a.text,'burn'),0);
  let burn=state.burn&&(state.burn.expires===undefined||state.burn.expires>stage.turn)?{...state.burn}:undefined;
  if(hazard.burn)burn={damage:hazard.burnDamage,expires:hazard.burnTurns?stage.turn+hazard.burnTurns:undefined};
  if(burn){const reduction=Math.max(passiveBurn,auxiliaryBurn)+selected.reduce((n,i)=>n+features[i].burnRemoval,0);
   if(reduction>=99)burn=undefined;
   else if(burn.expires!==undefined){burn.expires-=reduction;if(burn.expires<=stage.turn)burn=undefined;}
  }
  let poisonSlots=hazard.poison?[...(hazard.poisonTargets||crew.map((_,i)=>i))]:[...(state.poisonSlots||[])],poisonUncertain=hazard.poison?hazard.poisonTargets===null:!!state.poisonUncertain;
  const auxiliaryPoison=(stage.plannedAbilities||[]).some(a=>!a.passive&&removalTurns(a.text,'poison')>0);
  const auxiliaryConverted=auxiliaryPoison&&!poisonUncertain?[...poisonSlots]:[];
  // A status-triggered Support or captain immunity does not automatically fire
  // from poison SLOTS. Only a planned active poison-recovery skill converts them.
  if(auxiliaryPoison){poisonSlots=[];poisonUncertain=false;instructions.push('Planlanan Poison iyileştirme yeteneği zehir slotlarını saldırıdan önce matching slota dönüştürür.');}
  const shield=(list:Buff[])=>Math.max(0,...list.filter(b=>b.kind==='shield').map(b=>b.amount));
  // An enemy preemptive happens before this turn's specials. Previously active
  // buffs may be removed before the enemy's hit; never credit a new shield here.
  if(threat.buffRemoval)buffs=[];
  let enemyHPLoss=0;for(const change of hpChanges(threat.text)){const before=hp;hp=changeHP(hp,maxHP,change);enemyHPLoss+=before-hp;instructions.push('Bossun giriş HP etkisi: '+before.toLocaleString('tr-TR')+' → '+hp.toLocaleString('tr-TR')+' HP.');}
  const preDamage=Math.ceil((threat.preemptive+threat.turnDamage)*captainReduction*(1-shield(buffs)));hp-=preDamage;if(hp<=0)dead=true;
  let supportLoss=0;for(const cost of supportCosts.get(stage)||[]){const loss=Math.ceil(Math.max(0,hp)*cost.rate);hp-=loss;supportLoss+=loss;instructions.push('#'+cost.id+' Support tetiği mevcut HP’den '+Math.round(cost.rate*100)+'% ('+loss.toLocaleString('tr-TR')+') tüketir; iyileştirme bu maliyetten sonra değerlendirilir.');}
  if(hp<=0)dead=true;
  const hpBefore=hp;
  for(const i of poisonSlots)actualSlots[i]='POISON';
  if(auxiliaryPoison&&!poisonUncertain)for(const i of auxiliaryConverted)actualSlots[i]=crew[i].character.types.length===1?crew[i].character.types[0]:undefined;
  const switched=[...new Set([...(state.switched||[]),...(stage.plannedAbilities||[]).filter(a=>a.changesForm).map(a=>a.sourceId)])];
  let invalidAuxiliary=false,selfCost=0;
  for(const ability of stage.plannedAbilities||[]){
   reduceBarriers(barrierRemoval(ability.text));const index=crew.findIndex(m=>m.character.id===ability.sourceId);if(index>=0)actualSlots=applySlotChanges(actualSlots,slotChanges(ability.text),index,crew.map(m=>m.character),data);
   if(index<0||dead||ability.passive&&ability.name!=='Kizuna başlangıç bonusu')continue;
   if(!ability.passive&&(['bind','specialBind'] as const).some(kind=>{const duration=Math.max(stage.requirements.find(e=>e.mechanic===kind)?.turns||0,...(stage.events||[]).filter(e=>['preemptive','starting','turn'].includes(e.trigger)).flatMap(e=>e.requirements.filter(r=>r.mechanic===kind).map(r=>r.turns)));const passive=(stage.plannedAbilities||[]).filter(a=>a.passive).reduce((n,a)=>n+(parseEffects(a.text).find(r=>r.mechanic===kind)?.turns||0),0);return statusTargets(stage,kind,index)&&duration-passive>statusResistance(crew[index],kind,data,index<2);})){invalidAuxiliary=true;issues.push('#'+ability.sourceId+' '+ability.name+' kaynağı Bind / Silence altında; bu aktif yetenek kullanılamaz.');continue;}
   let f=auxiliaryFeatures.get(ability);if(!f){f=specialFeatures(crew[index],index,crew,data,ability.text);auxiliaryFeatures.set(ability,f);}
   buffs.push(...f.buffs.map(({duration,...b})=>({...b,source:index,expires:stage.turn+duration})));
   for(const action of f.health){if(action.kind==='cost'){const before=hp;hp=changeHP(hp,maxHP,action.change);selfCost+=before-hp;}else if(hp>0)hp=Math.min(maxHP,hp+action.amount+maxHP*action.rate);}
   if(hp<=0)dead=true;
   instructions.push((ability.passive?'Otomatik bonus: ':'Saldırıdan ve normal special sırasından önce: #'+ability.sourceId+' · ')+ability.name+'.');
   if(f.warnings.length)issues.push('#'+ability.sourceId+' '+ability.name+': '+f.warnings.join(' '));
  }
  if(stage===boss.stages[0])instructions.push(...startEffects);
  const poisonConverted:number[]=[];
  for(const index of selected){const f=features[index];if(dead||specialKill)continue;used.push(index);
   for(const skill of offense[index].filter(s=>s.timing==='special')){
    const blocker=damageBlocker(skill,offenseStage,[...remaining,...defenses],barriers.length>0);if(blocker){instructions.push('#'+crew[index].character.id+' special hasarı: '+blocker+' nedeniyle alternatif bitirme sayılmadı.');continue;}
    const damage=skillDamage(skill,crew[index].attack*eventStats(crew[index]).atk,enemyLeft,stage.enemyDefense,threat.type);specialDamage+=damage;
    if(enemyLeft!==undefined)enemyLeft=Math.max(0,enemyLeft-damage);
    instructions.push('#'+crew[index].character.id+' special hasarı: '+damage.toLocaleString('tr-TR')+(skill.trueDamage?' · True Damage, savunmayı aşar':'')+(skill.ignoreNAO?' · Normal Attack Only’yi aşar':'')+'.');
    if(enemyLeft===0&&(!multipleEnemies||skill.all))specialKill=true;
   }
   if(specialKill){instructions.push('#'+crew[index].character.id+' düşmanı special ile bitirir; normal saldırı gerekmez. Sonraki special’lar bu aşamada kullanılmaz.');if(f.heal||f.healRate||f.buffs.some(b=>b.kind==='shield'))issues.push('Bitiren special’ın sonraki iyileştirme / kalkan etkisi yenilince hasarına karşı doğrulanmadı; önceden ayrı koruma kullan.');break;}
   const barrierCount=barriers.length;reduceBarriers(barrierRemovers[index]);if(barrierCount&&!barriers.length)instructions.push('#'+crew[index].character.id+' bariyer süresini kaldırır; slot / timing şartı normal saldırıda kalmaz.');
   if(f.poisonRemoval&&poisonBeforeSlots[index]&&!poisonUncertain)for(const i of poisonSlots)actualSlots[i]=crew[i].character.types.length===1?crew[i].character.types[0]:undefined;
   if(slotProfiles[index].length)actualSlots=applySlotChanges(actualSlots,slotProfiles[index],index,crewCharacters,data);
   buffs.push(...f.buffs.map(({duration,...b})=>({...b,source:index,expires:stage.turn+duration})));
   if(f.warnings.length&&/\b(?:If|When)\b[^.;]*(?:reduces?|cuts?|sets?) (?:the )?crew['’]s (?:current )?HP (?:by|to)/i.test(crew[index].specialText))issues.push('#'+crew[index].character.id+' koşullu HP maliyeti doğrulanmadı; kullanım öncesi HP koşulunu kontrol et.');
   for(const action of f.health){if(action.kind==='cost'){const before=hp;hp=changeHP(hp,maxHP,action.change);const cost=before-hp;selfCost+=cost;instructions.push('#'+crew[index].character.id+' special HP maliyeti: '+before.toLocaleString('tr-TR')+' → '+hp.toLocaleString('tr-TR')+'; bu sıradan sonraki iyileştirme kullanılabilir.');}else hp=Math.min(maxHP,hp+action.amount+maxHP*action.rate);}
   if(f.poisonRemoval&&poisonSlots.length){if(!poisonUncertain){poisonConverted.push(...poisonSlots);if(!poisonBeforeSlots[index])for(const i of poisonSlots)actualSlots[i]=crew[i].character.types.length===1?crew[i].character.types[0]:undefined;}poisonSlots=[];poisonUncertain=false;instructions.push('#'+crew[index].character.id+' Poison iyileştirmesi: zehir slotlarını matching slota çevir; daha sonraki slot dönüşümünün verdiği renk geçerli olur.');}
  }
  const hpAttack=hp;
  const active=(kind:Buff['kind'],index:number,fallback:number)=>Math.max(fallback,...buffs.filter(b=>b.kind===kind&&b.targets.includes(index)).map(b=>b.amount));
  const powers=crew.map((m,i)=>{
   const reductions=[...offensiveText(stage).matchAll(/\d+ turn\(s\) Slot Damage Reduction (\d{1,2}|100)% for ([A-Z ]+)/g)];
   const slotFactor=(slot:string)=>reductions.reduce((n,r)=>r[2].trim().split(/\s+/).includes(slot)?Math.min(n,1-Number(r[1])/100):n,1);
   const possible=actualSlots[i]?[actualSlots[i]!]:['STR','DEX','QCK','PSY','INT','RCV','TND','RAINBOW','BLOCK','EMPTY'];
   const slotLow=Math.min(...possible.map(slotFactor)),slotHigh=Math.max(...possible.map(slotFactor));
   const cap=captainTexts.reduce((n,t)=>n*captainBoost(t,m.character,data),1),type=typeMultiplier(m.character.types,threat.type);
   const poisoned=poisonSlots.includes(i),matching=actualSlots[i]!==undefined?beneficialSlots[i].has(actualSlots[i]!):poisonConverted.includes(i)||auxiliaryConverted.includes(i)||active('matching',i,0)>0;
   const orbLow=poisoned?1:matching?2:threat.badSlots?.5:threat.block?1:.5,orbHigh=poisoned&&!poisonUncertain?1:matching?2:threat.badSlots?.5:threat.block?1:2;
   const base=eventStat(crew[i],crew[i].attack,baseATK[i]-crew[i].attack+active('base',i,0),'atk')*cap*active('atk',i,1)*active('orb',i,1)*active('affinity',i,1)*1.9;
   return {index:i,low:base*type.low*orbLow,high:base*type.high*orbHigh,slotLow,slotHigh};
  }).sort((a,b)=>a.high-b.high);
  const barrierPlan=planBarrierAttacks(barriers,actualSlots,powers.map(p=>p.index),/Slot (?:Bind|Seal)|Super[ -]?Lock|Slot Change (?:Prevention|Impossible)/i.test(barrierActiveText(stage))||poisonUncertain);
  powers.sort((a,b)=>barrierPlan.order.indexOf(a.index)-barrierPlan.order.indexOf(b.index));
  const barrierReports:BarrierReport[]=specialKill?originalBarriers.map(b=>({kind:b.kind,label:barrierLabel(b),status:'bypassed',detail:'Düşman bariyeri aşan special hasarıyla bitirildi; normal saldırıyla açmak gerekmedi.'})):originalBarriers.length&&!barriers.length?originalBarriers.map(b=>({kind:b.kind,label:barrierLabel(b),status:'resolved',detail:'Planlanan yeteneklerle bariyer süresi kaldırıldı.'})):barrierPlan.reports;
  instructions.push(...barrierReports.map(r=>r.label+': '+r.detail));
  if(barriers.length&&!barrierPlan.blocked&&!specialKill)instructions.push('Bariyer saldırı sırası: '+barrierPlan.order.map(i=>'#'+crew[i].character.id).join(' → ')+'.');
  const hit=(damage:number,upper=false,slotFactor=1)=>{
   if(defenses.some(e=>e.mechanic==='damageNullification'))return 0;
   if(!upper&&stage.enemyDefense===undefined)return 1;
   damage=Math.max(1,damage-(stage.enemyDefense||0));
   if(defenses.some(e=>e.mechanic==='defenseUp')&&stage.enemyDefense===undefined)return 1;
   const percent=defenses.some(e=>e.mechanic==='damageReduction')?1-(threat.reduction??.99):1;
   const reduce=(value:number)=>defenses.some(e=>e.mechanic==='threshold')?threat.threshold?Math.min(value,threat.threshold.amount)+Math.max(0,value-threat.threshold.amount)*(1-threat.threshold.percent):1:value;
   const orders=[reduce(damage*percent),reduce(damage)*percent];damage=upper?Math.max(...orders):Math.min(...orders);
   return Math.max(1,Math.floor(damage*slotFactor));
  };
  const damageDisabled=remaining.some(e=>['bind','despair','paralysis','atkDown'].includes(e.mechanic));
  let low=0,high=0,completedPerfects=0,completedAttacks=0,chainValue=1,burnDamage=0,poisonSlotDamage=0,earlyClear=false;
  for(const [order,power]of powers.entries()){
   if(dead||specialKill)break;
   const timing=barriers.length&&!barrierPlan.blocked&&order<barrierPlan.consumes?barrierPlan.timing:'PERFECT';
   const poison=poisonSlots.includes(power.index)?Math.ceil(maxHP*.08):0,burnHit=timing==='PERFECT'?burn?.damage||0:0;
   hp-=poison+burnHit;poisonSlotDamage+=poison;burnDamage+=burnHit;
   if(hp<=0){dead=true;break;}
   completedAttacks++;if(timing==='PERFECT')completedPerfects++;const chain=chainValue+active('chain',power.index,0),tap=timing==='GREAT'?1.594/1.9:timing==='GOOD'?1.297/1.9:1;
   if(!barriers.length||!barrierPlan.blocked&&order>=barrierPlan.consumes)low+=hit(power.low*chain*tap,false,power.slotLow);
   if(!barriers.length||barrierPlan.blocked||order>=barrierPlan.consumes-1)high+=hit(power.high*chain*tap,true,power.slotHigh);
   chainValue+=timing==='PERFECT'?.3:timing==='GREAT'?.1:0;
   if(enemyLeft&&low>=enemyLeft&&!defenses.some(e=>e.mechanic==='resilience')&&!damageDisabled&&(!barriers.length||!barrierPlan.blocked&&completedAttacks>barrierPlan.consumes)&&!poisonUncertain&&!(burn&&!burn.damage)){earlyClear=true;break;}
  }
  // Unknown slot targeting is a hazard range. The full upper bound cannot be
  // called achievable once the known Burn alone kills this attack sequence.
  if(!specialKill&&poisonUncertain){low=0;issues.push('Zehir slotlarının hedefi / sayısı eksik okunmuş: 0–'+poisonSlots.length+' slot, en fazla '+(Math.ceil(maxHP*.08)*poisonSlots.length).toLocaleString('tr-TR')+' HP riski hesaplandı; canlı slot dağılımı doğrulanmalı.');}
  if(!specialKill&&burn&&!burn.damage){low=0;issues.push('PERFECT vurunca hasar (Burn) okunuyor fakat hasar miktarı eksik; sıfır hasar veya güvenli 6 PERFECT varsayılmadı.');}
  if(!specialKill&&burn&&burn.expires===undefined){low=0;issues.push('Burn tur sayısı okunamadı; kısmi azaltma temizledi sayılmadı. Tam kaldırma gerekir veya satır yeniden okunmalı.');}
  if(burn){instructions.push('Burn: PERFECT başına '+(burn.damage?burn.damage.toLocaleString('tr-TR')+' HP':'miktarı bilinmeyen hasar')+'. Kalkan bu hasarı önlemiş sayılmaz; GREAT seçersen bu PERFECT hasar tahminini kullanma.');}
  if(poisonSlots.length)instructions.push('Zehir slotu başına maksimum HP’nin %8’i ('+Math.ceil(maxHP*.08).toLocaleString('tr-TR')+' HP); normal slot çevirme / kalkan çözüm sayılmaz. Poison iyileştirme special’ını saldırıdan önce kullan.');
  if(!specialKill&&dead&&completedPerfects<crew.length)issues.push('HP saldırı sırasında bitti: 6 PERFECT zinciri tamamlanamaz; hasar '+completedPerfects+' tamamlanabilen vuruşla sınırlandı.');
  if(earlyClear)instructions.push('Okunan düşman HP’si '+completedPerfects+' vuruşla aşılır; kalan zehir / Burn slotları için gereksiz saldırı yapılmaz.');
  if(damageDisabled||invalidAuxiliary||switched.length)low=0;
  if(switched.length)issues.push('Switch sonrası form değişti: '+switched.map(id=>'#'+id).join(' / ')+'. Eski formun special’ı tekrar kullanılmadı; yeni formun stat / kaptan etkileri doğrulanmadığı için asgari hasar sıfır gösterilir.');
  const barrierOpen=!barriers.length||!damageDisabled&&!barrierPlan.blocked&&completedAttacks>=barrierPlan.consumes;
  if(!specialKill&&!barrierOpen){low=0;issues.push(...barrierReports.filter(r=>r.status==='conditional').map(r=>r.label+': '+r.detail));}
  if(enemyLeft!==undefined&&!specialKill)enemyLeft=Math.max(defenses.some(e=>e.mechanic==='resilience')?1:0,enemyLeft-low);
  const endSkills=[...captainEnd,...used.flatMap(index=>offense[index].filter(s=>s.timing==='end').map(skill=>({index,skill})))];
  for(const {index,skill}of endSkills){if(dead||specialKill)break;const blocker=damageBlocker(skill,offenseStage,[...remaining,...defenses],!barrierOpen);if(blocker){instructions.push('#'+crew[index].character.id+' tur sonu bitirme: '+blocker+' nedeniyle uygulanmaz.');continue;}const damage=skillDamage(skill,crew[index].attack*eventStats(crew[index]).atk,enemyLeft,stage.enemyDefense,threat.type);endDamage+=damage;if(enemyLeft!==undefined)enemyLeft=Math.max(0,enemyLeft-damage);instructions.push('#'+crew[index].character.id+' '+(skill.kind==='poison'?'zehir':'tur sonu hasarı')+': en az '+damage.toLocaleString('tr-TR')+' · normal saldırıdan sonra, düşman saldırısından önce bitirme kontrolü.');}
  const cleared=!dead&&enemyLeft===0&&!multipleEnemies&&!revival&&!stage.events?.some(e=>e.trigger==='hp'||e.trigger==='interrupt');
  const neutralized=cleared?[...new Set(boss.stages.filter(s=>s.id.split(':turn:')[0]===battleKey).flatMap(s=>s.requirements.map(e=>e.mechanic)))]:[];
  if(multipleEnemies)issues.push('Birden fazla düşmanın HP ve hedefleri ayrı doğrulanmadı; tek hedefli hasar tüm aşamayı bitirmiş sayılmaz.');
  for(const defense of defenses){
   const sources=used.filter(index=>offense[index].some(s=>!damageBlocker(s,offenseStage,[...remaining,...defenses],barriers.length>0))).map(index=>'#'+crew[index].character.id);
   if(cleared&&(specialDamage||endDamage)){counterplay.push({mechanic:defense.mechanic,status:'verified',method:specialKill?'Special hasarıyla bitirme':'Normal saldırı + tur sonu bitirme',sources:[...new Set([...sources,...captainEnd.map(s=>'#'+crew[s.index].character.id)])],condition:'Düşman HP’si ve hesaplanan asgari hasar bitirme için yeterli. Debuff kaldırılmış sayılmadı; düşman bitirildi.'});}
   else if(defense.mechanic==='resilience'){
    const possible=crew.flatMap((m,index)=>offense[index].filter(s=>s.kind!=='percent'&&!damageBlocker(s,offenseStage,[...remaining,...defenses],barriers.length>0)&&m.owned.cooldown!==null&&(used.includes(index)||(ready?.[index]??m.owned.readyTurn??Infinity)<=stage.turn+1)).map(skill=>({index,skill})));
    if(possible.length){const cap=Math.max(0,...possible.map(s=>skillDamage(s.skill,crew[s.index].attack*eventStats(crew[s.index]).atk,undefined,stage.enemyDefense,threat.type)));counterplay.push({mechanic:'resilience',status:'conditional',method:'Resilience azaltma yerine hasarla bitirme',sources:[...new Set(possible.map(s=>'#'+crew[s.index].character.id))],condition:enemyHP===undefined?'Düşman HP okunmadı. Special ile tek başına bitirme için HP’nin hesaplanan hasara ('+cap.toLocaleString('tr-TR')+') sığması gerekir. Alternatif: normal saldırıyla 1 HP’ye indir, bitirme special’ını sakla; sonraki turda hayatta kalma ve cooldown doğrulanmalı.':'Special hasarı tek başına yetmiyor. Normal saldırıyla 1 HP’ye indirip sonraki tur hazır hasar special’ı kullanma veya izin verilen tur sonu hasarı gerekir; bekleme riski ayrıca kontrol edilir.'});}
   }
  }
  const unresolvedDefenses=defenses.filter(e=>!neutralized.includes(e.mechanic));
  const conditionalResilience=counterplay.some(c=>c.mechanic==='resilience'&&c.status==='conditional');
  if(conditionalResilience)issues.push('Resilience için alternatif bitirme yolu var; HP / sıra / bekleme koşulları doğrulanmadan çözülmüş sayılmaz.');
  if(stage.events?.some(e=>['hp','interrupt'].includes(e.trigger)))issues.push('HP / special karşı saldırı koşulları var; uygulanmayan koşullu dal güvenli geçiş sayılmadı.');
  for(const event of stage.events?.filter(e=>e.trigger==='interrupt')||[])instructions.push('Karşı saldırı · '+event.label+': '+event.text.replace(/\n/g,' / ')+(stage.blockedSpecialPatterns?.length?' — Tetikleyen orb değiştirme etkileri bu aşamanın kullanım planından çıkarıldı.':''));
  if(revival)issues.push('Canlanma davranışı var; canlanma sonrası HP / bariyer ve ikinci hasar döngüsü doğrulanmalı.');
  if(unresolvedDefenses.length)issues.push('Kalan düşman savunmaları: '+unresolvedDefenses.map(e=>MECHANICS[e.mechanic]+' '+e.turns+' tur').join(' / '));
  const disabling=remaining.filter(e=>!neutralized.includes(e.mechanic)&&['bind','despair','specialBind','paralysis','atkDown'].includes(e.mechanic));
  if(disabling.length)issues.push('Kalan mürettebat etkileri: '+disabling.map(e=>MECHANICS[e.mechanic]+' '+e.turns+' tur').join(' / '));
  if(enemyHP===undefined)issues.push('Düşman HP okunmadı: tek turda geçiş ve sonraki turun atlanması doğrulanamadı.');
  else if(!contributionEnd&&!cleared&&high+specialDamage+endDamage<enemyHP)issues.push('Tahmini en yüksek normal saldırı hasarı düşman HP’sinden düşük; tek turda geçiş önerilemez.');
  else if(!contributionEnd&&!cleared&&low+specialDamage+endDamage<enemyHP)issues.push('Tek turda geçiş orb / tap / aktif yetenek koşullarına bağlı; sonraki tur da hesaba katılmalı.');
  if(stage.enemyDefense===undefined)issues.push('Düşmanın temel DEF değeri bilinmiyor; hasar aralığı kesin savaş sonucu değildir.');
  if(stage===boss.stages[0]&&stage.turn>0)issues.push(stage.turn+' hazırlık turunun hangi aşamada güvenle geçirileceği doğrulanmadı; Poison / saldırı altında bu kadar beklenebileceği varsayılmamalı.');
  const enemyAttack=cleared||contributionEnd?0:stage.enemyAttack||0;
  if(contributionEnd)issues.push('Super Boss katkısı: bu pencere mürettebat saldırısından sonra biter; bossun tüm HP’sini bitirme veya sonraki turda hayatta kalma şartı aranmaz.');
  if(!cleared&&!contributionEnd){if(stage.enemyAttack===undefined)issues.push('Kalınan turun düşman saldırısı bilinmiyor; stall ve hayatta kalma doğrulanamadı.');else instructions.push('Tek turda geçemezsen normal düşman saldırısı da HP’den düşülür.');}
  if(!cleared&&!contributionEnd){
   const expiring=buffs.filter(b=>b.expires===stage.turn+1),spent=selected.map(i=>'#'+crew[i].character.id);
   if(expiring.length)instructions.push('Tek turda geçemezsen sonraki tur şu buff’lar biter: '+[...new Set(expiring.map(b=>'#'+crew[b.source].character.id+' '+b.kind))].join(' / ')+'.');
   if(spent.length)instructions.push('Sonraki turda '+spent.join(' / ')+' special’ları tekrar hazır kabul edilmez; yeniden dolmaları ve kalan savunma süreleri ayrıca doğrulanmalıdır.');
   const later=stage.events?.filter(e=>e.trigger==='turn'&&e.battleTurn&&e.battleTurn>1)||[];
   for(const event of later)instructions.push('Kalınca · '+event.label+': '+event.text.replace(/\n/g,' / '));
   if(!later.length)issues.push('Rehber sonraki turun tam davranışını vermiyor; tek turda geçilemezse devam planı doğrulanmamış olur.');
  }
  const postDamage=dead||contributionEnd?0:Math.ceil((threat.defeated+enemyAttack)*captainReduction*(1-shield(buffs)));
  hp-=postDamage;
  if(threat.defeated)instructions.push('Yenilince '+threat.defeated.toLocaleString('tr-TR')+' hasar: son vuruştan önce koruma / iyileştirme ve en az '+(Math.ceil(threat.defeated*captainReduction*(1-shield(buffs)))+1).toLocaleString('tr-TR')+' HP gerekir.');
  if(threat.text.match(/Progressive Poison/i)&&remaining.some(e=>e.mechanic==='poison'))issues.push('Artan Poison hasarı bilinmiyor; hazırlık / bekleme turları güvenli sayılmadı.');
  if(stage.sourceSections?.length&&stage.sourceSections.length>1)instructions.push(stage.sourceSections.join(' / ')+': tüm alt bölümlerin etkileri korunur; alt numara tek başına saldırı turu değildir.');
  if(stage.conditionalTurn)instructions.push('Bu aşamada kalındığında Tur '+stage.conditionalTurn+' etkileri ve cooldown takvimi uygulanır.');
  if(dead||hp<=0||hpBefore<=0)issues.unshift('Kaptan HP maliyeti ve saldırıdaki hasar dahil bu kullanım planında ölüm riski var. Koruma / iyileştirme veya slot / Burn çözümü yetersiz.');
  const damageWindow=!!stage.hp||(stage.battleNumber??stage.turn+1)>=3;
  // A barrier makes the lower bound unverified; it must not make all offensive
  // choices equally worthless to the search. Discount the conditional upper
  // bound for ranking, while retaining zero guaranteed damage in the report.
  const rankingDamage=specialDamage+endDamage+((barrierPlan.blocked||stage.enemyDefense===undefined)&&!remaining.some(e=>['bind','despair','paralysis','atkDown'].includes(e.mechanic))?high*.25:low);
  const finalBattle=stage.battleNumber!==undefined&&stage.battleNumber===Math.max(...boss.stages.map(s=>s.battleNumber||0));
  const damageScore=contributionEnd?Math.log1p(rankingDamage)*5:damageWindow?(stage.hp?Math.min(40,40*rankingDamage/stage.hp):Math.min(25,Math.log1p(rankingDamage/10000)*5))*(finalBattle?2:1):0;
  const counterScore=conditionalResilience&&stage.specialLimit!==0?Math.min(60,2*(defenses.find(e=>e.mechanic==='resilience')?.turns||0)):0;
  const attackHazard=(burn?.damage||0)*(barriers.length&&!barrierPlan.blocked&&barrierPlan.timing!=='PERFECT'?crew.length-barrierPlan.consumes:crew.length)+Math.ceil(maxHP*.08)*poisonSlots.length;
  const unresolved=(burn&&!burn.damage||burn&&burn.expires===undefined||poisonUncertain)?600:0;
  const healthScore=(postDamage||preDamage||attackHazard||selfCost||hp<maxHP)?Math.max(-1000,Math.min(20,(hp-state.hp)/1000)):0;
  const status:CombatWindow['status']=strictBarriers&&!specialKill&&barrierReports.some(b=>b.status==='conditional')||invalidAuxiliary||dead||hp<=0||hpBefore<=0||!contributionEnd&&enemyHP!==undefined&&!cleared&&high+specialDamage+endDamage<enemyHP||unresolvedDefenses.some(e=>e.mechanic!=='resilience'||!conditionalResilience)||disabling.length?'blocked':issues.length?'unverified':'estimated';
  return {used,neutralized,state:{switched,enemy:{key:battleKey,blockers,defenses:unresolvedDefenses.map(e=>({mechanic:e.mechanic,until:stage.turn+e.turns})),barriers:barriers.map(b=>({...b,until:b.turns===undefined?Infinity:stage.turn+b.turns})),hp:revival||stage.events?.some(e=>e.trigger==='hp'||e.trigger==='interrupt')?undefined:enemyLeft,cleared},hp,buffs,dead:dead||hp<=0,burn,poisonSlots:earlyClear?poisonSlots.filter(i=>!powers.slice(0,completedAttacks).some(p=>p.index===i)):[],poisonUncertain:false},score:damageScore+counterScore-(strictBarriers&&!specialKill&&barrierReports.some(b=>b.status==='conditional')?10000:0)+(originalBarriers.some(b=>b.kind==='slot')&&barrierReports.every(r=>r.status==='resolved'||r.status==='bypassed')?100:0)+healthScore+weaknessMembers.length*3-unresolved-(dead||hp<=0||hpBefore<=0?2000:0),window:{stage:stage.name,turn:stage.turn,specialDamage,endDamage,enemyRemainingHP:enemyLeft,counterplay,barriers:barrierReports,completedAttacks,damageLow:Math.floor(low),damageHigh:Math.floor(high),enemyHP,hpBefore:Math.floor(hpBefore),hpAttack:Math.floor(hpAttack),hpAfter:Math.floor(hp),incoming:preDamage+enemyHPLoss+postDamage+supportLoss+burnDamage+poisonSlotDamage,selfCost,burnDamage,poisonSlotDamage,poisonSlotCount:poisonSlots.length,completedPerfects,requiredHP:Math.max(preDamage,postDamage+(earlyClear?burnDamage+poisonSlotDamage:attackHazard))+1,status,issues,instructions,remainingDefenses:unresolvedDefenses.map(e=>MECHANICS[e.mechanic])}};
 };
 const resolvedStages=new WeakMap<Stage,Map<string,Stage>>();
 const mayRemoveNAO=crew.some(m=>/removes?[^.;\n]*(?:Normal Attacks? Only|NAO)/i.test(m.specialText));
 const resolveStage=(stage:Stage,state:CombatState):Stage=>{
  let resolved=crewHpBranch(stage,state.hp,maxHP);
  const branch=resolved.events?.find(e=>/^Crew HP (below|at least) /.test(e.label)&&e.trigger==='preemptive');
  const naoGuard=!mayRemoveNAO&&/Non-Normal Attacks deal 1 damage|Normal Attack Only/i.test(offensiveText(resolved))&&!resolved.plannedAbilities?.some(a=>/removes?[^.;\n]*(?:Normal Attacks? Only|NAO)/i.test(a.text));
  const key=(branch?.label||'')+':'+naoGuard;
  const cached=resolvedStages.get(stage)?.get(key);if(cached)return cached;
  if(naoGuard&&resolved.events?.some(e=>e.trigger==='interrupt'&&e.label==='NAO etkin değilse · her seferinde'))resolved={...resolved,events:resolved.events.filter(e=>e.trigger!=='interrupt'||e.label!=='NAO etkin değilse · her seferinde')};
  if(branch){const passives=crew.flatMap((m,i)=>parseEffects(i<2?m.captainText:passiveSailor(m,data)));resolved={...resolved,requirements:resolved.requirements.map(e=>({...e,turns:Math.max(0,e.turns-(branch.requirements.find(r=>r.mechanic===e.mechanic)?passives.filter(r=>r.mechanic===e.mechanic).reduce((n,r)=>n+r.turns,0):0))})).filter(e=>e.turns>0)};}
  let variants=resolvedStages.get(stage);if(!variants){variants=new Map();resolvedStages.set(stage,variants);}variants.set(key,resolved);return resolved;
 };
 return {initial:{hp:initialHP,buffs:[]},resolveStage,step,report:windows=>({status:windows.some(w=>w.status==='blocked')?'blocked':environmentWarning||windows.some(w=>w.status==='unverified')?'unverified':'estimated',maxHP,initialHP,startEffects,windows,tandem,assumptions:['Normal saldırı aralığı: timing bariyeri için belirtilen GREAT / GOOD, diğer saldırılarda PERFECT; sıralanan temel ATK, gerçek kaptan kapsamı ve yalnız planlanan / süresi devam eden koşulsuz buff’lar. Ölümcül saldırı zinciri 6 vuruşluk hasar sayılmaz. Gemi / Cotton Candy / kritik / Last Tap / Tandem / Rush / Territory için ek hasar varsayılmadı.','Başlangıç HP’sine iki kaptanın HP kesmeleri uygulandı. İyileştirme yalnız kullanım sırasında ve hayattayken sayılır; hazırlıkta otomatik tam cana dönülmez. Bilinmeyen düşman saldırıları, Poison durum hasarı, yüzde hasarı ve eksik orb verisi güvenli kabul edilmez.','Zehir slotu başına %8 maksimum HP riski; Poison iyileştirme ile matching slota çevrilir. Socket Poison direnci kayıtlı olmadığından indirimsiz hesaplanır. Kaynak: https://xn--pck6bvfc.gamewith.jp/article/show/289502','Aynı kategorideki buff’lar çarpılmaz; cooldown, special sınırı, savunma kaldırma ve aktif buff süreleri kullanım planıyla birlikte değerlendirilir.'],problems:windows.flatMap(w=>w.issues.map(issue=>w.stage+': '+issue))})};
}
