const sharp=require('sharp'),crypto=require('node:crypto');
const {rows}=require('./boss-behavior-core.cjs');
function levelRange(text){
 const numeric=text.trim().replace(/\bLv\.?\s*[Il](?=\s*[~～〜&-])/gi,'Lv1');
 const m=numeric.match(/^When\s+Lv\.?\s*(\d{1,6})\s*(?:[~～〜&]|-v?)\s*(?:Lv\.?\s*(\d{1,6}))?\s*$/i);
 if(!m)return null;const min=Number(m[1]),max=m[2]?Number(m[2]):Infinity;
 return min>=1&&max>=min?{min,max}:null;
}
function createLevelReader(readOCR,readLineOCR){
 const cache=new Map();
 return async(image,ocr,body)=>{
  for(const r of rows(ocr).filter(r=>/^When\b/i.test(r.text)&&r.y>body.top+8&&r.y+r.height<body.top+body.height-8)){
   if(levelRange(r.text))continue;
   const rect={left:body.left+8,top:Math.round(r.y-4),width:body.width-20,height:Math.round(r.height+8)},raw=await sharp(image).extract(rect).removeAlpha().raw().toBuffer({resolveWithObject:true}),key=crypto.createHash('sha256').update(raw.data).digest('hex');let value=cache.get(key);
   if(value===undefined){
    const mask=Buffer.alloc(raw.data.length);for(let i=0;i<mask.length;i+=3){const a=raw.data[i],b=raw.data[i+1],c=raw.data[i+2],v=a>120&&b>100&&c<150&&a>c*1.4?0:255;mask[i]=mask[i+1]=mask[i+2]=v;}
    const masked=await sharp(mask,{raw:{width:raw.info.width,height:raw.info.height,channels:3}}).resize({height:110}).extend({top:30,bottom:30,left:30,right:30,background:'white'}).png().toBuffer();
    const texts=[(await readOCR(masked)).text];if(!texts.some(levelRange))texts.push((await readOCR(await sharp(image).extract(rect).resize({height:110}).png().toBuffer())).text);
    if(!texts.some(levelRange)){const resized=[];for(const scale of [.8,1.5])resized.push((await readOCR(masked,{scale})).text);const ranges=resized.map(levelRange);if(ranges.every(Boolean)&&JSON.stringify(ranges[0])===JSON.stringify(ranges[1]))texts.push(...resized);}
    if(!texts.some(levelRange)&&readLineOCR){
     const color=await sharp(image).extract(rect).extend({top:12,bottom:12,left:12,right:12,background:'black'}).png().toBuffer(),alternate=[(await readLineOCR(masked,{scale:1})).text,(await readLineOCR(color,{scale:3})).text],ranges=alternate.map(levelRange);
     if(ranges.every(Boolean)&&JSON.stringify(ranges[0])===JSON.stringify(ranges[1]))texts.push(...alternate);
    }
    const candidates=texts.map(t=>({t,range:levelRange(t)})).filter(v=>v.range);
    value=candidates.length&&new Set(candidates.map(v=>JSON.stringify(v.range))).size===1?candidates[0].t.replace(/&/g,'~'):null;
    if(cache.size>100)cache.clear();cache.set(key,value);
   }
   if(value){ocr.lines=ocr.lines.filter(l=>!l.words.some(w=>Math.abs(w.y-r.y)<10));ocr.lines.push({text:value,words:[{text:value,x:rect.left,y:r.y,width:Math.min(rect.width,r.words.at(-1).x+r.words.at(-1).width-rect.left+30),height:r.height}]});}
  }
  ocr.text=ocr.lines.map(l=>l.text).join('\n');return ocr;
 };
}
function selectLevelTokens(tokens,level){
 const sections=[];let current;
 for(const token of tokens){if(token.kind==='battle'){current={number:token.number,name:token.text,tokens:[],range:null};sections.push(current);}if(current)current.tokens.push(token);}
 for(const section of sections){const eventIndex=section.tokens.findIndex(t=>t.kind==='event'),conditions=section.tokens.slice(0,eventIndex<0?undefined:eventIndex).filter(t=>t.kind==='line'&&/^When\b/i.test(t.text));if(conditions.length>1||conditions.some(t=>!levelRange(t.text)))throw Error(section.name+': Kizuna seviye aralığı tam okunamadı; farklı seviyelerin davranışları birleştirilmedi.');if(conditions.length)section.range=levelRange(conditions[0].text);}
 const selected=new Set(),descriptions=[];
 for(const number of new Set(sections.map(s=>s.number))){const group=sections.filter(s=>s.number===number),conditional=group.filter(s=>s.range),active=conditional.filter(s=>s.range.min<=level&&s.range.max>=level).sort((a,b)=>b.range.min-a.range.min);
  if(conditional.length&&!active.length)throw Error('Battle '+number+': seçili Lv.'+level+' için rehber aralığı bulunamadı.');
  if(active.length>1&&active[0].range.min===active[1].range.min)throw Error('Kizuna seviyesine ait birden fazla aynı aralık okundu.');
  group.filter(s=>!s.range||s===active[0]).forEach(s=>selected.add(s));
  for(const s of conditional)descriptions.push(s.name+' · Lv.'+s.range.min+(s.range.max===Infinity?'+':'–'+s.range.max)+(s===active[0]?' · seçili':''));
 }
 const keep=new Set([...selected].flatMap(s=>s.tokens));return {tokens:tokens.filter(t=>t.kind==='heading'||keep.has(t)&&!(t.kind==='line'&&/^When\s+.*Lv/i.test(t.text))),descriptions};
}
function selectedRangeComplete(tokens,level,lastBattle){
 const branches=[];let branch;
 for(const t of tokens){if(t.kind==='battle'){branch={number:t.number,range:null};branches.push(branch);}else if(branch&&t.kind==='line'&&/^When\b/i.test(t.text))branch.range=levelRange(t.text);}
 const matching=branches.findIndex(b=>b.number===lastBattle&&b.range&&b.range.min<=level&&b.range.max>=level&&Number.isFinite(b.range.max));
 return matching>=0&&branches[matching+1]?.number===lastBattle&&branches[matching+1]?.range?.min>branches[matching].range.max;
}
module.exports={levelRange,createLevelReader,selectLevelTokens,selectedRangeComplete};
