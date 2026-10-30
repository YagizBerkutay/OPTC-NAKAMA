import type { Character, Owned, RumbleEffect, RumbleSkill } from './model';
import { candidates, CLASSES, TYPES, skillAt, type PlannerData, type PlanMember, type PlanTeam, type Scenario } from './planning';
import { makeRumbleContext, rumbleCondition, targetSet, tagged, skillDescription } from './rumble-planner';

export type GPSeason = { name:string; leaderTargets:string[]; leaderMatch?:'any'|'all'; effectsRequireLeader?:boolean; extraUses:number; chargeMultiplier:number; effects:RumbleEffect[]; note?:string; observedAt?:string };
export const NEUTRAL_SEASON:GPSeason = { name:'Etkinlik bonusu eklenmedi', leaderTargets:[], extraUses:0, chargeMultiplier:1, effects:[] };
export const OCTOBER_GP_SEASON:GPSeason = {
  name:'6 Ekim 2026 · Elbaph Arc / World Government',observedAt:'2026-10-06',leaderTargets:['Elbaph Arc','World Government'],leaderMatch:'any',effectsRequireLeader:true,extraUses:1,chargeMultiplier:1/.6,
  effects:[{effect:'buff',attributes:['DEF'],level:5,targeting:{targets:['PSY','DEX']}},{effect:'buff',attributes:['Special CT'],level:5,targeting:{targets:['Striker','Powerhouse']}},{effect:'buff',attributes:['HP','ATK','SPD','RCV'],level:5,targeting:{targets:['crew']}}],
  note:'Kullanıcının 6 Ekim ekranından: son 30 saniyede Special CT Speed Up ve Damage Up; büyüklük belirtilmediği için sayısal puana eklenmedi. Oyun açıklaması “Special Rule will only affect the Combat Power” ifadesini içeriyor. Gösterilen uyum puanı oyunun Combat Power değeri değildir.'
};
export type GPRequest = { box:Owned[]; characters:Character[]; data:PlannerData; leaderId?:string; costLimit:number; season?:GPSeason };
export type GPLeader = { member:PlanMember; ability:RumbleSkill; burst:RumbleSkill; condition:unknown[]; abilityLevel:number; burstLevel:number; uses:number; seasonal:boolean };
export type GPPlan = { leader:GPLeader; teams:PlanTeam[]; score:number; coverage:number[]; burstPlan:string[]; warnings:string[] };
export type GPGroup = { scenario:Scenario; plans:GPPlan[]; diagnostic:string; leadersChecked:number };
const key=(crew:PlanMember[])=>crew.map(m=>m.sourceId+':'+m.character.id).sort().join(',');
const valid=(crew:PlanMember[],m:PlanMember)=>!crew.some(t=>t.sourceId===m.sourceId||t.character.id===m.character.id||t.families.some(f=>m.families.includes(f)));
const weights:Record<string,number>={ATK:3,HP:2,DEF:3,SPD:2,RCV:.8,'Special CT':4,Guard:1,Accuracy:1,Shield:2,CRIT:1};

export function gpLeader(member:PlanMember,data:PlannerData,scenario:Scenario,season=NEUTRAL_SEASON):GPLeader|null {
  const r=data.units[member.character.id]?.rumble,tiers=data.units[member.character.id]?.llb.slice(0,member.owned.llb)||[];
  const upgradedAbility=tiers.some(t=>t?.gpAbility),upgradedBurst=tiers.some(t=>t?.gpSpecial);
  const ability=upgradedAbility&&r?.llbgpability?.length?r.llbgpability:r?.gpability||[];
  const burst=upgradedBurst&&r?.llbgpspecial?.length?r.llbgpspecial:r?.gpspecial||[];
  if(!ability.length||!burst.length)return null;
  const abilityLevel=Math.min(ability.length,scenario==='current'?member.owned.gpAbility??1:5);
  const burstLevel=Math.min(burst.length,scenario==='current'?member.owned.gpSpecial??1:5);
  const special=skillAt(burst,burstLevel),seasonal=!!season.leaderTargets.length&&(season.leaderMatch==='all'?season.leaderTargets.every(t=>tagged(member,[t],data)):tagged(member,season.leaderTargets,data));
  return {member,ability:skillAt(ability,abilityLevel),burst:special,condition:upgradedBurst&&r?.llbgpcondition?.length?r.llbgpcondition:r?.gpcondition||[],abilityLevel,burstLevel,uses:Math.max(0,Math.min(8,(special.uses??0)+(seasonal?season.extraUses:0))),seasonal};
}

