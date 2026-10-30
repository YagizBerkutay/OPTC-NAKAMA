const fs=require('node:fs'),path=require('node:path');
const ORIGIN='https://e9wiki.com';
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const plain=s=>decode(s.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[ \t\r]+/g,' ').trim();
function safeUrl(value){const u=new URL(value);if(u.origin!==ORIGIN||u.username||u.password||u.search||u.hash||!/^\/optc\/en(?:\/notices(?:\/\d{1,8})?|\/characters\/\d{1,8})?\/?$/.test(u.pathname))throw Error('Kizuna kaynağı izin verilen Global bilgi sayfası değil.');return u;}
async function fetchHtml(url,signal){
 let next=safeUrl(url);
 for(let i=0;i<3;i++){
  const r=await fetch(next,{redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
  if(r.status>=300&&r.status<400){next=safeUrl(new URL(r.headers.get('location'),next).href);continue;}
  if(!r.ok)throw Error('Global Kizuna kaynağı alınamadı: HTTP '+r.status);
  const reader=r.body.getReader(),chunks=[];let count=0;
  while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>2*1024*1024){await reader.cancel();throw Error('Kizuna kaynak sayfası çok büyük.');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks).toString('utf8');
 }
 throw Error('Global bilgi kaynağı çok fazla yönlendirdi.');
}
function schedule(text,now=new Date()){
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const parts=[...text.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s+(\d{1,2})\s*\((\d{1,2}):(\d{2})\)/g)];
 if(parts.length!==2||! /PST\b/.test(text))return null;
 const day=(m,y)=>new Date(Date.UTC(y,months.indexOf(m[1].slice(0,3)),Number(m[2]),Number(m[3])+8,Number(m[4])));
 for(const y of [now.getUTCFullYear()-1,now.getUTCFullYear(),now.getUTCFullYear()+1]){
  const start=day(parts[0],y),end=day(parts[1],y+(months.indexOf(parts[1][1].slice(0,3))<months.indexOf(parts[0][1].slice(0,3))?1:0));
  if(end-start<=45*86400000&&start<=now&&now<=end)return {startsAt:start.toISOString(),endsAt:end.toISOString()};
 }
 return null;
}
function eventLinks(html){
 const links=[];
 for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/href="(\/optc\/en\/notices\/\d+)"/)?.[1];if(!href)continue;
  const title=decode(m[1].match(/data-notice-title="([^"]+)"/)?.[1]||plain(m[2]).match(/Pirate Alliance Kizuna Clash!!\s*Vs\.[\s\S]+?(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d|$)/)?.[0]||'');
  if(!/^Pirate Alliance Kizuna Clash!!\s*Vs\.\s*\S/i.test(title)||links.some(v=>v.url===ORIGIN+href))continue;
  links.push({title:title.trim().slice(0,160),url:ORIGIN+href,dateText:plain(m[2])});
 }
 return links.slice(0,8);
}
function noticeGroups(html){
 const marker=html.indexOf('Certain Characters Powered Up!'),start=html.lastIndexOf('<p',marker),end=html.indexOf('About Kizuna Clash!!',marker);if(marker<0||start<0||end<0)throw Error('Duyurunun kart bonusu bölümü bulunamadı.');
 const body=html.slice(start,end),groups=[];
 for(const m of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>\s*<div\b[^>]*class="[^"]*\bgrid\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)){
  const spans=[...m[1].matchAll(/<span\b[^>]*class="[^"]*font-medium[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)].map(x=>plain(x[1]));
  const effect=spans.reverse().find(t=>/boost(?:s|ed)?[\s\S]*\d(?:\.\d+)?\s*x/i.test(t));if(!effect)continue;
  const ids=[...m[2].matchAll(/href="\/optc\/en\/characters\/(\d+)"/g)].map(x=>x[1]);if(!ids.length||ids.length>200)continue;
  groups.push({text:effect,scope:/^When owned\b/i.test(effect)?'owned':'crew',gameIds:[...new Set(ids)]});
 }
 // The first group begins in the powered-up paragraph already opened before the marker.
 if(!groups.length)throw Error('Duyurudaki bonuslar kart gruplarıyla eşleştirilemedi.');
 return groups;
}
function characterNumber(html){const description=decode(html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1]||'');const id=description.match(/\(No\.(\d{1,6}),/)?.[1];if(!id)throw Error('Kaynak kartının katalog numarası bulunamadı.');return id;}
function createService(folder,{load=fetchHtml,clock=()=>new Date()}={}){
 const file=path.join(folder,'kizuna-online.json');let active;
 const cancel=()=>{active?.abort();return true;};
 async function read(progress=()=>{}){
  if(active)throw Error('Kizuna internet okuması zaten sürüyor.');const controller=new AbortController();active=controller;
  try{
   progress('Güncel Global Kizuna duyurusu aranıyor…');const now=clock();let html='';
   try{html=await load(ORIGIN+'/optc/en',controller.signal);}catch(e){if(controller.signal.aborted)throw e;}
   const current=page=>eventLinks(page).map(v=>({...v,period:schedule(v.dateText,now)})).filter(v=>v.period);
   let choices=current(html);
   // The homepage only shows recent posts; an ongoing event can leave that list.
   if(!choices.length){progress('Kizuna ana sayfanın kısa listesinde yok; Global duyuru dizini kontrol ediliyor…');choices=current(await load(ORIGIN+'/optc/en/notices',controller.signal));}
   if(choices.length!==1)throw Error(choices.length?'Birden fazla etkin Kizuna duyurusu var; oyundaki etkinlik doğrulanmalı.':'Global duyuru dizininde tarih aralığı doğrulanabilen Kizuna etkinliği bulunamadı.');
   const selected=choices[0],notice=await load(selected.url,controller.signal),title=plain(notice.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');if(title!==selected.title)throw Error('Kizuna duyuru başlığı değişti.');
   const groups=noticeGroups(notice);
   const allIds=[...new Set(groups.flatMap(g=>g.gameIds))];if(allIds.length>200)throw Error('Kizuna bonus kartı sınırı aşıldı.');
   // Exact public No. mappings verified from card metadata ship with the app;
   // only unfamiliar cards require another metadata request.
   let cached={...require('./kizuna-character-map.json').mapping};try{cached={...cached,...(JSON.parse(fs.readFileSync(file,'utf8')).mapping||{})};}catch{}
   const mapping={},failures=[];let cursor=0;
   await Promise.all(Array.from({length:4},async()=>{while(cursor<allIds.length){if(controller.signal.aborted)throw Error('Kizuna internet okuması iptal edildi.');const id=allIds[cursor++];try{mapping[id]=/^\d{1,6}$/.test(cached[id]||'')?cached[id]:characterNumber(await load(ORIGIN+'/optc/en/characters/'+id,controller.signal));}catch(e){if(controller.signal.aborted)throw e;failures.push(id);}progress(`Global Kizuna · ${Object.keys(mapping).length}/${allIds.length} kart eşleştirildi…`);}}));
   if(controller.signal.aborted)throw Error('Kizuna internet okuması iptal edildi.');
   const article=notice.slice(notice.indexOf('<h1'),notice.indexOf('</article>')>0?notice.indexOf('</article>'):notice.indexOf('Support the wiki'));
   const result={title,url:selected.url,...selected.period,fetchedAt:now.toISOString(),notes:plain(article).slice(0,24000),groups:groups.map(g=>({...g,ids:g.gameIds.map(id=>mapping[id]).filter(Boolean)})),mapping,warnings:failures.length?[failures.length+' kart numarası kaynaktan doğrulanamadı.']:[]};
   fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file,JSON.stringify(result));return result;
  }finally{if(active===controller)active=undefined;}
 }
 return {read,cancel};
}
module.exports={safeUrl,fetchHtml,schedule,eventLinks,noticeGroups,characterNumber,createService};
