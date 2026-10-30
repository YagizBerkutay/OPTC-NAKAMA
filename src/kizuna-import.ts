import type {Character} from './model';
import type {Encounter} from './boss-library';
import {newKizunaBonus,type KizunaBonus,type KizunaSetup} from './kizuna';
import type {ScanCandidate} from './recognition';

export type KizunaImagePage={name:string;hash:string;text:string;lines:{text:string;y:number;height:number}[];cards:{rect:{x:number;y:number;size:number};candidates:ScanCandidate[];status:string;crop:string}[]};
export type ImportedBonus={key:string;bonus:KizunaBonus;label:string;scope?:'crew'|'owned';crop?:string;candidates:ScanCandidate[];warnings:string[]};
export type KizunaImport={rows:ImportedBonus[];warnings:string[];patch:Partial<KizunaSetup>;text:string};
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const typeNames=['STR','DEX','QCK','PSY','INT'];
const classNames=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'];

// Only explicit labelled multipliers. A special's ordinary ATK boost is not an event bonus.
export function readEffects(raw:string):{values:Partial<KizunaBonus>;warnings:string[]}{
 const text=raw.replace(/×/g,'x'),values:Partial<KizunaBonus>={},warnings:string[]=[];
 const set=(key:keyof KizunaBonus,n:number)=>{if(!Number.isFinite(n)||n<1||n>100){warnings.push('Çarpan okunamadı: '+key);return;}if(key in values&&values[key]!==n)warnings.push('Çelişen çarpan: '+key);else Object.assign(values,{[key]:n});};
 const clauses=text.replace(/when on (?:the )?crew\s*,?/gi,'').replace(/,\s*(?=boosts\b|stats boosted\b|damage limit\b|special\b|and makes\b|when owned\b)/gi,';').replace(/\n(?=ATK\b|HP\b|RCV\b|Treasure\b|Tickets\b|Tokens\b|Special cooldown\b|If\b|Captain\b|Deals\b|Damage Limit\b|boosts\b|stats boosted\b)/gi,';').replace(/\n/g,' ').split(/[;•]/).map(s=>s.trim()).filter(Boolean);
 for(const line of clauses){
  const relevant=/\b(?:ATK|HP|RCV|stats?|tickets?|treasure|tokens?|insignia|cooldown|special\s*(?:charge|turn|CT)|charge time)\b/i.test(line);
  if(!relevant)continue;
  if(/captain ability|\b(?:deals?|damage|orb effects?|slot effects?)\b/i.test(line)&&!/damage limit break|damage cap/i.test(line)){warnings.push('Kart yeteneği / ek etki stat bonusu sayılmadı: '+line);continue;}
  if(/\b(?:if|when|except|only|excluding|does not|not apply|up to)\b/i.test(line)&&!/friend(?:s| captain)? (?:also|included)/i.test(line)){warnings.push('Koşullu bonus otomatik uygulanmadı: '+line);continue;}
  const a=[...line.matchAll(/(?:\bx\s*(\d+(?:\.\d+)?)(?![\w.])|(?<![\w.])(\d+(?:\.\d+)?)\s*x\b)/gi)].map(m=>Number(m[1]||m[2]));
  if(!a.length&&/\bATK\b|\bRCV\b|\bHP\b|\b(?:tickets?|tokens?|insignia|all stats?)\b/i.test(line)&&!/cooldown|special\s*(?:charge|turn|CT)/i.test(line))warnings.push('Çarpan okunamadı: '+line);
  if(a.length===1){
   if(/\bATK\b/i.test(line))set('atk',a[0]);if(/\bHP\b/i.test(line))set('hp',a[0]);if(/\bRCV\b/i.test(line))set('rcv',a[0]);
   if(/\ball stats?\b|\bstats? boosted\b/i.test(line))for(const k of ['atk','hp','rcv'] as const)set(k,a[0]);
   if(/\btickets?\b|treasure exchange/i.test(line))set('tickets',a[0]);
   if(/\btokens?\b|insignia|super boss (?:entry|challenge)/i.test(line))set('tokens',a[0]);
  }else if(a.length>1){
   // Accept separated label/value pairs, never broadcast one stat to the others.
   for(const key of ['atk','hp','rcv','tickets','tokens'] as const){const label=key==='tickets'?'tickets?':key==='tokens'?'tokens?':key;const m=line.match(new RegExp('\\b'+label+'\\b\\s*(?:by|boost(?:ed)?|[:=])?\\s*(?:x\\s*(\\d+(?:\\.\\d+)?)|(\\d+(?:\\.\\d+)?)\\s*x)','i'));if(m)set(key,Number(m[1]||m[2]));}
   if(!Object.keys(values).length)warnings.push('Birden çok çarpanın hedefi belirsiz: '+line);
  }
  if(/cooldown|special\s*(?:charge|turn|CT)|charge time/i.test(line)){
   const m=line.match(/(?:reduc\w*|shorten\w*|charge\w*|cooldown|special turns?)\D{0,30}(\d{1,2})\s*(?:turn|s\b|$)/i)||line.match(/[-−]\s*(\d{1,2})\s*turn/i);
   if(m){const n=Number(m[1]);if(values.cooldown!==undefined&&values.cooldown!==n)warnings.push('Çelişen CD indirimi');else values.cooldown=n;}
  }
 }
 if(/\b(?:captain ability|type (?:effectiveness|advantage)|damage limit\s+break|damage cap|super boss only|super boss excluded)|attacks? effective against all enemy/i.test(text))warnings.push('Ek etkinlik etkisi tam hesaplanmıyor; kaynak metni korundu.');
 if(/additional boss tokens?/i.test(text))warnings.push('Sabit ek Boss Token ödülü okunmuş kaynakta saklanır; bu ek miktar henüz hesaplanmıyor.');
 values.friend=/friend(?:s| captain)? (?:also|included)|including (?:the )?friend captain/i.test(text)&&!/not (?:apply|applied).*friend|exclud.*friend/i.test(text);
 return {values,warnings};
}

