const {safeUrl,getHtml,text,requirements}=require('./guides.cjs');
const ROOT='https://onepiecetreasurecruise.fr/Invasion.html';
const key=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/cipher\s*pol\s*(?:n[°o]?\s*)?9|cp\s*[- ]?9/g,'cp9').replace(/[^a-z0-9]/g,'');
function links(html,root,folder){
 const found=new Set();for(const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi))try{const u=safeUrl(new URL(m[1],root).href);if(u.pathname.startsWith('/'+folder+'/'))found.add(u.href);}catch{}return [...found];
}
function frenchEffect(raw,hp){
 const turns=raw.match(/pendant\s+(\d+)\s+tours?/i)?.[1],p=turns?turns+' turn(s) ':'';
 const scoped=/colonne de droite/i.test(raw)?'Right-Column ':/rangée du milieu/i.test(raw)?'Middle-Row ':/personnages qui ne sont pas capitaines/i.test(raw)?'Crewmate ':'';
 const labels=[[/Lien des coups sp[ée]ciaux/i,'Special Bind'],[/D[ée]sespoir du capitaine/i,'Despair on captains'],[/D[ée]sespoir du co[ée]quipier/i,'Despair on crewmates'],[/["“]Lien["”]/i,'Bind'],[/Paralys/i,'Paralysis'],[/r[ée]duira les d[ée]g[âa]ts subis/i,'Damage Reduction'],[/augmentera la d[ée]fense/i,'DEF Up'],[/r[ée]duira l.?ATK/i,'ATK Down']];
 const label=labels.find(([re])=>re.test(raw));if(label&&turns)return {text:p+scoped+label[1]+(/effet retiré après sa défaite/i.test(raw)?' (removed after this enemy is defeated)':''),complete:!scoped&&!/effet retiré après sa défaite/i.test(raw)};
 const cut=raw.match(/enl[èe]vera\s+(\d+)%\s+des HP/i);if(cut)return {text:"Reduce crew's current HP by "+cut[1]+'%',complete:true};
 if(/revivra avec tous ses HP/i.test(raw))return {text:hp?'Revive with '+hp+' HP':'Revive with full HP',complete:!!hp};
 if(/partira/i.test(raw))return {text:'Retreat',complete:true};
 if(/immunit[ée]/i.test(raw)&&turns)return {text:p+'Debuff Immunity',complete:true};
 if(/mettra fin à tous les effets positifs/i.test(raw))return {text:'Remove all beneficial effects, including accumulated values',complete:true};
 if(/cercles\s*\[EMP\].*toute l.équipe/i.test(raw))return {text:'Change all slots to [EMPTY]',complete:true};
 return {text:'Kaynak davranışı: '+raw,complete:false};
}
function parseAmbushGuide(html,url){
 const u=safeUrl(url);if(!u.pathname.startsWith('/Invasion/'))throw Error('Ambush kaynağı bir Invasion rehberi olmalı.');
 const heading=html.match(/Guide de l.attaque ennemie/i);if(!heading)throw Error('Ambush savaş bölümü bulunamadı.');
 const section=html.slice(heading.index).split(/<h2\b/i)[0],stages=[];
 for(const row of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];if(cells.length<2)continue;const label=text(cells[0][1]);if(!/^(?:Stage\s+\d+|Boss)$/i.test(label))continue;
  const body=cells[1][1],heads=[...body.matchAll(/<b\b[^>]*>([\s\S]*?)<\/b>/gi)].filter(m=>{const s=text(m[1]);return s&&s.length<100&&!/:|Actions|HP|ATK|^\[[A-Za-z]+\]$/.test(s);}),enemies=[],events=[];let complete=true;
  for(const [i,head]of heads.entries()){
   const name=text(head[1]),part=body.slice(head.index+head[0].length,heads[i+1]?.index??body.length),plain=text(part),hp=Number(plain.match(/HP\s*:\s*([\d ]+)\s*HP/i)?.[1]?.replaceAll(' ',''))||undefined,attack=Number(plain.match(/ATK\s*:\s*([\d ]+)\s*points/i)?.[1]?.replaceAll(' ',''))||undefined;
   enemies.push({name,hp,attack,attackEveryTurn:/points de dégâts tous les tours/i.test(plain)});
   const markers=[...part.matchAll(/<u\b[^>]*>([\s\S]*?)<\/u>/gi)];
   for(const [j,marker]of markers.entries()){
    const title=text(marker[1]);if(/^(?:HP|ATK|Défense|Barrière)\s*:/i.test(title))continue;
    const content=text(part.slice(marker.index+marker[0].length,markers[j+1]?.index??part.length));if(!content)continue;
    let trigger='unknown',extra={};if(/Actions préventives/i.test(title))trigger='preemptive';else if(/Action ultime/i.test(title))trigger='defeated';else if(/En-dessous/i.test(title))trigger='hp';else{const n=title.match(/^(\d+)(?:er|ème|eme) tour/i);if(n){trigger='turn';extra={battleTurn:Number(n[1])+1,...(/tous les (\d+) tours/i.test(title)?{repeatEvery:Number(title.match(/tous les (\d+) tours/i)[1])}:{})};}}
    const lines=content.split('\n').map(s=>s.trim()).filter(Boolean),translated=lines.map(s=>frenchEffect(s,hp));complete&&=trigger!=='unknown'&&translated.every(v=>v.complete);
    events.push({trigger,label:(name+' · '+title).slice(0,200),text:translated.map(v=>v.text).join('\n'),requirements:requirements(content),sourceBattle:label,...extra});
   }
   if(/Barrière/i.test(plain)){complete=false;events.push({trigger:'starting',label:name+' · Bariyer',text:plain.match(/Barrière[^\n]*/i)?.[0]||'Kaynak bariyeri',requirements:[]});}
  }
  if(!events.length)throw Error('Ambush aşaması boş; eksik rehber eklenmedi.');
  const number=Number(label.match(/\d+/)?.[0])||((stages.at(-1)?.battleNumber||0)+1),effects=new Map();for(const e of events.filter(e=>e.trigger==='preemptive'))for(const r of e.requirements)effects.set(r.mechanic,Math.max(effects.get(r.mechanic)||0,r.turns));
  const single=enemies.length===1?enemies[0]:null;stages.push({id:'battle-'+number,name:label+' · '+enemies.map(e=>e.name).join(' / ').slice(0,80),battleNumber:number,turn:number-1,requirements:[...effects].map(([mechanic,turns])=>({mechanic,turns})),events,hp:single?.hp,enemyAttack:single?.attackEveryTurn?single.attack:undefined,behaviorTextComplete:complete&&!!single,notes:enemies.map(e=>e.name+(e.hp?' · HP '+e.hp:'')+(e.attack?' · ATK '+e.attack:'')).join('\n')+'\n'+events.map(e=>e.label+': '+e.text).join('\n')});
 }
 if(!stages.length||stages.length>10||stages.some((s,i)=>s.battleNumber!==i+1))throw Error('Ambush aşama sırası eksik veya birden fazla varyant içeriyor.');
 const name=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');if(!name)throw Error('Ambush kaynak başlığı bulunamadı.');
 return {id:'invasion-'+u.pathname.split('/').at(-1).replace('.html',''),name,source:url,training:false,difficulty:'Ambush · kaynak rehberi',reviewed:new Date().toISOString().slice(0,10),notes:'Ambush savaşları kaynaktan alındı. Çok düşmanlı aşamalar ve çevrilemeyen davranışlar tam doğrulanmış sayılmaz.',stages};
}
function validateBoss(boss){
 if(!boss||typeof boss.name!=='string'||boss.name.length>160||typeof boss.source!=='string'||boss.source.length>1000||!Array.isArray(boss.stages)||!boss.stages.length||boss.stages.length>10||boss.stages.some(s=>!s||typeof s.id!=='string'||!Number.isInteger(s.turn)||s.turn<0||s.turn>999)||JSON.stringify(boss).length>600000)throw Error('Ambush için boss bilgisi geçersiz.');
 if(boss.restrictions&&(!Array.isArray(boss.restrictions.warnings)||boss.restrictions.warnings.some(s=>typeof s!=='string')||typeof boss.restrictions.text!=='string'))throw Error('Ambush katılım açıklaması geçersiz.');
 if(boss.ambush&&(!Array.isArray(boss.ambush.stageIds)||boss.ambush.stageIds.some(id=>typeof id!=='string'||!id.startsWith('ambush:'))))throw Error('Kaydedilmiş Ambush aşamaları geçersiz.');
}
function hasAmbush(boss){return /\bambush(?:ed)?\b|\binvasion\b|Neo savaşı/i.test([boss.notes,boss.restrictions?.text,...boss.restrictions?.warnings||[],...boss.stages.map(s=>s.notes)].filter(s=>typeof s==='string').join('\n'));}
async function resolveAmbush(boss,{load=getHtml,progress=()=>{},signal}={}){
 validateBoss(boss);if(!hasAmbush(boss)||/\/Invasion\//.test(boss.source))return boss;
 if(boss.ambush?.status==='found'&&boss.ambush.quest===boss.name&&boss.ambush.difficulty===(boss.difficulty||'')&&boss.ambush.stageIds.every(id=>boss.stages.some(s=>s.id===id)))return boss;
 if(boss.ambush){const ids=boss.ambush.stageIds;boss={...boss,ambush:undefined,stages:boss.stages.filter(s=>!s.id.startsWith('ambush:')||!ids.includes(s.id))};}
 const context={quest:boss.name,difficulty:boss.difficulty||''},unresolved=warning=>({...boss,ambush:{...context,status:'unresolved',warning,stageIds:[]}});
 progress('Ambush · ana göreve bağlı internet rehberi aranıyor…');
 try{
  const index=await load(ROOT,signal),neo=/\bNeo\b/i.test(boss.restrictions?.text||''),family=key(boss.name);let parent,candidates=links(index,ROOT,'Invasion').filter(link=>{const slug=decodeURIComponent(new URL(link).pathname.split('/').at(-1).replace('.html',''));return (!neo||/^Neo_/.test(slug))&&family.includes(key(slug.replace(/^Neo_/i,'')));});
  if(candidates.length!==1){
   progress('Ambush · ana görev rehberindeki bağlantılar kontrol ediliyor…');
   const raidIndex='https://onepiecetreasurecruise.fr/Raid.html',parents=links(await load(raidIndex,signal),raidIndex,'Raid').filter(link=>family.includes(key(new URL(link).pathname.split('/').at(-1).replace('.html',''))));
   if(parents.length===1){parent=parents[0];const available=new Set(links(index,ROOT,'Invasion'));candidates=links(await load(parent,signal),parent,'Invasion').filter(link=>available.has(link)&&(!neo||/\/Neo_/.test(link)));}
  }
  if(candidates.length!==1)return unresolved('Ambush: Ana göreve ait tek bir internet rehberi eşleştirilemedi; ek karşılaşma kazanılmış sayılmaz.');
  const url=candidates[0],html=await load(url,signal),associations=links(html,url,'Raid').filter(link=>parent?link===parent:family.includes(key(new URL(link).pathname.split('/').at(-1).replace('.html',''))));
  if(associations.length!==1)throw Error('Kaynak, bu Ambush ile ana görevin bağlantısını doğrulamıyor.');
  const slug=new URL(url).pathname.split('/').at(-1).replace(/^Neo_/i,'').replace(/\.html$/i,'');
  const guide=parseAmbushGuide(html,url);if(!key(guide.name).includes(key(slug)))throw Error('Ambush kaynak başlığı eşleşmiyor.');
  if(key(slug)==='cp9'&&((boss.observation?.difficulty??boss.restrictions?.difficulty)!==10||boss.restrictions?.allowedTypes&&[...boss.restrictions.allowedTypes].sort().join('/')!=='PSY/QCK'))throw Error('Neo CP-9 bağlantısı için 10★ ve QCK/PSY katılım koşulu eşleşmedi.');
  if(boss.stages.length+guide.stages.length>10)throw Error('Ana görev ve Ambush toplamı desteklenen 10 aşamayı aşıyor.');
  const start=Math.max(...boss.stages.map(s=>s.turn))+1,stages=guide.stages.map((s,i)=>({...s,id:'ambush:'+s.id,name:('Ambush · '+s.name).slice(0,100),turn:start+i})),warning='Ambush: '+guide.stages.length+' ek aşama internetten bulundu ve kadro hesabına eklendi. Çok düşmanlı davranışlar, çevrilemeyen etkiler ve Ambush girişindeki HP / special / support yenilenmesi tam doğrulanmadı; iki karşılaşmanın galibiyeti birlikte onaylanmış değildir.';
  progress('Ambush · '+guide.name+' · '+stages.length+' aşama eklendi.');return {...boss,stages:[...boss.stages,...stages],ambush:{...context,status:'found',name:guide.name,url,linkedFrom:associations[0],stageIds:stages.map(s=>s.id),warning},...(boss.restrictions?{restrictions:{...boss.restrictions,warnings:boss.restrictions.warnings.filter(s=>!s.startsWith('Neo Ambush:'))}}:{})};
 }catch(e){if(signal?.aborted)throw Error('Ambush araması iptal edildi.');return unresolved('Ambush: '+e.message+' Ana rehber korundu; ek karşılaşma doğrulanmadı.');}
}
function createAmbushService({load=getHtml}={}){let active;return {async read(boss,progress){if(active)throw Error('Ambush rehberi araması zaten sürüyor.');const controller=new AbortController();active=controller;try{return await resolveAmbush(boss,{load,progress,signal:controller.signal});}finally{if(active===controller)active=undefined;}},cancel(){active?.abort();active=undefined;return true;}};}
module.exports={links,key,hasAmbush,parseAmbushGuide,resolveAmbush,createAmbushService};
