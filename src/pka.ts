import type {Boss,BossObservation,Owned} from './model';
import type {PlanMember,PlanTeam,PlannerData} from './planning';
import type {EventStats,KizunaMemberBonus} from './kizuna';
export type PkaBoost={gameIds:string[];ids:string[];stats:number;cooldown:number;drops:number;chance:number;damageLimitBreak:number;ownedHime:number;ownedChance:number;hexStats:number;hexDrops:number;text:string};
export type PkaEvent={version:1;title:string;url:string;startsAt:string;endsAt:string;fetchedAt:string;fingerprint:string;bosses:string[];groups:PkaBoost[];complete:boolean;notes:string;warnings:string[];cached?:boolean};
export type PkaSetup={event:PkaEvent;level:number;objective:'clear'|'drops';mapBonus:'unknown'|'normal'|'bonus'};
export type PkaReport={crewExpectedDrops:number;crewGuaranteedDrops:number;knownOwnedHime:number;effects:{id:string;friend:boolean;stats:number;cooldown:number;drops:number;hexDrops:number;chance:number;damageLimitBreak:number}[];warnings:string[]};
const text=(v:unknown,n=500):v is string=>typeof v==='string'&&v.length>0&&v.length<=n;
export function validatePka(value:unknown):PkaSetup{
 const s=value as PkaSetup,e=s?.event;
 if(!s||!e||e.version!==1||!text(e.title,160)||!/^Pirate King Adventures Vs\. /i.test(e.title)||!/^https:\/\/e9wiki\.com\/optc\/en\/notices\/\d+$/.test(e.url)||![e.startsAt,e.endsAt,e.fetchedAt].every(d=>text(d,40)&&Number.isFinite(Date.parse(d)))||Date.parse(e.startsAt)>=Date.parse(e.endsAt)||!/^[a-f0-9]{64}$/.test(e.fingerprint)||!Array.isArray(e.bosses)||!e.bosses.length||e.bosses.length>10||e.bosses.some(b=>!text(b,120))||!Array.isArray(e.groups)||!e.groups.length||e.groups.length>50||typeof e.complete!=='boolean'||!text(e.notes,26000)||!Array.isArray(e.warnings)||e.warnings.length>50||e.warnings.some(w=>!text(w,1000))||!Number.isInteger(s.level)||s.level<1||s.level>9999||!['clear','drops'].includes(s.objective)||!['unknown','normal','bonus'].includes(s.mapBonus))throw Error('PKA etkinlik bağlamı geçersiz.');
 const ids=new Set<string>();for(const b of e.groups){if(!Array.isArray(b.ids)||b.ids.length>200||b.ids.some(id=>!/^\d{1,6}$/.test(id)||ids.has(id))||!Array.isArray(b.gameIds)||!b.gameIds.length||b.gameIds.length>200||b.gameIds.some(id=>!/^\d{1,8}$/.test(id))||!text(b.text,2400)||![b.stats,b.hexStats,b.cooldown,b.drops,b.chance,b.damageLimitBreak,b.ownedHime,b.ownedChance,b.hexDrops].every(Number.isFinite)||b.stats<1||b.hexStats<b.stats||b.hexStats>20||!Number.isInteger(b.cooldown)||b.cooldown<0||b.cooldown>99||!Number.isInteger(b.drops)||b.drops<0||b.drops>20||b.chance<=0||b.chance>1||b.damageLimitBreak<0||b.damageLimitBreak>10||!Number.isInteger(b.ownedHime)||b.ownedHime<0||b.ownedHime>20||b.ownedChance<0||b.ownedChance>1||!Number.isInteger(b.hexDrops)||b.hexDrops<0||b.hexDrops>20)throw Error('PKA kart bonusu geçersiz veya çakışıyor.');b.ids.forEach(id=>ids.add(id));}
 return structuredClone(s);
}
const canonical=(s:string)=>s.replace(/^(?:PKA\s*[·:]?\s*)?Vs\.?\s*/i,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function pkaProblem(s:PkaSetup,boss?:Boss&{observation?:BossObservation}):string{
 if(Date.now()<Date.parse(s.event.startsAt)||Date.now()>Date.parse(s.event.endsAt))return 'Bu PKA etkinliği şu an etkin değil; güncel duyuruyu getir.';
 if(!boss||boss.observation?.mode!=='pka')return 'PKA Quest Guide rehberi gerekli.';
 if(!s.event.bosses.some(b=>canonical(b)===canonical(boss.name)))return 'Okunan boss güncel PKA etkinliğiyle eşleşmiyor.';
 const o=boss.observation;if(!o.complete||o.textComplete===false)return 'PKA rehber okuması tamamlanmadı; eksik mekaniklerle devam edilmedi.';
 if(!o.levelRange||o.levelRange.length!==2||!o.levelRange.every(Number.isInteger)||o.levelRange[0]<1||o.levelRange[1]<o.levelRange[0]||s.level<o.levelRange[0]||s.level>o.levelRange[1])return 'Hedef PKA seviyesi okunan davranış aralığının dışında.';
 if(!Number.isFinite(Date.parse(o.observedAt))||Date.parse(o.observedAt)<Date.parse(s.event.startsAt))return 'Bu PKA rehberi önceki etkinlikten kalmış; MuMu’dan yeniden oku.';
 return '';
}
const neutral=():EventStats=>({atk:1,hp:1,rcv:1,cooldown:0,tickets:1,tokens:1});
export function pkaBoost(m:PlanMember,s:PkaSetup){return m.friend?undefined:s.event.groups.find(b=>b.ids.includes(m.character.id));}
export function pkaMember(m:PlanMember,s:PkaSetup):PlanMember{
 const b=pkaBoost(m,s),own=neutral();if(b){own.atk=own.hp=own.rcv=s.mapBonus==='bonus'?b.hexStats:b.stats;own.cooldown=m.owned.readyTurn===null?b.cooldown:0;}
 const pkaBonus:KizunaMemberBonus={own,friend:neutral()};
 return {...m,pkaBonus,notes:[...m.notes,...(b?[`PKA etkinlik bonusu: temel stat ×${own.atk}, başlangıç CD −${b.cooldown}, ek drop ${b.drops} (%${Math.round(b.chance*100)}).`]:[])]};
}
export function pkaRewardPriority(m:PlanMember,s?:PkaSetup){if(!s||s.objective!=='drops')return 0;const b=pkaBoost(m,s);return b?b.drops*b.chance+(s.mapBonus==='bonus'?b.hexDrops:0):0;}
const lineageCache=new WeakMap<PlannerData,Map<string,string>>();
function lineages(data:PlannerData){let roots=lineageCache.get(data);if(roots)return roots;const parent=new Map<string,string>(),find=(id:string):string=>{if(!parent.has(id))parent.set(id,id);const p=parent.get(id)!;if(p!==id)parent.set(id,find(p));return parent.get(id)!;};for(const [id,u]of Object.entries(data.units))for(const e of u.evolutions||[])parent.set(find(e.to),find(id));roots=new Map([...parent.keys()].map(id=>[id,find(id)]));lineageCache.set(data,roots);return roots;}
export function pkaOwnedHime(box:Owned[],s:PkaSetup,data:PlannerData){const roots=lineages(data),known=new Map<string,number>();for(const o of box){const b=s.event.groups.find(g=>g.ids.includes(o.id));if(b?.ownedHime)known.set(roots.get(o.id)||o.id,Math.max(known.get(roots.get(o.id)||o.id)||0,b.ownedHime*b.ownedChance));}return [...known.values()].reduce((a,b)=>a+b,0);}
export function describePka(team:PlanTeam,s:PkaSetup,data:PlannerData,box:Owned[],boss?:Boss):PlanTeam{
 const gaps=(boss?.stages||[]).filter(stage=>/Blow Away/i.test(stage.events?.map(e=>e.text).join('\n')||stage.notes||'')).map(stage=>stage.name+': Blow Away konum / direnç çözümü doğrulanmadı; uzaklaştırılan üyelerin special ve saldırıları güvenli plan sayılmaz.');
 const effects=team.members.map(m=>{const b=pkaBoost(m,s);return {id:m.character.id,friend:!!m.friend,stats:b?(s.mapBonus==='bonus'?b.hexStats:b.stats):1,cooldown:b?.cooldown||0,drops:b?.drops||0,hexDrops:s.mapBonus==='bonus'?b?.hexDrops||0:0,chance:b?.chance||0,damageLimitBreak:b?.damageLimitBreak||0};});
 const crewExpectedDrops=effects.reduce((n,e)=>n+e.drops*e.chance+e.hexDrops,0),crewGuaranteedDrops=effects.reduce((n,e)=>n+(e.chance===1?e.drops:0)+e.hexDrops,0);
 const warnings=[...team.warnings,...s.event.warnings,'PKA stat bonusu temel statlara uygulandı; işlem sırası doğrulanmadığından pozitif Support / sailor / savaş içi düz stat ekleri boostla büyütülmedi.','Arkadaş kaptanın etkinlik bonusu doğrulanmadı; stat, başlangıç CD ve ek drop bonusu verilmedi.','Buddy tip stat katsayıları bu ekrandan okunamadı; bu hesaba eklenmedi.','Damage Limit Break bonusları listelenir; toplam yığılma ve kişisel hasar tavanı bu motorla doğrulanmaz.','Ek drop değeri bir katkı beklentisidir; bütün sandıkları çoğaltan çarpan veya kesin toplam turtle sayısı değildir.',...(s.mapBonus==='unknown'?['Bonus Hex durumu bilinmiyor; yalnız temel etkinlik bonusu kullanıldı.']:[]),...(!s.event.complete?['Bonus listesi kısmi; doğrulanmayan kartlara bonus eklenmedi.']:[])];
 return {...team,missing:[...team.missing||[],...gaps],pka:{crewExpectedDrops,crewGuaranteedDrops,knownOwnedHime:pkaOwnedHime(box,s,data),effects,warnings:[...warnings,...gaps]},warnings:[...warnings,...gaps],reasons:[`PKA · ${s.event.title} · hedef Lv.${s.level} · ${s.objective==='drops'?'mekanikler + ek drop':'mekanikler + ilerleme'}`,...team.reasons]};
}
export function rankPkaTeams(teams:PlanTeam[],s:PkaSetup):PlanTeam[]{const risk=(t:PlanTeam)=>(t.missing?.length||0)*10+(t.combat?.status==='blocked'?3:t.combat?.status==='estimated'?0:1);return [...teams].sort((a,b)=>risk(a)-risk(b)||(s.objective==='drops'?(b.pka?.crewExpectedDrops||0)-(a.pka?.crewExpectedDrops||0):0)||b.score-a.score);}
