const sharp=require('sharp'),adb=require('./adb.cjs'),{ocrBuffer}=require('./rule-ocr.cjs');
const {rows,modalIdentity}=require('./boss-behavior-core.cjs');
const {enrichTitle,createPageReader}=require('./behavior-page.cjs');
const {execFile}=require('node:child_process'),execute=require('node:util').promisify(execFile);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const sameName=(a,b)=>a.toLowerCase().replace(/.*\bvs\.?\s*/,'').replace(/[^a-z0-9]/g,'')===b.toLowerCase().replace(/.*\bvs\.?\s*/,'').replace(/[^a-z0-9]/g,'');
function mainLandmarks(text){return /\bLIST\b|\bKIZUNA|CLASH/i.test(text)&&/\bRequired\s*:/i.test(text)&&(/\bTIPS\b/i.test(text)||/\bBattle\s*:\s*\d{1,2}\b/i.test(text));}
function screenKind(ocr){if(/TRUSTY CHARACTERS/i.test(ocr.text))return 'trusty';if(modalIdentity(ocr))return 'guide';if((/\bKIZUNA|CLASH/i.test(ocr.text)||mainLandmarks(ocr.text))&&/\bTIPS\b/i.test(ocr.text)&&/Vs\.\s+\S/i.test(ocr.text))return 'main';return 'unknown';}
function mainValues(ocr){
 const list=rows(ocr),title=list.find(r=>/^Vs\.\s+\S/i.test(r.text)&&r.y>ocr.height*.55)?.words.filter(w=>w.x+w.width<=ocr.width*.55).map(w=>w.text).join(' ');
 const numbers=list.filter(r=>r.y>ocr.height*.62&&r.y<ocr.height*.70).flatMap(r=>[...r.text.matchAll(/\b\d{4,}\b/g)].map(m=>m[0]));
 const lv=list.filter(r=>r.y>ocr.height*.62&&r.y<ocr.height*.70).map(r=>r.text).join(' ').match(/\bLv\.?\s*(\d{1,6})\b/i);
 const battles=ocr.text.match(/\bBattle\s*:\s*(\d{1,2})\b/i);
 if(!title||numbers.length!==2||!lv||!battles)throw Error('Kizuna başlığı, HP, Lv. veya savaş sayısı tam okunamadı; hedef tahmin edilmedi.');
 return {title,remainingHP:numbers[0],maxHP:numbers[1],level:Number(lv[1]),battles:Number(battles[1])};
}
async function mainType(image,w,h){
 const {data}=await sharp(image).extract({left:Math.round(w*.125),top:Math.round(h*.637),width:Math.round(w*.043),height:Math.round(h*.025)}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const counts={STR:0,DEX:0,QCK:0,PSY:0,INT:0};
 for(let p=0;p<data.length;p+=3){const r=data[p]/255,g=data[p+1]/255,b=data[p+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(max<.4||d/max<.4)continue;let hue=max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);if(hue<0)hue+=360;counts[hue<32||hue>=345?'STR':hue<75?'PSY':hue<170?'DEX':hue<270?'QCK':'INT']++;}
 const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]),total=Object.values(counts).reduce((a,b)=>a+b,0);if(total<30||ranked[0][1]/total<.65)throw Error('Kizuna hedef tipi güvenle okunamadı.');return ranked[0][0];
}
function createReader({capture,readOCR=ocrBuffer,readLineOCR,readBlockOCR,act,wait=pause,onObserve}={}){
 const observe=async(exe,device)=>{
  const snap=await capture(exe,device);let ocr=await enrichTitle(snap.image,await readOCR(snap.image,{scale:2}));
  // Full-frame OCR can omit both title and TIPS; candidate landmarks permit crops only.
  const kind=screenKind(ocr);
  if(kind==='main'||kind==='unknown'&&mainLandmarks(ocr.text)){
   const additions=[];
   {
    const battle=await readOCR(snap.image,{crop:{left:Math.round(ocr.width*.20),top:Math.round(ocr.height*.69),width:Math.round(ocr.width*.20),height:Math.round(ocr.height*.03)},scale:3});
    additions.push(...battle.lines);
   }
   for(const crop of [{left:Math.round(ocr.width*.16),top:Math.round(ocr.height*.616),width:Math.round(ocr.width*.39),height:Math.round(ocr.height*.03)},{left:Math.round(ocr.width*.073),top:Math.round(ocr.height*.693),width:Math.round(ocr.width*.09),height:Math.round(ocr.height*.032)}])additions.push(...(await readOCR(snap.image,{crop,scale:3})).lines);
   const level=await readOCR(snap.image,{crop:{left:Math.round(ocr.width*.68889),top:Math.round(ocr.height*.64375),width:Math.round(ocr.width*.25556),height:Math.round(ocr.height*.04375)},scale:3});
   if(/^\d{1,6}$/.test(level.text.trim())&&level.lines.length===1&&level.lines[0].words.length===1){level.lines[0].words[0].text='Lv. '+level.text.trim();level.lines[0].text='Lv. '+level.text.trim();}
   ocr={...ocr,lines:[...ocr.lines.filter(l=>!l.words.some(w=>w.x>ocr.width*.69&&w.y>ocr.height*.64&&w.y<ocr.height*.685||w.x>ocr.width*.16&&w.x<ocr.width*.55&&w.y>ocr.height*.616&&w.y<ocr.height*.646||w.x>ocr.width*.073&&w.x<ocr.width*.163&&w.y>ocr.height*.693&&w.y<ocr.height*.725)),...additions,...level.lines]};ocr.text=ocr.lines.map(l=>l.text).join('\n');
  }
  onObserve?.(snap.image,ocr);return {...snap,ocr,identity:modalIdentity(ocr),kind:screenKind(ocr)};
 };
 async function read(exe,device,{difficulty=10,title='',collectBonuses=false,targetOnly=false}={},check=()=>{},progress=()=>{}){
  let snap=await observe(exe,device);check();
  const settle=async()=>{for(let retry=0;retry<12&&(snap.kind==='unknown'||/\bCONNECTING|\bLOADING/i.test(snap.ocr.text));retry++){if(snap.kind==='unknown'&&!/\bCONNECTING|\bLOADING/i.test(snap.ocr.text)&&retry>=2)break;progress('Kizuna ekranının yüklenmesi bekleniyor…');await wait(700);check();snap=await observe(exe,device);check();}if(/\bCONNECTING|\bLOADING/i.test(snap.ocr.text))throw Error('Kizuna bilgi penceresi yüklenemedi; yükleme ekranına dokunulmadı.');};
  await settle();let selectedDifficulty=snap.identity?await require('./boss-behavior.cjs').difficultyNumber(snap.image,snap.identity):null;
  const input=async(action,rect)=>{check();await act(exe,device,action,snap,rect,check);await wait(700);check();snap=await observe(exe,device);await settle();};
  const word=(re,low=0,high=1)=>rows(snap.ocr).flatMap(r=>r.words).find(w=>re.test(w.text)&&w.y>snap.height*low&&w.y<snap.height*high);
  if(snap.kind==='trusty'||snap.kind==='guide'){
   const ok=word(/^[O0]K$/i,.77,.92);if(!ok)throw Error('Kizuna bilgi penceresinin OK düğmesi okunamadı.');progress('Kizuna ana ekranına dönülüyor…');await input('tap',ok);
  }
  if(snap.kind!=='main')throw Error('MuMu’da Kizuna ana ekranını açık bırak; uygulama bilgi pencerelerini kendisi açacak.');
  let target=mainValues(snap.ocr);if(title&&!sameName(title,target.title))throw Error('Oyundaki Kizuna bossu güncel Global duyurusuyla farklı; veriler birleştirilmedi.');
  const bonusPages=[];let bonusComplete=false;
  if(collectBonuses){
   const list=word(/^LIST$/i,.27,.38);if(!list)throw Error('Kizuna LIST düğmesi okunamadı.');progress('İnternet bilgisi eksik · Trusty Characters listesi açılıyor…');await input('tap',list);
   if(snap.kind!=='trusty')throw Error('Kizuna Trusty Characters penceresi açılmadı.');
   const body={left:Math.round(snap.width*.112),top:Math.round(snap.height*.289),width:Math.round(snap.width*.784),height:Math.round(snap.height*.44)},getBar=()=>require('./scrollbar.cjs').scrollbar(snap.image,body);
   for(let i=0;!(await getBar()).top;i++){if(i===8)throw Error('Trusty Characters listesinin başı bulunamadı.');await input('up',{fraction:.40});}
   for(let page=0;;page++){
    progress('Kizuna bonusları · sayfa '+(page+1)+' okunuyor…');bonusPages.push(...await require('./kizuna-images.cjs').read([{name:'MuMu Trusty Characters '+(page+1),dataUrl:'data:image/png;base64,'+snap.image.toString('base64')}],()=>{}));check();
    if((await getBar()).bottom){bonusComplete=true;break;}await input('down',{fraction:.28});
   }
   const ok=word(/^[O0]K$/i,.74,.86);if(!ok)throw Error('Trusty Characters OK düğmesi bulunamadı.');await input('tap',ok);
   if(snap.kind!=='main'||!sameName(mainValues(snap.ocr).title,target.title))throw Error('Bonus okumasından sonra Kizuna hedefi değişti.');
  }
  const openTips=async()=>{const tips=word(/^TIPS$/i,.65,.75);if(!tips)throw Error('Kizuna TIPS düğmesi okunamadı.');await input('hold',tips);if(!snap.identity||!sameName(snap.identity.title,target.title))throw Error('Kizuna TIPS hedefi doğrulanamadı.');const value=await require('./boss-behavior.cjs').difficultyNumber(snap.image,snap.identity);if(![3,7,10,13].includes(value))throw Error('Kizuna yıldız zorluğu güvenle okunamadı.');return value;};
  if(!selectedDifficulty){progress('Kizuna · seçili zorluk rehberden doğrulanıyor…');selectedDifficulty=await openTips();const ok=word(/^[O0]K$/i,.77,.92);if(!ok)throw Error('Kizuna rehberinin OK düğmesi okunamadı.');await input('tap',ok);}
  while(selectedDifficulty!==difficulty){
   const order=[3,7,10,13],offset=order.indexOf(difficulty)-order.indexOf(selectedDifficulty),step=Math.sign(offset)*Math.min(2,Math.abs(offset));if(!order.includes(selectedDifficulty)||!order.includes(difficulty)||snap.height/snap.width<1.74||snap.height/snap.width>1.81)throw Error('Kizuna zorluk şeridi desteklenen düzende değil.');
   progress('Kizuna · '+difficulty+'★ hedefi seçiliyor…');await input('tap',{x:snap.width*(.50+step*.17),y:snap.height*.77,width:1,height:1});
   if(Math.abs(offset)<=2)break;
   if(snap.kind!=='main')throw Error('Kizuna ara zorluk ekranı doğrulanamadı.');
   const intermediate=await openTips(),expected=order[order.indexOf(selectedDifficulty)+step];if(intermediate!==expected)throw Error('Kizuna ara zorluğu beklenen hedefle eşleşmiyor.');
   const ok=word(/^[O0]K$/i,.77,.92);if(!ok)throw Error('Kizuna rehberinin OK düğmesi okunamadı.');await input('tap',ok);selectedDifficulty=intermediate;
  }
  if(snap.kind!=='main')throw Error('Kizuna zorluk seçimi doğrulanamadı.');target={...mainValues(snap.ocr),difficulty,enemyType:await mainType(snap.image,snap.width,snap.height),observedAt:new Date().toISOString()};
  progress('Kizuna TIPS · rehber açılıyor…');const openedDifficulty=await openTips();
  if(!snap.identity||openedDifficulty!==difficulty||!sameName(snap.identity.title,target.title))throw Error('Açılan Kizuna rehberi seçilen boss / zorlukla eşleşmiyor.');
  const info=word(/^INFO$/i,.18,.26);if(!info)throw Error('Kizuna QUEST INFO sekmesi okunamadı.');await input('tap',info);
  for(let i=0;i<8;i++){
   const text=rows(snap.ocr).filter(r=>r.y>=snap.identity.body.top&&r.y<snap.identity.body.top+snap.identity.body.height).map(r=>r.text).join('\n');
   if(!/CONNECT|LOADING/i.test(text)&&/BOSS CHARACTERS|CHARACTER TAG|REQUIREMENT|CONDITIONS/i.test(text))break;
   progress('Kizuna QUEST INFO · yüklenmesi bekleniyor…');await wait(750);check();snap=await observe(exe,device);if(!snap.identity||!sameName(snap.identity.title,target.title))throw Error('Kizuna QUEST INFO hedefi değişti.');
  }
  const {parseRequirement}=require('./quest-restrictions.cjs'),body=snap.identity.body,getInfoBar=()=>require('./scrollbar.cjs').scrollbar(snap.image,body),infoPages=[];let infoComplete=false;
  for(let i=0;(await getInfoBar()).known&&!(await getInfoBar()).top;i++){if(i===8)throw Error('Kizuna QUEST INFO başlangıcı doğrulanamadı.');await input('up',{fraction:.35});}
  for(let i=0;;i++){
   infoPages.push(rows(snap.ocr).filter(r=>r.y>=body.top&&r.y<body.top+body.height).map(r=>r.text).join('\n'));const infoBar=await getInfoBar();
   if(infoBar.bottom||!infoBar.known){infoComplete=true;break;}progress('Kizuna katılım bilgileri · sayfa '+(i+2)+' okunuyor…');await input('down',{fraction:.35});
  }
  const infoText=infoPages.join('\n'),rule=parseRequirement(infoText);
  let restrictions={status:'partial',source:'MuMu Kizuna QUEST INFO',text:infoText,quest:target.title,difficulty,warnings:['Katılım koşulu henüz tam doğrulanmadı.']};
  if(infoComplete&&rule?.complete&&rule?.prefix){const {complete,prefix,...limits}=rule;restrictions={...restrictions,...limits,status:'verified',warnings:[]};}
  else if(infoComplete&&/BOSS CHARACTERS/i.test(infoText)&&/CHARACTER TAG/i.test(infoText)&&!/REQUIREMENT|CONDITIONS|Only.*characters/i.test(infoText))restrictions={...restrictions,status:'verified',text:infoText+'\nTam QUEST INFO listesinde katılım kısıtlaması / REQUIREMENT listelenmiyor.',warnings:[]};
  if(targetOnly){
   const ok=word(/^[O0]K$/i,.77,.92);if(!ok)throw Error('Kizuna bilgi penceresinin OK düğmesi okunamadı.');await input('tap',ok);
   if(snap.kind!=='main')throw Error('Kizuna hedef ekranına dönülemedi.');const current=mainValues(snap.ocr);
   if(!sameName(current.title,target.title)||current.level!==target.level||current.maxHP!==target.maxHP)throw Error('Bilgiler okunurken Kizuna hedefi değişti; yeniden oku.');
   return {target,restrictions,bonusPages,bonusComplete};
  }
  const guide=word(/^GUIDE$/i,.18,.26);if(!guide)throw Error('Kizuna QUEST GUIDE sekmesi okunamadı.');await input('tap',guide);
  for(let i=0;!(await require('./scrollbar.cjs').scrollbar(snap.image,body)).top;i++){
   if(i===12)throw Error('Kizuna QUEST GUIDE listesinin başı doğrulanamadı.');progress('Kizuna rehberi · liste başına dönülüyor…');await input('up',{fraction:.45});
  }
  // Move to the measured BEHAVIOR heading before the shared parser starts.
  for(let i=0;i<16;i++){
   const tokens=require('./boss-behavior-core.cjs').pageTokens(snap.ocr,snap.identity);if(tokens.some(t=>t.kind==='heading')&&tokens.some(t=>t.kind==='battle'))break;
   if(i===15)throw Error('Kizuna BEHAVIOR başlangıcı bulunamadı.');progress('Kizuna rehberi · BEHAVIOR başlangıcı bulunuyor…');await input('down',{fraction:tokens.some(t=>t.kind==='heading')?.14:.43});
  }
  for(let i=0;i<5;i++){
   const heading=rows(snap.ocr).find(r=>/^BEHAVIO[RU]$/i.test(r.text)&&r.y>=body.top);if(!heading){if(i<4&&require('./boss-behavior-core.cjs').pageTokens(snap.ocr,snap.identity).some(t=>t.kind==='battle'&&t.number===1)){await input('up',{fraction:.12});continue;}throw Error('Kizuna BEHAVIOR başlığı kaydırmada kayboldu; aşamalar tahmin edilmedi.');}
   if(heading.y<body.top+body.height*.22)break;
   progress('Kizuna · ilk savaş okuma alanına yerleştiriliyor…');await input('down',{fraction:Math.min(.20,Math.max(.06,(heading.y-body.top-body.height*.14)/body.height))});
  }
  let branches=[];const shared=require('./boss-behavior.cjs'),pageReader=createPageReader({readOCR,readLineOCR}),reader=shared.createBehaviorReader({trackPixels:true,reuseGuardedSnapshot:true,completeAt:tokens=>require('./kizuna-levels.cjs').selectedRangeComplete(tokens,target.level,target.battles),transformTokens:tokens=>{const selected=require('./kizuna-levels.cjs').selectLevelTokens(tokens,target.level);branches=selected.descriptions;return selected.tokens;},marqueeOptions:{readOCR,readLineOCR,readBlockOCR},capture,ocr:async image=>{const value=await pageReader(image);onObserve?.(image,value);return value;},scrollbar:require('./scrollbar.cjs').scrollbar,
   pendingQuestModal:ocr=>!modalIdentity(ocr)||!sameName(modalIdentity(ocr).title,target.title)||/CONNE|LOADING/i.test(ocr.text),
   headerHash:async(image,w,h)=>(await sharp(image).extract({left:Math.round(w*.13),top:Math.round(h*.10),width:Math.round(w*.74),height:Math.round(h*.10)}).removeAlpha().raw().toBuffer()).toString('base64'),difficulty:async()=>difficulty,
   mergeNumbers:options=>require('./behavior-numbers.cjs').mergeNumericRows({...options,readOCR}),
   input:async(exe,device,action,current)=>{check();await act(exe,device,action,{...current,kind:'guide'}, {fraction:.43},check);},wait:async ms=>{check();await wait(ms);check();}});
  const boss=await reader.read(exe,device,progress);check();
  if(!sameName(boss.name,target.title)||boss.stages.at(-1)?.battleNumber!==target.battles)throw Error('Kizuna rehberindeki son Battle, seçilen hedefin savaş sayısıyla eşleşmiyor.');
  boss.restrictions=restrictions;boss.observation.level=target.level;boss.observation.quest=target.title;boss.id=(boss.id+'-'+target.level+'-'+target.enemyType).slice(0,100);boss.difficulty=difficulty+'★ · Lv.'+target.level;
  boss.source='MuMu · Kizuna seçili Lv. rehberi';boss.notes='Kizuna Lv.'+target.level+' için okunan davranış. Son savaşın seçili seviye bloğunun bitişi veya liste sonu doğrulandı; diğer seviyelerin tüm sayfaları taranmış sayılmaz. '+branches.join('; ');boss.observation.warnings=boss.observation.warnings.filter(w=>!w.startsWith('Sayısal boss seviyesi'));
  const last=boss.stages.at(-1);last.enemyType=target.enemyType;if(BigInt(target.maxHP)<=1000000000000000n)last.hp=Number(target.maxHP);
  snap=await observe(exe,device);if(snap.kind!=='guide'||!sameName(snap.identity.title,target.title))throw Error('Okuma sonunda Kizuna rehberi değişti.');
  const ok=word(/^[O0]K$/i,.77,.92);if(!ok)throw Error('Kizuna rehberinin OK düğmesi okunamadı.');await input('tap',ok);
  if(snap.kind!=='main')throw Error('Rehber okumasından sonra Kizuna hedef ekranına dönülemedi.');const current=mainValues(snap.ocr);
  if(!sameName(current.title,target.title)||current.level!==target.level||current.maxHP!==target.maxHP)throw Error('Rehber okunurken Kizuna hedefi değişti; yeniden oku.');
  target={...target,remainingHP:current.remainingHP,observedAt:new Date().toISOString()};
  return {target,boss,bonusPages,bonusComplete};
 }
 return {read,observe};
}
function createLiveReader({onObserve}={}){
 const capture=async(exe,device)=>{const image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),m=await sharp(image).metadata();return {image,width:m.width,height:m.height};};
 return createReader({capture,onObserve,readLineOCR:require('./line-ocr.cjs').readLineOCR,readBlockOCR:require('./line-ocr.cjs').readBlockOCR,act:async(exe,device,action,snap,rect,check)=>{
  const binary=adb.validateAdb(exe),serial=adb.validateDevice(device),opts={windowsHide:true,timeout:10000,maxBuffer:1024*1024};
  const current=await capture(exe,device);check();const b=snap.identity?.body||(snap.kind==='trusty'?{left:Math.round(snap.width*.112),top:Math.round(snap.height*.289),width:Math.round(snap.width*.784),height:Math.round(snap.height*.44)}:null),area=b?{left:Math.round(snap.width*.13),top:Math.round(snap.height*.10),width:Math.round(snap.width*.74),height:Math.round(snap.height*.10)}:{left:Math.round(snap.width*.03),top:Math.round(snap.height*.61),width:Math.round(snap.width*.94),height:Math.round(snap.height*.08)};
  const a=await sharp(snap.image).extract(area).resize(64,12).removeAlpha().raw().toBuffer(),z=await sharp(current.image).extract(area).resize(64,12).removeAlpha().raw().toBuffer();if(a.length!==z.length||a.reduce((n,v,i)=>n+Math.abs(v-z[i]),0)/a.length>8)throw Error('Kizuna başlığı / hedefi değişti; hareket durduruldu.');
  const activity=(await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],opts)).stdout;if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(activity))throw Error('Global OPTC ön planda değil.');
  let args;if(action==='tap'||action==='hold'){const x=String(Math.round(rect.x+rect.width/2)),y=String(Math.round(rect.y+rect.height/2));args=action==='tap'?['tap',x,y]:['swipe',x,y,x,y,'1100'];}
  else if(['down','up'].includes(action)&&b){const x=Math.round(b.left+b.width*.5),low=Math.round(b.top+b.height*.80),high=Math.round(low-b.height*(rect?.fraction||.30));args=['swipe',String(x),String(action==='down'?low:high),String(x),String(action==='down'?high:low),'650'];}
  else throw Error('Kizuna bilgi hareketi doğrulanamadı.');check();await execute(binary,['-s',serial,'shell','input',...args],opts);
 }});
}
module.exports={sameName,enrichTitle,screenKind,mainValues,mainType,createPageReader,createReader,createLiveReader};