export function identityFromText(text:string):Partial<KizunaSetup>{
 const patch:Partial<KizunaSetup>={};
 const title=text.split('\n').find(l=>/kizuna\s*(?:clash)?\s*(?:vs\.?|:|[–-])/i.test(l));if(title)patch.event=title.trim().slice(0,160);
 const level=text.match(/\bLv\.?\s*(\d{1,6})(?:\s*[-–~]\s*(\d{1,6}))?/i);
 if(level){const lo=Number(level[1]),hi=Number(level[2]||level[1]);if(lo>0&&hi>=lo&&hi<=1000000){patch.level=lo;patch.levelMin=lo;patch.levelMax=hi;}}
 const type=text.match(/(?:boss\s*(?:type|attribute)\s*[:=]?|(?:normal|boss)\s*[:·-])\s*\[?(STR|DEX|QCK|PSY|INT)\]?\b/i);if(type)patch.enemyType=type[1].toUpperCase();
 const hp=text.match(/(?:max(?:imum)?|boss)\s*HP\s*[:=]\s*([\d,]+)/i);if(hp){const n=hp[1].replace(/,/g,'');if(/^[1-9]\d{0,79}$/.test(n))patch.maxHP=n;}
 const remaining=text.match(/remaining\s*HP\s*[:=]\s*([\d,]+)/i);if(remaining){const n=remaining[1].replace(/,/g,'');if(/^[1-9]\d{0,79}$/.test(n)){patch.remainingHP=n;patch.observedAt=new Date().toISOString();}}
 const battleOne=text.match(/\bBATTLE\s*1\b([\s\S]*?)(?=\bBATTLE\s*[2-9]\b|$)/i)?.[1]||'';
 const chargeLine=battleOne.split('\n').find(l=>/special.*(?:reduc|shorten)|(?:reduc|shorten).*special/i.test(l)&&classNames.concat(typeNames).some(c=>new RegExp('\\b'+c+'\\b','i').test(l)));
 if(chargeLine){const m=chargeLine.match(/(?:by|-)\s*(\d{1,2})\s*turn/i);if(m&&!/if|when|except/i.test(chargeLine))patch.charge={amount:Number(m[1]),types:typeNames.filter(t=>new RegExp('\\b'+t+'\\b','i').test(chargeLine)),classes:classNames.filter(c=>new RegExp('\\b'+c+'\\b','i').test(chargeLine)),source:chargeLine.slice(0,2000),confirmed:false};}
 return patch;
}

