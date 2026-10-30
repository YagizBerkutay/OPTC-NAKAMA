import type {Stage,Character} from './model';
import type {PlannerData} from './planning';
import {sentences,scopeMatches} from './pve-targets';
import {damageSkills,damageBlocker,skillDamage} from './pve-offense';

export type Barrier={kind:'timing'|'slot'|'hit'|'damage'|'unknown';text:string;turns?:number;count?:number;timing?:'PERFECT'|'GREAT'|'GOOD';slot?:string};
export type BarrierReport={kind:Barrier['kind'];label:string;status:'manual'|'resolved'|'conditional'|'bypassed';detail:string};
export type SlotChange={targets:'all'|'self'|'adjacent'|'top'|'middle'|'bottom'|string;from?:string[];to:string;block:boolean};
const colors=['STR','DEX','QCK','PSY','INT'],slots=[...colors,'RCV','TND','EMPTY','BLOCK','POISON'];
const unconditional=(s:string)=>!/\bif\b|\bwhen\b|\bafter\b|depending|chance|random|otherwise|Launch Status/i.test(s);
const skillClauses=(text:string)=>sentences(text).flatMap(s=>/^\s*(If|When|After|Depending)\b/i.test(s)?[s]:s.split(/(?:,\s*(?:and\s+)?|\s+and\s+)(?=changes?|converts?|reduces?|removes?|boosts?|recovers?|makes?|locks?)/i));
export const barrierActiveText=(stage:Stage)=>stage.events?.length?stage.events.filter(e=>['starting','preemptive','turn','unknown'].includes(e.trigger)&&(!e.battleTurn||e.battleTurn===(stage.conditionalTurn||1))).map(e=>e.text).join('\n'):stage.notes||'';
export function stageBarriers(stage:Stage):Barrier[]{
 const out:Barrier[]=[];
 for(const text of barrierActiveText(stage).replace(/Tap-Timino/gi,'Tap-Timing').split('\n').filter(v=>/Barrier|Bariyer/i.test(v))){
  const turns=Number(text.match(/\b(\d+)\s*turn(?:\(s\)|s)?/i)?.[1])||undefined;
  const timing=text.match(/\b(PERFECT|GREAT|GOOD)\b/i)?.[1].toUpperCase() as Barrier['timing'];
  const slot=text.match(/\b(STR|DEX|QCK|PSY|INT|RCV|TND)\b/i)?.[1].toUpperCase();
  const kind:Barrier['kind']=/Slot|Orb/i.test(text)?'slot':timing||/Tap[ -]Timing/i.test(text)?'timing':/Hit/i.test(text)?'hit':/Damage/i.test(text)?'damage':'unknown';
  const label=timing||slot;
  const count=Number(label?text.match(new RegExp(label+'\\]?\\s*[:x×]?\\s*(\\d+)\\s*(?:time(?:\\(s\\)|s)?|hits?|orbs?|slots?)?','i'))?.[1]||text.match(new RegExp('(\\d+)\\s*\\[?'+label+'\\]?','i'))?.[1]:kind==='hit'?text.match(/(\d+)\s*hits?/i)?.[1]:undefined)||undefined;
  const barrier={kind,text,turns,count,timing,slot};
  if(!out.some(b=>b.kind===kind&&b.count===count&&b.slot===slot&&b.timing===timing&&b.turns===turns))out.push(barrier);
 }
 return out;
}
export function barrierRemoval(text:string):number{
 let value=0;
 for(const line of skillClauses(text)){
  if(!unconditional(line))continue;
  const match=line.match(/(?:reduces?|removes?) (?:the )?(?:duration of (?:all )?enemies['’] )?[^.;]{0,70}?Barriers?(?: duration)? by (\d+) turns?/i);
  if(match)value=Math.max(value,Number(match[1]));
  if(/removes? (?:all )?(?:enemies['’] )?Barriers?(?: duration)? completely/i.test(line))value=Infinity;
 }
 return value;
}
export function slotChanges(text:string):SlotChange[]{
 const out:SlotChange[]=[];
 for(const line of skillClauses(text)){
  if(!unconditional(line)||!/^\s*(?:Changes?|Converts?)/i.test(line))continue;
  const m=line.match(/^\s*(?:Changes?|Converts?)\s+(.+?)\s+(?:into|to)\s+(Matching|\[(?:STR|DEX|QCK|PSY|INT|RCV|TND)\])\s*(?:orbs?|slots?)?(?:\s*[,.;]|$)/i);if(!m)continue;
  const source=m[1],to=m[2].replace(/[\[\]]/g,'').toUpperCase();
  const bracket=[...source.matchAll(/\[(\w+)\]/g)].map(v=>v[1].toUpperCase()).filter(v=>slots.includes(v));
  const targets=/adjacent/i.test(source)?'adjacent':/own|this character|self/i.test(source)?'self':/top[ -]row|captains?['’]? orbs?/i.test(source)?'top':/middle[ -]row/i.test(source)?'middle':/bottom[ -]row/i.test(source)?'bottom':/all orbs?|all slots?|all characters/i.test(source)?'all':source.match(/(?:orbs?|slots?) of (.+?)(?: characters)?$/i)?.[1]||(/^(?:\[[^\]]+\][, /and]*)+\s*(?:orbs?|slots?)$/i.test(source)?'all':'unknown');
  if(targets==='unknown')continue;
  const from=bracket.length&&!/all (?:orbs?|slots?)/i.test(source)&&!/(?:including|excluding)/i.test(source)?bracket:undefined;
  out.push({targets,from,to,block:bracket.includes('BLOCK')&&!/excluding \[BLOCK\]/i.test(source)});
 }
 return out;
}
export function applySlotChanges(current:(string|undefined)[],changes:SlotChange[],index:number,crew:Character[],data?:PlannerData){
 const out=[...current];
 for(const change of changes)for(let i=0;i<out.length;i++){
  const target=change.targets==='all'||change.targets==='self'&&i===index||change.targets==='adjacent'&&Math.abs(i%2-index%2)+Math.abs(Math.floor(i/2)-Math.floor(index/2))===1||change.targets==='top'&&i<2||change.targets==='middle'&&i>=2&&i<4||change.targets==='bottom'&&i>=4||!['self','adjacent','top','middle','bottom'].includes(change.targets)&&scopeMatches(change.targets,crew[i],data,crew[index]);
  if(!target||out[i]==='POISON'||(out[i]==='BLOCK'||out[i]===undefined)&&!change.block||change.from&&!change.from.includes(out[i]||''))continue;
  out[i]=change.to==='MATCHING'?(crew[i].types.length===1?crew[i].types[0]:undefined):change.to;
 }
 return out;
}
export function enemySlots(stage:Stage,size:number):(string|undefined)[]{
 const out:(string|undefined)[]=Array(size).fill(undefined);
 for(const text of barrierActiveText(stage).split('\n')){
  if(/Barrier|beneficial|matching effect|Orb Effects/i.test(text)||/Random|Shuffle|Unfavorable/i.test(text))continue;
  const slot=text.match(/(?:into|to|Slot Change[: ]|Change Slots?[: ])\s*\[?(STR|DEX|QCK|PSY|INT|RCV|TND|BLOCK|EMPTY|POISON)\]?(?:\s*(?:orbs?|slots?)|\s*$)/i)?.[1].toUpperCase();
  if(slot&&(/all (?:slots?|orbs?)|(?:slots?|orbs?) of all/i.test(text)||/^\s*(?:Slot Change|Change Slots?):/i.test(text)))out.fill(slot);
 }
 return out;
}
export function crewBarrierPotential(stage:Stage,crew:{character:Character;specialText:string}[],ready:{character:Character;specialText:string}[],data?:PlannerData):number {
 const initial=enemySlots(stage,crew.length),changes=ready.flatMap(m=>slotChanges(m.specialText).map(change=>({member:m,change}))),removal=Math.max(0,...ready.map(m=>barrierRemoval(m.specialText)));
 return stageBarriers(stage).filter(b=>b.kind!=='timing').reduce((sum,b)=>{
  if(removal&&(removal===Infinity||b.turns!==undefined&&removal>=b.turns))return sum+1;
  if(b.kind!=='slot'||!b.slot||!b.count)return sum;
  if(initial.filter(s=>s===b.slot).length>=b.count)return sum+1;
  const count=b.count;
  const single=crew.filter(m=>m.character.types.length===1&&m.character.types[0]===b.slot);
  const usable=changes.filter(({change:c})=>(!c.from||initial.some(s=>s!==undefined&&c.from!.includes(s)))&&(c.to===b.slot||c.to==='MATCHING'));
  const enough=usable.some(({member,change:c})=>{
   const targets=crew.filter(m=>c.targets==='self'?m===member:c.targets==='adjacent'?m!==member:['all','middle','bottom'].includes(c.targets)?true:c.targets==='top'?crew.indexOf(m)<2:scopeMatches(c.targets,m.character,data,member.character));
   return targets.filter(m=>c.to===b.slot||single.includes(m)).length>=count;
  });
  // Search potential only; the combat pass proves positions and actual slots.
  return sum+(enough?1:usable.length?.5:single.length?.25:0);
 },0);
}
export function barrierRelevance(stage:Stage,text:string,character:Character,data?:PlannerData){
 const barriers=stageBarriers(stage).filter(b=>b.kind!=='timing');if(!barriers.length||stage.specialLimit===0)return 0;
 const removal=barrierRemoval(text),changes=slotChanges(text),trueSkills=damageSkills(text).filter(s=>s.trueDamage&&!damageBlocker(s,stage,stage.requirements));
 let value=trueSkills.length?(stage.hp===undefined||trueSkills.some(s=>skillDamage(s,character.atk,stage.hp)>=stage.hp!)?.6:.1):0;
 // Rank feasibility against the read initial slots. A RCV-only converter
 // cannot supply STR when the enemy has filled every slot with BLOCK.
 const hypothetical=applySlotChanges(enemySlots(stage,6),changes,2,Array(6).fill(character),data);
 for(const b of barriers){if(removal)value+=removal===Infinity?1:b.turns?Math.min(1,removal/b.turns):0;if(b.kind==='slot'&&b.slot&&b.count)value+=Math.min(1,hypothetical.filter(slot=>slot===b.slot).length/b.count);}
 return value;
}
export function barrierLabel(b:Barrier){return b.kind==='timing'?'Timing bariyeri · '+(b.timing||'Timing okunmadı')+(b.count?' × '+b.count:''):b.kind==='slot'?'Slot bariyeri · '+(b.slot?'['+b.slot+']':'Slot okunmadı')+(b.count?' × '+b.count:''):b.kind==='hit'?'Hit bariyeri':b.kind==='damage'?'Hasar bariyeri':'Bariyer türü okunamadı';}
export function planBarrierAttacks(barriers:Barrier[],actualSlots:(string|undefined)[],weakest:number[],restricted=false){
 const reports:BarrierReport[]=[],front:number[]=[];let consumes=0,timing:Barrier['timing']='PERFECT',blocked=false;
 if(barriers.length>1){blocked=true;reports.push({kind:'unknown',label:'Birden fazla bariyer',status:'conditional',detail:'Bariyerlerin hedefleri ve birlikte açılma sırası doğrulanmalı; tek bariyer hesabı kullanılmadı.'});}
 for(const b of barriers){
  if(b.kind==='timing'&&b.timing&&b.count&&b.count<=weakest.length){consumes=b.count;timing=b.timing;reports.push({kind:b.kind,label:barrierLabel(b),status:'manual',detail:'İlk '+b.count+' saldırıyı '+b.timing+' vur; özel bariyer kaldırıcı aranmıyor. Bariyer açılmadan yapılan vuruşlar tam hasar sayılmaz.'});}
  else if(b.kind==='slot'&&b.slot&&b.count&&b.count<=weakest.length&&!restricted){const matching=weakest.filter(i=>actualSlots[i]===b.slot);if(matching.length>=b.count){front.push(...matching.slice(0,b.count));consumes=b.count;reports.push({kind:b.kind,label:barrierLabel(b),status:'resolved',detail:'['+b.slot+'] × '+b.count+' · gereken gerçek slot '+matching.length+' üyede sağlandı. Önce bu slotlu üyelerle bariyeri aç, güçlü saldırıları sona bırak.'});}else{blocked=true;reports.push({kind:b.kind,label:barrierLabel(b),status:'conditional',detail:'['+b.slot+'] × '+b.count+' gerekiyor; kesin sağlanan '+matching.length+' slot. Uygun slot dönüştürme / bariyer süresini kaldırma veya savunmayı aşan hasar gerekli. Faydalı / matching sayılması, ['+b.slot+'] slotu olması değildir.'});}}
  else{blocked=true;reports.push({kind:b.kind,label:barrierLabel(b),status:'conditional',detail:restricted?'Slot kilidi / bağlama / zehir hedefi belirsiz; dönüşüm güvenli sayılmadı.':b.kind==='hit'?'Kombo hit sayısı gerekli; timing veya slot bariyeri gibi sayılmadı.':b.kind==='damage'?'Bariyer hasar eşiği gerekli; timing veya slot bariyeri gibi sayılmadı.':'Bariyerin slotu / timing türü veya gereken adet tam okunmadı.'});}
 }
 return {order:[...front,...weakest.filter(i=>!front.includes(i))],consumes,timing,blocked,reports};
}