export function gpConditionText(value:unknown):string {
  if(Array.isArray(value))return value.map(gpConditionText).join(' ve ');
  const c=value as Record<string,unknown>;if(!c||!c.type)return 'Kaynakta aktivasyon koşulu yok';
  const n=c.count??'?',enemy=/enem/.test(String(c.team)),names:Record<string,string>={
    defeat:enemy?'rakip üye yenildiğinde':'kadro üyesi yenildiğinde',special:enemy?'rakip Rumble special kullandığında':'kadron Rumble special kullandığında',
    hitreceived:'kez hasar aldığında',dbfreceived:'kez olumsuz durum aldığında',dmgreceived:'toplam hasar alındığında',
    damage:'kez hasar verildiğinde',dmgdealt:'toplam hasar verildiğinde',attack:'saldırı yapıldığında',action:'aksiyon yapıldığında',debuff:'kez belirtilen etki uygulandığında',time:'saniye geçtiğinde',specialreceived:'kez Rumble special etkisi alındığında',heal:'kez iyileşme alındığında'};
  return `${n} ${names[String(c.type)]||String(c.type)}${c.action?' · '+c.action:''}${c.attack?' · '+c.attack:''}${c.attribute?' · '+c.attribute:''}${c.stat?' · '+c.stat:''}`;
}

// GP buffs are supplied by the one leader, once per crew. They never become eight extra Rumble abilities.
export function gpAura(leader:GPLeader,active:PlanMember[],roster:PlanMember[],data:PlannerData,season=NEUTRAL_SEASON):number {
  let value=0;
  for(const e of [...leader.ability.effects||[],...(season.effectsRequireLeader&&!leader.seasonal?[]:season.effects)]) {
    const condition=rumbleCondition(e.condition||e.conditions,active,roster,data);
    const allies=targetSet(e,leader.member,active,data).length;
    const duration=Math.min(1,Number(e.duration??100)/100),chance=Math.max(0,Math.min(1,Number(e.chance??100)/100));
    const attrs=(e.attributes||[]).reduce((n,a)=>n+(weights[a]||1),0);
    if(e.effect==='buff'||e.effect==='penalty')value+=allies*(e.level||0)*attrs*duration*chance*condition*(e.effect==='penalty'?-1:1);
    if(e.effect==='evade'||e.effect==='cleanse')value+=allies*attrs*2*duration*chance*condition;
    if(e.effect==='boon')value+=allies*(e.attributes||[]).reduce((n,a)=>n+(a==='Revive'?8:a==='Haste'?8:3),0)*duration*chance*condition;
    const enemy=(e.targeting?.targets||[]).some(t=>/^(enemy|enemies)$/i.test(t));
    if(e.effect==='debuff'&&enemy&&!e.targeting?.types?.length&&!e.targeting?.classes?.length)value+=Math.min(5,e.targeting?.count||5)*(e.level||0)*attrs*.7*duration*chance*condition;
  }
  return value;
}

