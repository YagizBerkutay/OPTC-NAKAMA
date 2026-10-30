const {rows,modalIdentity}=require('./boss-behavior-core.cjs');
const CLASSES=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'],TYPES=['STR','DEX','QCK','PSY','INT'];
function parseRequirement(text){
 const t=require('./requirement-marquee.cjs').separators(text.trim().replace(/^!\s*/,'').replace(/SIasher/g,'Slasher').replace(/\s+/g,' ')),suffix=t.match(/^(.+?)\s+characters only[.!]?$/i),only=t.match(/^(?:Only|nly)\s+(.+?)\s+charact(?:ers?|el|e)?[.!]?$/i)||suffix;
 if(only){
  const known=only[1].replace(/[\[\]]/g,'').split(/\s*\/\s*|\s*,\s*|\s+or\s+/i).map(v=>[...CLASSES,...TYPES].find(c=>c.toLowerCase()===v.toLowerCase()));
  if(known.some(v=>!v)||!known.length)return null;
  const flags={complete:!!suffix||/characters?[.!]?$/i.test(t),prefix:!!suffix||/^Only\b/i.test(t)};
  if(known.every(v=>CLASSES.includes(v)))return {allowedClasses:known,...flags};
  if(known.every(v=>TYPES.includes(v)))return {allowedTypes:known,...flags};
  return null;
 }
 const cost=t.match(/^(?:Only )?characters (?:with )?(?:a )?cost (?:of )?(\d+) (?:or less|or lower|and below)[.!]?$/i);
 if(cost&&Number(cost[1])>0&&Number(cost[1])<=999)return {maxCost:Number(cost[1]),complete:true,prefix:true};
 const stars=t.match(/^(?:Only )?(\d)[ -]?star characters (?:or lower|or less)[.!]?$/i);
 if(stars&&Number(stars[1])>=1&&Number(stars[1])<=6)return {maxStars:Number(stars[1]),complete:true,prefix:true};
 return null;
}
function parseRequirementTexts(texts,identity){
 const base={status:'partial',source:'MuMu · seçili görevin REQUIREMENT açıklaması',text:[...new Set(texts.filter(Boolean))].join('\n'),quest:identity.title,difficulty:identity.difficulty,warnings:[]};
 const neo=require('./requirement-marquee.cjs').parseNeoRequirement(texts,parseRequirement);
 if(neo)return {...base,status:'verified',...neo.restriction,text:neo.text,warnings:[neo.warning]};
 const parsed=texts.map(parseRequirement).filter(Boolean),keys=parsed.map(({complete,prefix,...r})=>JSON.stringify(r));
 const canonical=s=>require('./requirement-marquee.cjs').separators(s.trim().replace(/^!\s*/,'').replace(/SIasher/g,'Slasher')).toLowerCase().replace(/[^a-z0-9]/g,'');
 const full=texts.filter(t=>{const rule=parseRequirement(t);return rule?.complete&&rule?.prefix;});
 if(full.length>=2){
  const candidate=full.reduce((a,b)=>a.length>b.length?a:b),key=canonical(candidate);
  if(texts.filter(Boolean).every(text=>key.includes(canonical(text)))){
   const {complete,prefix,...rule}=parseRequirement(candidate);return {...base,status:'verified',...rule};
  }
 }
 const maps=texts.filter(t=>/^Map Effect:\s+[A-Za-z][A-Za-z '\-]{1,80}$/.test(t.trim())).map(t=>t.trim());
 if(maps.length>=2&&maps.length===texts.filter(Boolean).length&&new Set(maps).size===1)return {...base,mapEffect:maps[0].replace(/^Map Effect:\s+/,''),warnings:['Harita etkisinin adı tutarlı okundu. Hasarı, süresi ve tetikleri bu açıklamada yok; kadro önerisi bu bilgiler için kontrol gerektirir.']};
 if(parsed.length>=2&&parsed.length===texts.filter(Boolean).length&&new Set(keys).size===1&&parsed.some(p=>p.complete)&&parsed.some(p=>p.prefix)){
  const {complete,prefix,...rule}=parsed[0];return {...base,status:'verified',...rule};
 }
 return {...base,warnings:['REQUIREMENT açıklaması bütünüyle / tutarlı okunamadı; katılım koşulu tahmin edilmedi.']};
}
function selectionButtons(ocr){
 const list=rows(ocr),word=regex=>list.flatMap(r=>r.words).find(w=>regex.test(w.text)&&w.y>ocr.height*.55&&w.y<ocr.height*.84);
 const detail=word(/^(?:DETAIL|DETAI[LIE]|bETAlE)$/i),requirement=word(/REQUIREMENT/i),battle=word(/^Battle[:.]?$/i);
 return detail&&battle?{detail,requirement}:null;
}
function createQuestRestrictionReader(io){
 async function prepare(exe,device,check,progress){
  const snap=await io.observe(exe,device);check();
  if(!snap.identity){if(!selectionButtons(snap.ocr))throw Error('MuMu’da görevin zorluk seçim ekranını veya Quest Guide penceresini aç.');progress('Seçili görevin bilgi penceresi açılıyor…');await io.input(exe,device,'openDetails',snap,check);}
  const modal=await io.observe(exe,device);check();if(!modal.identity)throw Error('Seçili görevin bilgi penceresi açılmadı.');
  await io.input(exe,device,'questGuide',modal,check);
 }
 async function read(exe,device,first,identity,check,progress){
  progress('Görevin REQUIREMENT katılım koşulu okunuyor…');check();await io.input(exe,device,'closeGuide',first,check);
  const selection=await io.observe(exe,device);check();const buttons=selectionButtons(selection.ocr);
  if(!buttons)throw Error('Görev seçim ekranı değişti; katılım koşulu uygulanmadı.');
  let result={status:'unverified',source:'MuMu · seçili görev ekranı',text:'',quest:identity.title,difficulty:identity.difficulty,warnings:['REQUIREMENT düğmesi okunamadı / görünmüyor; karakter kısıtlaması yok sayılmadı.']};
  if(buttons.requirement){progress('Kırmızı REQUIREMENT açıklaması açılıyor…');const images=await io.input(exe,device,'holdRequirement',selection,check,progress);check();const pixels=io.pixelTooltip?await io.pixelTooltip(images,buttons.requirement,identity,{check,progress}):null;
   if(pixels)result=pixels;else{const texts=[];for(const [index,image]of images.entries()){progress('REQUIREMENT · açıklama görüntüsü '+(index+1)+'/'+images.length+' okunuyor…');texts.push(await io.tooltip(image,buttons.requirement));check();}result=parseRequirementTexts(texts,identity);
   }
  }
  // Bind the tooltip to the original quest AND difficulty before planning.
  // Only information windows and tabs are opened, never a quest.
  progress('Katılım koşulu seçili boss ve zorlukla doğrulanıyor…');const current=await io.observe(exe,device);check();if(!selectionButtons(current.ocr))throw Error('Görev seçim ekranı değişti; katılım koşulu kullanılmadı.');
  await io.input(exe,device,'openDetails',current,check);progress('Seçili görevin Quest Guide ekranına dönülüyor…');const restored=await io.observe(exe,device);check();
  if(!require('./quest-header.cjs').sameQuestModal(restored,first,io.sameHeader))throw Error('Boss veya zorluk değişti; katılım koşulu kullanılmadı.');
  await io.input(exe,device,'questGuide',restored,check);return result;
 }
 return {prepare,read};
}
function createQuestRestrictionService(sameHeader,headerHash,onObserve){
 const sharp=require('sharp'),adb=require('./adb.cjs'),{ocrBuffer}=require('./rule-ocr.cjs'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),execute=promisify(execFile),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const observe=async(exe,device)=>{
  let image,ocr,identity;
  for(let attempt=0;attempt<8;attempt++){
   image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64');ocr=await ocrBuffer(image,{scale:2});identity=modalIdentity(ocr);
   if(!require('./quest-header.cjs').pendingQuestModal(ocr))break;
   if(attempt===7)throw Error('Quest Guide başlığı yüklenemedi; katılım koşulu okunmadı.');await pause(650);
  }
  if(!identity){
   const footer=await ocrBuffer(image,{crop:{left:Math.round(ocr.width*.02),top:Math.round(ocr.height*.60),width:Math.round(ocr.width*.95),height:Math.round(ocr.height*.23)},scale:3});ocr.lines.push(...footer.lines);
   const battle=ocr.lines.flatMap(l=>l.words).find(w=>/^Battle[:.]?$/i.test(w.text)&&w.y>ocr.height*.55&&w.y<ocr.height*.76);
   if(battle)for(const [left,width]of [[.80,.17],[.565,.19]]){
    const label=await ocrBuffer(image,{crop:{left:Math.round(ocr.width*left),top:Math.round(battle.y-10),width:Math.round(ocr.width*width),height:Math.round(battle.height+30)},scale:4});
    ocr.lines.push(...label.lines.filter(l=>/DETAIL|REQUIREMENT/i.test(l.text)));
   }
   if(!selectionButtons(ocr)?.requirement){const word=await require('./quest-requirement-button.cjs').readRequirementButton(image,ocr,ocrBuffer);if(word)ocr.lines.push({text:word.text,words:[word]});}
  }
  onObserve?.(image,ocr);return {image,ocr,identity,header:identity?await headerHash(image,ocr.width,ocr.height,identity,ocr):null};
 };
 const io={observe,sameHeader,
  pixelTooltip:(...args)=>require('./requirement-pixels.cjs').readRequirementPixels(...args),
  tooltip:async(image,button)=>{const m=await sharp(image).metadata(),crop={left:Math.round(m.width*.108),top:Math.max(0,Math.round(button.y-m.height*.058)),width:Math.round(m.width*.687),height:Math.round(m.height*.048)};const ocr=await ocrBuffer(image,{crop,scale:4});onObserve?.(image,ocr);return ocr.text;},
  input:async(exe,device,action,snap,check,progress=()=>{})=>{
   check();const current=await observe(exe,device);check();const binary=adb.validateAdb(exe),serial=adb.validateDevice(device),options={windowsHide:true,timeout:10000,maxBuffer:2*1024*1024},activity=(await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],options)).stdout;
   if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(activity))throw Error('Global OPTC ön planda değil; katılım koşulu okuması durdu.');
   if(snap.identity&&!require('./quest-header.cjs').sameQuestModal(current,snap,sameHeader))throw Error('Seçili görev değişti; koşul okuması durdu.');
   const buttons=selectionButtons(current.ocr);let word;
   if(action==='closeGuide'||action==='questGuide'){
    if(!current.identity)throw Error('Görev bilgi penceresi kapandı.');
    word=rows(current.ocr).flatMap(r=>r.words).find(w=>action==='closeGuide'?/^[O0]K$/i.test(w.text)&&w.y>current.ocr.height*.78:/^GUIDE$/i.test(w.text)&&w.y>current.ocr.height*.2&&w.y<current.ocr.height*.25);
   }else if(action==='openDetails')word=buttons?.detail;
   else if(action==='holdRequirement')word=buttons?.requirement;
   else throw Error('Geçersiz katılım koşulu işlemi.');
   if(!word)throw Error('Katılım koşulu için gerekli bilgi düğmesi okunamadı.');const x=String(Math.round(word.x+word.width/2)),y=String(Math.round(word.y+word.height/2));check();
   if(action==='holdRequirement'){
    const started=Date.now(),duration=30000,hold=execute(binary,['-s',serial,'shell','input','swipe',x,y,x,y,String(duration)],{...options,timeout:duration+5000}),images=[];
    // Never interpret the quest title beneath a tooltip after the hold ends.
    // Slow emulator captures get fewer frames instead of leaking into another UI.
    try{for(let i=0;;i++){await pause(i?80:950);check();if(Date.now()-started>=duration-3000)break;progress('REQUIREMENT · kayan açıklama görüntüsü '+(i+1)+' alınıyor…');const image=Buffer.from((await adb.screenshot(binary,serial)).split(',')[1],'base64');if(Date.now()-started>=duration-500)break;images.push(image);}}finally{await hold;}return images;
   }
   await execute(binary,['-s',serial,'shell','input','tap',x,y],options);await pause(750);
  }
 };
 return createQuestRestrictionReader(io);
}
module.exports={parseRequirement,parseRequirementTexts,selectionButtons,createQuestRestrictionReader,createQuestRestrictionService};
