const sharp=require('sharp'),crypto=require('node:crypto');
const {positioned,conflictingNumbers,mergeTokens}=require('./boss-behavior-core.cjs');
const caches=new WeakMap(),number=/[-+]?\d+(?:,\d{3})*(?:\.\d+)?/g;
function facts(text){
 const raw=text.match(number)||[];
 return {raw,values:raw.map(s=>String(Number(s.replace(/,/g,'')))),letters:text.replace(number,'').toLowerCase().replace(/[^a-z]/g,''),valid:raw.length>0&&raw.every(s=>!/^[-+]?0\d/.test(s))};
}
async function readRow(image,token,body,readOCR){
 const meta=await sharp(image).metadata(),left=Math.floor(body.left+body.width*.10),top=Math.floor(token.position.top)-5,width=body.left+body.width-30-left,height=Math.ceil(token.position.height)+12;
 if(top<body.top||top+height>body.top+body.height||left<0||left+width>meta.width)return null;
 const raw=await sharp(image).extract({left,top,width,height}).removeAlpha().png().toBuffer(),hash=crypto.createHash('sha256').update(raw).digest('hex');
 let cache=caches.get(readOCR);if(!cache){cache=new Map();caches.set(readOCR,cache);}
 if(cache.has(hash))return cache.get(hash);
 const original=await readOCR(raw,{scale:4}),variants=await Promise.all([[100,4],[130,4],[170,4],[170,3],[100,5],[110,4]].map(async([threshold,scale])=>{
  const processed=await sharp(raw).grayscale().threshold(threshold).negate().extend({top:10,bottom:10,left:16,right:16,background:'white'}).png().toBuffer();
  return (await readOCR(processed,{scale})).text;
 }));
 const result={raw,original,variants};if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(hash,result);return result;
}
function votes(row,letters,candidates){
 const result=new Map();
 for(const text of row.variants){const f=facts(text),key=JSON.stringify(f.values);if(!f.valid||f.letters!==letters||!candidates.has(key))continue;result.set(key,(result.get(key)||0)+1);}
 return result;
}
async function matchingNumberPixels(a,b,index,tolerance,expectedCount){
 // a/o may be OCR's transcription of numeral ink. Use them only to locate
 // the rectangle, never to infer its value; ordinary words such as All fail.
 const numericWords=row=>row.original.lines.flatMap(l=>l.words).filter(w=>/^[-+]?(?:\d+(?:,\d{3})*(?:\.\d+)?|[0-9aAoO]{2,})$/.test(w.text));
 const aw=numericWords(a),bw=numericWords(b);if(expectedCount&&(aw.length!==expectedCount||bw.length!==expectedCount))return false;
 const wa=aw[index],wb=bw[index];
 if(!wa||!wb||wa.text.length!==wb.text.length||wa.text.length>12)return false;
 const width=Math.ceil(Math.max(wa.width,wb.width))+6,height=Math.ceil(Math.max(wa.height,wb.height))+6;
 if(width<10||height<10)return false;
 const buffers=await Promise.all([[a,wa],[b,wb]].map(async([row,w])=>{
  const m=await sharp(row.raw).metadata(),rect={left:Math.floor(w.x)-3,top:Math.floor(w.y)-3,width,height};
  if(rect.left<0||rect.top<0||rect.left+width>m.width||rect.top+height>m.height)return null;
  return sharp(row.raw).extract(rect).grayscale().raw().toBuffer();
 }));if(buffers.some(v=>!v))return false;
 // Compare every character of the numeral. A large unchanged sentence must
 // not hide a changed digit; OCR agreement alone is not a page-content check.
 for(const ta of [100,130,170,190])for(const tb of [100,130,170,190])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const parts=Array.from({length:wa.text.length},()=>({hit:0,union:0}));
  for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
   const old=buffers[0][y*width+x]>=ta,current=buffers[1][(y+dy)*width+x+dx]>=tb,p=parts[Math.min(parts.length-1,Math.floor((x-2)*parts.length/(width-4)))];
   p.union+=old||current;p.hit+=old&&current;
  }
  if(parts.every(p=>p.union>=20&&p.hit/p.union>=tolerance))return true;
 }
 return false;
}
async function reconcileNumericRows({existing,next,previous:observedBefore,beforeImage,afterImage,evidence,body,readOCR,check=()=>{},progress=()=>{}}){
 if(!beforeImage||!evidence?.verified||!Number.isFinite(evidence.shift))return next;
 const page=existing.at(-1)?.position?.page,previous=existing.filter(t=>t.position?.page===page),output=[...next];let corrected=0;
 for(let i=0;i<next.length&&corrected<3;i++){
  const current=next[i];if(current.kind!=='line'||current.position?.edge||current.marquee?.complete===false)continue;
  const matches=previous.filter(t=>t.kind==='line'&&Math.abs(t.position.top-current.position.top-evidence.shift)<=4);if(matches.length!==1)continue;
  const old=matches[0],a=facts(old.text),b=facts(current.text);
  if(a.letters!==b.letters||a.raw.length!==b.raw.length||!a.raw.length)continue;
  const ambiguous=a.raw.some(s=>/^[-+]?0\d/.test(s))||b.raw.some(s=>/^[-+]?0\d/.test(s));
  if(!conflictingNumbers(old,current)&&!ambiguous)continue;
  const observed=(observedBefore||previous).filter(t=>t.kind==='line'&&Math.abs(t.position.top-old.position.top)<=5&&facts(t.text).letters===a.letters);if(observed.length!==1)continue;
  check();progress('Çelişen tur / hasar sayısı büyütülerek yeniden doğrulanıyor…');
  const [left,right]=await Promise.all([readRow(beforeImage,observed[0],body,readOCR),readRow(afterImage,current,body,readOCR)]);check();if(!left||!right)continue;
  const candidates=new Set([JSON.stringify(a.values),JSON.stringify(b.values)]);
  // Repeated leading-zero misreads can agree with one another. In that case
  // allow a value independently read twice from each actual image, instead
  // of treating the repeated ambiguous transcription as certified evidence.
  if(!a.valid&&!b.valid)for(const text of [...left.variants,...right.variants]){
   const f=facts(text);if(f.valid&&f.letters===a.letters&&f.raw.length===a.raw.length&&f.values.every((value,i)=>/^[-+]?0\d/.test(a.raw[i])||/^[-+]?0\d/.test(b.raw[i])||value===a.values[i]&&value===b.values[i]))candidates.add(JSON.stringify(f.values));
  }
  const av=votes(left,a.letters,candidates),bv=votes(right,a.letters,candidates);
  let agreed=[...av].filter(([key,count])=>count>=2&&(bv.get(key)||0)>=2),transferred=false;
  // One frame can lose a digit in every OCR transform. Transfer a reading
  // only from three agreeing transforms of the other frame, to a leading-zero
  // integer of equal length, with no plausible alternative OCR votes. The
  // independently aligned numeral pixels below still have to match per digit.
  if(!agreed.length&&a.valid!==b.valid){
   const known=a.valid?a:b,uncertain=a.valid?b:a,strong=a.valid?av:bv,weak=a.valid?bv:av,key=JSON.stringify(known.values);
   if((strong.get(key)||0)>=3&&weak.size===0&&known.raw.every((value,n)=>value===uncertain.raw[n]||/^0\d+$/.test(uncertain.raw[n])&&value.length===uncertain.raw[n].length)){
    agreed=[[key,strong.get(key)]];transferred=true;
   }
  }
  if(agreed.length!==1)continue;
  // A leading-zero integer is ambiguous OCR, not a certified alternate
  // value. Plausible conflicting values require almost identical digit ink.
  const tolerance=transferred?0.90:(a.valid&&b.valid)?0.995:0.88;
  const values=JSON.parse(agreed[0][0]);
  let same=true;for(let n=0;n<a.values.length;n++)if((a.values[n]!==values[n]||b.values[n]!==values[n])&&!await matchingNumberPixels(left,right,n,tolerance,a.values.length)){same=false;break;}
  if(!same)continue;
  let n=0;const text=current.text.replace(number,()=>values[n++]);
  output[i]=positioned({...current,text,numericEvidence:{method:transferred?'aligned-digit-pixels-and-source-ocr':'digit-pixels-and-cropped-ocr',readingsPerImage:transferred?[av.get(agreed[0][0])||0,bv.get(agreed[0][0])||0]:2,values}},current.position);corrected++;
  progress('Tur / hasar sayısı iki görüntüden doğrulandı: '+text);
 }
 return corrected?output:next;
}
function correctedPrevious(options,next,alignment){
 const page=options.existing.at(-1)?.position?.page,existing=[...options.existing];
 for(let i=0;i<next.length;i++){
  const n=next[i];if(n===options.next[i]||!n.numericEvidence)continue;
  const matches=existing.map((t,index)=>({t,index})).filter(({t})=>t.kind==='line'&&t.position?.page===page&&Math.abs(t.position.top-n.position.top-alignment.shift)<=4&&facts(t.text).letters===facts(n.text).letters);
  if(matches.length!==1)continue;
  const {t,index}=matches[0],values=n.numericEvidence.values;if(facts(t.text).raw.length!==values.length)continue;
  let v=0;existing[index]=positioned({...t,text:t.text.replace(number,()=>values[v++]),numericEvidence:n.numericEvidence},t.position);
 }
 return existing;
}
async function mergeNumericRows(options){
 try{
  let alignment;const merged=mergeTokens(options.existing,options.next,options.evidence,value=>alignment=value);
  const next=await reconcileNumericRows({...options,evidence:alignment});
  if(next===options.next)return {merged,next,evidence:options.evidence};
  return {merged:mergeTokens(correctedPrevious(options,next,alignment),next,alignment),next,evidence:alignment};
 }
 catch(error){
  const alignment=error.cause?.alignment;if(!alignment?.verified||!Number.isFinite(alignment.shift))throw error;
  // Use the very alignment accepted by the core merger. A calibrated range
  // alone never supplies a shift: the core must first prove a unique match.
  const next=await reconcileNumericRows({...options,evidence:alignment});if(next===options.next)throw error;
  return {merged:mergeTokens(correctedPrevious(options,next,alignment),next,alignment),next,evidence:alignment};
 }
}
module.exports={facts,reconcileNumericRows,matchingNumberPixels,mergeNumericRows};
