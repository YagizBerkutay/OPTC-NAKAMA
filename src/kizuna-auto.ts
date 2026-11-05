import type {Character} from './model';
import type {Encounter} from './boss-library';
import {applyKizunaImport,identityFromText,parseKizunaImages,readEffects,setupFromGuide,type ImportedBonus,type KizunaImagePage,type KizunaImport} from './kizuna-import';
import {newKizunaBonus,validateKizunaSetup,type KizunaSetup} from './kizuna';
export type KizunaOnline={title:string;url:string;startsAt:string;endsAt:string;fetchedAt:string;notes?:string;warnings:string[];groups:{text:string;scope:'crew'|'owned';ids:string[];gameIds:string[]}[]};
export type KizunaAutoResult={event?:KizunaOnline;live?:{boss:Encounter;target:{title:string;remainingHP:string;maxHP:string;level:number;difficulty:number;enemyType:string;observedAt:string};bonusPages:KizunaImagePage[];bonusComplete:boolean;mechanics?:{url?:string;mode:'online'|'game';complete:boolean;warnings:string[]}};warnings:string[]};
export type KizunaTarget=Pick<NonNullable<KizunaAutoResult['live']>['target'],'title'|'remainingHP'|'maxHP'|'level'|'enemyType'>&{difficulty?:number};
export function kizunaTargetChanged(previous:KizunaTarget,next:KizunaTarget):boolean{
 return !sameEvent(previous.title,next.title)||previous.level!==next.level||previous.maxHP!==next.maxHP||previous.remainingHP!==next.remainingHP||previous.enemyType!==next.enemyType||previous.difficulty!==undefined&&next.difficulty!==undefined&&previous.difficulty!==next.difficulty;
}
export function onlineImport(event:KizunaOnline,characters:Character[]):KizunaImport{
 const catalog=new Map(characters.map(c=>[c.id,c])),rows:ImportedBonus[]=[],warnings=[...event.warnings];
 for(const [i,g]of event.groups.entries()){
  const parsed=readEffects(g.text.replace(/^When owned\s*,?/i,''));
  for(const id of g.ids){const c=catalog.get(id);if(!c){warnings.push('#'+id+' güncel katalogda yok; başka versiyon seçilmedi.');continue;}
   rows.push({key:i+':'+id,scope:g.scope,label:c.name,candidates:[],warnings:parsed.warnings,bonus:{...newKizunaBonus(id),...parsed.values,source:(event.url+'\n'+g.text).slice(0,2000)}});
  }
 }
 return {rows,warnings:[...new Set(warnings)],patch:{event:event.title,source:event.url},text:event.groups.map(g=>g.text).join('\n')};
}
export function applyAutomaticKizuna(current:KizunaSetup,result:KizunaAutoResult,characters:Character[]):{setup:KizunaSetup;warnings:string[];imported:KizunaImport}{
 const ids=new Set(characters.map(c=>c.id)),warnings=[...result.warnings,...(result.live?.mechanics?.warnings||[])];
 if(result.live?.boss.observation?.warnings)warnings.push(...result.live.boss.observation.warnings.filter(w=>/okunamad|eksik|doğrulanamad|tamamı|kısmi/i.test(w)));
 if(result.live?.boss.restrictions?.status==='partial')warnings.push(...result.live.boss.restrictions.warnings);
 const previous=result.event&&current.eventPeriod?.startsAt!==result.event.startsAt?{...current,statOrder:'unknown' as const,rewardStack:'unknown' as const,rewardSource:'',otherEffects:'',bonuses:[],bonusesConfirmed:false,charge:{amount:0,types:[],classes:[],source:'',confirmed:false}}:current;
 let setup=result.live?setupFromGuide(previous,result.live.boss):{...previous,confirmed:false,bonuses:[],bonusesConfirmed:false,profileId:''};
 setup={...setup,bonuses:[],bonusesConfirmed:false,charge:{amount:0,types:[],classes:[],source:'',confirmed:false}};
 if(!result.event){setup.eventPeriod=undefined;setup.statOrder='unknown';setup.rewardStack='unknown';setup.rewardSource='';}
 const imported=result.event?onlineImport(result.event,characters):parseKizunaImages(result.live?.bonusPages||[],characters);
 const usable=imported.rows.filter(r=>r.bonus.id&&!r.warnings.some(w=>/Çelişen|farklı bonuslar|Çarpan okunamadı/.test(w)));
 const skipped=imported.rows.length-usable.length;if(skipped)warnings.push(skipped+' bonus satırında sayı / kart belirsiz; okunabilenler aktarıldı, belirsiz bonus uygulanmadı.');
 if(usable.length)setup=applyKizunaImport(setup,{...imported,rows:usable});else warnings.push('Etkinlik bonusları tam okunamadı; bilinmeyen bonuslar hesaba eklenmedi.');
 setup.bonusCoverage=result.event&&!result.event.warnings.length&&!imported.warnings.length&&!skipped?'complete':'partial';
 if(result.event){setup.event=result.event.title;setup.source=result.event.url;setup.eventPeriod={startsAt:result.event.startsAt,endsAt:result.event.endsAt,source:result.event.url};}
 if(result.live){const {target,boss}=result.live;setup={...setup,variant:(target.difficulty>=13?'Super':'Normal')+' · '+target.difficulty+'★ · '+target.enemyType,mode:target.difficulty>=13?'super':'normal',objective:target.difficulty>=13?'clear':setup.objective,profileId:boss.id,level:target.level,levelMin:target.level,levelMax:target.level,enemyType:target.enemyType,maxHP:target.maxHP,remainingHP:setup.access==='sos'||target.difficulty>=13?target.remainingHP:'',observedAt:target.observedAt,confirmed:boss.observation?.complete===true&&boss.observation.textComplete!==false&&(!result.event||sameEvent(result.event.title,target.title))};
  const charge=identityFromText(boss.stages.map(s=>s.name+'\n'+s.notes).join('\n')).charge;if(charge)setup.charge={...charge,confirmed:true};
 }
 setup.otherEffects=[setup.otherEffects,...warnings,...imported.warnings].filter(Boolean).join('\n').slice(0,4000);
 return {setup:validateKizunaSetup(setup,ids),warnings:[...warnings,...imported.warnings],imported};
}
export function sameEvent(a:string,b:string){const key=(s:string)=>s.toLowerCase().replace(/.*\bvs\.?\s*/,'').replace(/[^a-z0-9]/g,'');return key(a)===key(b);}
