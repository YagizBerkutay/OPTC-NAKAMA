const sharp=require('sharp'),{createHash}=require('node:crypto'),{rows}=require('./boss-behavior-core.cjs'),{ocrBuffer}=require('./rule-ocr.cjs'),{readLineOCR,readBlockOCR}=require('./line-ocr.cjs');
const cache=new Map(),normalize=s=>s.replace(/\s+/g,' ').trim();
const numericText=s=>normalize(s).replace(/^[Il|](?=\s+turn\(s\))/,'1').replace(/(\bATK\s+)(\d{1,3})[0o]\/[06o](?=\s+Down)/i,'$1$2%');
const parse=s=>{const m=numericText(s).match(/^(\d{1,4})\s+turn\(s\)\s+ATK\s+(\d{1,3})\s*%\s+Down$/i);return m&&+m[1]>=1&&+m[2]>0&&+m[2]<=100?{turns:+m[1],percent:+m[2]}:null;};
const percentToken=s=>{const token=normalize(s).replace(/\s/g,'');if(!/^[\dAOIl|]+(?:%|[0O]\/[06O])$/i.test(token))return null;const normalized=token.replace(/A/gi,'4').replace(/O/gi,'0').replace(/[Il|]/g,'1').replace(/(\d)[0]\/([06])$/,'$1%'),m=normalized.match(/^(\d{1,3})%$/);return m&&+m[1]>0&&+m[1]<=100?+m[1]:null;};
async function recoverEffectNumbers(image,ocr,body,{read=ocrBuffer,line=readLineOCR,block=readBlockOCR,check=()=>{}}={}){
 let lines=ocr.lines;
 for(const row of rows(ocr)){
  if(row.y<body.top||row.y>body.top+body.height||!/^.*\bATK\b.*\bDown\b.*$/i.test(normalize(row.text))||!row.words.length)continue;
  const defer=()=>{const conditionRequired=/\b(?:if|when|chance|chain|multiplier|or less|or more|below|above|at least|at most)\b/i.test(row.text),words=row.words.filter(w=>!/[\d%]/.test(w.text)).map(w=>({...w,effectProofRequired:true,effectProofConditionRequired:conditionRequired}));lines=lines.filter(l=>!l.words.some(w=>row.words.includes(w)));if(words.length)lines.push({text:words.map(w=>w.text).join(' '),words});};
  if(!/^\d+\s+turn\(s\)\s+ATK\s*.*\s+Down$/i.test(normalize(row.text))||Math.max(...row.words.map(w=>w.x+w.width))>body.left+body.width-35){defer();continue;}
  const top=Math.max(body.top,Math.floor(Math.min(...row.words.map(w=>w.y)))-5),bottom=Math.min(body.top+body.height,Math.ceil(Math.max(...row.words.map(w=>w.y+w.height)))+6),rect={left:Math.floor(body.left+body.width*.10),top,width:Math.round(body.width*.87),height:bottom-top};
  const raw=await sharp(image).extract(rect).removeAlpha().png().toBuffer(),key=createHash('sha256').update(raw).digest('hex');let recovered=cache.get(key);check();
  if(!recovered){
   const [a,b]=await Promise.all([read(raw,{scale:3}),line(raw)]);check();const av=parse(a.text),bv=parse(b.text),duration=numericText(a.text).match(/^(\d+)\s+turn\(s\)\s+ATK\b/i);
   if(!bv||!duration||+duration[1]!==bv.turns){defer();continue;}
   let verified=av&&av.percent===bv.percent;
   if(!verified){
    // A second layout decoder on a binary, padded row recovers fonts that
    // WinRT consistently segments without their visible percentage. Both
    // complete local reads must agree and retain confident numeric words.
    const sample=await sharp(raw).greyscale().threshold(155).negate().extend({top:10,bottom:10,left:14,right:14,background:'white'}).png().toBuffer(),c=await block(sample,{scale:3}),cv=parse(c.text),confident=result=>result.lines.flatMap(l=>l.words||[]).some(w=>/^\d+%$/.test(w.text)&&w.confidence>=90);check();
    if(cv?.turns===bv.turns&&cv.percent===bv.percent&&confident(b)&&confident(c))verified=true;
   }
   if(!verified)for(const [threshold,trim]of [[155,1],[155,0],[100,0],[130,0]]){const binary=await sharp(raw).extract({left:0,top:0,width:rect.width,height:rect.height-trim}).greyscale().threshold(threshold).negate().extend({top:10,bottom:10,left:14,right:14,background:'white'}).png().toBuffer(),value=parse((await read(binary,{scale:4})).text);check();if(value?.turns===bv.turns&&value.percent===bv.percent){verified=true;break;}}
   if(!verified){const word=b.lines.flatMap(l=>l.words||[]).find(w=>new RegExp('^'+bv.percent+'%$').test(w.text));if(!word){defer();continue;}const numberRect={left:rect.left+Math.floor(word.x)-1,top:rect.top+Math.floor(word.y)-2,width:Math.ceil(word.width)+4,height:Math.ceil(word.height)+5};
    // WinRT may decode the game's open-top 4 as A and its percent as 0/0.
    // Normalize only this isolated percentage field, and require agreement
    // with the complete independent line (including its duration).
    for(const binary of [false,true]){let view=sharp(image).extract(numberRect).removeAlpha();if(binary)view=view.greyscale().threshold(155).negate();const sample=await view.extend({top:8,bottom:8,left:10,right:10,background:binary?'white':'black'}).png().toBuffer(),value=percentToken((await read(sample,{scale:3})).text);check();if(value===bv.percent){verified=true;break;}}
    if(!verified){defer();continue;}}
   recovered={text:`${bv.turns} turn(s) ATK ${bv.percent}% Down`,words:b.lines.flatMap(l=>l.words||[])};if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,recovered);
  }
  const words=recovered.words.map(w=>({...w,x:w.x+rect.left,y:w.y+rect.top,effectNumberVerified:true}));lines=lines.filter(l=>!l.words.some(w=>w.y>=top&&w.y<bottom));lines.push({text:recovered.text,words});
 }
 return {...ocr,lines,text:lines.map(l=>l.text).join('\n')};
}
function restoreVerifiedEffects(tokens,ocr){
 if(!ocr)return tokens;const verified=rows(ocr).filter(r=>parse(r.text)&&r.words.every(w=>w.effectNumberVerified));
 return tokens.map(t=>{const row=t.kind==='line'&&t.position&&/ATK.*Down/i.test(t.text)&&verified.find(r=>Math.abs(r.y-t.position.top)<=4);if(!row)return t;return require('./boss-behavior-core.cjs').positioned({...t,text:row.text},t.position);});
}
module.exports={recoverEffectNumbers,restoreVerifiedEffects,percentToken};
