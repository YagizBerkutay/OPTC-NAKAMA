import type {Boss, Character, Stage} from './model';
import type {PlanMember, PlanTeam,PlannerData} from './planning';
import {questRestrictionProblem} from './quest-restrictions';

const TYPES=['STR','DEX','QCK','PSY','INT'];
const CLASSES=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'];
export type KizunaBonus={id:string;form:'character1'|'character2'|'combined'|'any';friend:boolean;atk:number;hp:number;rcv:number;cooldown:number;tickets:number;tokens:number;source:string;confirmed:boolean};
export type KizunaSetup={
 version:1;event:string;variant:string;source:string;profileId:string;confirmed:boolean;
 mode?:'normal'|'super';eventPeriod?:{startsAt:string;endsAt:string;source:string};
 level:number;levelMin:number;levelMax:number;enemyType:string;access:'own'|'sos';objective:'clear'|'tickets'|'tokens';
 maxHP:string;remainingHP:string;observedAt:string;bonusesConfirmed:boolean;statOrder:'unknown'|'after-flat';
 rewardStack:'unknown'|'multiply';rewardSource:string;otherEffects:string;bonuses:KizunaBonus[];bonusCoverage?:'partial'|'complete';
 charge:{amount:number;types:string[];classes:string[];source:string;confirmed:boolean};
};
export type EventStats={atk:number;hp:number;rcv:number;cooldown:number;tickets:number;tokens:number};
export type KizunaMemberBonus={own:EventStats;friend:EventStats};
export type KizunaReport={status:'draft'|'modelled';tickets?:number;tokens?:number;contribution?:{low:number;high:number;remainingHP?:number};effects:{id:string;friend:boolean;stats:EventStats}[];warnings:string[]};
const neutral=():EventStats=>({atk:1,hp:1,rcv:1,cooldown:0,tickets:1,tokens:1});
export const newKizunaSetup=():KizunaSetup=>({version:1,event:'',variant:'',source:'',profileId:'',confirmed:false,level:1,levelMin:1,levelMax:1,enemyType:'STR',access:'own',objective:'clear',maxHP:'',remainingHP:'',observedAt:'',bonusesConfirmed:false,statOrder:'unknown',rewardStack:'unknown',rewardSource:'',otherEffects:'',bonuses:[],charge:{amount:0,types:[],classes:[],source:'',confirmed:false}});
export const newKizunaBonus=(id:string):KizunaBonus=>({id,form:'character1',friend:false,atk:1,hp:1,rcv:1,cooldown:0,tickets:1,tokens:1,source:'',confirmed:false});
const int=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
const factor=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=100;
export function validateKizunaSetup(value:unknown,ids:Set<string>):KizunaSetup {
 const s=value as KizunaSetup;
 if(!s||s.version!==1||!text(s.event,160)||!text(s.variant,160)||!text(s.source,2000)||!text(s.profileId,100)||typeof s.confirmed!=='boolean'||!int(s.level,1,1000000)||!int(s.levelMin,1,1000000)||!int(s.levelMax,1,1000000)||s.levelMin>s.levelMax||!TYPES.includes(s.enemyType)||!['own','sos'].includes(s.access)||!['clear','tickets','tokens'].includes(s.objective)||![s.maxHP,s.remainingHP].every(v=>typeof v==='string'&&/^(?:[1-9]\d{0,79})?$/.test(v))||!text(s.observedAt,40)||(s.observedAt!==''&&!Number.isFinite(Date.parse(s.observedAt)))||typeof s.bonusesConfirmed!=='boolean'||!['unknown','after-flat'].includes(s.statOrder)||!['unknown','multiply'].includes(s.rewardStack)||!text(s.rewardSource,2000)||!text(s.otherEffects,4000)||!Array.isArray(s.bonuses)||s.bonuses.length>200)throw Error('Kizuna etkinlik kaydı geçersiz.');
 const seen=new Set<string>();
 if(s.mode!==undefined&&!['normal','super'].includes(s.mode))throw Error('Kizuna boss modu geçersiz.');
 if(s.eventPeriod&&(![s.eventPeriod.startsAt,s.eventPeriod.endsAt].every(v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v)))||Date.parse(s.eventPeriod.startsAt)>=Date.parse(s.eventPeriod.endsAt)||!text(s.eventPeriod.source,2000)))throw Error('Kizuna etkinlik tarihleri geçersiz.');
 if(s.bonusCoverage!==undefined&&!['partial','complete'].includes(s.bonusCoverage))throw Error('Kizuna bonus kapsamı geçersiz.');
 for(const b of s.bonuses){
  const key=b?.id+':'+b?.form;
  if(!b||!ids.has(b.id)||!['character1','character2','combined','any'].includes(b.form)||seen.has(key)||typeof b.friend!=='boolean'||![b.atk,b.hp,b.rcv,b.tickets,b.tokens].every(factor)||!int(b.cooldown,0,99)||!text(b.source,2000)||typeof b.confirmed!=='boolean')throw Error('Kizuna bonus kartı, formu veya katsayısı geçersiz.');
  if(s.bonuses.some(v=>v!==b&&v.id===b.id&&(v.form==='any'||b.form==='any')))throw Error('Aynı kartın tüm-form ve özel-form bonusları çakışıyor.');
  seen.add(key);
 }
 const c=s.charge;
 if(!c||!int(c.amount,0,99)||!Array.isArray(c.types)||!Array.isArray(c.classes)||c.types.length>5||c.classes.length>8||c.types.some(t=>!TYPES.includes(t))||c.classes.some(v=>!CLASSES.includes(v))||new Set(c.types).size!==c.types.length||new Set(c.classes).size!==c.classes.length||!text(c.source,2000)||typeof c.confirmed!=='boolean')throw Error('Kizuna Battle 1 cooldown kaydı geçersiz.');
 return structuredClone(s);
}