// Burst value is a shared budget across all three battles, discounted for uncertain charging/HP/opponents.
export function gpBurstValue(leader:GPLeader,crew:PlanMember[],data:PlannerData):number {
  let total=0;
  for(const e of leader.burst.effects||[]) {
    const t=e.targeting as {targets?:string[];count?:number;types?:string[];classes?:string[];families?:string[]}|undefined;
    const enemy=(t?.targets||[]).some(v=>/^(enemies|enemy)$/i.test(v));
    if(!t)continue;
    const unknownEnemy=enemy&&!!(t.types?.length||t.classes?.length||t.families?.length);
    const enemies=enemy&&!unknownEnemy?(e.spread?1:Math.min(5,t.count||5)):0;
    const allies=targetSet(e,leader.member,crew,data).length;
    const attrs=(e.attributes||[]).reduce((n,a)=>n+(weights[a]||1),0),amount=Number(e.amount)||0;
    let v=0;
    if(e.effect==='damage')v=enemies*(e.type==='fixed'?amount/350:e.type==='atkbase'||e.type==='atk'?amount*leader.member.attack/1000:e.type==='cut'||e.type==='percentage'?amount/5:0);
    if(e.effect==='buff'||e.effect==='penalty')v=allies*(e.level||0)*attrs*Math.min(1,Number(e.duration??20)/30)*(e.effect==='penalty'?-1:1);
    if(e.effect==='debuff')v=enemies*(e.level||1)*attrs*Math.min(1,Number(e.duration??20)/30);
    if(e.effect==='hinderance')v=enemies*((e.attributes||[]).reduce((n,a)=>n+(/Half Stats|Action Bind|Special Bind|Forced Out/.test(a)?12:4),0)+(e.type==='Special CT'?amount/3:0));
    if(e.effect==='recharge')v=allies*(e.type==='Special CT'?amount/3:e.type==='percentage'?amount/6:e.type==='fixed'?amount/400:e.type==='RCV'?amount*leader.member.character.rcv/400:0);
    if(e.effect==='boon')v=allies*(e.attributes||[]).reduce((n,a)=>n+(a==='Revive'?20:a==='Haste'?12:3),0);
    if(e.effect==='evade'||e.effect==='cleanse')v=allies*attrs*3;
    const condition=e.condition||e.conditions,c=condition as {type?:string}|undefined;
    const available=c?.type==='stat'?.5:rumbleCondition(condition,crew,crew,data);
    total+=Math.min(180,v)*available*Math.max(0,Math.min(1,Number(e.chance??100)/100));
  }
  return total;
}

export function rumbleEXPotential(source:PlanMember,skill:RumbleSkill,active:PlanMember[],roster:PlanMember[],data:PlannerData):number {
  const c=skill.condition as {type?:string;team?:string;count?:number}|undefined;
  let chance=rumbleCondition(c,active,roster,data);
  if(c?.type==='specialreceived') {
    if(/enemy|enemies/.test(c.team||''))chance=Math.min(.4,.7/Math.max(1,c.count||2));
    else {
      const teammates=active.filter(m=>m.sourceId!==source.sourceId&&skillAt(data.units[m.character.id]?.rumble?.special||[],m.specialLevel).effects?.some(e=>targetSet(e,m,[source],data).length));
      chance=Math.min(.5,teammates.length/Math.max(1,c.count||2)*.3);
    }
  } else if(c?.type==='heal') {
    const healers=active.filter(m=>skillAt(data.units[m.character.id]?.rumble?.special||[],m.specialLevel).effects?.some(e=>e.effect==='recharge'&&e.type!=='Special CT'&&targetSet(e,m,[source],data).length));
    chance=Math.min(.4,healers.length/Math.max(1,c.count||1));
  }
  if(!chance)return 0;
  return gpBurstValue({member:source,ability:{},burst:skill,condition:[],abilityLevel:0,burstLevel:0,uses:1,seasonal:false},active,data)*chance;
}

