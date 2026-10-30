import type {Effect,Stage} from './model';
import {sentences} from './pve-targets';

export type DamageSkill={timing:'special'|'end';kind:'fixed'|'attack'|'percent'|'poison';amount:number;all:boolean;trueDamage:boolean;ignoreDefense:boolean;ignoreNAO:boolean;type?:string;text:string};
export type Counterplay={mechanic:string;status:'verified'|'conditional';method:string;sources:string[];condition:string};
const number=(text:string)=>Number(text.replace(/,/g,''));
export function damageSkills(text:string):DamageSkill[]{
 const result:DamageSkill[]=[];
 for(const sentence of sentences(text)){
  // A damage clause is evaluated separately from later conditional buffs.
  const re=/\bDeals?\s+(\d[\d,.]*)(x (?:this )?character['’]s ATK)?(?: in)?\s+((?:(?:\[(?:STR|DEX|QCK|PSY|INT)\]|Typeless|Fixed|True|non-type)\s+)*)damage(?:,\s*(ignoring Normal Attacks? Only))?,?\s+to\s+(all enemies|one enemy)/gi;
  for(const m of sentence.matchAll(re)){
   const prefix=sentence.slice(0,m.index),tail=sentence.slice(m.index!+m[0].length).split(/,\s*(?:and\s+)?(?=boosts?|reduces?|changes?|recovers?|delays?|applies?|becomes?)/i)[0];
   if(/\bif\b|\bwhen\b|after \d|chance|random|depending|otherwise/i.test(prefix+' '+tail))continue;
   result.push({timing:/at (?:the )?end of (?:the |each )?turn/i.test(prefix+' '+tail)?'end':'special',kind:m[2]?'attack':'fixed',amount:number(m[1]),all:/all/i.test(m[5]),trueDamage:/\bTrue\b/i.test(m[3]),ignoreDefense:/\bTrue|\bFixed/i.test(m[3]),ignoreNAO:!!m[4],type:m[3].match(/\[(STR|DEX|QCK|PSY|INT)\]/)?.[1],text:m[0]+tail});
  }
  const cut=sentence.match(/^\s*Deals? (\d+)% of enemies['’] current HP in (True )?damage(?:, (ignoring Normal Attacks? Only))?,? to (all enemies|one enemy)/i);
  if(cut)result.push({timing:'special',kind:'percent',amount:Number(cut[1])/100,all:/all/.test(cut[4]),trueDamage:!!cut[2],ignoreDefense:!!cut[2],ignoreNAO:!!cut[3],text:cut[0]});
  // Unknown Poison magnitude is only a >=1 finishing hit, never full damage.
  if(/^\s*(?:Poisons? all enemies|Applies Poison to all enemies)[.!]?$/i.test(sentence))result.push({timing:'end',kind:'poison',amount:1,all:true,trueDamage:false,ignoreDefense:true,ignoreNAO:false,text:sentence});
 }
 return result;
}
export function offensiveText(stage:Stage){return stage.events?.length?stage.events.filter(e=>['starting','preemptive','turn','unknown'].includes(e.trigger)).map(e=>e.text).join('\n'):stage.notes||'';}
export function damageBlocker(skill:DamageSkill,stage:Stage,remaining:Effect[],barrier?:boolean):string{
 const text=offensiveText(stage);
 if((stage.normalAttackOnly||/Normal Attacks? Only|Non-Norma[lI] Attacks deal\s*1/i.test(text))&&!skill.ignoreNAO)return 'Normal Attack Only';
 if(skill.kind==='percent'&&/Percentage damage resistan|Nullify Percentage Damage|Percentage Damage Immunity/i.test(text))return 'Yüzde hasarı bağışıklığı';
 if(skill.kind==='poison'&&/Immunity|Debuff Protection/i.test(text))return 'Zehir / durum bağışıklığı';
 if(remaining.some(e=>e.mechanic==='damageNullification')||/Damage Nullification|Damage Negation|Immune to damage/i.test(text)&&!stage.requirements.some(e=>e.mechanic==='damageNullification'))return 'Hasar etkisizleştirme: bu yeteneğin aşabildiği doğrulanmadı';
 if(!skill.trueDamage&&skill.kind!=='poison'){
  if(barrier??/Barrier|Bariyer/i.test(text))return 'Bariyer';
  if(remaining.some(e=>['defenseUp','damageReduction','threshold'].includes(e.mechanic)))return 'Kalan DEF / hasar savunması';
  if(!skill.ignoreDefense&&skill.kind!=='percent'&&stage.enemyDefense===undefined)return 'Düşman DEF okunmadı';
 }
 return '';
}
export function skillDamage(skill:DamageSkill,attack:number,enemyHP?:number,defense=0,enemyType?:string):number{
 if(skill.kind==='percent')return enemyHP===undefined?0:Math.floor(enemyHP*skill.amount);
 const value=skill.kind==='attack'?skill.amount*attack:skill.amount;
 // ATK specials use the source's base ATK, without captain / orb multipliers.
 const beats:Record<string,string>={STR:'DEX',DEX:'QCK',QCK:'STR',PSY:'INT',INT:'PSY'},affinity=!skill.type?1:!enemyType?.5:beats[skill.type]===enemyType?2:beats[enemyType]===skill.type?.5:1;
 return Math.max(0,Math.floor(value*affinity-(skill.ignoreDefense?0:defense)));
}
export function counterRelevance(stage:Stage,text:string,passive=false):number{
 if(!passive&&stage.specialLimit===0)return 0;
 const skills=damageSkills(text).filter(s=>(!passive||s.timing==='end')&&!damageBlocker(s,stage,stage.requirements));
 if(!skills.length)return 0;
 return stage.requirements.filter(e=>e.mechanic==='resilience'||['defenseUp','damageReduction','threshold'].includes(e.mechanic)&&skills.some(s=>s.trueDamage)).length*.7;
}