export function setupFromGuide(current:KizunaSetup,boss:Encounter):KizunaSetup{
 const last=boss.stages.at(-1),o=boss.observation,patch=identityFromText(boss.name+'\n'+boss.difficulty);
 const range=o?.levelRange,level=o?.level??patch.level;
 return {...current,...patch,event:boss.name.slice(0,160),variant:boss.difficulty.slice(0,160)||'Normal',source:boss.source.slice(0,2000),profileId:boss.id,confirmed:false,
  enemyType:last?.enemyType||patch.enemyType||current.enemyType,
  ...(level?{level,levelMin:range?.[0]||patch.levelMin||level,levelMax:range?.[1]||patch.levelMax||level}:{}),
  maxHP:last?.hp&&Number.isSafeInteger(last.hp)?String(last.hp):'',
  // A new guide must not inherit the previous event's bonus evidence.
  ...(current.profileId&&current.profileId!==boss.id?{bonuses:[],bonusesConfirmed:false,charge:{amount:0,types:[],classes:[],source:'',confirmed:false},otherEffects:'',statOrder:'unknown',rewardStack:'unknown',rewardSource:''}:{})};
}

export function parseKizunaImages(pages:KizunaImagePage[],characters:Character[]):KizunaImport{
 const catalog=new Map(characters.map(c=>[c.id,c])),rows:ImportedBonus[]=[],warnings:string[]=[],patch:Partial<KizunaSetup>={};
 for(const page of pages){
  if(!/special effects?|trusty characters?|boosted characters?|kizuna|bonus/i.test(page.text)){warnings.push(page.name+': Special Effects / Trusty Characters başlığı görünmüyor; kart bonusları aktarılmadı.');continue;}
  const above=/trusty characters/i.test(page.text);
  if(/when owned/i.test(page.text))warnings.push('“When owned” bonusu takımda bulunma şartından ayrı; bu sahiplik bonusu henüz hesaplanmıyor. Görüntü metni korundu.');
  const identity=identityFromText(page.text);for(const [k,v]of Object.entries(identity)){if(k in patch&&JSON.stringify(patch[k as keyof KizunaSetup])!==JSON.stringify(v))warnings.push('Görüntülerde hedef bilgisi çelişiyor: '+k);else Object.assign(patch,{[k]:v});}
  // A group of icons shares only the description directly below that row.
  const groups:{y:number;bottom:number;cards:KizunaImagePage['cards']}[]=[];
  for(const card of [...page.cards].sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x)){let g=groups.find(g=>Math.abs(g.y-card.rect.y)<card.rect.size*.35);if(!g){g={y:card.rect.y,bottom:card.rect.y+card.rect.size,cards:[]};groups.push(g);}g.cards.push(card);g.bottom=Math.max(g.bottom,card.rect.y+card.rect.size);}
  const add=(id:string,label:string,text:string,key:string,card?:KizunaImagePage['cards'][number],owned=false)=>{
   owned=owned||/^\s*when owned\b/i.test(text);
   if(!owned)text=text.split(/\bwhen owned\b/i)[0];
   const parsed=readEffects(owned?text.replace(/^when owned\s*,?/i,''):text);if(!Object.keys(parsed.values).some(k=>k!=='friend')){warnings.push(label+': sayısal bonus okunamadı; satır uygulanmadı.');return;}
   const source=(page.name+' · '+page.hash.slice(0,12)+'\n'+text).slice(0,2000);
   const form= /combined form/i.test(text)?'combined':/second (?:character|form)/i.test(text)?'character2':'character1';
   rows.push({key,bonus:{...newKizunaBonus(id),...parsed.values,form,source},label,scope:owned?'owned':'crew',crop:card?.crop,candidates:card?.candidates||[],warnings:[...parsed.warnings,...(!id?['Kart versiyonunu seç.']:[])]});
  };
  const idMarkers=[...page.text.matchAll(/(?:\bNo\.?\s*[:#]?\s*|#)(\d{1,6})\b/gi)];
  if(idMarkers.length){for(const [i,m]of idMarkers.entries()){const id=catalog.has(m[1])?m[1]:'';add(id,id?catalog.get(id)!.name:'Katalogda olmayan #'+m[1],page.text.slice(m.index!+m[0].length,idMarkers[i+1]?.index??page.text.length),page.hash+':id:'+i);}}
  else if(groups.length){
   for(const [i,g]of groups.entries()){
    const lines=above?page.lines.filter(l=>l.y>=(groups[i-1]?.bottom??0)&&l.y<g.y):page.lines.filter(l=>l.y>=g.bottom-3&&l.y<(groups[i+1]?.y??Infinity));
    let text=lines.map(l=>l.text).join('\n');
    if(above){const heading=text.search(/when (?:on (?:the )?crew|owned)/i);if(heading<0){warnings.push(page.name+': ikonun üstündeki bonus başlangıcı görünmüyor; önceki kısmı içeren fotoğraf ekle.');continue;}text=text.slice(heading);}
    for(const [j,c]of g.cards.entries()){const best=c.candidates[0],id=c.status==='confident'&&best&&catalog.has(best.id)?best.id:'';add(id,id?catalog.get(id)!.name:'Eşleşme kontrolü',text,page.hash+':card:'+i+':'+j,c,above&&/^when owned/i.test(text.trim()));}
   }
  }else{
   // Full catalog titles identify a version; a short common name never does.
   const lines=page.text.split('\n'),anchors=lines.flatMap((l,i)=>{const matches=characters.filter(c=>norm(c.name)===norm(l)&&norm(l).length>8);return matches.length===1?[{i,c:matches[0]}]:[];});
   for(const [i,a]of anchors.entries())add(a.c.id,a.c.name,lines.slice(a.i+1,anchors[i+1]?.i).join('\n'),page.hash+':name:'+i);
   if(!anchors.length)warnings.push(page.name+': kart adı / numarası veya net ikon bulunamadı. Special Effects’te kartlar ve açıklamalar birlikte görünmeli.');
  }
 }
 // Duplicate overlaps may merge only if every value/form/scope agrees.
 const unique:ImportedBonus[]=[];
 for(const row of rows){const previous=row.bonus.id?unique.find(v=>v.bonus.id===row.bonus.id&&v.bonus.form===row.bonus.form&&v.scope===row.scope):undefined;if(!previous){unique.push(row);continue;}const signature=(b:KizunaBonus)=>JSON.stringify([b.atk,b.hp,b.rcv,b.cooldown,b.tickets,b.tokens,b.friend]);if(signature(previous.bonus)!==signature(row.bonus)){previous.warnings.push('Aynı kart için görüntülerde farklı bonuslar okundu; düzeltmeden kullanma.');previous.bonus.confirmed=false;}}
 if(!unique.length)warnings.push('Henüz aktarılabilecek bonus satırı yok. Başlık, kartlar ve açıklamaların tamamını içeren görüntü ekle.');
 return {rows:unique,warnings:[...new Set(warnings)],patch,text:pages.map(p=>p.name+'\n'+p.text).join('\n\n').slice(0,100000)};
}

export function applyKizunaImport(current:KizunaSetup,result:KizunaImport):KizunaSetup{
 if(!result.rows.length||result.rows.some(r=>!r.bonus.id||r.warnings.some(w=>/Çelişen|farklı bonuslar|Çarpan okunamadı/.test(w)))||result.warnings.some(w=>/çelişiyor/.test(w)))throw Error('Belirsiz kartları ve çelişen bonusları düzeltmeden aktarım yapılamaz.');
 const crew=result.rows.filter(r=>r.scope!=='owned'),owned=result.rows.filter(r=>r.scope==='owned');
 return {...current,...result.patch,confirmed:false,bonuses:crew.length?crew.map(r=>({...r.bonus,confirmed:true})):current.bonuses,bonusesConfirmed:crew.length?true:current.bonusesConfirmed,bonusCoverage:'partial',
  ...(result.patch.charge?{charge:{...result.patch.charge,confirmed:true}}:{}),
  otherEffects:[...new Set([current.otherEffects,...result.warnings,...result.rows.flatMap(r=>r.warnings),...owned.map(r=>'Sahiplik bonusu #'+r.bonus.id+' · '+r.label+' · kadro yeri gerektirmez; henüz hesaba eklenmedi. '+r.bonus.source)].filter(Boolean))].join('\n').slice(0,4000)};
}