// Keep exact input even when the legacy PvE engine cannot safely evaluate it.
export function legacyKizunaHP(raw:string):number|undefined {
 if(!raw)return undefined;
 if(!/^[1-9]\d{0,79}$/.test(raw))throw Error('HP tam sayı olmalı; kısaltma veya ondalık kabul edilmez.');
 const n=BigInt(raw);
 if(n>1000000000000000n)throw Error('Bu HP mevcut savaş motorunun güvenli aralığını aşıyor. Tam değer kayıtta korunur; bu sürümde hasar hesabı yapılamaz.');
 return Number(n);
}
export function kizunaProblem(s:KizunaSetup,boss?:Boss):string {
 if(s.eventPeriod&&Date.now()>Date.parse(s.eventPeriod.endsAt))return 'Bu Kizuna etkinliği sona ermiş; güncel etkinliği otomatik getir.';
 if(!boss)return 'Önce Kizuna karşılaşmasının rehberini veya fotoğraflarını yükle.';
 const sourceObservation=(boss as Boss&{observation?:{complete:boolean;warnings:string[]}}).observation;
 if(sourceObservation?.complete===false&&boss.source.startsWith('https://telegra.ph/'))return sourceObservation.warnings[0]||'İnternet rehberi bu seviyeyi kapsamıyor.';
 if(!s.event.trim()||!s.variant.trim()||!s.source.trim())return 'Etkinlik, varyant ve Global kaynak bilgisini tamamla.';
 if(!s.confirmed||s.profileId!==boss.id)return 'Rehberin bu Global etkinlik ve seviye aralığıyla eşleştiğini kontrol et.';
 if(s.level<s.levelMin||s.level>s.levelMax)return 'Boss seviyesi doğruladığın rehber aralığının dışında.';
 const observed=(boss as Boss&{observation?:{mode?:string;complete:boolean;level:number|null;levelRange?:number[]}}).observation;
 if(observed?.mode==='pka')return 'Bu profil Pirate King Adventure için; Kizuna rehberini yükle.';
 if(observed?.complete===false)return 'Rehber okuması tamamlanmadı; eksik sayfaları tamamla.';
 if(observed?.level!==undefined&&observed.level!==null&&observed.level!==s.level)return 'Ekrandan okunan boss seviyesi seçtiğin seviyeden farklı.';
 if(observed?.levelRange&&(s.level<observed.levelRange[0]||s.level>observed.levelRange[1]))return 'Boss seviyesi okunan görüntünün seviye aralığı dışında.';
 const restriction=questRestrictionProblem(boss);if(restriction)return restriction;
 if(boss.stages.some(v=>v.hp!==undefined&&(!Number.isSafeInteger(v.hp)||v.hp>1e15)))return 'Rehber HP’si bu sürümün güvenli sayı aralığı dışında; kayıpsız ham HP kaynağı gerekli.';
 if(s.access==='sos'&&(!s.remainingHP||!s.observedAt))return 'SOS için kalan HP ve gözlem zamanını kaydet.';
 if(s.mode==='super'&&(!s.remainingHP||!s.observedAt))return 'Super Boss için güncel kalan HP’yi yeniden oku.';
 try{
  const max=legacyKizunaHP(s.maxHP)??boss.stages.at(-1)?.hp,remaining=legacyKizunaHP(s.remainingHP);
  if((s.access==='sos'||s.mode==='super')&&max!==undefined&&remaining!>max)return 'Kalan HP, orijinal maksimum HP’yi aşamaz.';
 }catch(e){return (e as Error).message;}
 return '';
}
export function kizunaBoss(boss:Boss,s:KizunaSetup):Boss {
 const problem=kizunaProblem(s,boss);if(problem)throw Error(problem);
 const result=structuredClone(boss),last=result.stages.at(-1)!;
 const max=legacyKizunaHP(s.maxHP);
 if(max!==undefined)last.hp=max;
 if(s.access==='sos'||s.mode==='super'&&s.remainingHP)last.hp=legacyKizunaHP(s.remainingHP);
 if(last.enemyType&&last.enemyType!==s.enemyType)throw Error('Rehberin boss tipi seçtiğin Kizuna varyantından farklı.');
 last.enemyType=s.enemyType;
 const c=s.charge;
 if(c.confirmed&&c.amount>0){
  if(!c.source.trim()||(!c.types.length&&!c.classes.length))throw Error('Battle 1 cooldown için kaynak ve hedef tip/sınıf seç.');
  const first=result.stages.find(v=>v.battleNumber===1||/^Battle 1\b|^Aşama 1\b/i.test(v.name));
  if(!first)throw Error('Battle 1 rehberde bulunamadı; cooldown başka aşamaya uygulanmadı.');
  first.specialCharge=[{amount:c.amount,types:c.types,classes:c.classes}];
 }
 return result;
}
export function eventStats(member:Pick<PlanMember,'friend'|'kizunaBonus'|'pkaBonus'|'coopBonus'>):EventStats {
 return member.coopBonus?{...neutral(),...member.coopBonus}:(member.pkaBonus||member.kizunaBonus)?.[member.friend?'friend':'own']||neutral();
}
export function eventStat(member:Pick<PlanMember,'friend'|'kizunaBonus'|'pkaBonus'|'coopBonus'>,base:number,flat:number,stat:'atk'|'hp'|'rcv'):number{const factor=eventStats(member)[stat];return member.pkaBonus||member.coopBonus?base*factor+Math.min(flat,flat*factor):(base+flat)*factor;}
export function kizunaMember(member:PlanMember,s:KizunaSetup):PlanMember {
 const b=s.bonusesConfirmed?s.bonuses.find(v=>v.id===member.character.id&&(v.form==='any'||v.form===(member.owned.pveForm||'character1'))&&v.confirmed&&v.source.trim()):undefined;
 const own=neutral();
 if(b){
  if(s.statOrder==='after-flat'&&s.rewardSource.trim()){own.atk=b.atk;own.hp=b.hp;own.rcv=b.rcv;}
  own.cooldown=member.owned.readyTurn===null?b.cooldown:0;own.tickets=b.tickets;own.tokens=b.tokens;
 }
 return {...member,kizunaBonus:{own,friend:b?.friend?{...own}:neutral()},notes:[...member.notes,...(b?[`Kizuna etkinlik bonusu: ATK ×${b.atk}, HP ×${b.hp}, RCV ×${b.rcv}, başlangıç CD −${b.cooldown}. Kaynak: ${b.source}`]:[]),...(b&&s.statOrder==='unknown'&&(b.atk>1||b.hp>1||b.rcv>1)?['Etkinlik stat bonusunun işlem sırası bilinmiyor; stat bonusu hasara / HP’ye eklenmedi.']:[])]};
}
export function kizunaRewardPriority(m:PlanMember,objective?:KizunaSetup['objective']):number {
 return objective==='tickets'?eventStats(m).tickets-1:objective==='tokens'?eventStats(m).tokens-1:0;
}
export function kizunaReport(team:PlanTeam,s:KizunaSetup):KizunaReport {
 const effects=team.members.map(m=>({id:m.character.id,friend:!!m.friend,stats:eventStats(m)}));
 const warnings=[
  'Hasar mevcut PvE motorunun koşullu tahminidir. Yeni Damage Limit Break tavanı, Rush / Tandem / Last Tap / Territory ve tüm ileri aksiyonlar tam hesaplanmıyor; maksimum hasar veya kazanma garantisi değildir.',
  'Arkadaş kaptan bir öneridir; gerçek formunu ve geliştirmelerini oyunda kontrol et.',
 ];
 if(s.mode==='super')warnings.unshift('Super Boss hasar katkısı adayıdır; tam HP’yi bitirme şartı aranmaz. Hasar tavanı ve ileri aksiyonlar eksik modellendiği için katkı koşulludur; sıralama karşılaştırılan adaylar içindir.');
 if(!s.bonusesConfirmed)warnings.push('Etkinlik bonus listesi doğrulanmadı; bonuslar hesaba eklenmedi.');
 if(s.bonusCoverage==='partial')warnings.push('Görüntülerde okunan kartların bonusları eklendi; görünmeyen kartların bonusları ve listenin tamamı doğrulanmadı.');
 if((s.statOrder==='unknown'||!s.rewardSource.trim())&&s.bonuses.some(b=>b.atk>1||b.hp>1||b.rcv>1))warnings.push('Stat bonusunun işlem sırası / kanıtı eksik; yalnız bonus hariç hasar gösteriliyor.');
 if(team.members.some(m=>m.owned.readyTurn!==null&&s.bonuses.some(b=>b.id===m.character.id&&b.cooldown>0)))warnings.push('Kayıtlı ilk hazır tur başlangıç indirimlerini içeriyor kabul edildi; etkinlik CD indirimi o üyeye tekrar eklenmedi. Battle 1 indirimi ayrı aşama olayıdır.');
 if(s.otherEffects.trim())warnings.push('Hesaplanmayan etkinlik etkileri: '+s.otherEffects);
 if(s.charge.amount>0&&!s.charge.confirmed)warnings.push('Battle 1 cooldown kaydı doğrulanmadı; uygulanmadı.');
 if(s.access==='sos')warnings.push('SOS kalan HP kaydı: '+s.observedAt+'. Boss seviyesi ve mekanikleri değiştirilmedi; oyundaki kalan HP güncelse kullan.');
 const usedRows=s.bonuses.filter(b=>team.members.some(m=>m.character.id===b.id&&(b.form==='any'||b.form===(m.owned.pveForm||'character1'))&&(!m.friend||b.friend)));
 const rowsKnown=usedRows.every(b=>b.confirmed&&b.source.trim());
 const statsKnown=!usedRows.some(b=>b.atk>1||b.hp>1||b.rcv>1)||s.statOrder==='after-flat'&&!!s.rewardSource.trim();
 const rewardKnown=s.bonusCoverage!=='partial'&&s.bonusesConfirmed&&s.rewardStack==='multiply'&&!!s.rewardSource.trim()&&rowsKnown;
 if(!rewardKnown)warnings.push('Ödül istifleme / kapsamı doğrulanmadı; toplam bilet veya token çarpanı hesaplanmadı.');
 const covered=s.mode!=='super'&&s.bonusCoverage!=='partial'&&!team.missing?.length&&team.combat?.status==='estimated'&&!s.otherEffects.trim()&&s.bonusesConfirmed&&rowsKnown&&statsKnown&&(!s.charge.amount||s.charge.confirmed)&&!team.warnings.some(w=>/Seviye bilinmiyor|Special cooldown bilinmiyor/.test(w));
 const last=team.combat?.windows.at(-1),remainingHP=s.mode==='super'?legacyKizunaHP(s.remainingHP||s.maxHP):undefined;
 const damage=(n:number)=>Math.max(0,Math.min(remainingHP??Infinity,n));
 const contribution=s.mode==='super'&&last?{low:damage(last.damageLow+(last.specialDamage||0)+(last.endDamage||0)),high:damage(last.damageHigh+(last.specialDamage||0)+(last.endDamage||0)),remainingHP}:undefined;
 return {status:covered?'modelled':'draft',contribution,tickets:rewardKnown?effects.reduce((n,v)=>n*v.stats.tickets,1):undefined,tokens:rewardKnown?effects.reduce((n,v)=>n*v.stats.tokens,1):undefined,effects,warnings};
}
export function rankKizunaTeams(teams:PlanTeam[],s:KizunaSetup):PlanTeam[] {
 const report=(t:PlanTeam)=>t.kizuna||kizunaReport(t,s);
 const blocked=(t:PlanTeam)=>!!t.missing?.length||t.combat?.status==='blocked';
 return teams.map(t=>({...t,kizuna:report(t)})).sort((a,b)=>Number(blocked(a))-Number(blocked(b))||(a.missing?.length||0)-(b.missing?.length||0)||Number(a.kizuna.status==='draft')-Number(b.kizuna.status==='draft')||(s.mode==='super'?(b.kizuna.contribution?.low||0)-(a.kizuna.contribution?.low||0)||(b.kizuna.contribution?.high||0)-(a.kizuna.contribution?.high||0):s.objective==='clear'?0:(b.kizuna[s.objective]??0)-(a.kizuna[s.objective]??0))||b.score-a.score);
}
export function chargeFor(stage:Pick<Stage,'specialCharge'|'conditionalTurn'>,character:Character):number {
 if(stage.conditionalTurn)return 0;
 return (stage.specialCharge||[]).reduce((n,c)=>n+(character.types.some(t=>c.types.includes(t))||character.classes.some(v=>c.classes.includes(v))?c.amount:0),0);
}
function openingKizunaText(boss:Boss,crew:PlanMember[],data:PlannerData):string {
 if(boss.source!=='https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17')return '';
 const twoTags=crew.filter(m=>data.units[m.character.id]?.tags?.includes('Revolutionary Army')).length>=2;
 return boss.stages.find(s=>s.battleNumber===1)?.events?.flatMap(e=>e.text.split('\n').flatMap(line=>line.startsWith('If at least 2 Revolutionary Army: ')?twoTags?[line.slice('If at least 2 Revolutionary Army: '.length)]:[]:['preemptive','starting'].includes(e.trigger)?[line]:[])).join('\n')||'';
}
export function kizunaCounterReduction(boss:Boss|undefined,crew:PlanMember[],member:PlanMember,data:PlannerData,kind:'VS'|'Super Switch'):number {
 if(!boss)return 0;
 const text=openingKizunaText(boss,crew,data);let amount=0;
 for(const m of text.matchAll(/Reduce Special Charge by \d+ turns for ([^;\n]+); Super Switch requirement reduction (\d+); VS requirement reduction (\d+)/g)){
  if(![...member.character.types,...member.character.classes].some(v=>m[1].split(/,\s*/).includes(v)))continue;
  amount=Math.max(amount,Number(m[kind==='VS'?3:2]));
 }
 return amount;
}
export function kizunaCrewCharge<T extends Boss>(boss:T,crew:PlanMember[],data:PlannerData):T {
 if(boss.source!=='https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17'||crew.filter(m=>data.units[m.character.id]?.tags?.includes('Revolutionary Army')).length<2)return boss;
 const first=boss.stages.find(s=>s.battleNumber===1),text=openingKizunaText(boss,crew,data);
 const m=text.match(/^Reduce Special Charge by (\d{1,2}) turns for ([^;\n]+)/m);
 if(!first||!m)return boss;
 const types=TYPES.filter(t=>new RegExp('\\b'+t+'\\b').test(m[2])),classes=CLASSES.filter(c=>new RegExp('\\b'+c+'\\b').test(m[2]));
 if(!types.length&&!classes.length)return boss;
 const buffs=text.split('\n').filter(line=>/^Boosts (?:ATK|Orb Effects) of [^;]+ by [\d.]+x for \d+ turns$/.test(line)).map(line=>({sourceId:crew[0].character.id,name:'Kizuna başlangıç bonusu',text:line,passive:true}));
 return {...boss,stages:boss.stages.map(s=>s===first?{...s,specialCharge:[...(s.specialCharge||[]),{amount:Number(m[1]),types,classes}],plannedAbilities:[...(s.plannedAbilities||[]),...buffs]}:s)};
}
