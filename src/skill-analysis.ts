import type { Boss, Effect } from './model';
import { parseEffects, specialBoosts, type PlanMember, type PlannerData, type PlanTeam } from './planning';
import {resolveCrewText} from './crew-conditions';
import {passiveSailor,abilityText,selectedLevel,targetMaximum,abilitiesAt} from './skill-levels';
import {hazardNeeded} from './pve-hazards';
import {stageBarriers,barrierRemoval,slotChanges} from './pve-barriers';
import {kizunaCounterReduction} from './kizuna';
import {statusTargets} from './pve-status';

const canonicalCache=new Map<string,string>(),baseNames=new Map<string,string>();
const canonical=(s:string)=>{let v=canonicalCache.get(s);if(v===undefined){v=s.replace(/\([^)]*\)/g,'').replace(/[^a-z]/gi,'').toLowerCase();if(canonicalCache.size>=8192)canonicalCache.clear();canonicalCache.set(s,v);}return v;};
export function namedMember(m:PlanMember,name:string){const n=canonical(name);let base=baseNames.get(m.character.name);if(base===undefined){base=canonical(m.character.name.split(/\s+-\s+|:/)[0]);if(baseNames.size>=8192)baseNames.clear();baseNames.set(m.character.name,base);}return !!n&&(m.families.some(f=>canonical(f)===n)||base.includes(n));}
export function rewindResistance(m:PlanMember,data?:PlannerData){
  if(!data)return 0;
  const sailor=passiveSailor(m,data);
  if(/restores Special Cooldown of this character completely when it is rewinded/i.test(sailor))return 99;
  return Number(sailor.match(/(?:resists|reduces).*?(?:Special Cooldown Rewind|Special Rewind|Cooldown Rewind|Special Reverse).*?by (\d+) turns?/i)?.[1])||0;
}
export function statusResistance(m:PlanMember,kind:'bind'|'specialBind',data?:PlannerData,captain=false){
 const text=captain?m.captainText:data?passiveSailor(m,data):'',label=kind==='bind'?'Bind':'Special (?:Bind|Silence)';
 if(new RegExp('(?:this character[^.;]*immune to '+label+'|completely (?:resists?|resistant to) '+label+')','i').test(text))return 99;
 const patterns=[new RegExp('resists? '+label+' (?:duration )?by (\\d+) turns?','i'),new RegExp('reduces? (?:duration of )?'+label+'(?: duration)? (?:on|of) this character by (\\d+) turns?','i'),new RegExp('reduces? this character[’\x27]s '+label+'(?: duration)? by (\\d+) turns?','i')];
 return Math.max(0,...patterns.map(p=>Number(text.match(p)?.[1]||0)));
}
function flatten(value:unknown, max:boolean):string {
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.every(v=>typeof v==='string')?String(value[max?value.length-1:0]||''):value.map(v=>flatten(v,max)).join('\n');
  if(value&&typeof value==='object')return Object.entries(value).map(([key,v])=>`${key}: ${flatten(v,max)}`).join('\n');
  return '';
}
export type Activation='ready'|'unmet'|'unknown';
const criteriaCache=new Map<string,{lists:{required:number;names:string[]}[];prefixUnknown:boolean;ready:boolean;alternative:boolean;captain:boolean;count?:{required:number;scope:string};runtime:boolean}>();
export function crewCriterion(criteria:string,source:PlanMember,crew:PlanMember[],matchesName=namedMember):Activation {
  if(!criteria.trim())return 'unknown';
  let parsed=criteriaCache.get(criteria);
  if(!parsed){
    const lists=[...criteria.matchAll(/(?:(?:any|at least)\s+(\d+)\s+of the following[^:]*:|(\d+)\s+of the following is required:)\s*/gi)],count=criteria.match(/(?:at least|with|of|contains|consist of)\s+(\d+)\s+([^.;]+?)\s+characters/i);
    parsed={lists:lists.map((start,index)=>({required:Number(start[1]||start[2]),names:criteria.slice(start.index!+start[0].length,lists[index+1]?.index).split(/\s+or your crew|;|\.\s+(?:If|When|This|Your)|\n/i)[0].replace(/\.\s*$/,'').split(/,\s*|\s+and\s+|\s+or\s+/).filter(Boolean)})),prefixUnknown:/last stage|orb|tap|HP|special abilit|activated|damage|Combined Form|Super Swap|Super Switch|Territory|Launch Status/i.test(criteria.slice(0,lists[0]?.index)),ready:/only|excluding supports|counting only|must be captain|crew must consist|following/i.test(criteria),alternative:/or your crew/i.test(criteria),captain:/must be (?:your )?captain/i.test(criteria),count:count?{required:Number(count[1]),scope:count[2]}:undefined,runtime:/HP|orb|tap|damage|specials? (?:used|activated)/i.test(criteria)};
    if(criteriaCache.size>=2048)criteriaCache.clear();criteriaCache.set(criteria,parsed);
  }
  if(parsed.captain&&crew.indexOf(source)>1)return 'unmet';
  if(parsed.lists.length){for(const list of parsed.lists){let matching=0;for(const m of crew)if(m!==source&&list.names.some(name=>matchesName(m,name)))matching++;if(matching<list.required)return parsed.alternative?'unknown':'unmet';}return parsed.prefixUnknown?'unknown':parsed.ready?'ready':'unknown';}
  if(parsed.count){const {scope,required}=parsed.count;let number=0;for(const m of crew)if(m.character.types.some(v=>scope.includes(v))||m.character.classes.some(v=>scope.includes(v)))number++;return number<required?'unmet':parsed.runtime?'unknown':'ready';}
  return 'unknown';
}
type Action={position?:number;bindResistance?:number;specialBindResistance?:number;changesForm?:boolean;id:string;name:string;text:string;effects:Effect[];oneUse:boolean;passive?:boolean;allowedStages?:string[]};
export function inspectSkills(crew:PlanMember[],data:PlannerData,pool:PlanMember[]=[],boss?:Boss){
  const audit:NonNullable<PlanTeam['skillAudit']>=[],actions:Action[]=[];
  const boosts=new Map<PlanMember,string[]>();
  for(const m of crew){
    const abilities=abilitiesAt(m,data), max=targetMaximum(m);
    boosts.set(m,[]);
    for(const [name,source]of [['Captain koşulu',m.captainText],['Special koşulu',m.specialText]] as const){
      if(name==='Captain koşulu'&&crew.indexOf(m)>1)continue;
      const unresolved=resolveCrewText(source,crew[0].character,crew.map(c=>c.character)).split(/\.\s+|\n/).filter(line=>/^\s*(?:If|When|After)|\bchance\b|Special Launch Status|depending on/i.test(line));
      if(unresolved.length)audit.push({id:m.character.id,name,status:'Kısmi model · bu koşullar garanti katkı sayılmadı',text:unresolved.join('\n'),condition:'HP / orb / önceki eylem veya kaynak dalı açıkça modellenmedikçe en yüksek etki varsayılmaz.'});
    }
    for(const key of ['superSpecial','swap','VSSpecial','sailor','potential','support','lastTap','superTandem','superTandemBoost','rush']){
      if(!abilities[key])continue;
      const value=abilities[key],leveled=['lastTap','superTandem','superTandemBoost','rush'].includes(key),level=leveled?selectedLevel(m,key,(value as Record<string,unknown>).description):1;
      let text=key==='sailor'?passiveSailor(m,data):key==='potential'&&Array.isArray(value)?value.map(p=>{const selected=m.owned.lb?selectedLevel(m,'potential:'+p.Name,p.description):0;return p.Name+': '+(selected?`Lv.${selected} · ${abilityText(p.description,selected)}`:'Seviye bilinmiyor veya açılmamış; maksimum katkı sayılmadı.');}).join('\n'):key==='swap'&&typeof value==='object'&&value?abilityText((value as Record<string,unknown>).base):leveled?abilityText(value,level||1):flatten(value,max);
      const swap=key==='swap'&&typeof value==='object'&&value?value as Record<string,unknown>:undefined;
      const superReady=!!swap?.super&&m.owned.pveForm!=='combined'&&typeof swap.superTurns==='number'&&swap.superTurns>0&&kizunaCounterReduction(boss,crew,m,data,'Super Switch')>=swap.superTurns;
      if(superReady)text=abilityText(swap!.super);
      if(key==='VSSpecial'&&typeof value==='object'&&value&&!Array.isArray(value))text=abilityText((value as Record<string,unknown>)[m.owned.pveForm||'character1']);
      const labels:Record<string,string>={superSpecial:'Super / EX special',swap:superReady?'Super Switch':'Switch / Super Switch',VSSpecial:'VS special',sailor:'Sailor',potential:'Potential',support:'Support',lastTap:'Last Tap',superTandem:'Super Tandem',superTandemBoost:'Super Tandem Boost',rush:'Rush'};
      const criteria=key==='superSpecial'?flatten(abilities.superSpecialCriteria,max):key==='VSSpecial'?flatten(abilities.VSCondition,max):typeof value==='object'&&value?flatten((value as Record<string,unknown>).characterCondition||(value as Record<string,unknown>).condition,max):'';
      let activation:Activation=key==='superSpecial'?crewCriterion(criteria,m,crew):key==='swap'&&m.owned.pveForm!=='combined'&&!/super switch|after|times|\bif\b/i.test(text)?'ready':'unknown';
      if(superReady)activation='ready';
      if(key==='VSSpecial'){const count=criteria.match(/^When the crew consumes\/uses (\d+) .+ orbs with normal attacks\.$/);activation=count&&Number(count[1])>0&&kizunaCounterReduction(boss,crew,m,data,'VS')>=Number(count[1])?'ready':'unknown';}
      if(key==='sailor')activation=crew.indexOf(m)>1?'ready':'unmet';
      const status=activation==='unmet'?'Takım / kaptan koşulu sağlanmıyor':activation==='ready'?'Desteklenen koşulsuz etkileri hesaba katıldı':'Tetik / seviye / form koşulu belirsiz; kesin katkı sayılmadı';
      audit.push({id:m.character.id,name:labels[key],status:leveled&&!level?'Mevcut yetenek seviyesi bilinmiyor; maksimum katkı sayılmadı':status,text,condition:criteria||'Kaynak metnindeki konum, orb, seviye ve tetik koşulları geçerli.'});
      if(key==='swap'&&typeof value==='object'&&value&&(value as Record<string,unknown>).super)audit.push({id:m.character.id,name:'Super Switch',status:superReady?'Kizuna başlangıç indirimiyle sayaç hazır; tek kullanım planlanır':'Sayaç / form süresi gerekir; koşulsuz normal switch ile birleştirilmedi',text:abilityText((value as Record<string,unknown>).super),condition:`Gerekli switch sayacı: ${(value as Record<string,unknown>).superTurns??'kaynak koşulu'}`});
      // Sailor/potential frequently affect only self; no blanket crew mechanic certificate.
      if(activation==='ready'&&['superSpecial','swap','VSSpecial'].includes(key)){
        const effects=parseEffects(text);
        actions.push({id:m.character.id,position:crew.indexOf(m),bindResistance:statusResistance(m,'bind',data,crew.indexOf(m)<2),specialBindResistance:statusResistance(m,'specialBind',data,crew.indexOf(m)<2),changesForm:key==='swap',name:labels[key],text,effects,oneUse:key==='superSpecial'||key==='VSSpecial'||superReady});
        boosts.get(m)!.push(text);
      }
    }
    audit.push({id:m.character.id,name:'Captain + Special',status:crew.indexOf(m)<2?'Kaptan kapsamı ve special planına dahil':'Special planına dahil; captain aktif değil',text:'Captain: '+m.captainText+'\nSpecial: '+m.specialText,condition:'Cooldown, kapsam ve boss karşı saldırı kısıtları uygulanır.'});
  }
  const extraTexts=[...boosts.values()].flat();
  const bonus=crew.reduce((sum,target)=>{
    const base=crew.map(m=>specialBoosts(m.specialText,target.character));
    const b=[...extraTexts,...crew.map(m=>resolveCrewText(m.specialText,crew[0].character,crew.map(m=>m.character)))].map(text=>specialBoosts(text,target.character));
    return sum+(['atk','orb','affinity'] as const).reduce((n,k)=>n+Math.max(0,Math.max(1,...b.map(v=>v[k]))-Math.max(1,...base.map(v=>v[k]))),0)*5;
  },0);
  return {audit,actions,bonus};
}
export function applyAuxiliary(boss:Boss,actions:Action[],blockedPatterns:string[]=[]){
  const used=new Set<Action>();const schedule:{stage:string;turn:number;used:string[]}[]=[];
  const stages=boss.stages.map(stage=>{
    const requirements=stage.requirements.map(e=>({...e})),labels:string[]=[],plannedAbilities:NonNullable<typeof stage.plannedAbilities>=[];
    for(const a of actions){
      if(a.oneUse&&used.has(a)||a.allowedStages&&!a.allowedStages.includes(stage.id)||!a.passive&&[...blockedPatterns,...(stage.blockedSpecialPatterns||[])].some(p=>new RegExp(p,'i').test(a.text)))continue;
      if(!a.passive&&a.position!==undefined&&(['bind','specialBind'] as const).some(kind=>statusTargets(stage,kind,a.position!)&&(requirements.find(e=>e.mechanic===kind)?.turns||0)>(kind==='bind'?a.bindResistance||0:a.specialBindResistance||0)))continue;
      const barriers=stageBarriers(stage),barrierNeeded=barriers.some(b=>b.kind!=='timing')&&(barrierRemoval(a.text)>0||slotChanges(a.text).some(c=>barriers.some(b=>b.kind==='slot'&&(b.slot===c.to||c.to==='MATCHING'))));
      const finalBuff=!a.passive&&stage===boss.stages.at(-1)&&/boosts? (?:the )?(?:ATK|Orb Effects|Color Affinity|effectiveness of orbs) of /i.test(a.text);
      if(!a.effects.some(e=>requirements.some(r=>r.mechanic===e.mechanic&&r.turns>0))&&!hazardNeeded(stage,a.text)&&!barrierNeeded&&!finalBuff)continue;
      for(const r of requirements)r.turns=Math.max(0,r.turns-(a.effects.find(e=>e.mechanic===r.mechanic)?.turns||0));
      used.add(a);labels.push(`#${a.id} · ${a.name}`);
      plannedAbilities.push({sourceId:a.id,name:a.name,text:a.text,passive:!!a.passive,changesForm:a.changesForm});
    }
    schedule.push({stage:stage.name,turn:stage.turn,used:labels});
    return {...stage,requirements:requirements.filter(e=>e.turns>0),plannedAbilities};
  });
  return {boss:{...boss,stages},schedule};
}
