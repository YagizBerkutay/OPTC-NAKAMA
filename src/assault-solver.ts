import {solveRumble} from './rumble-planner';
import {gpCandidates} from './grand-party';
import {validateAssault,assaultRuleBounds,type AssaultJob,type AssaultResult,type AssaultRequest} from './assault-rumble';
import type {PlanTeam,PlannerData} from './planning';

export function describeAssaultTeam(team:PlanTeam,request:AssaultRequest,data:PlannerData):PlanTeam {
 const {context,boss,objective}=request,enemy=context.enemies[boss];
 const matches=team.members.map(m=>({id:m.character.id,...assaultRuleBounds(m,data.units[m.character.id]?.tags||[],context.rules,boss)}));
 const weighted=matches.map((m,i)=>({m,d:team.offense?.members[i]?.baseDirect??0})),pressure=Math.round(weighted.reduce((n,{m,d})=>n+d*m.low,0)*10)/10,pressureHigh=weighted.reduce((n,{m,d})=>n+d*m.high,0);
 const warnings=[...context.warnings,...team.warnings.filter(w=>!w.includes('özel oyun modu koşulları belirsizse'))];
 const roster=[...team.members,...team.reserves||[]],enemyText=[enemy?.details.special,enemy?.details.ability].filter(Boolean).join(' ').replace(/\s+/g,' ');
 for(const target of new Set(roster.flatMap(m=>[...m.character.types,...m.character.classes]))){
  if(!new RegExp('\\b'+target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s+(?:(?:class|type)\\s+)?enemies\\b','i').test(enemyText))continue;
  const affected=roster.filter(m=>[...m.character.types,...m.character.classes].includes(target)).map(m=>'#'+m.character.id);
  warnings.push('Bossun seçili ability / special metni '+target+' karakterlerini özel hedefliyor: '+affected.join(', ')+'. Bu risk henüz sayısal sağkalım hesabına çevrilmedi.');
 }
 if(!enemy)warnings.unshift(boss+' rakip ayrıntıları henüz okunmadı; Rules bonuslarına göre aday, savaş doğrulaması eksik.');
 if(!context.limits.verified)warnings.unshift('Maliyet sınırı ekrandan doğrulanmadı; sonuç geçici adaydır.');
 if(request.ruleInterpretation==='upper')warnings.unshift('Bu alternatif, bonusların henüz doğrulanmamış üst yorumuna dayanır; ek bonus koşulları kesinleşmeden üstünlüğü garanti değildir.');
 const instructions=[objective==='score'?'MAX / Break hedefinde süre bitene kadar hasar döngüsünü sürdür; boss HP’sine ulaşmak hasarı kesme gerekçesi değildir.':'Mevcut seviyede hasar veren çekirdeği ve onu koruyan / iyileştiren desteği birlikte kullan.',
  'Normal Rumble special’ları otomatik çalışır. Üye / yedek sırasını gösterildiği gibi ayarla; kesin special saniyesi veya HP sonucu varsayılmadı.',
  ...team.members.filter(m=>(data.units[m.character.id]?.rumble?.superspecial?.length||0)>0).map(m=>'#'+m.character.id+' Super Special: yetenek denetimindeki tetik gerçekleşmeden hazır kabul edilmez.'),
  'Trusty sahibi olma bonusu ekipten bağımsızdır; yalnız bonus almak için kadroya eklenmez.'];
 return {...team,reasons:[`${boss} · Assault ${boss===context.selectedBoss?context.maxLevel?'MAX':'Lv.'+context.level:'seviye okunmadı'} · ${objective==='score'?'Hasar / kalan HP karşılaştırması':'İlerleme / sağkalım'} · ${team.cost}/${context.limits.cost} maliyet`,...team.reasons.slice(1)],warnings:[...new Set(warnings)],assault:{boss,level:boss===context.selectedBoss?context.level:null,objective,ranking:request.ruleInterpretation||'lower',ruleMatches:matches.map(({id,clauses,low,high})=>({id,clauses,low,high})),pressure,pressureHigh:Math.round(pressureHigh*10)/10,survival:Math.round(team.members.reduce((n,m)=>n+(m.health??m.character.hp),0)),stackingSensitive:matches.some(m=>m.uncertain),instructions,warnings:[...new Set(warnings)]}};
}
export async function runAssaultJob(job:AssaultJob,emit:(message:{progress:string}|{preview:AssaultResult}|{row:AssaultResult}|{done:true;elapsedMs:number})=>void){
 const context=validateAssault(job.context);
 if(!context.bosses.includes(job.boss)||!['current','power','evolve'].includes(job.scenario)||!['progression','score'].includes(job.objective)||typeof job.category!=='string'||job.category.length>100)throw Error('Assault hesaplama isteği geçersiz.');
 const started=performance.now(),pool=gpCandidates({box:job.box,characters:job.characters,data:job.data,costLimit:context.limits.cost},job.scenario);
 for(const boss of job.all?context.bosses:[job.boss]){
  const start=performance.now(),budget=job.deep?20000:14000,uncertain=pool.some(m=>assaultRuleBounds(m,job.data.units[m.character.id]?.tags||[],context.rules,boss).uncertain),request:AssaultRequest={context,boss,objective:job.objective,ruleInterpretation:'lower'};emit({progress:boss+' · hasar, CT desteği ve yedekler karşılaştırılıyor…'});
  const lower=solveRumble(pool,job.data,context.limits.cost,'attack',job.category,undefined,{assault:request,deep:job.deep,budgetMs:uncertain?budget*.55:budget,onPreview:teams=>{
   emit({preview:{boss,teams:teams.map(t=>describeAssaultTeam(t,request,job.data)),diagnostic:'İlk aday; alternatif araması sürüyor.',elapsedMs:performance.now()-start}});
  }}).map(t=>describeAssaultTeam(t,request,job.data));
  let upper:PlanTeam[]=[];
  if(uncertain){emit({progress:boss+' · bonusların üst yorumunda farklı kadro aranıyor…'});const alternate:AssaultRequest={...request,ruleInterpretation:'upper'};upper=solveRumble(pool,job.data,context.limits.cost,'attack',job.category,undefined,{assault:alternate,deep:job.deep,budgetMs:Math.max(1,budget-(performance.now()-start))}).map(t=>describeAssaultTeam(t,alternate,job.data));}
  const teams:PlanTeam[]=[],seen=new Set<string>();for(const team of [...lower.slice(0,1),...upper.slice(0,1),...lower.slice(1),...upper.slice(1)]){const key=team.members.map(m=>m.sourceId+':'+m.character.id).sort().join(',')+'|'+(team.reserves||[]).map(m=>m.sourceId+':'+m.character.id).join(',');if(seen.has(key))continue;seen.add(key);teams.push(team);if(teams.length===3)break;}
  emit({row:{boss,teams,diagnostic:teams.length?'':'Bu filtre ve maliyetle beş farklı kullanılabilir Rumble karakteri bulunamadı. Karma takım seç veya kutudaki seviyeleri kontrol et.',elapsedMs:performance.now()-start}});
  await new Promise(r=>setTimeout(r,0));
 }
 emit({done:true,elapsedMs:performance.now()-started});
}
