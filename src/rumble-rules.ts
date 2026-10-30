import type {PlanMember,PlannerData} from './planning';
import {tagged} from './rumble-planner';
export type RumbleRuleEffect =
  | {kind:'stat';targets:string[];attributes:string[];level:number}
  | {kind:'damage';targets:string[];dealtPercent:number;takenPercent:number;combatPowerOnly:boolean}
  | {kind:'late';targets:string[];seconds:number};
export type RumbleRules = {phase:string;text:string;effects:RumbleRuleEffect[];warnings:string[];observedAt:string;source:string};
export function ruleDescription(effect:RumbleRuleEffect):string {
  if(effect.kind==='stat')return effect.targets.join(' / ')+' · '+effect.attributes.join(' / ')+' '+(effect.level>0?'+':'')+effect.level;
  if(effect.kind==='damage')return effect.targets.join(' / ')+' · verilen hasar +%'+effect.dealtPercent+' / alınan hasar '+effect.takenPercent+'%'+(effect.combatPowerOnly?' · yalnızca Combat Power':'');
  return 'Son '+effect.seconds+' saniye · Special CT Speed / Damage Up (miktar belirtilmemiş)';
}
export function rulesValid(rules:RumbleRules):boolean {
  return ['Block A','Block B','Block C','Championship','Exhibition'].includes(rules.phase)&&typeof rules.text==='string'&&rules.text.length<=12000&&Number.isFinite(Date.parse(rules.observedAt))&&Array.isArray(rules.effects)&&rules.effects.length<=30&&rules.effects.every(e=>Array.isArray(e.targets)&&e.targets.length<=20&&e.targets.every(t=>typeof t==='string'&&t.length<=100)&&(e.kind==='stat'?Number.isInteger(e.level)&&Math.abs(e.level)<=20&&Array.isArray(e.attributes)&&e.attributes.every(a=>['ATK','HP','DEF','SPD','RCV','Special CT','Guard','CRIT','Accuracy','Shield'].includes(a)):e.kind==='damage'?Number.isFinite(e.dealtPercent)&&e.dealtPercent>=0&&e.dealtPercent<=100&&Number.isFinite(e.takenPercent)&&e.takenPercent<=0&&e.takenPercent>=-100&&typeof e.combatPowerOnly==='boolean':e.kind==='late'&&Number.isInteger(e.seconds)&&e.seconds>0&&e.seconds<=100));
}
export function ruleMemberValue(member:PlanMember,data:PlannerData,rules:RumbleRules|undefined,weights:Record<string,number>):number {
  if(!rules)return 0;
  // Dual cards have no Rumble colour; their combined classes and tags still apply.
  const targetMember=data.units[member.character.id]?.abilities?.swap?{...member,character:{...member.character,types:[]}}:member;
  return rules.effects.reduce((total,e)=>{
    if(e.kind==='late'||!e.targets.some(t=>t==='crew')&&!tagged(targetMember,e.targets,data))return total;
    if(e.kind==='stat')return total+e.level*e.attributes.reduce((n,a)=>n+(weights[a]||1),0)*2;
    // CP-only percentages are a small displayed-power preference, never a battle damage multiplier.
    return total+(e.dealtPercent+Math.abs(e.takenPercent))*(e.combatPowerOnly?.15:.5);
  },0);
}
