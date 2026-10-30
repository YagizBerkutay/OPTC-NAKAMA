const sharp=require('sharp'),{createHash}=require('node:crypto'),{execFile}=require('node:child_process'),execute=require('node:util').promisify(execFile);
const adb=require('./adb.cjs'),{createRumbleIO,kind}=require('./assault-rumble.cjs'),{readRumbleInfo}=require('./rumble-info.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const crop=(s,x,y,w,h)=>({left:Math.round(s.width*x),top:Math.round(s.height*y),width:Math.round(s.width*w),height:Math.round(s.height*h)});
const centers=[82,184,286,388,490,610,713,816].map(x=>x/900),types=['STR','DEX','QCK','PSY','INT'];
const digest=b=>createHash('sha256').update(b).digest('hex');
async function rosterSignature(s){const parts=await Promise.all(centers.flatMap(x=>[sharp(s.image).extract(crop(s,x-.025,.411,.05,.019)).removeAlpha().resize(20,12).raw().toBuffer(),sharp(s.image).extract(crop(s,x-.03,.437,.06,.012)).removeAlpha().resize(20,8).raw().toBuffer()]));parts.push(await sharp(s.image).extract(crop(s,.61,.317,.34,.045)).removeAlpha().resize(60,16).raw().toBuffer());return Buffer.concat(parts).toString('base64');}
function sameRoster(a,b){const x=Buffer.from(a,'base64'),y=Buffer.from(b,'base64');return x.length===y.length&&x.reduce((n,v,i)=>n+Math.abs(v-y[i]),0)/x.length<8;}
async function readRoster(s,io){
 const slots=[],{data,info}=await sharp(s.image).removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const [slot,x]of centers.entries()){
  const cx=(x-30/900)*s.width,cy=s.height*641/1600,radius=s.width*9.5/900,counts=Object.fromEntries(types.map(t=>[t,0]));let colored=0,bright=0;
  for(let y=Math.floor(cy-radius);y<=Math.ceil(cy+radius);y++)for(let xx=Math.floor(cx-radius);xx<=Math.ceil(cx+radius);xx++){
   if((xx-cx)**2+(y-cy)**2>radius**2)continue;const i=(y*info.width+xx)*info.channels,r=data[i],g=data[i+1],b=data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(min>160)bright++;if(max<85||d/max<.4)continue;
   let hue=max===r?60*((g-b)/d%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);if(hue<0)hue+=360;counts[hue<32||hue>=345?'STR':hue<75?'PSY':hue<170?'DEX':hue<270?'QCK':'INT']++;colored++;
  }
  const [type,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0],scale=(s.width/900)**2;
  if(colored>80*scale&&count/colored>.7){slots.push({slot,types:[type]});continue;}
  // Empty slots have neither the type medallion nor a level label. Unknown portraits fail closed.
  if(colored<10*scale&&bright<10*scale)continue;
  throw Error('Rakibin '+(slot+1)+'. yuvası doğrulanamadı; yeni ekranla tekrar oku.');
 }
 if(!slots.some(s=>s.slot<5))throw Error('Aktif rakip kadrosu okunamadı.');return slots;
}
async function readBonus(s,io,check=()=>{}){
 const values={};
 for(const [i,type]of types.entries()){
  const image=await sharp(s.image).extract(crop(s,(100+i*145)/900,.317,130/900,.038)).png().toBuffer(),[a,b]=await Promise.all([io.ocr(image,{scale:3}),io.line(image,{scale:3})]);check();
  const number=t=>{const m=t.replace(/\s/g,'').match(/^\+?(\d{1,3})%$/);return m?Number(m[1]):null;},av=number(a.text),bv=number(b.text);
  let value=av!==null&&av===bv?av:null;
  if(value===null){const rect=crop(s,(177+i*145)/900,.323,53/900,.028),confirmed=await require('./assault-rumble-ocr.cjs').verifyNumberCrop(s.image,rect,{read:io.ocr,line:io.line,check,percentExpected:true,contextRect:crop(s,(100+i*145)/900,.317,130/900,.038)});value=confirmed?Number(confirmed.replace('%','')):null;}
  if(value===null)throw Error(type+' PKA tip bonusu iki okumada doğrulanamadı.');values[type]=value;
 }
 return values;
}
function createPkaRumbleReader(io){
 let active;const wait=io.wait||pause,detailsCache=new Map();
 const cancel=()=>{if(active)active.cancelled=true;return true;};
 async function read(input,progress=()=>{}){
  if(active){if(!active.cancelled)throw Error('PKA Rumble okuması sürüyor.');await active.finished;}
  if(!input||typeof input.exe!=='string'||typeof input.device!=='string'||input.refresh!==undefined&&typeof input.refresh!=='boolean')throw Error('PKA Rumble okuma isteği geçersiz.');
  let finish;const token={cancelled:false,finished:new Promise(r=>finish=r)};active=token;
  const check=()=>{if(token.cancelled)throw Error('PKA Rumble okuma iptal edildi.');},update=t=>{check();progress(t);};
  const observe=async()=>{check();const s=await io.capture(input.exe,input.device);s.ocr=await io.ocr(s.image);check();if(kind(s)==='unknown'){
   const head=await io.ocr(s.image,{crop:crop(s,.02,.165,.72,.062),scale:2});s.ocr.text+='\n'+head.text;if(!/Oppone/i.test(s.ocr.text)){const line=await io.line(await sharp(s.image).extract(crop(s,.02,.178,.60,.039)).png().toBuffer());s.ocr.text+='\n'+line.text;}
   if(/Oppone/i.test(s.ocr.text)){const button=await io.ocr(s.image,{crop:crop(s,.02,.79,.21,.105),scale:2});s.ocr.text+='\n'+button.text;}
  }return s;};
  const screen=s=>kind(s)==='info'?'info':kind(s)==='detail'?'detail':/Type Bonus/i.test(s.ocr.text)&&/Buddy Character Stats/i.test(s.ocr.text)?'bonus':/Oppone/i.test(s.ocr.text)&&/BONUS/i.test(s.ocr.text)?'opponent':'unknown';
  const settle=async expected=>{let previous,unchanged=Date.now();for(;;){const s=await observe();if(screen(s)===expected)return s;const signature=s.ocr.text.replace(/\d+:\d+/g,'');if(previous!==signature)unchanged=Date.now();else if(Date.now()-unchanged>10000&&!/CONNECTING|LOADING/i.test(signature))throw Error('PKA Rumble bilgi ekranı doğrulanamadı: '+expected);previous=signature;await wait(300);check();}};
  const move=async(s,action)=>{check();await io.pkaInput(input.exe,input.device,s,action,{check,screen:screen(s)});check();await wait(350);};
  try{
   update('PKA Rumble rakip ekranı doğrulanıyor…');let s=await observe();if(screen(s)==='unknown'&&/BONUS|CONNECTING/i.test(s.ocr.text))s=await settle('opponent');if(screen(s)==='detail'){await move(s,'closeDetail');s=await settle('info');}if(screen(s)==='info'){await move(s,'backInfo');s=await settle('opponent');}if(screen(s)==='bonus'){await move(s,'closeBonus');s=await settle('opponent');}
   if(screen(s)!=='opponent')throw Error('PKA içindeki Confirm Opponent ekranını aç; rakip ve BONUS düğmesi görünmeli.');
   let slots;const votes=new Map(),initialSignature=await rosterSignature(s);for(;;){try{const candidate=await(io.roster||readRoster)(s,io),key=JSON.stringify(candidate),count=(votes.get(key)||0)+1;votes.set(key,count);if(count>=3){slots=candidate;break;}update('Rakip yuvaları ve tipleri ayrı karelerde doğrulanıyor…');}catch(error){if(!/yuvası doğrulanamadı/.test(error.message))throw error;update('Rakip tip simgesinin animasyonu bekleniyor…');}await wait(350);s=await settle('opponent');if(!sameRoster(await rosterSignature(s),initialSignature))throw Error('Rakip kadrosu doğrulama sırasında değişti.');}
   const signature=await rosterSignature(s);check();
   const header=await io.ocr(s.image,{crop:crop(s,.60,.31,.36,.06),scale:2}),opponent=header.text.trim()||'PKA rakibi';
   update('PKA Buddy tip bonusları okunuyor…');await move(s,'bonus');s=await settle('bonus');const bonus=await(io.bonus||readBonus)(s,io,check);await move(s,'closeBonus');s=await settle('opponent');
   const unchanged=async snap=>{if(!sameRoster(await rosterSignature(snap),signature))throw Error('Rakip kadrosu okuma sırasında değişti; eski rakibe göre takım kurulmadı.');};await unchanged(s);
   const enemies=[],warnings=['Standart Pirate Rumble Rules bu karşılaşmaya uygulanmaz.','Trusty / Bonus Hex PvE stat, CD, DLB ve eşya bonusları Rumble takımına taşınmadı.','Buddy tip bonusları Rumble’da geçerlidir. DEF / SPD dahil kesin istatistik kapsamı doğrulanmadığı için bonuslu yorum ayrıca karşılaştırılır.'];
   for(const {slot,types}of slots){
    update('Rakip '+(slot+1)+' / '+slots.length+' · Rumble ayrıntıları okunuyor…');await move(s,'enemy:'+slot);s=await settle('info');
    const name=await io.ocr(s.image,{crop:crop(s,.026,.399,.75,.052),scale:2});check();const selected=name.text.trim().replace(/\s+/g,' ');if(!selected)throw Error('Rakip karakterinin adı okunamadı.');
    const result=await readRumbleInfo({...io,catalog:undefined},{snap:s,selected,warnings,check,update,move,observe,settle,input,last:detailsCache.get(selected),cachePrefix:['pka-rumble',new Date().toISOString().slice(0,10),io.data?.metadata?.sha],onCached:()=>warnings.push(selected+' · ad / seviye / sınıf / değerler yeniden doğrulandı; aynı oturumun ayrıntıları kullanıldı.')});s=result.snap;
    const enemy={...result.enemy,slot,types,complete:!!result.enemy.level&&result.enemy.classes.length>0&&Object.keys(result.enemy.stats).length===5&&Object.keys(result.enemy.details).length===5};
    enemies.push(enemy);await move(s,'backInfo');s=await settle('opponent');await unchanged(s);check();if(enemy.complete){detailsCache.set(selected,{key:result.cacheKey,enemy:structuredClone(enemy)});while(detailsCache.size>64)detailsCache.delete(detailsCache.keys().next().value);}
   }
   const observedAt=new Date().toISOString(),context={version:1,mode:'pka-rumble',opponent,enemies,bonus,limits:{main:5,sub:3,cost:300},source:'MuMu · PKA Confirm Opponent / BONUS / Character Details',observedAt,warnings};
   context.fingerprint=digest(JSON.stringify({opponent,enemies,bonus}));update('PKA rakibi ve Buddy bonusları hazır; kutudaki takımlar karşılaştırılıyor…');check();return context;
  }finally{if(active===token)active=undefined;finish();}
 }
 return {read,cancel};
}
function createPkaRumbleService(options={}){
 const io=createRumbleIO(options);
 io.pkaInput=async(exe,device,s,action,{check,screen})=>{
  const spec={backInfo:['info',.085,.125],closeDetail:['detail',.5,.786],bonus:['opponent',.118,.838],closeBonus:['bonus',.5,.845],'detail:special':['info',.095,.522],'detail:ability':['info',.095,.597],'detail:pattern':['info',.095,.671],'detail:priority':['info',.095,.745],'detail:resistance':['info',.095,.819]}[action],slot=/^enemy:([0-7])$/.exec(action);
  const seek=/^seekSkill:(\d{1,2}):(5|10)$/.exec(action),scroll=['scrollDetail','scrollDetailUp'].includes(action);
  if(!spec&&!slot&&!scroll&&!seek||spec&&spec[0]!==screen||slot&&screen!=='opponent'||(scroll||seek)&&screen!=='detail')throw Error('PKA bilgi hareketi doğrulanmadı: '+action);
  check();const binary=adb.validateAdb(exe),serial=adb.validateDevice(device),opts={windowsHide:true,timeout:10000,maxBuffer:2*1024*1024},activity=(await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],opts)).stdout;
  if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(activity))throw Error('Global OPTC ön planda değil.');
  const current=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),rect=crop(s,screen==='detail'?.39:.19,screen==='opponent'?.176:screen==='info'?.11:screen==='bonus'?.13:.765,screen==='detail'?.22:.53,.035),small=async image=>sharp(image).extract(rect).greyscale().resize(80,12).raw().toBuffer(),[a,b]=await Promise.all([small(s.image),small(current)]);
  if(a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0)/a.length>12){
   if(screen==='opponent'){const bonus=await io.ocr(current,{crop:crop(s,.02,.79,.21,.105),scale:2});if(!/BONUS/.test(bonus.text)||!sameRoster(await rosterSignature({...s,image:current}),await rosterSignature(s)))throw Error('PKA rakip ekranı değişti; giriş gönderilmedi.');}
   else {const title=await io.ocr(current,{crop:rect,scale:2}),expected={info:/Character Details/i,bonus:/Bonus/i,detail:/[O0]K/i};if(!expected[screen]?.test(title.text))throw Error('PKA ekranı değişti; giriş gönderilmedi.');}
  }
  if(slot&&!sameRoster(await rosterSignature({...s,image:current}),await rosterSignature(s)))throw Error('Rakip kadrosu değişti; portre açılmadı.');
  let args;if(slot){const x=String(Math.round(s.width*centers[Number(slot[1])])),y=String(Math.round(s.height*.4219));args=['swipe',x,y,x,y,'650'];}else if(spec)args=['tap',String(Math.round(s.width*spec[1])),String(Math.round(s.height*spec[2]))];else if(seek){const layout=await require('./assault-details.cjs').detailLayout(current),bar=layout?.scrollbar,level=Number(seek[1]),max=Number(seek[2]);if(!bar||!Number.isInteger(bar.thumbStart)||!Number.isInteger(bar.thumbEnd)||level<3||level>max)return;const half=(bar.thumbEnd-bar.thumbStart)/2,from=(bar.thumbEnd+bar.thumbStart)/2,to=bar.start+half+(bar.end-bar.start-half*2)*(level-2)/max;args=['swipe',String(bar.x),String(Math.round(from)),String(bar.x),String(Math.round(to)),'500'];}else args=['swipe',String(Math.round(s.width*.73)),String(Math.round(s.height*(action==='scrollDetailUp'?.38:.70))),String(Math.round(s.width*.73)),String(Math.round(s.height*(action==='scrollDetailUp'?.70:.38))),'450'];
  check();await execute(binary,['-s',serial,'shell','input',...args],opts);
 };
 io.seekSkill=async(s,level,max,{check,input})=>{await io.pkaInput(input.exe,input.device,s,'seekSkill:'+level+':'+max,{check,screen:'detail'});await pause(350);};
 io.verifyInfo=async(a,b)=>{for(const region of [[.026,.399,.75,.052],[.52,.224,.455,.164]]){const rect=crop(a,...region),sample=async s=>sharp(s.image).extract(rect).greyscale().resize(120,40).raw().toBuffer(),[x,y]=await Promise.all([sample(a),sample(b)]);if(x.reduce((n,v,i)=>n+Math.abs(v-y[i]),0)/x.length>8)throw Error('Ayrıntı okunurken rakip karakteri veya değerleri değişti.');}};
 return createPkaRumbleReader(io);
}
module.exports={createPkaRumbleReader,createPkaRumbleService,readRoster,readBonus,rosterSignature};
