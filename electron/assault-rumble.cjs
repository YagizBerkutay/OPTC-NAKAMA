const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile),adb=require('./adb.cjs'),{ocrBuffer}=require('./rule-ocr.cjs'),{readLineOCR,readBlockOCR}=require('./line-ocr.cjs');
const {parseAssaultHome,parseSkillSection,skillLevel,normalize,wordRect}=require('./assault-rumble-core.cjs'),{readVerifiedRules,readVerifiedRulePage,verifyNumberCrop}=require('./assault-rumble-ocr.cjs');
const {readStaticSkill}=require('./assault-details.cjs');
const {readTrustyPortraits,rulesAtBottom}=require('./assault-trusty.cjs'),{createHash}=require('node:crypto');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),canonical=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const crop=(snap,x,y,w,h)=>({left:Math.round(snap.width*x),top:Math.round(snap.height*y),width:Math.round(snap.width*w),height:Math.round(snap.height*h)});
const kind=s=>/Character Details/i.test(s.ocr.text)&&s.ocr.lines.flatMap(l=>l.words||[]).some(w=>/^[O0]K$/i.test(w.text)&&w.x>s.width*.35&&w.x<s.width*.65&&w.y>s.height*.75&&w.y<s.height*.83)?'detail':/Special Rules Effect/i.test(s.ocr.text)?'rules':/Assault Rumble Tea/i.test(s.ocr.text)&&/SUB CHARACTER|TOTAL COST/i.test(s.ocr.text)?'setup':/\b[O0]K\b/i.test(s.ocr.text)&&/RUMBLE SPECIAL|RUMBLE ABILIT(?:Y|IES)|RESISTANCE|TARGET PRIORITY|BEHAVIOR PATTERN/i.test(s.ocr.text)?'detail':/Character Details/i.test(s.ocr.text)&&/COMBAT|TARGET PRIORITY|BEHAVIOR PATTERN/i.test(s.ocr.text)?'info':parseAssaultHome(s.ocr.text)?'home':'unknown';
const {statsFrom,mergePages}=require('./rumble-info.cjs');
function createAssaultReader(io){
 let active,last;const wait=io.wait||pause;
 const cancel=()=>{if(active)active.cancelled=true;return true;};
 async function read(input,progress=()=>{}){
  if(active){if(!active.cancelled)throw Error('Assault okuması zaten sürüyor.');await active.finished;}
  if(!input||typeof input.exe!=='string'||typeof input.device!=='string'||input.refresh!==undefined&&typeof input.refresh!=='boolean')throw Error('Assault okuma isteği geçersiz.');
  let finish;const token={cancelled:false,finished:new Promise(resolve=>finish=resolve)};active=token;const check=()=>{if(token.cancelled)throw Error('Assault okuma iptal edildi.');},update=s=>{check();progress(s);};
  const observe=async()=>{check();const snap=await io.capture(input.exe,input.device);check();snap.ocr=await io.ocr(snap.image);check();
   if(kind(snap)==='unknown'&&!/Character Details|Special Rules Effect|About Assault/i.test(snap.ocr.text)){
    const buttons=await io.ocr(snap.image,{crop:crop(snap,.02,.70,.96,.115),scale:2});check();snap.ocr.text+='\n'+buttons.text;
   }
   if(/\bSETUP\b/i.test(snap.ocr.text)&&/\bRULES\b|Assault\s+L[vV]/i.test(snap.ocr.text)&&!/Special Rules Effect/i.test(snap.ocr.text)){
    const part=crop(snap,.65,.208,.322,.033),image=await sharp(snap.image).extract(part).png().toBuffer(),level=await io.line(image);check();
    const found=level.text.match(/Assault\s+L[vV][.]?\s*(MAX|\d{1,3})\b/i),old=[...snap.ocr.text.matchAll(/Assault\s+L[vV][.]?\s*(MAX|\d{1,3})\b/gi)];
    if(found){if(old.length>1||old.length===1&&old[0][1].toUpperCase()!==found[1].toUpperCase())throw Error('Assault seviye okumaları çelişiyor.');if(!old.length)snap.ocr.text+='\n'+found[0];}
   }
   if(kind(snap)==='unknown'){
    const title=await io.line(await sharp(snap.image).extract(crop(snap,.12,.155,.76,.045)).png().toBuffer());check();snap.ocr.text+='\n'+title.text;
   }
   return snap;
  };
  const move=async(snap,action)=>{check();await io.input(input.exe,input.device,snap,action,{check});check();await wait(350);};
  const settle=async(expected)=>{let snap,previous,changed=Date.now();for(;;){snap=await observe();if(kind(snap)===expected)return snap;const key=canonical(snap.ocr.lines.filter(l=>l.words?.some(w=>w.y>snap.height*.2&&w.y<snap.height*.85)).map(l=>l.text).join(' '));if(previous!==key)changed=Date.now();else if(Date.now()-changed>10000&&!/connect|loading/i.test(snap.ocr.text))throw Error('Assault ekran geçişi doğrulanamadı: '+expected);previous=key;await wait(350);check();}};
  const leave=async snap=>{const k=kind(snap);if(k==='rules')await move(snap,'closeRules');else if(k==='info')await move(snap,'backInfo');else if(k==='setup')await move(snap,'backSetup');else if(k==='detail'){await move(snap,'closeDetail');snap=await settle('info');await move(snap,'backInfo');}else if(k!=='home')throw Error('MuMu’da Assault Rumble ana ekranını aç.');return settle('home');};
  try{
   update('Assault Rumble ve mevcut seviye doğrulanıyor…');let home=await observe();if(kind(home)!=='home')home=await leave(home);
   const identity=parseAssaultHome(home.ocr.text);if(!identity)throw Error('Assault seviyesi okunamadı.');
   await move(home,'homeRules');let snap=await settle('rules');update('Sabit Rules paneli ve yüzdeler doğrulanıyor…');
   const mainBody=crop(snap,.1055,.2625,.761,.32625);let rules;
   try{rules=await io.rules(snap.image,mainBody,{check});}catch(first){
    // A longer future event may need overlap-preserving page reads.
    if(!/sonu|tam çözümlenemedi/.test(first.message))throw first;
    let text='',previous;for(;;){check();const page=await io.rulePage(snap.image,crop(snap,.105,.248,.775,.48),{check});text=mergePages(text,page.text);
     try{rules=require('./assault-rumble-core.cjs').parseAssaultRules(text);break;}catch(error){if(previous===normalize(page.text)||io.rulesBottom&&await io.rulesBottom(snap.image))throw error;}
     previous=normalize(page.text);await move(snap,'scrollRules');snap=await settle('rules');
    }
   }
   check();const warnings=['Bonusların birlikte toplanma / çarpılma biçimi doğrulanmadı; alt / üst yorumlar karşılaştırılır.','Son '+rules.lateSeconds+' saniyedeki CT / hasar artışının miktarı yazmıyor; sayısal bonus eklenmedi.'];
   const context={version:1,mode:'assault',...rules,...identity,selectedBoss:rules.bosses[0],observedAt:new Date().toISOString(),source:'MuMu · Global Assault Rumble · Rules / INFO / DETAILS',warnings,limits:{main:5,sub:3,cost:300,verified:false},enemies:{},trusty:{ownershipOnly:true,entries:[],complete:false}};
   if(io.trusty){
    update('Trusty sahiplik listesi kontrol ediliyor…');let previous,partial=false;
    for(;;){const area=crop(snap,.105,.248,.775,.484),page=await io.ocr(snap.image,{crop:area,scale:2}),result=await io.trusty(snap.image,page);check();
     for(const entry of result.entries)if(!context.trusty.entries.some(e=>e.id===entry.id))context.trusty.entries.push(entry);
     if(result.frames.length&&!result.complete)partial=true;
     if(await io.rulesBottom(snap.image)){context.trusty.complete=!partial&&result.frames.length>0;break;}
     const hash=createHash('sha256').update(await sharp(snap.image).extract(area).raw().toBuffer()).digest('hex');if(hash===previous){warnings.push('Trusty listesinin sonu doğrulanamadı; sahiplik çarpanı kesinleştirilmedi.');break;}previous=hash;
     await move(snap,'scrollRules');snap=await settle('rules');
    }
   }
   await move(snap,'closeRules');home=await settle('home');const returned=parseAssaultHome(home.ocr.text);if(JSON.stringify(returned)!==JSON.stringify(identity))throw Error('Assault seviyesi okuma sırasında değişti.');
   update('Boss kimliği ve sabit ayrıntı pencereleri okunuyor…');await move(home,'homeInfo');snap=await settle('info');
   const matching=rules.bosses.filter(b=>new RegExp('\\b'+b.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(snap.ocr.text));if(matching.length!==1)throw Error('INFO bossu Rules listesindeki tek bir hedefle eşleştirilemedi.');
   const selected=matching[0];context.selectedBoss=selected;
   const info=await require('./rumble-info.cjs').readRumbleInfo(io,{snap,selected,warnings,check,update,move,observe,settle,input,last,cachePrefix:[rules.fingerprint,identity],onCached:()=>context.cached=true});
   snap=info.snap;const {enemy,cacheKey}=info,character=enemy.id;
   context.enemies[selected]=enemy;if(!character)warnings.push(selected+' tam kart formu yerel kaynakla eşleşmedi; farklı formun yetenekleri kullanılmadı.');
   warnings.push('INFO seçili boss kartını gösterir; rakibin bütün kadrosu ve hareketleri doğrulanmadığından kesin galibiyet / Assault Score hesaplanmaz.');
   await move(snap,'backInfo');home=await settle('home');
   update('Assault kadro maliyeti ve slot sınırları doğrulanıyor…');await move(home,'homeSetup');snap=await settle('setup');
   const cost=await io.ocr(snap.image,{crop:crop(snap,.61,.68,.36,.063),scale:3}),costMatch=cost.text.match(/\b\d+\s*\/\s*(\d{2,3})\b/);check();
   if(costMatch&&Number(costMatch[1])>=1&&Number(costMatch[1])<=500&&/MAIN CHARACTER/i.test(snap.ocr.text)&&/SUB CHARACTER/i.test(snap.ocr.text)){context.limits.cost=Number(costMatch[1]);context.limits.verified=true;}
   if(!context.limits.verified)warnings.push('SETUP maliyet sınırı tam okunamadı; 300 sınırındaki adaylar geçici olarak gösterilir.');
   await move(snap,'backSetup');home=await settle('home');if(JSON.stringify(parseAssaultHome(home.ocr.text))!==JSON.stringify(identity))throw Error('Assault seviyesi değişti; önceki okuma uygulanmadı.');
   warnings.push('Trusty yalnız sahip olma bonusudur. Tam kart listesi / toplam çarpan doğrulanmadı; kadro slotu ayrılmadı.');check();last={key:cacheKey,enemy:structuredClone(enemy)};
   update(selected+' · Rules ve boss ayrıntıları hazır.');return context;
  }finally{if(active===token)active=undefined;finish();}
 }
 return {read,cancel};
}
const actions={homeRules:['home',.12,.788],homeInfo:['home',.095,.337],closeRules:['rules',.50,.794],homeSetup:['home',.88,.746],backSetup:['setup',.085,.193],backInfo:['info',.085,.125],closeDetail:['detail',.50,.80],'detail:special':['info',.095,.522],'detail:ability':['info',.095,.597],'detail:pattern':['info',.095,.671],'detail:priority':['info',.095,.745],'detail:resistance':['info',.095,.819]};
function createRumbleIO({dataDir=path.join(__dirname,'../dist/data'),onObserve}={}){
 const catalog=JSON.parse(fs.readFileSync(path.join(dataDir,'catalog.json'),'utf8')),data=JSON.parse(fs.readFileSync(path.join(dataDir,'planner.json'),'utf8'));
 return {catalog,data,
  capture:async(exe,device)=>{const image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),meta=await sharp(image).metadata();return {image,width:meta.width,height:meta.height};},
  ocr:async(image,options)=>{const result=await ocrBuffer(image,options);onObserve?.(image,result,options);return result;},line:readLineOCR,block:readBlockOCR,rules:readVerifiedRules,rulePage:readVerifiedRulePage,staticSkill:readStaticSkill,trusty:(image,ocr)=>readTrustyPortraits(image,ocr,dataDir),rulesBottom:rulesAtBottom,number:verifyNumberCrop,
  input:async(exe,device,snap,action,{check=()=>{}}={})=>{
   check();
   const binary=adb.validateAdb(exe),serial=adb.validateDevice(device),options={windowsHide:true,timeout:10000,maxBuffer:2*1024*1024};
   const {stdout}=await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],options);if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(stdout))throw Error('Global OPTC ön planda değil.');
   const state=kind(snap),spec=actions[action];if(!spec&&!['scrollRules','scrollDetail'].includes(action)||spec&&spec[0]!==state&&!(spec[0]==='detail'&&/\b[O0]K\b/i.test(snap.ocr.text)))throw Error('Assault hareketi için ekran doğrulanamadı: '+action);
   const w=snap.width,h=snap.height;if(!Number.isInteger(w)||!Number.isInteger(h)||w<200||h<200||w>4096||h>4096)throw Error('Assault ekran boyutu geçersiz.');
   const current=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),guard=crop(snap,state==='home'?.64:.20,{home:.208,rules:.165,info:.11,detail:.20,setup:.18}[state]??.16,state==='home'?.33:.60,.035);
   const small=async b=>sharp(b).extract(guard).greyscale().resize(80,12,{fit:'fill'}).raw().toBuffer(),[a,b]=await Promise.all([small(snap.image),small(current)]);if(a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0)/a.length>12){
    const titleGuard=state==='setup'?crop(snap,.13,.17,.65,.063):state==='info'?crop(snap,.14,.10,.64,.06):guard;
    const title=await ocrBuffer(current,{crop:titleGuard,scale:2}),expected={setup:/Assault Rumble Team/i,info:/Character Details/i,rules:/Special Rules Effect/i};
    if(!expected[state]?.test(title.text)){
     const fresh=await ocrBuffer(current);onObserve?.(current,fresh,{guard:true});if(state!=='setup'||kind({...snap,ocr:fresh})!=='setup')throw Error('Assault ekranı değişti; giriş gönderilmedi.');
    }
   }
   let args;if(spec){const ok=/^close/.test(action)?wordRect(snap.ocr,/^[O0]K$/i,.35,.87):null;if(/^close/.test(action)&&!ok)throw Error('Ayrıntının OK düğmesi tekil olarak doğrulanamadı.');args=['tap',String(Math.round(ok?ok.x+ok.width/2:w*spec[1])),String(Math.round(ok?ok.y+ok.height/2:h*spec[2]))];}else {if(action==='scrollRules'&&state!=='rules'||action==='scrollDetail'&&!/\b[O0]K\b/i.test(snap.ocr.text))throw Error('Kaydırma alanı doğrulanamadı.');args=['swipe',String(Math.round(w*.73)),String(Math.round(h*.69)),String(Math.round(w*.73)),String(Math.round(h*.52)),'450'];}
   check();await execute(binary,['-s',serial,'shell','input',...args],options);
  }
 };
}
const createAssaultService=options=>createAssaultReader(createRumbleIO(options));
module.exports={createAssaultReader,createAssaultService,createRumbleIO,statsFrom,mergePages,kind};
