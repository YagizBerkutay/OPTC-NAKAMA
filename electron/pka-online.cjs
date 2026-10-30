const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {fetchHtml,schedule,characterNumber}=require('./kizuna-online.cjs');
const ORIGIN='https://e9wiki.com';
const plain=s=>s.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&#x27;|&#39;/g,"'").replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
function eventLinks(html){
 const result=[];for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/href="(\/optc\/en\/notices\/\d+)"/)?.[1],title=plain(m[1].match(/data-notice-title="([^"]+)"/)?.[1]||'');
  if(href&&/^Pirate King Adventures Vs\. \S/i.test(title)&&!result.some(r=>r.url===ORIGIN+href))result.push({title,url:ORIGIN+href,dateText:plain(m[2])});
 }return result;
}
function parseBoost(text){
 const t=plain(text).replace(/^Trusty Characters\s*/i,''),parts=t.split(/When on crew,\s*/i);if(parts.length!==2)throw Error('PKA bonusunun kadro kapsamı okunamadı.');
 const own=parts[0].trim(),crew=parts[1],hex=crew.match(/Further adds (\d+) additional item drop and boosts stats by ([\d.]+)x during that map when landing on Bonus Hex!$/i),base=crew.split(/Further adds/i)[0];
 const drops=base.match(/^(?:(\d+)% chance to )?adds? (\d+) additional item drops?!/i),cd=base.match(/reduces Special charge time by (\d+) turns at start of quest/i),stats=base.match(/boosts stats by ([\d.]+)x/i),dlb=base.match(/Boosts crew's Damage Limit Break by \+?([\d.]+)/i);
 const owned=own?own.match(/^When owned, (?:(\d+)% chance to )?add (\d+) additional Rainbow Hime Turtle!$/i):null;
 if(!drops||!cd||own&&!owned||/Further adds/i.test(crew)&&!hex)throw Error('PKA drop / başlangıç CD / harita bonusu tam okunamadı.');
 const bonus={stats:stats?+stats[1]:1,cooldown:+cd[1],drops:+drops[2],chance:drops[1]?+drops[1]/100:1,damageLimitBreak:dlb?+dlb[1]:0,ownedHime:owned?+owned[2]:0,ownedChance:owned?(owned[1]?+owned[1]/100:1):0,hexStats:hex?+hex[2]:stats?+stats[1]:1,hexDrops:hex?+hex[1]:0};
 if(!Object.values(bonus).every(Number.isFinite)||bonus.stats<1||bonus.stats>20||bonus.hexStats<bonus.stats||bonus.hexStats>20||bonus.cooldown<0||bonus.cooldown>99||bonus.chance<=0||bonus.chance>1||bonus.ownedChance>1||bonus.drops<0||bonus.drops>20||bonus.hexDrops>20||bonus.damageLimitBreak>10)throw Error('PKA bonus sayıları geçersiz.');
 // Reject new mechanics rather than silently accepting a partially understood group.
 const residue=base.replace(drops[0],'').replace(cd[0],'').replace(stats?.[0]||/^$/,'').replace(dlb?.[0]||/^$/,'').replace(/[!.,\s]|\band\b/gi,'');if(residue)throw Error('PKA bonusunda desteklenmeyen ek etki var: '+residue.slice(0,80));
 return {...bonus,text:t};
}
function noticeGroups(html){
 const marker=html.indexOf('When owned'),start=html.lastIndexOf('<p',marker),end=html.indexOf('Ticket Exchange',marker);if(marker<0||start<0||end<0)throw Error('PKA Trusty bölümü bulunamadı.');
 const groups=[];for(const m of html.slice(start,end).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>\s*<div\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)){
  const text=plain(m[1]),gameIds=[...new Set([...m[2].matchAll(/href="\/optc\/en\/characters\/(\d+)"/g)].map(v=>v[1]))];
  if(!gameIds.length||gameIds.length>200)throw Error('PKA bonus kartlarıyla etkileri eşleştirilemedi.');groups.push({...parseBoost(text),gameIds});
 }if(!groups.length||new Set(groups.flatMap(g=>g.gameIds)).size!==groups.flatMap(g=>g.gameIds).length)throw Error('PKA bonus listesi eksik veya çakışıyor.');return groups;
}
function createService(folder,{load=fetchHtml,clock=()=>new Date()}={}){
 let active;const file=path.join(folder,'pka-online.json');
 const validCache=e=>{try{const groups=e.groups.map(({ids,...g})=>g),fingerprint=createHash('sha256').update(JSON.stringify([e.title,{startsAt:e.startsAt,endsAt:e.endsAt},groups,e.mapping])).digest('hex');return e.version===1&&groups.length>0&&fingerprint===e.fingerprint&&e.groups.every(g=>JSON.stringify(g.ids)===JSON.stringify(g.gameIds.map(id=>e.mapping[id]).filter(Boolean)));}catch{return false;}};
 async function read(progress=()=>{},{refresh=false}={}){
  if(active)throw Error('PKA internet okuması zaten sürüyor.');const controller=new AbortController();active=controller;
  try{
   const now=clock();let cache;try{cache=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
   if(!refresh&&validCache(cache)&&now-Date.parse(cache.fetchedAt)>=0&&now-Date.parse(cache.fetchedAt)<15*60000&&Date.parse(cache.startsAt)<=now&&now<=Date.parse(cache.endsAt)){progress('Güncel Global PKA kaynağı önbellekten alındı.');return {...cache,cached:true};}
   progress('Güncel Global Pirate King Adventures duyurusu aranıyor…');const index=await load(ORIGIN+'/optc/en/notices',controller.signal),choices=eventLinks(index).map(r=>({...r,period:schedule(r.dateText,now)})).filter(r=>r.period);if(choices.length!==1)throw Error(choices.length?'Birden fazla etkin PKA duyurusu var.':'Tarih aralığı doğrulanan güncel Global PKA duyurusu bulunamadı.');
   controller.signal.throwIfAborted();const selected=choices[0],html=await load(selected.url,controller.signal),title=plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');controller.signal.throwIfAborted();if(title!==selected.title)throw Error('PKA duyuru kimliği değişti.');
   const groups=noticeGroups(html),gameIds=[...new Set(groups.flatMap(g=>g.gameIds))];if(gameIds.length>200)throw Error('PKA kart listesi çok büyük.');
   const known={...require('./kizuna-character-map.json').mapping,...(validCache(cache)?cache.mapping:{})},mapping={},failures=[];let cursor=0;
   await Promise.all(Array.from({length:4},async()=>{while(cursor<gameIds.length){controller.signal.throwIfAborted();const id=gameIds[cursor++];try{mapping[id]=/^\d{1,6}$/.test(known[id]||'')?known[id]:characterNumber(await load(ORIGIN+'/optc/en/characters/'+id,controller.signal));}catch(e){controller.signal.throwIfAborted();failures.push(id);}progress('PKA · '+Object.keys(mapping).length+'/'+gameIds.length+' tam kart numarası doğrulandı…');}}));
   controller.signal.throwIfAborted();const article=plain(html.slice(html.indexOf('<h1'),html.indexOf('</article>')>0?html.indexOf('</article>'):html.indexOf('</main>'))),returning=[...article.matchAll(/Enemies from "Pirate King Adventures Vs\. ([^"]+)" event/gi)].map(m=>m[1]);
   const result={version:1,title,url:selected.url,...selected.period,fetchedAt:now.toISOString(),fingerprint:createHash('sha256').update(JSON.stringify([title,selected.period,groups,mapping])).digest('hex'),bosses:[title.replace(/^Pirate King Adventures Vs\. /,''),...returning],groups:groups.map(g=>({...g,ids:g.gameIds.map(id=>mapping[id]).filter(Boolean)})),mapping,complete:!failures.length,notes:article.slice(0,26000),warnings:[...(failures.length?[failures.length+' kartın tam numarası doğrulanamadı; o kartlara bonus uygulanmadı.']:[]),'Sahiplik bonusu kart satıldıktan sonra da kalabilir. Kutu kaydı yalnız bilinen sahipliği gösterir.','Buddy, Bonus Hex ve arkadaş kaptan bonusu ayrı doğrulama gerektirir.','PKA Rumble Hex savaşlarında normal Pirate Rumble etkinlik kuralları uygulanmaz.']};
   fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file,JSON.stringify(result));return result;
  }catch(error){if(controller.signal.aborted)throw Error('PKA internet okuması iptal edildi.');throw error;}finally{if(active===controller)active=undefined;}
 }
 return {read,cancel:()=>{const previous=active;active=undefined;previous?.abort();return true;}};
}
module.exports={plain,eventLinks,parseBoost,noticeGroups,createService};
