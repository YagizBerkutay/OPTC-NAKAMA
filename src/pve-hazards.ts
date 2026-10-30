import type {Stage} from './model';
import {sentences} from './pve-targets';

export type HPChange={kind:'cut'|'set';amount:number;basis:'current'|'max'|'fixed'};
// "by 80%" leaves 20%; "to 20%" sets the remainder. Enemy HP cuts
// are deliberately excluded from the crew's health costs.
export function hpChanges(text:string,startOnly=false):HPChange[]{
 const changes:HPChange[]=[];
 for(const sentence of sentences(text)){
  if(/\bif\b|\bwhen\b|\bafter\b|otherwise|chance/i.test(sentence))continue;
  for(const m of sentence.matchAll(/(?:reduces?|cuts?|sets?) (?:the )?crew['’]s (?:current )?HP (by|to) ([\d,]+)(%?)(?: of (?:the )?(?:crew['’]s )?(MAX|maximum|current) HP)?/gi)){
   const tail=sentence.slice(m.index!+m[0].length).split(/,\s*(?:and\s+)?(?=reduces?|boosts?|makes?|increases?)/i)[0];
   if(startOnly&&!/at (?:the )?start of (?:the )?(?:fight|quest|adventure)/i.test(tail))continue;
   const percent=!!m[3],amount=Number(m[2].replace(/,/g,''));if(percent&&amount>100)continue;
   changes.push({kind:m[1].toLowerCase()==='by'?'cut':'set',amount:percent?amount/100:amount,basis:percent?/max|maximum/i.test(m[4]||'')?'max':'current':'fixed'});
  }
 }
 return changes;
}
export function changeHP(hp:number,maxHP:number,change:HPChange){
 const value=change.basis==='fixed'?change.amount:(change.basis==='max'?maxHP:hp)*change.amount;
 return change.kind==='cut'?Math.max(1,Math.floor(hp-value)):Math.min(hp,Math.max(1,Math.floor(value)));
}
export function removalTurns(text:string,kind:'burn'|'poison'){
 // This reaction's condition is the debuff itself; it is guaranteed when the
 // crew receives Burn, unlike HP / tag / launch-count requirements.
 if(kind==='burn'&&/If (?:the )?crew is inflicted with Burn from a Special, Support Ability or Enemy Action, replaces that debuff/i.test(text))return 99;
 let turns=0;
 for(const sentence of sentences(text)){
  if(/\bif\b|\bwhen\b|\bafter\b|otherwise|chance|Special Launch Status/i.test(sentence))continue;
  for(const line of sentence.split(/(?:,\s*(?:and\s+)?|\s+and\s+)(?=reduces?|removes?|recovers?|boosts?|changes?|If|When)/i)){
  if(/\bif\b|\bwhen\b|\bafter\b|otherwise|chance|this character|enemies|enemy/i.test(line))continue;
  if(!/reduces?|removes?|recovers?/i.test(line)||!new RegExp('\\b'+kind+'\\b','i').test(line))continue;
  const label=new RegExp('\\b'+kind+'\\b','i');
  for(const match of line.matchAll(/(?:removes?|recovers?)\s+([^.;]{1,150}?)\s+(?:duration\s+)?completely/gi))if(label.test(match[1]))turns=99;
  if(new RegExp('(?:removes?|recovers?) (?:all|every) '+kind+'\\b','i').test(line))turns=99;
  for(const match of line.matchAll(/(?:reduces?|removes?)\s+([^.;]{1,150}?)\s+(?:duration\s+)?by (\d+) turns?/gi))if(label.test(match[1]))turns=Math.max(turns,Number(match[2]));
  }
 }
 return turns;
}
export function stageHazards(stage:Stage){
 const text=stage.events?.length?stage.events.filter(e=>['preemptive','starting','turn','unknown'].includes(e.trigger)&&(!e.battleTurn||e.battleTurn===(stage.conditionalTurn||1))).map(e=>e.text).join('\n'):stage.notes||'';
 const lines=text.split('\n'),burnLine=lines.find(l=>/\bBurn\b|take damage when performing PERFEC[TIl]/i.test(l));
 const burnDamage=Number(burnLine?.match(/([\d,]+)\s*damage (?:Burn|when)/i)?.[1]?.replace(/,/g,'')||0);
 const burnTurns=Number(burnLine?.match(/\b(\d{1,2})\s*turn(?:\(s\)|s)?/i)?.[1])||stage.events?.filter(e=>['preemptive','starting','turn'].includes(e.trigger)).flatMap(e=>e.requirements).find(e=>e.mechanic==='burn')?.turns||stage.requirements.find(e=>e.mechanic==='burn')?.turns;
 const poisonLine=lines.find(l=>/(?:to|into)\s*\[?POISON\]?\s*(?:Slots?|orbs?)/i.test(l)||/POISON\s+(?:slots?|orbs?)/i.test(l));
 const poisonTargets=poisonLine?/all (?:slots?|orbs?)|(?:slots?|orbs?) of all (?:characters|units)/i.test(poisonLine)?[0,1,2,3,4,5]:/middle[ -]row/i.test(poisonLine)?[2,3]:/bottom[ -]row/i.test(poisonLine)?[4,5]:/top[ -]row|captain/i.test(poisonLine)?[0,1]:/crewmate/i.test(poisonLine)?[2,3,4,5]:null:[];
 return {burn:!!burnLine,burnDamage,burnTurns,poison:!!poisonLine,poisonTargets};
}
export function hazardNeeded(stage:Stage,text:string){
 const h=stageHazards(stage);return h.poison&&removalTurns(text,'poison')>0||h.burn&&!h.burnTurns&&removalTurns(text,'burn')>=99;
}
