const sharp=require('sharp'),adb=require('./adb.cjs'),{ocrBuffer}=require('./rule-ocr.cjs');
const {rows,modalIdentity,pageTokens,mergeTokens,encounterFromTokens}=require('./boss-behavior-core.cjs');
const {execFile}=require('node:child_process'),execute=require('node:util').promisify(execFile);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function sameGuide(current,first,sameHeader){const key=text=>String(text||'').toLowerCase().replace(/\s+/g,'');return current.width===first.width&&current.height===first.height&&current.identity?.mode==='pka'&&first.identity?.mode==='pka'&&key(current.identity.title)===key(first.identity.title)&&current.identity.level===first.identity.level&&sameHeader(current.header,first.header);}
function expandedStart(body,items){const open=items.filter(v=>v.expanded);if(open.length!==1)return null;const band=open[0];return !band.clippedTop&&!band.clippedBottom&&band.top>=body.top&&band.bottom<body.top+body.height-20?band:null;}
const {estimateScroll,collectMarquee,createScrollAlignment}=require('./behavior-tracking.cjs');
// EDIT CREW and the DEFEAT/TOTAL label are animated; the button is verified in its own crop before input.
const isPKAHome=text=>/PIRATE/i.test(text)&&/\bKING\b/i.test(text)&&/ADV\.?\s*STAMINA|ADVSTAMINA/i.test(text)&&/\bHELP\b/i.test(text)&&/\bLIST\b/i.test(text);
async function verifyPKAHome(snap,read=ocrBuffer){
 if(isPKAHome(snap.ocr.text))return true;
 if(snap.identity)return false;
 // Home animation can hide one word from full-page segmentation. Recheck the
 // same image's fixed logo, help/list and stamina regions before any input.
 const crops=[[.03,.15,.47,.10],[.005,.265,.54,.055],[.02,.775,.40,.05]];let text=snap.ocr.text;
 // All readings refer to this same frame. A narrow crop must not erase a
 // label already seen on it; another scale recovers omitted logo/stamina ink.
 for(const scale of [3,2]){const parts=await Promise.all(crops.map(([x,y,w,h])=>read(snap.image,{crop:{left:Math.round(snap.width*x),top:Math.round(snap.height*y),width:Math.round(snap.width*w),height:Math.round(snap.height*h)},scale})));text+='\n'+parts.map(p=>p.text).join('\n');if(isPKAHome(text))return true;}
 return false;
}
async function enrichHeader(image,ocr){
 if(!/QUEST\s+GUIDE/i.test(ocr.text)||rows(ocr).some(r=>/Difficulty/i.test(r.text)&&r.y<ocr.height*.25))return ocr;
 if(rows(ocr).some(r=>/^Vs\.\s+\S/i.test(r.text)&&r.y>ocr.height*.09&&r.y<ocr.height*.15))return ocr;
 const title=await ocrBuffer(image,{crop:{left:Math.round(ocr.width*.155),top:Math.round(ocr.height*.119),width:Math.round(ocr.width*.69),height:Math.round(ocr.height*.041)},scale:3});
 if(!/^Vs\.\s+\S/i.test(title.text.trim()))return ocr;
 const lines=ocr.lines.filter(l=>!l.words.some(w=>w.y>ocr.height*.119&&w.y<ocr.height*.16));lines.push(...title.lines);
 return {...ocr,lines,text:lines.map(l=>l.text).join('\n')};
}
async function bands(image,body){
 const {data,info}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height,runs=[];
 const orange=(x,y)=>{const i=(y*w+x)*info.channels,r=data[i],g=data[i+1],b=data[i+2];return r>100&&g>40&&g<210&&b<60&&r>g*1.1;};
 for(let y=body.top;y<body.top+body.height;y++){
  let n=0;for(let x=Math.round(w*.22);x<w*.79;x+=9)if(orange(x,y))n++;
  if(n>w*.57/9*.55){const last=runs.at(-1);if(last&&y-last.end<7)last.end=y;else runs.push({start:y,end:y});}
 }
 const output=[];
 for(const run of runs.filter(r=>r.end-r.start>h*.027&&r.end-r.start<h*.065)){
  const center=Math.floor((run.start+run.end)/2+h*.0035);let upper=0,lower=0;
  for(let y=Math.round(center-h*.0063);y<center+h*.0063;y++)for(let x=Math.round(w*.166);x<w*.184;x++){
   const i=(y*w+x)*info.channels;if(data[i]>230&&data[i+1]>225&&data[i+2]>210){if(y<center)upper++;else lower++;}
  }
  const clippedTop=run.start<=body.top+2,clippedBottom=run.end>=body.top+body.height-2;
  if(upper+lower<20&&!clippedTop&&!clippedBottom)continue;
  // A partially visible band shifts its measured centre and can turn a down
  // arrow into a false "expanded" reading. It still marks the next range's edge.
  output.push({top:run.start,bottom:run.end,center,clippedTop,clippedBottom,expanded:!clippedTop&&!clippedBottom&&lower>upper*1.05});
 }
 return output;
}
async function rangeNumber(image,band,expected){
 const m=await sharp(image).metadata();
 for(const threshold of [175,180,185,200]){
  const crop={left:Math.round(m.width*.40),top:Math.round(band.center-m.height*.013),width:Math.round(m.width*.39),height:Math.round(m.height*.02625)};
  const digit=await sharp(image).extract(crop).removeAlpha().grayscale().threshold(threshold).negate().resize({width:250,height:55,fit:'fill'}).png().toBuffer();
  const input=await sharp({create:{width:720,height:125,channels:3,background:'white'}}).composite([{input:Buffer.from('<svg width="340" height="125"><text x="10" y="85" font-family="Segoe UI" font-size="64">Difficulty</text></svg>'),left:0,top:0},{input:digit,left:340,top:33}]).png().toBuffer();
  let text=(await ocrBuffer(input)).text.replace(/Difficulty/gi,'').trim();
  // Windows OCR sometimes drops only the dash and splits its two numbers
  // into separate lines. Accept this solely when its central horizontal dash
  // is present in the thresholded pixels, not from two guessed numbers.
  const raw=await sharp(digit).removeAlpha().raw().toBuffer({resolveWithObject:true});let separator=false;
  for(let y=14;y<42;y++){let run=0;for(let x=90;x<160;x++){const p=(y*raw.info.width+x)*raw.info.channels;if(raw.data[p]<50){if(++run>=20)separator=true;}else run=0;}}
  const parse=value=>{const numeric=value.replace(/[IOil|]/g,c=>/[Oo]/.test(c)?'0':'1'),match=numeric.match(/^(\d{1,4})\s*[-–—]\s*(\d{1,4})$/)||(separator?numeric.match(/^(\d{1,4})\s+(\d{1,4})$/):null);return separator&&match&&+match[1]>=1&&+match[2]>=+match[1]&&+match[2]<=9999?[+match[1],+match[2]]:null;};
  const independent=parse((await require('./line-ocr.cjs').readLineOCR(digit)).text);let native=parse(text),nativeText=text;
  if(!native){const padded=await sharp(digit).extend({top:12,bottom:12,left:12,right:12,background:'white'}).png().toBuffer();nativeText=(await ocrBuffer(padded,{scale:3})).text.trim();native=parse(nativeText);}
  if(native&&independent&&native.join('-')===independent.join('-'))return native;
  // An expanded orange header can make WinRT omit its isolated leading 1.
  // Reuse only the full two-reader proof obtained from the same collapsed band before the guarded click.
  const tail=nativeText.match(/^[-–—]\s*(\d{1,4})$/);if(!native&&expected&&independent?.join('-')===expected.join('-')&&tail&&+tail[1]===expected[1])return expected;
 }
 return null;
}
function clipBand(ocr,identity,start,end){
 const list=pageTokens(ocr,{...identity,body:{...identity.body,top:start??identity.body.top,height:(end??identity.body.top+identity.body.height)-(start??identity.body.top)}});
 return list.filter(t=>t.kind!=='line'||!/^Lv\.?\s*\d/i.test(t.text));
}
function behaviorWindow(body,items,own){
 // A cut-off arrow cannot prove expansion, but its orange header still has
 // to stay outside both OCR tokens and pixel-based discovery.
 const top=own?.bottom??items.find(v=>v.clippedTop)?.bottom??body.top,nextBand=items.find(v=>!v.clippedTop&&v.top>top);
 return {nextBand,body:{...body,top,height:(nextBand?.top??body.top+body.height)-top}};
}
function createPKAService({readPage,scrollbar,headerHash,sameHeader,onObserve,readLineOCR,readBlockOCR,targetLevel}){
 const observe=async(exe,device)=>{const image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64');let ocr=await enrichHeader(image,await ocrBuffer(image,{scale:2}));
  if(!modalIdentity(ocr)&&/Edit\s+Crew|ABILITY\s*LIST/i.test(ocr.text)){const header=await ocrBuffer(image,{crop:{left:Math.round(ocr.width*.14),top:Math.round(ocr.height*.165),width:Math.round(ocr.width*.85),height:Math.round(ocr.height*.12)},scale:3});ocr={...ocr,lines:[...ocr.lines,...header.lines],text:ocr.text+'\n'+header.text};}
  const identity=modalIdentity(ocr);onObserve?.(image,ocr);return {image,ocr,identity,width:ocr.width,height:ocr.height};};
 const input=async(exe,device,action,snap,rect,check)=>{
  check();
  if(snap.identity?.mode==='pka'){
   // The fixed header includes the boss title and active GUIDE tab. Its pixels
   // must still match before an input; another full OCR adds no identity evidence.
   const image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),m=await sharp(image).metadata();check();
   if(m.width!==snap.width||m.height!==snap.height||!sameHeader(await headerHash(image,m.width,m.height),await headerHash(snap.image,snap.width,snap.height)))throw Error('PKA bossu veya rehber ekranı değişti; okuma durduruldu.');
  }else{
   const current=await observe(exe,device);check();
   if(!snap.identity&&await verifyPKAHome(snap)&&!await verifyPKAHome(current))throw Error('PKA ana ekranı değişti.');
  }
  const binary=adb.validateAdb(exe),serial=adb.validateDevice(device),options={windowsHide:true,timeout:10000,maxBuffer:2*1024*1024},activity=(await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],options)).stdout;
  if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(activity))throw Error('Global OPTC ön planda değil.');
  const b=snap.identity?.body;let args;
  if(action==='tap')args=['tap',String(Math.round(rect.x+rect.width/2)),String(Math.round(rect.y+rect.height/2))];
  else if(b&&['up','down'].includes(action)){const x=Math.round(b.left+b.width*.5),a=Math.round(b.top+b.height*.81),z=Math.round(b.top+b.height*(action==='down'?.59:.38));args=['swipe',String(x),String(action==='down'?a:z),String(x),String(action==='down'?z:a),'650'];}
  else throw Error('PKA bilgi hareketi doğrulanamadı.');
  check();await execute(binary,['-s',serial,'shell','input',...args],options);await pause(800);check();
 };
 async function prepare(exe,device,check,progress){
  let s=await observe(exe,device);check();
  const edit=s=>/Edit\s+Crew/i.test(s.ocr.text)&&/CREW\s+LOG|ABILITY\s*LIST/i.test(s.ocr.text);
  const settle=async(predicate)=>{const started=Date.now();for(;;){s=await observe(exe,device);check();if(predicate(s))return;if(Date.now()-started>10000)throw Error('PKA bilgi ekranı geçişi doğrulanamadı.');await pause(350);}};
  const questGuide=async()=>{const guide=rows(s.ocr).flatMap(r=>r.words).find(w=>/^GUIDE$/i.test(w.text)&&w.x>s.width*.38&&w.x<s.width*.63&&w.y>s.height*.18&&w.y<s.height*.24);if(!guide)throw Error('PKA QUEST GUIDE sekmesi okunamadı.');progress('PKA · QUEST GUIDE davranışları açılıyor…');await input(exe,device,'tap',s,guide,check);await settle(s=>s.identity?.mode==='pka'&&!/LOADING|CONNECTING/i.test(s.ocr.text));};
  if(s.identity?.mode==='pka'){
   await questGuide();return true;
  }
  if(await verifyPKAHome(s)){
   const rect={left:Math.round(s.width*.805),top:Math.round(s.height*.5125),width:Math.round(s.width*.194),height:Math.round(s.height*.1125)},button=await ocrBuffer(s.image,{crop:rect,scale:3});check();
   if(!/\bCREW\b/i.test(button.text)){const second=await require('./line-ocr.cjs').readBlockOCR(await sharp(s.image).extract(rect).png().toBuffer());check();if(!/\bCREW\b/i.test(second.text))throw Error('PKA Edit Crew düğmesi okunamadı; Edit Crew → GUIDE ekranını açıp yeniden okut.');}
   progress('PKA · Edit Crew bilgi ekranı açılıyor…');await input(exe,device,'tap',s,{x:s.width*.84,y:s.height*.55,width:s.width*.12,height:s.height*.04},check);await settle(edit);
  }
  if(!edit(s))return false;
  const button=rows(s.ocr).flatMap(r=>r.words).find(w=>/^GUIDE$/i.test(w.text)&&w.x>s.width*.65&&w.y>s.height*.15&&w.y<s.height*.25);
  if(!button)throw Error('PKA GUIDE düğmesi okunamadı.');
  progress('PKA boss rehberi açılıyor…');await input(exe,device,'tap',s,button,check);
  await settle(s=>s.identity?.mode==='pka'&&!/LOADING|CONNECTING/i.test(s.ocr.text));await questGuide();return true;
 }
 async function read(exe,device,first,check,progress){
  const identity={...first.identity};let snap=first;
  const capture=async({pixelsOnly=false}={})=>{check();const image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),ocr=pixelsOnly?snap.ocr:await readPage(image),s={image,ocr,identity:modalIdentity(ocr),width:ocr.width,height:ocr.height};s.header=await headerHash(s.image,s.width,s.height);check();if(!sameGuide(s,first,sameHeader))throw Error('PKA bossu veya rehber ekranı değişti; okuma durduruldu.');if(!pixelsOnly)onObserve?.(s.image,s.ocr);return s;};
  const scroll=async direction=>{await input(exe,device,direction,snap,null,check);snap=await capture();};
  let selected,range,verifiedBand,seekDirection='up';const seenPositions=new Set();
  for(;;){
   const items=await bands(snap.image,identity.body),open=items.filter(v=>v.expanded);
   if(open.length>1)throw Error('PKA’da birden fazla seviye aralığı açık; yalnız istediğin aralığı açık bırak.');
   if(targetLevel){
    let changed=false;for(const item of items.filter(v=>!v.clippedTop&&!v.clippedBottom)){const values=await rangeNumber(snap.image,item,verifiedBand);check();if(item.expanded&&!values&&!verifiedBand){progress('PKA · aralık başlığı sabit kapalı görüntüde doğrulanıyor…');await input(exe,device,'tap',snap,{x:snap.width*.30,y:item.top,width:snap.width*.35,height:item.bottom-item.top},check);snap=await capture();seenPositions.clear();changed=true;break;}if(values&&values[0]<=targetLevel&&targetLevel<=values[1]&&!item.expanded){verifiedBand=values;progress('PKA · Lv.'+values.join('–')+' davranış aralığı açılıyor…');await input(exe,device,'tap',snap,{x:snap.width*.30,y:item.top,width:snap.width*.35,height:item.bottom-item.top},check);snap=await capture();seenPositions.clear();changed=true;break;}}
    if(changed)continue;
   }
   const start=expandedStart(identity.body,items);
   if(start){
    const values=await rangeNumber(snap.image,start,verifiedBand);check();if(!values)throw Error('PKA seviye aralığı güvenilir okunamadı; başlığın tamamı görünecek şekilde yeniden okut.');if(!targetLevel||values[0]<=targetLevel&&targetLevel<=values[1]){selected=start;range=values;break;}
   }
   progress('PKA · açık seviye aralığının başlangıcı doğrulanıyor…');
   // Start from the guide top, then seek its behavior accordions.
   const bar=await scrollbar(snap.image,identity.body);if(bar.top||/BEHAVIO|RECOMMENDED CHARACTER|CLEARED CAPTAIN/i.test(snap.ocr.text))seekDirection='down';const position=seekDirection+'|'+require('node:crypto').createHash('sha256').update(await sharp(snap.image).extract(identity.body).resize(180,210).greyscale().raw().toBuffer()).digest('hex');if(seenPositions.has(position))throw Error('PKA rehberinde istenen seviye aralığına ilerlenemedi.');seenPositions.add(position);await scroll(seekDirection);
  }
  if(!selected||!range)throw Error('PKA BEHAVIOR’da istediğin Lv. aralığını açıp yeniden okut.');
  let tokens=[],complete=false,pages=0,firstPage=true,previousImage,previousTokens,staticCycleMs;const alignment=createScrollAlignment();
  for(;;pages++){
   const items=await bands(snap.image,identity.body);
   const own=firstPage?selected:items.find(v=>v.expanded),{nextBand,body:textBody}=behaviorWindow(identity.body,items,own);
   // Before the selected expansion, headings belong to other difficulty bands.
   const readTokens=s=>clipBand(s.ocr,identity,textBody.top,textBody.top+textBody.height);
   const prior=previousImage?await alignment.evidence(previousImage,snap.image,identity.body,{previous:previousTokens,next:readTokens(snap)}):undefined;
   const visibleBand=own||items.find(v=>v.clippedTop);
   if(!firstPage&&visibleBand){const seen=await rangeNumber(snap.image,visibleBand,range);check();if(seen?seen.join('-')!==range.join('-'):own||!prior?.verified)throw Error('PKA seviye aralığı veya sayfa konumu doğrulanamadı; okuma kullanılmadı.');}
   const marquee={capture,tokens:readTokens,body:textBody,check,progress,readOCR:ocrBuffer,readLineOCR,readBlockOCR,staticCycleMs,reuse:prior?.verified?{...prior,tokens:previousTokens}:undefined};
   const tracked=await collectMarquee(snap,marquee);snap=tracked.snap;staticCycleMs=tracked.staticCycleMs||staticCycleMs;
   let next=tracked.tokens,merged;
   for(let retry=0;retry<3;retry++){
    const evidence=previousImage?await alignment.evidence(previousImage,snap.image,identity.body,{previous:previousTokens,next}):undefined;
     try{const result=await require('./behavior-numbers.cjs').mergeNumericRows({existing:tokens,next,previous:previousTokens,beforeImage:previousImage,afterImage:snap.image,evidence,body:identity.body,readOCR:ocrBuffer,check,progress});merged=result.merged;next=result.next;break;}catch(error){if(retry===2)throw error;progress('PKA · sayfa konumu ve kayan satırlar yeniden doğrulanıyor…');snap=await capture();const retracked=await collectMarquee(snap,{...marquee,staticCycleMs});snap=retracked.snap;next=retracked.tokens;}
   }
   tokens=merged;progress(identity.title+' · Lv.'+range.join('–')+' · sayfa '+(pages+1)+' okunuyor…');firstPage=false;
   if(nextBand||(await scrollbar(snap.image,identity.body)).bottom){complete=true;pages++;break;}
    const old=next.map(t=>t.text).join('\n');previousImage=snap.image;previousTokens=next;progress('PKA · sayfa '+(pages+1)+' tamamlandı; sonraki sayfa kaydırılıyor…');await scroll('down');
   let moved=await estimateScroll(previousImage,snap.image,identity.body);
   if(moved?.shift===0){progress('PKA · listenin sonu doğrulanıyor…');await scroll('down');moved=await estimateScroll(previousImage,snap.image,identity.body);if(moved?.shift===0){complete=(await scrollbar(snap.image,identity.body)).bottom;pages++;break;}}
   if(clipBand(snap.ocr,identity).map(t=>t.text).join('\n')===old)throw Error('PKA seviye aralığının sonu doğrulanamadı.');
  }
  check();const result=encounterFromTokens({...identity,levelRange:range},[{kind:'heading',text:'BEHAVIOR'},...tokens],{observedAt:new Date().toISOString(),complete,startVerified:true,pages,mode:'pka',levelRange:range,marqueeChecked:true});
  result.difficulty='PKA · Lv.'+range.join('–');result.source='MuMu · Pirate King Adventures · Quest Guide';result.observation.warnings=result.observation.warnings.filter(v=>!/Yıldız zorluğu/.test(v));result.observation.warnings.push('Bu aralık davranışları okundu; kesin seviyeye ait HP / ATK / DEF rehberde yoksa hasar ve hayatta kalma doğrulanamaz.');
  result.restrictions={status:'unverified',source:'MuMu · PKA rehberi',text:'',quest:identity.title,difficulty:null,warnings:['PKA rehberinde normal görevlerdeki REQUIREMENT düğmesi yok; katılım kısıtlaması ayrıca doğrulanmalı.']};
  progress(result.stages.length+' PKA aşaması '+(complete?'okundu.':'kısmen okundu.'));return result;
 }
 return {prepare,read};
}
module.exports={isPKAHome,verifyPKAHome,enrichHeader,bands,rangeNumber,clipBand,behaviorWindow,expandedStart,sameGuide,createPKAService};
