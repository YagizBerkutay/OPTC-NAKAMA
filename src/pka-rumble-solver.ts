import {gpCandidates} from './grand-party';
import {solveRumble} from './rumble-planner';
import {pkaBuddyFactor,validatePkaRumble,type PkaRumbleJob,type PkaRumbleRequest,type PkaRumbleResult} from './pka-rumble';
import type {PlanTeam} from './planning';
export function describePkaRumbleTeam(team:PlanTeam,request:PkaRumbleRequest):PlanTeam{
 const {context,bonusInterpretation}=request,roster=[...team.members,...team.reserves||[]];
 const targeted=roster.flatMap(m=>context.enemies.filter(e=>new RegExp('(?:targets?|to|of)\\s+(?:\\[)?(?:'+[...m.character.types,...m.character.classes].join('|')+')(?:\\])?(?:\\s+(?:type|class))?\\s+enem','i').test((e.details.special||'')+' '+(e.details.ability||''))).map(e=>'#'+m.character.id+' · '+e.name+' bu tip / sınıfı özel hedefliyor; sayısal savaş simülasyonu yok.'));
 return {...team,reasons:[context.opponent+' · '+context.enemies.filter(e=>e.slot<5).length+' aktif / '+context.enemies.filter(e=>e.slot>=5).length+' yedek rakibe göre karşılaştırma',bonusInterpretation==='all-stats'?'Buddy alternatif yorumu: tip yüzdesi HP / ATK / RCV / DEF / SPD’ye uygulanarak karşılaştırıldı; bu kapsam henüz doğrulanmadı.':'Temkinli aday: Buddy yüzdeleri okundu; kesin istatistik kapsamı bilinmediğinden sayısal bonus eklenmedi.',...team.reasons,'Rumble special’ları otomatik kullanılır; 5 aktif ve yedek sırasını gösterildiği gibi ayarla.','Bu ekran standart Rumble Attack takımını kullanır; PvE Support / VS / normal special planı uygulanmaz.'],warnings:[...new Set([...context.warnings,...team.warnings,...targeted,...context.enemies.some(e=>!e.complete)?['Bazı rakip değerleri tam okunmadı; eksik alanlar tahmin edilmedi.']:[],'Arama sınırlı aday ve yaklaşık savaş puanı kullanır; kesin galibiyet veya matematiksel en iyi kadro garantisi değildir.'])]};
}
export async function runPkaRumbleJob(job:PkaRumbleJob,emit:(message:{progress:string}|{preview:PkaRumbleResult}|{result:PkaRumbleResult})=>void){
 const context=validatePkaRumble(job.context);if(!['current','power','evolve'].includes(job.scenario)||typeof job.category!=='string'||job.category.length>100)throw Error('PKA Rumble hesaplama isteği geçersiz.');
 const started=performance.now(),base=gpCandidates({box:job.box,characters:job.characters,data:job.data,costLimit:300},job.scenario),branches:PlanTeam[][]=[];
 for(const bonusInterpretation of ['unscaled','all-stats'] as const){
  const request:PkaRumbleRequest={context,bonusInterpretation};emit({progress:bonusInterpretation==='unscaled'?'Rakip tipleri, dirençler, CT ve yedekler karşılaştırılıyor…':'Buddy bonusunun kapsamına duyarlılık karşılaştırılıyor…'});
  const pool=base.map(m=>{const f=pkaBuddyFactor(m.character.types,request);return f===1?m:{...m,attack:m.attack*f,health:(m.health??m.character.hp)*f,recovery:(m.recovery??m.character.rcv)*f};});
  const teams=solveRumble(pool,job.data,300,'attack',job.category,undefined,{pka:request,deep:job.deep,onPreview:teams=>emit({preview:{teams:teams.map(t=>describePkaRumbleTeam(t,request)),elapsedMs:performance.now()-started,diagnostic:'Alternatif araması sürüyor.'}})}).map(t=>describePkaRumbleTeam(t,request));
  branches.push(teams);await new Promise(r=>setTimeout(r,0));
 }
 const teams:PlanTeam[]=[],seen=new Set<string>();for(const t of [branches[0][0],branches[1][0],...branches.flat()].filter((t):t is PlanTeam=>!!t)){const key=t.members.map(m=>m.character.id).sort().join(',')+'|'+t.reserves?.map(m=>m.character.id).join(',');if(seen.has(key))continue;seen.add(key);teams.push(t);if(teams.length===3)break;}
 emit({result:{teams,elapsedMs:performance.now()-started,diagnostic:teams.length?'':'Bu filtre ve maliyetle beş farklı Rumble karakteri bulunamadı.'}});
}