function readiness(leader:GPLeader,teams:PlanTeam[],data:PlannerData,season:GPSeason):number {
  if(!leader.condition.length)return 0;
  return Math.min(...leader.condition.map(condition=>{
    const c=condition as {type?:string;team?:string;count?:number;action?:string};let value=.55;
    if(c.type==='time')return Math.max(.1,1-(c.count||0)/(leader.seasonal?season.chargeMultiplier:1)/100);
    if(c.type==='defeat')value=c.team==='crew'?.35:.5;
    if(c.type==='hitreceived')value=Math.min(.8,12/Math.max(12,c.count||20));
    if(c.type==='special'&&c.team==='crew') {
      const specials=teams.reduce((n,t)=>n+t.members.reduce((k,m)=>k+100/Math.max(15,skillAt(data.units[m.character.id].rumble?.special||[],m.specialLevel).cooldown||30),0),0)/3;
      value=Math.min(.9,specials/Math.max(1,c.count||6)*.55);
    }
    if(c.type==='action'&&String(c.action).toLowerCase()==='heal') {
      const healer=teams.flatMap(t=>t.members).some(m=>skillAt(data.units[m.character.id].rumble?.special||[],m.specialLevel).effects?.some(e=>e.effect==='recharge'&&e.type!=='Special CT'));
      value=healer?.6:.15;
    }
    return Math.min(1,value*(leader.seasonal?season.chargeMultiplier:1));
  }));
}

export function grandObjective(scores:number[]):number {
  const [first=0,second=0,third=0]=[...scores].sort((a,b)=>b-a);
  // Winning requires two crews; reward the weaker of those two and retain a viable third.
  return first*.6+second*1.25+third*.5;
}

export function gpCandidates(request:GPRequest,scenario:Scenario):PlanMember[] {
  const {data}=request;
  return candidates(request.box,request.characters,data,scenario).filter(m=>!m.character.supportOnly).flatMap(m=> {
    const forms=data.units[m.character.id]?.rumbleForms;
    if(forms?.length)return forms.map(form=> {
      const u=data.units[form.id],r=u.rumble!,tiers=u.llb.slice(0,m.owned.llb);
      const ability=tiers.some(t=>t?.rAbility)&&r.llbability.length?r.llbability:r.ability;
      const special=tiers.some(t=>t?.rSpecial)&&r.llbspecial.length?r.llbspecial:r.special;
      return {...m,character:{...m.character,...form,rumble:null},owned:{...m.owned,id:form.id},families:u.families||m.families,abilityLevel:Math.min(scenario==='current'?m.owned.rumbleAbility??1:5,ability.length),specialLevel:Math.min(scenario==='current'?m.owned.rumbleSpecial??1:10,special.length),attack:form.atk*(m.attack/Math.max(1,m.character.atk)),notes:[...m.notes,`VS kartında ${form.name} tarafı seçildi; aynı kartın diğer tarafı başka kadroya eklenmez.`]};
    });
    const dual=!!data.units[m.character.id]?.abilities?.swap;
    return [dual?{...m,character:{...m.character,types:[]},notes:[...m.notes,'Dual kart Pirate Rumble’da tip taşımaz; sınıf / etiket güçlendirmeleri hesaplandı.']}:m];
  });
}

