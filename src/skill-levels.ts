import type {PlanMember,PlannerData} from './planning';
export function targetMaximum(m:PlanMember){return m.targeted===true;}
export function abilitiesAt(m:PlanMember,data:PlannerData):Record<string,unknown>{
  const unit=data.units[m.character.id],out={...unit?.abilities};
  for(const tier of unit?.llb.slice(0,m.owned.llb)||[])for(const key of ['sailor','support'] as const)if(tier?.[key])out[key]=typeof out[key]==='object'&&!Array.isArray(out[key])&&typeof tier[key]==='object'?{...out[key] as object,...tier[key] as object}:tier[key];
  return out;
}
export function abilityText(value:unknown,level=1):string{
  if(typeof value==='string')return value.replace(/<[^>]*>/g,' ');
  if(Array.isArray(value))return value.every(v=>typeof v==='string')?abilityText(value[Math.max(0,Math.min(value.length,level)-1)],level):value.map(v=>abilityText(v,level)).join('\n');
  if(value&&typeof value==='object')return Object.entries(value).filter(([k])=>!['condition','characterCondition','Characters','Name'].includes(k)).map(([,v])=>abilityText(v,level)).join('\n');
  return '';
}
export function passiveSailor(m:PlanMember,data?:PlannerData):string{
  const value=data?abilitiesAt(m,data).sailor:undefined;if(typeof value==='string')return abilityText(value);if(!value||typeof value!=='object')return '';
  const limit=data!.units[m.character.id].limit,key=limit.findIndex(v=>/LOCKED WITH KEY/i.test(v)),open=targetMaximum(m)?limit:key<0?limit:limit.slice(0,key);
  const entries=Object.entries(value),form=m.owned.pveForm||'character1';
  return entries.filter(([k])=>['character1','character2','combined'].includes(k)?k===(entries.some(([name])=>name===form)?form:'character1'):k==='base'||m.owned.lb&&(!/level\d+/i.test(k)||!limit.some(v=>/Acquire Sailor Ability/i.test(v))||open.some(v=>new RegExp('Acquire Sailor Ability '+k.match(/\d+/)?.[0]+'\\b','i').test(v)))).map(([,v])=>abilityText(v)).join('\n');
}
export function selectedLevel(m:PlanMember,key:string,value:unknown):number{
  if(targetMaximum(m))return Array.isArray(value)?value.length:5;
  return m.owned.pveLevels?.[key]??0;
}
