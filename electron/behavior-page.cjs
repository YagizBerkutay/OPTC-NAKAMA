const {ocrBuffer}=require('./rule-ocr.cjs'),{rows,modalIdentity}=require('./boss-behavior-core.cjs');
async function enrichTitle(image,ocr,readOCR=ocrBuffer){
 const {pendingQuestModal}=require('./quest-header.cjs');
 if(pendingQuestModal(ocr)&&!/\b(?:CONNECTING|LOADING)\b/i.test(ocr.text)){
  const crop={left:Math.round(ocr.width*.11),top:Math.round(ocr.height*.095),width:Math.round(ocr.width*.78),height:Math.round(ocr.height*.048)};
  const title=await readOCR(image,{crop,scale:3});
  const lines=ocr.lines.filter(line=>!line.words.some(word=>word.y>=crop.top&&word.y<crop.top+crop.height)).concat(title.lines);
  const recovered={...ocr,lines,text:lines.map(line=>line.text).join('\n')};
  if(!pendingQuestModal(recovered)&&modalIdentity(recovered)?.difficultyRow)return recovered;
 }
 if(!/QUEST\s+(?:GUIDE|INFO)/i.test(ocr.text)||rows(ocr).some(r=>/^Vs\.\s+\S/i.test(r.text)&&r.y>ocr.height*.09&&r.y<ocr.height*.15))return ocr;
 const crop={left:Math.round(ocr.width*.17),top:Math.round(ocr.height*.098),width:Math.round(ocr.width*.66),height:Math.round(ocr.height*.047)};
 let title=await readOCR(image,{crop,scale:3});
 // The decorative banner can make page OCR omit Vs.; isolate the actual text on this same frame.
 if(!/^(?:Vs\.\s+\S|Co.Op Quest\s*[-:])/i.test(title.text.trim()))title=await readOCR(image,{crop:{left:Math.round(ocr.width*.155),top:Math.round(ocr.height*.1125),width:Math.round(ocr.width*.69),height:Math.round(ocr.height*.03125)},scale:3});
 if(!/^(?:Vs\.\s+\S|Co.Op Quest\s*[-:])/i.test(title.text.trim()))return ocr;
 const lines=ocr.lines.filter(l=>!l.words.some(w=>w.y>=crop.top&&w.y<crop.top+crop.height));lines.push(...title.lines);return {...ocr,lines,text:lines.map(l=>l.text).join('\n')};
}
function createPageReader({readOCR:baseReadOCR=ocrBuffer,readLineOCR:baseReadLineOCR}={}){
 let cached;const readLevels=require('./kizuna-levels.cjs').createLevelReader(baseReadOCR,baseReadLineOCR);
 return async (image,{signal}={})=>{
  const readOCR=(source,options={})=>baseReadOCR(source,{...options,signal:options.signal||signal}),readLineOCR=baseReadLineOCR&&((source,options={})=>baseReadLineOCR(source,{...options,signal:options.signal||signal}));
  let raw=await enrichTitle(image,await readOCR(image,{scale:2}),readOCR);const identity=modalIdentity(raw),bar=identity?await require('./scrollbar.cjs').scrollbar(image,identity.body):null;
  if(identity)raw=await require('./behavior-effect-ocr.cjs').recoverEffectNumbers(image,raw,identity.body,{read:readOCR,line:readLineOCR});
  const stable=cached&&bar?.known&&cached.bar?.known&&Math.abs(bar.thumbTop-cached.bar.thumbTop)<=1&&Math.abs(bar.thumbBottom-cached.bar.thumbBottom)<=1&&identity?.title===cached.title;
  const movement=stable?await require('./behavior-tracking.cjs').estimateScroll(cached.image,image,identity.body):null;
  if(stable&&movement&&Math.abs(movement.shift)<=2){
   // Fixed labels can be reused only after their page pixels still align.
   let lines=raw.lines;
   for(const label of cached.labels){const y=Math.min(...label.words.map(w=>w.y)),right=Math.max(...label.words.map(w=>w.x+w.width));
    lines=lines.map(l=>({...l,words:l.words.filter(w=>!(Math.abs(w.y-y)<12&&(label.battle||w.x<right+3)))})).filter(l=>l.words.length);lines.push(structuredClone(label));
   }
   cached.image=image;return readLevels(image,{...raw,lines,text:lines.map(l=>l.words.map(w=>w.text).join(' ')).join('\n')},identity.body,{signal});
  }
  const full=await require('./boss-behavior.cjs').readBehaviorPage(image,raw,readLineOCR,signal,readOCR),labels=[];
  for(const row of rows(full)){
   if(identity&&row.y<identity.body.top)continue;
   if(/^BATTLE\s*\d+(?:-\d+)?$/i.test(row.text))labels.push({text:row.text,words:row.words,battle:true});
   else{const words=row.words.filter(w=>identity&&w.x<identity.body.left+identity.body.width*.28&&/^(?:PREEMPTIVE|STARTING|STATE|DEFEATED|DEFEAT|ON|INTERRUPT(?:ION)?)$/i.test(w.text));if(words.length)labels.push({text:words.map(w=>w.text).join(' '),words});}
  }
  cached={image,bar,title:identity?.title,labels};return identity?readLevels(image,full,identity.body,{signal}):full;
 };
}
module.exports={enrichTitle,createPageReader};
