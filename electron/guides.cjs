const fs=require('node:fs');
const path=require('node:path');
const HOST='onepiecetreasurecruise.fr';
function safeUrl(value){
  const url=new URL(value);
  if(url.protocol==='https:'&&url.hostname===require('./gamewith-guide.cjs').HOST&&!url.port&&!url.username&&!url.password&&/^\/article\/show\/\d{1,8}$/.test(url.pathname)&&!url.search&&!url.hash)return url;
  if(url.protocol!=='https:'||![HOST,'www.'+HOST].includes(url.hostname)||url.port||url.username||url.password||!/^\/(?:Arene|Crane|Raid|Invasion)(?:\/[^/]+)?\.html$/.test(decodeURIComponent(url.pathname)))throw Error('Desteklenen savaş rehberi bağlantısı gerekli.');
  return url;
}
async function getHtml(value,signal){
  let url=safeUrl(value);
  for(let redirect=0;redirect<4;redirect++){
    const r=await fetch(url,{redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
    if(r.status>=300&&r.status<400){url=safeUrl(new URL(r.headers.get('location'),url).href);continue;}
    if(!r.ok)throw Error('Rehber alınamadı: HTTP '+r.status);
    if(Number(r.headers.get('content-length'))>2*1024*1024)throw Error('Rehber çok büyük.');
    const reader=r.body.getReader();let bytes=0,chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2*1024*1024){await reader.cancel();throw Error('Rehber çok büyük.');}chunks.push(Buffer.from(value));}
    return Buffer.concat(chunks).toString('utf8');
  }
  throw Error('Çok fazla yönlendirme.');
}
const entities={nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',eacute:'é',egrave:'è',ecirc:'ê',agrave:'à',acirc:'â',ocirc:'ô',ucirc:'û',icirc:'î',ccedil:'ç',rsquo:'’',ldquo:'“',rdquo:'”'};
function text(html){return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/\s+/g,' ').replace(/<br\s*\/?\s*>|<\/(?:p|li|ul)>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_,key)=>key[0]==='#'?String.fromCodePoint(Math.min(0x10ffff,parseInt(key.slice(key[1]==='x'?2:1),key[1]==='x'?16:10)||32)):entities[key]||' ').replace(/[ \t\r]+/g,' ').replace(/ *\n */g,'\n').trim();}
function requirements(preemptive){
  const found=new Map();
  for(const line of preemptive.split('\n')){
    if(/immunit|r[ée]sistan(?:ce|t) aux|retards/i.test(line))continue;
    const turns=Number(line.match(/pendant\s+(\d+)\s+tours?/i)?.[1]);if(!turns)continue;
    const rules=[['specialBind',/lien des coups sp[ée]ciaux/i],['despair',/d[ée]sespoir du capitaine/i],['bind',/["“]Lien["”]/i],['paralysis',/paralys/i],['atkDown',/r[ée]duira l.?ATK/i],['burn',/br[ûu]lure/i],['poison',/empoison|poison/i],['threshold',/r[ée]duira drastiquement|partie des d[ée]g[âa]ts.*exc[èe]de/i],['damageReduction',/r[ée]duira les d[ée]g[âa]ts subis/i],['defenseUp',/augmentera (?:sa|la) d[ée]fense/i],['resilience',/r[ée]sistance avec 1 HP/i]];
    for(const [mechanic,regex]of rules)if(regex.test(line))found.set(mechanic,Math.max(found.get(mechanic)||0,turns));
  }
  return [...found].map(([mechanic,turns])=>({mechanic,turns}));
}
function parseGuide(html,url){
  safeUrl(url);
  if(new URL(url).pathname.startsWith('/Invasion/'))return require('./ambush.cjs').parseAmbushGuide(html,url);
  if(new URL(url).hostname===require('./gamewith-guide.cjs').HOST)return require('./gamewith-guide.cjs').parseGamewith(html,url);
  const heading=html.match(/Guide (?:de|du|des|d')[\s\S]{0,140}?(?:Ar[èe]ne|qu[êe]te|combats?|Cr[âa]ne)/i);
  if(!heading)throw Error('Bu sayfada desteklenen savaş rehberi yok.');
  const section=html.slice(heading.index).split(/<h2\b/i)[0];
  const stages=[];
  for(const row of section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
    if(cells.length<2)continue;
    const label=text(cells[0][1]);if(!/^(Stage\s+\d+|Boss)$/i.test(label))continue;
    const body=cells[1][1], plain=text(body), name=text(body.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)?.[1]||label);
    const events=[...body.matchAll(/<u\b[^>]*>([\s\S]*?)<\/u>/gi)].filter(m=>!/^HP|ATK/i.test(text(m[1])));
    const pre=events.findIndex(m=>/Actions pr[ée]ventives/i.test(text(m[1])));
    if(pre<0)continue;
    const beginning=events[pre].index+events[pre][0].length;
    const preemptive=events.flatMap((event,i)=>/Actions pr[ée]ventives/i.test(text(event[1])) ? [text(body.slice(event.index+event[0].length,events[i+1]?.index??body.length))] : []).join('\n');
    if(!preemptive||!/\b(?:Il|Elle|Ils|Elles|Seules|Tous|Le|Les)\b/i.test(preemptive))continue;
    const number=Number(label.match(/\d+/)?.[0])||((stages.at(-1)?.turn??3)+2);
    const hp=Number(plain.match(/HP\s*:\s*([\d ]+)\s*HP/i)?.[1]?.replaceAll(' ',''))||undefined;
    const later=text(body.slice(events[pre+1]?.index??body.length));
    const specialLimit=Number(preemptive.match(/limitera l.utilisation des coups sp[ée]ciaux [àa]\s+(\d+)/i)?.[1])||undefined;
    const rewind=preemptive.match(/inversera le temps[^.\n]*?(?:(\d+) tours?|d.un tour)/i);
    stages.push({id:'guide-stage-'+number,name:(label+' · '+name).slice(0,100),turn:number-1,requirements:requirements(preemptive),hp,specialLimit,cooldownRewind:rewind?Number(rewind[1])||1:undefined,normalAttackOnly:/Seules les attaques normales/i.test(preemptive),notes:'İlk saldırı: '+preemptive+(later?'\nSonraki tur / HP / karşı saldırı koşulları: '+later:''),preemptive,later});
  }
  if(!stages.length||stages.length>10)throw Error('Rehberde dolu savaş aşamaları bulunamadı; boş taslak kullanılmadı.');
  if(stages.some((s,i)=>i&&s.turn<=stages[i-1].turn))throw Error('Rehberde birden fazla varyant var; tek bir zorluk güvenle ayrıştırılamadı.');
  const name=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||decodeURIComponent(new URL(url).pathname.split('/').pop()).replace('.html',''));
  const all=stages.map(s=>s.later).join(' '),blockedSpecialPatterns=[];
  if(/Si un coup sp[ée]cial qui bloque le multiplicateur/i.test(all))blockedSpecialPatterns.push('locks? (?:the )?(?:chain|Chain)|sets? (?:the )?chain multiplier');
  if(/Si un coup sp[ée]cial[^:]*r[ée]duit la d[ée]fense/i.test(all))blockedSpecialPatterns.push('reduces? (?:the )?(?:enemies.{0,12})?(?:DEF|Defense)');
  return {id:'guide-'+encodeURIComponent(new URL(url).pathname),name:name.slice(0,160),source:url,training:false,difficulty:'Rehberdeki zorluk',reviewed:new Date().toISOString().slice(0,10),notes:'Aşamalar rehberden otomatik çekildi. İlk saldırının desteklenen süreli mekanikleri, special sınırı ve cooldown geri sarma hesaplanır. Bariyer, orb, dirilme ve sonraki tur koşulları kaynak metninde gösterilir; bunlar kesin çözüldü sayılmaz.',stages,blockedSpecialPatterns};
}
function parseIndex(html,root){
  const found=new Map();
  for(const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)){
    try{const url=safeUrl(new URL(m[1],root).href);if(!/^\/(Arene|Crane)\//.test(url.pathname))continue;found.set(url.href,{url:url.href,name:decodeURIComponent(url.pathname.split('/').at(-1)).replace('.html','').replaceAll('_',' '),kind:url.pathname.startsWith('/Arene/')?'Arène':'Skull görevi'});}catch{}
  }
  return [...found.values()];
}
function createGuideService(directory){
  const cachePath=path.join(directory,'guide-cache.json');let cache={index:[],encounters:{}};
  try{const saved=JSON.parse(fs.readFileSync(cachePath,'utf8'));if(Array.isArray(saved.index)&&saved.encounters)cache=saved;}catch{}
  const save=()=>{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(cachePath,JSON.stringify(cache));};
  return {
    confirm(url,input){
      safeUrl(url);const saved=cache.encounters[url];if(!saved)throw Error('Önce rehberi getir.');
      if(!input||input.confirmed!==true||typeof input.title!=='string'||input.title.trim().length<3||input.title.length>160||!Number.isInteger(input.difficulty)||input.difficulty<1||input.difficulty>20)throw Error('Global görev adını, zorluğu ve kaynak eşleşmesini doğrula.');
      const star=saved.difficulty?.match(/^(\d+)★/)?.[1];if(star&&Number(star)!==input.difficulty)throw Error('Seçilen yıldız rehberin zorluğuyla eşleşmiyor.');
      const identity={title:input.title.trim(),difficulty:input.difficulty};return {...saved,name:identity.title,difficulty:identity.difficulty+'★ · kaynak eşleşmesi elle doğrulandı',restrictions:require('./boss-images.cjs').reviewedRequirements(identity,input.requirement,input.noRestrictions),notes:saved.notes+' Global görev eşleşmesi kullanıcı tarafından doğrulandı; çevrilemeyen veya kaynakta eksik bilgiler doğrulanmış sayılmaz.'};
    },
    async index(){try{const roots=['https://'+HOST+'/Arene.html','https://'+HOST+'/Crane.html'];const lists=await Promise.all(roots.map(async r=>parseIndex(await getHtml(r),r)));cache.index=[{url:'https://xn--pck6bvfc.gamewith.jp/article/show/263248',name:'Clash!! Marco · 10★ · Global eşleşmesi kontrol edilmeli',kind:'GameWith JP'},...lists.flat()];save();return {guides:cache.index,cached:false};}catch(e){if(cache.index.length)return {guides:cache.index,cached:true,warning:e.message};throw e;}},
    async encounter(url,refresh=false){safeUrl(url);if(!refresh&&cache.encounters[url])return {...cache.encounters[url],cached:true};const encounter=parseGuide(await getHtml(url),url);cache.encounters[url]=encounter;save();return {...encounter,cached:false};}
  };
}
module.exports={safeUrl,getHtml,text,parseGuide,parseIndex,requirements,createGuideService};