export function planGrandParty(request:GPRequest,scenario:Scenario,progress?:(message:string)=>void):GPGroup {
  const {data}=request,season=request.season||NEUTRAL_SEASON,limit=Math.max(1,Math.min(300,request.costLimit));
  const pool=gpCandidates(request,scenario);
  const ctx=makeRumbleContext(pool,data,'attack','',limit),members=ctx.prepared.map(p=>p.m);
  const allLeaders=members.map(m=>gpLeader(m,data,scenario,season)).filter((l):l is GPLeader=>!!l&&(!request.leaderId||l.member.sourceId===request.leaderId));
  if(members.length<3||!allLeaders.length)return {scenario,plans:[],leadersChecked:allLeaders.length,diagnostic:members.length<3?'Üç kadro için en az üç kullanılabilir Rumble kartı gerekiyor.':'Kutunda bu seçimle GP lider yetenekleri bulunan kullanılabilir bir kart yok.'};
  // Rumble ability, regular special and conditional EX are scored once in the shared context.
  const baseScore=ctx.score;
  const solo=new Map(members.map(m=>[m,baseScore([m])]));
  const ordered=[...members].sort((a,b)=>solo.get(b)!-solo.get(a)!);
  const cost=(m:PlanMember)=>ctx.byMember.get(m)!.cost;
  const labels=['',...TYPES,...CLASSES];
  // First compare every GP-capable owned form. Then refine diverse promising leaders with joint crew search.
  const proxy=(l:GPLeader)=> {
    const groupScores=labels.map(label=>{
      const crew:PlanMember[]=[];for(const m of ordered.filter(m=>!label||tagged(m,[label],data)))if(valid(crew,m)&&crew.reduce((n,t)=>n+cost(t),0)+cost(m)<=limit){crew.push(m);if(crew.length===5)break;}
      return gpAura(l,crew,crew,data,season)+gpBurstValue(l,crew,data)*Math.min(2,l.uses)*.35;
    }).sort((a,b)=>b-a);
    return groupScores[0]+(groupScores[1]||0)+(groupScores[2]||0)*.5;
  };
  const proxies=new Map(allLeaders.map(l=>[l,proxy(l)]));
  const rankedLeaders=allLeaders.sort((a,b)=>proxies.get(b)!-proxies.get(a)!);
  const burstLeaders=[...allLeaders].sort((a,b)=>gpBurstValue(b,ordered.slice(0,5),data)*b.uses-gpBurstValue(a,ordered.slice(0,5),data)*a.uses).slice(0,2);
  const leaders=[...new Set([...rankedLeaders.slice(0,request.leaderId?12:8),...rankedLeaders.filter(l=>l.seasonal),...burstLeaders])].filter(l=>!request.leaderId||l.member.sourceId===request.leaderId);
  const plans:GPPlan[]=[];
  for(const [leaderIndex,leader] of leaders.entries()) {
    progress?.(`${scenario} · GP lideri ${leaderIndex+1}/${leaders.length}: ${leader.member.character.name}`);
    const leaderScores=new Map<string,number>();
    const score=(active:PlanMember[],roster=active)=>{const id=key(active)+(roster===active?'':'|'+key(roster));let value=leaderScores.get(id);if(value===undefined){value=baseScore(active,roster)+gpAura(leader,active,roster,data,season)*ctx.balance(active,roster);if(leaderScores.size>50000)leaderScores.clear();leaderScores.set(id,value);}return value;};
    const candidateTeams:PlanTeam[]=[];
    const scopes=[...labels,...new Set((leader.ability.effects||[]).flatMap(e=>e.targeting?.targets||[]).filter(t=>!['crew','self'].includes(t)).map(t=>t.replace(/[\[\]]/g,'')))];
    const build=(label:string,required?:PlanMember)=> {
      const available=members.filter(m=>!label||tagged(m,[label],data));
      const potentials=available.map(m=>({m,value:solo.get(m)!+gpAura(leader,[m],[m],data,season)}));
      const top=potentials.sort((a,b)=>b.value-a.value).slice(0,28).map(p=>p.m);
      const cheap=potentials.sort((a,b)=>b.value/Math.max(1,cost(b.m))-a.value/Math.max(1,cost(a.m))).slice(0,8).map(p=>p.m);
      const damage=available.sort((a,b)=>ctx.damagePotential(b)-ctx.damagePotential(a)).slice(0,8);
      const shortlist=[...new Set([...top,...cheap,...damage])];
      type Beam={crew:PlanMember[];value:number;cost:number};
      let beams:Beam[]=[{crew:required?[required]:[],value:required?score([required]):0,cost:required?cost(required):0}];
      for(let slot=required?1:0;slot<5;slot++) {
        const next:Beam[]=[],seen=new Set<string>();
        for(const b of beams)for(const m of shortlist)if(valid(b.crew,m)&&b.cost+cost(m)<=limit){const crew=[...b.crew,m],k=key(crew);if(seen.has(k))continue;seen.add(k);next.push({crew,cost:b.cost+cost(m),value:score(crew)});}
        if(!next.length)break;
        const strongest=next.sort((a,b)=>b.value-a.value).slice(0,10);
        const economical=next.sort((a,b)=>b.value/Math.max(1,b.cost)-a.value/Math.max(1,a.cost)).slice(0,4);
        beams=[...new Map([...strongest,...economical].map(b=>[key(b.crew),b])).values()];
      }
      let kept=0;
      for(const b of beams.sort((a,b)=>b.value-a.value)) {
        if(!b.crew.length||candidateTeams.some(t=>key(t.members)===key(b.crew)))continue;
        if(kept&&!required&&candidateTeams.some(t=>t.members.filter(m=>b.crew.some(c=>c.sourceId===m.sourceId)).length>=4))continue;
        candidateTeams.push({members:b.crew,reserves:[],score:b.value,cost:b.cost,reasons:[label?`${label} odaklı kadro`:'Karma kadro'],warnings:[]});if(++kept===3)break;
      }
    };
    for(const label of [...new Set(scopes)])build(label);
    build('',leader.member);
    // Every owned card also provides a small-crew fallback for sparse boxes and competing expensive cores.
    for(const m of ordered.slice(0,30))candidateTeams.push({members:[m],reserves:[],score:score([m]),cost:cost(m),reasons:['Sınırlı kutu alternatifi'],warnings:[]});
    const teams=candidateTeams.sort((a,b)=>b.score-a.score);
    const combinations:{teams:PlanTeam[];value:number}[]=[];
    const disjoint=(a:PlanTeam,b:PlanTeam)=>!a.members.some(m=>b.members.some(t=>t.sourceId===m.sourceId||t.character.id===m.character.id));
    const canLeader=(t:PlanTeam)=>t.members.some(m=>m.sourceId===leader.member.sourceId&&m.character.id===leader.member.character.id)||valid(t.members,leader.member)&&t.cost!+cost(leader.member)<=limit;
    for(let a=0;a<teams.length;a++)for(let b=a+1;b<teams.length;b++) {
      if(!disjoint(teams[a],teams[b]))continue;
      for(let c=b+1;c<teams.length;c++) {
        const triple=[teams[a],teams[b],teams[c]];
        if(!disjoint(teams[a],teams[c])||!disjoint(teams[b],teams[c]))continue;
        const sameSourceOtherForm=triple.some(t=>t.members.some(m=>m.sourceId===leader.member.sourceId&&m.character.id!==leader.member.character.id));
        if(sameSourceOtherForm||!triple.some(canLeader))continue;
        // Penalize partial crews; spare slots are valuable when the box can field full crews.
        const value=grandObjective(triple.map(t=>t.score))*triple.reduce((n,t)=>n+(t.members.length>=5?1:.8+.04*t.members.length),0)/3;
        if(combinations.length<12||value>combinations.at(-1)!.value){combinations.push({teams:triple,value});combinations.sort((a,b)=>b.value-a.value);if(combinations.length>12)combinations.pop();}
      }
    }
    for(const combination of combinations.sort((a,b)=>b.value-a.value).slice(0,3)) {
      const selected=combination.teams.map(t=>({...t,members:[...t.members],reserves:[] as PlanMember[]}));
      const used=new Set(selected.flatMap(t=>t.members.map(m=>m.sourceId))),cardIds=new Set(selected.flatMap(t=>t.members.map(m=>m.character.id)));
      if(!used.has(leader.member.sourceId)) {
        const target=selected.filter(canLeader).sort((a,b)=>a.score-b.score)[0];
        if(target.members.length<5)target.members.push(leader.member);else target.reserves.push(leader.member);
        target.cost!+=cost(leader.member);used.add(leader.member.sourceId);cardIds.add(leader.member.character.id);
      }
      const teamValue=(t:PlanTeam)=> {
        const roster=[...t.members,...t.reserves||[]];let value=score(t.members,roster);
        for(const [i,m] of (t.reserves||[]).entries())value+=t.members.reduce((n,_,slot)=>n+score(t.members.map((a,j)=>j===slot?m:a),roster),0)/t.members.length*[.28,.16,.09][i];
        return value;
      };
      // Allocate bench cards jointly: a reserve cannot silently steal another crew's starter or reserve.
      for(let round=0;round<9;round++) {
        let best:{team:typeof selected[number];member:PlanMember;gain:number}|undefined;
        for(const t of selected) {
          if(t.members.length<5||t.reserves.length===3)continue;
          const current=teamValue(t);
          for(const m of ordered.filter(m=>!used.has(m.sourceId)&&!cardIds.has(m.character.id)&&valid([...t.members,...t.reserves],m)&&t.cost!+cost(m)<=limit).slice(0,45)) {
            const candidate={...t,reserves:[...t.reserves,m]},gain=teamValue(candidate)-current;
            if(!best||gain>best.gain)best={team:t,member:m,gain};
          }
        }
        if(!best||best.gain<=0)break;
        best.team.reserves.push(best.member);best.team.cost!+=cost(best.member);used.add(best.member.sourceId);cardIds.add(best.member.character.id);
      }
      for(const t of selected) {
        t.score=teamValue(t);const roster=[...t.members,...t.reserves];t.offense=ctx.offense(t.members,roster);
        t.reasons=[`${t.members.length} aktif + ${t.reserves.length} yedek · ${t.cost}/${limit} maliyet.`,t.reasons[0],`GP lideri #${leader.member.character.id}; başlangıç lider bonusu ${Math.round(gpAura(leader,t.members,roster,data,season))} uyum puanı.`, 'Yedeklerin buffları yalnızca sahaya girdikleri kayıp senaryolarında hesaplanır.'];
        t.warnings=[...new Set(roster.flatMap(m=>m.notes)),...(t.offense.risk==='lower'?[]:['Hücumda süre riski: başlangıç special hasarı sınırlı veya tek üyeye bağımlı. Koşullu EX / GP Burst ve yedekler hazır normal hasar kaynağı sayılmaz.'])];
        t.skillAudit=roster.flatMap(m=>{
          const p=ctx.byMember.get(m)!;
          const tiers=data.units[m.character.id]?.llb.slice(0,m.owned.llb)||[],r=data.units[m.character.id]?.rumble;
          const supers=tiers.some(t=>t?.rSuperSpecial)&&r?.llbsuperspecial?.length?r.llbsuperspecial:r?.superspecial||[];
          return [{id:m.character.id,name:'Rumble ability',status:'Kadro hedefleri / süre / şans hesaplandı',condition:'Rakip ve savaş içi tetik belirsizse puan dışı',text:(p.ability.effects||[]).map(skillDescription).join('\n')},{id:m.character.id,name:'Rumble special',status:'Hasar, CT, iyileştirme ve kontrol hesaplandı',condition:'Sahadaki üyeler ve cooldown kullanıldı',text:(p.special.effects||[]).map(skillDescription).join('\n')},...supers.map(s=>({id:m.character.id,name:'Rumble EX special',status:rumbleEXPotential(m,s,t.members,roster,data)>0?'Tahmini tetik ağırlığıyla değerlendirildi; garanti aktif sayılmadı':'Koşul doğrulanamadı / puan dışı',condition:gpConditionText(s.condition),text:(s.effects||[]).map(skillDescription).join('\n')}))];
        });
      }
      const coverage=selected.map(t=>t.members.filter(m=>(leader.ability.effects||[]).some(e=>e.effect==='buff'&&rumbleCondition(e.condition||e.conditions,t.members,[...t.members,...t.reserves],data)>0&&targetSet(e,leader.member,t.members,data).includes(m))).length);
      const burstValues=selected.map(t=>gpBurstValue(leader,t.members,data));
      const available=readiness(leader,selected,data,season),burstBudget=[...burstValues].sort((a,b)=>b-a).slice(0,Math.min(leader.uses,3)).reduce((n,v)=>n+v,0)*available;
      const order=selected.map((t,i)=>({i,value:burstValues[i],score:t.score})).sort((a,b)=>b.value-a.value||a.score-b.score);
      plans.push({leader,teams:selected,coverage,score:grandObjective(selected.map(t=>t.score))+burstBudget,burstPlan:[`Aktivasyon: ${gpConditionText(leader.condition)}.${leader.seasonal&&season.chargeMultiplier!==1?` Etkinlik: gereksinim %${Math.round((1-1/season.chargeMultiplier)*100)} azalır (${gpConditionText(leader.condition.map(c=>({...c as Record<string,unknown>,count:Math.ceil(Number((c as Record<string,unknown>).count)/season.chargeMultiplier)})))}).`:""}`,`${leader.uses} kullanım hakkı üç savaş için ortak değerlendirilir; her takıma ayrı ${leader.uses} kullanım yazılmaz.`,...order.slice(0,Math.min(leader.uses,3)).map(({i},n)=>`${n+1}. öncelik: Kadro ${i+1}. GP barı dolduğunda ${leader.burst.effects?.some(e=>e.effect==='recharge'&&e.type==='Special CT')?'kadro special zincirini başlatmak için':leader.burst.effects?.some(e=>e.effect==='hinderance')?'rakibin special zincirini kesmek için':'öldürücü hasarı / gerekli iyileştirmeyi tamamlamak için'} kullan; barın dolacağı saniye garanti değildir.`),'Rakipler göründüğünde güçlü iki kadroyu kazanabilecekleri eşleşmelere yerleştir. Aşağıdaki numaralar öneri kimliğidir; sabit savaş sırası değildir.'],warnings:[scenario==='current'&&(!leader.member.owned.gpAbility||!leader.member.owned.gpSpecial)?'GP ability / Burst seviyesi bilinmiyorsa Lv.1 hesaplandı. Kart detayından gerçek GP seviyelerini girebilirsin.':'GP seviyeleri bu geliştirme senaryosuna göre hesaplandı.',season===NEUTRAL_SEASON||!season.effects.length&&!season.leaderTargets.length?'Güncel Grand Party etkinlik bonusu doğrulanmadı; etkinlik buff / ekstra Burst kullanımı eklenmedi.':'Etkinlik bonusları girdiğin kurallara göre hesaplandı.',`Kutudaki ${allLeaders.length} GP formu ön karşılaştırıldı; ${leaders.length} lider için ayrıntılı kadro dağılımı arandı.`, ...(season.note?[season.note]:[]), 'Bu bir uyum optimizasyonudur; rakip, pozisyon, hasar alınması ve rastgele savaş hareketleri olmadan kesin kazanma veya matematiksel optimum garantisi vermez. Koşullu EX special için tetik tahmini kullanılır; bu tahmin gerçek savaşta aktivasyon garantisi değildir. Desteklenmeyen tetiklere puan verilmez.']});
    }
  }
  const alternatives:GPPlan[]=[];
  for(const p of plans.sort((a,b)=>b.score-a.score)) {
    if(alternatives.some(t=>t.leader.member.character.id===p.leader.member.character.id))continue;
    alternatives.push(p);if(alternatives.length===3)break;
  }
  return {scenario,plans:alternatives,leadersChecked:allLeaders.length,diagnostic:alternatives.length?'':'Üç ayrı, maliyete uygun kadro ve seçilen GP lideri birlikte yerleştirilemedi. Maliyet sınırını ve kutunu kontrol et.'};
}
