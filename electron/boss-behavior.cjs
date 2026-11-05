const sharp=require('sharp'),crypto=require('node:crypto'),adb=require('./adb.cjs'),{ocrBuffer}=require('./rule-ocr.cjs');
const {execFile}=require('node:child_process'),{promisify}=require('node:util'),execute=promisify(execFile);
const {modalIdentity,pageTokens,mergeTokens,encounterFromTokens,rows}=require('./boss-behavior-core.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const {estimateScroll,collectMarquee,createScrollAlignment}=require('./behavior-tracking.cjs');
const {scrollbar}=require('./scrollbar.cjs');
const triggerCache=new Map();
async function headerHash(image,width,height,identity,ocr){if(identity&&!['pka','coop'].includes(identity.mode))return require('./quest-header.cjs').questHeaderHash(image,width,height,identity,ocr);return (await sharp(image).extract({left:Math.round(width*.14),top:Math.round(height*.105),width:Math.round(width*.70),height:Math.round(height*.095)}).removeAlpha().raw().toBuffer()).toString('base64');}
function sameHeader(a,b){if(typeof a!=='string'||typeof b!=='string')return false;if(a.startsWith('quest-header:')||b.startsWith('quest-header:'))return require('./quest-header.cjs').sameQuestHeader(a,b,sameHeader);if(a===b)return true;const x=Buffer.from(a,'base64'),y=Buffer.from(b,'base64');if(x.length!==y.length||x.length<100)return false;let different=0;for(let i=0;i<x.length;i++)if(Math.abs(x[i]-y[i])>12&&++different>24)return false;return true;}
const sameQuestModal=(a,b)=>require('./quest-header.cjs').sameQuestModal(a,b,sameHeader);
async function difficultyNumber(image,identity,signal){
  const row=identity.difficultyRow;if(!row)return null;const word=row.words.find(w=>/Difficulty/i.test(w.text));if(!word)return null;
  const meta=await sharp(image).metadata(),digits=row.words.filter(w=>w.x>word.x+word.width+meta.width*.06);let left=digits.length?Math.min(...digits.map(w=>w.x))-6:word.x+word.width+meta.width*.07,right=digits.length?Math.max(...digits.map(w=>w.x+w.width))+6:left+meta.width*.13;
  // The centered star moves with numeral width. Isolate its coloured column run
  // before OCR instead of allowing the star to become a spurious leading digit.
  const area={left:Math.round(word.x+word.width+meta.width*.035),top:Math.round(word.y-6),width:Math.round(meta.width*.20),height:Math.round(word.height+12)};
  if(area.left+area.width<=meta.width&&area.top>=0&&area.top+area.height<=meta.height){
   const {data,info}=await sharp(image).extract(area).removeAlpha().raw().toBuffer({resolveWithObject:true}),runs=[];
   for(let x=0;x<info.width;x++){let ink=0;for(let y=0;y<info.height;y++){const p=(y*info.width+x)*info.channels,r=data[p],g=data[p+1],b=data[p+2];if(Math.max(r,g,b)>180&&Math.max(r,g,b)-Math.min(r,g,b)>100)ink++;}if(ink>=2){const last=runs.at(-1);if(last&&x-last.end<=2)last.end=x;else runs.push({start:x,end:x});}}
   if(runs.length>=2&&runs.length<=3&&runs[0].end-runs[0].start>=14){left=area.left+runs[0].end+4;right=area.left+runs.at(-1).end+8;}
  }
  const crop={left:Math.round(left),top:Math.round(word.y-6),width:Math.round(right-left),height:Math.round(word.height+12)};
  if(crop.left+crop.width>meta.width||crop.top<0)return null;
  const values=[];
  for(const threshold of [60,80,100,140]){
    const digit=await sharp(image).extract(crop).removeAlpha().grayscale().threshold(threshold).negate().resize({height:86}).png().toBuffer();const dm=await sharp(digit).metadata();
    const composite=await sharp({create:{width:355+dm.width,height:125,channels:3,background:'white'}}).composite([{input:Buffer.from('<svg width="340" height="125"><text x="10" y="96" font-family="Segoe UI" font-size="64">Difficulty</text></svg>'),left:0,top:0},{input:digit,left:340,top:20}]).png().toBuffer();
    const text=(await ocrBuffer(composite,{signal})).text.replace(/\bDifficulty\b/gi,'').trim();const n=Number(/^\d[\d\s]*$/.test(text)?text.replace(/\s/g,''):NaN);values.push(n>=1&&n<=20?n:null);
  }
  const valid=values.filter(v=>v!==null);return valid.length>=2&&new Set(valid).size===1?valid[0]:null;
}
async function readBehaviorPage(image,headerOCR,readLineOCR,signal,readOCR=ocrBuffer){
  const read=(source,options={})=>readOCR(source,{...options,signal:options.signal||signal}),line=readLineOCR&&((source,options={})=>readLineOCR(source,{...options,signal:options.signal||signal}));
  const ocr=await require('./boss-glyph.cjs').correctBattleDigits(image,await require('./pka-guide.cjs').enrichHeader(image,headerOCR||await read(image,{scale:2}),read)),identity=modalIdentity(ocr);if(!identity)return ocr;
  for(const row of rows(ocr).filter(r=>/BATTLE/i.test(r.text)&&!/^BATTLE\s*(?:[1-9]|10)(?:\s*-\s*\d+)?$/i.test(r.text)&&r.y>identity.body.top&&r.y+r.height<identity.body.top+identity.body.height)){
    const top=Math.max(identity.body.top,Math.round(row.y-4)),height=Math.round(row.height+8),label=await require('./boss-glyph.cjs').correctBattleDigits(image,await read(image,{crop:{left:Math.round(ocr.width*.30),top,width:Math.round(ocr.width*.40),height},scale:4}));
    const valid=label.lines.filter(l=>/^BATTLE\s*(?:[1-9]|10)(?:\s*-\s*\d+)?$/i.test(l.text));
    if(valid.length===1){ocr.lines=ocr.lines.filter(l=>!l.words.some(w=>Math.abs(w.y-row.y)<row.height*.5));ocr.lines.push(valid[0]);}
  }
  // Small coloured trigger labels are often dropped by full-screen OCR. Read their
  // measured colour rectangles separately; colour alone never assigns a trigger.
  const b=identity.body,crop={left:b.left+8,top:b.top,width:Math.min(230,b.width),height:b.height};
  const {data,info}=await sharp(image).extract(crop).removeAlpha().raw().toBuffer({resolveWithObject:true});const ys=[];
  for(let y=0;y<info.height;y++){let n=0,left=info.width,right=0;for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels,r=data[i],g=data[i+1],b=data[i+2];if(r>145&&r>g*1.55&&r>b*1.4||g>130&&g>r*1.5&&g>b*1.1||r>170&&g>140&&b<90&&r<g*1.55){n++;left=Math.min(left,x);right=Math.max(right,x);}}if(n>=3&&right-left>=80)ys.push(y);}
  const runs=[];for(const y of ys){const last=runs.at(-1);if(last&&y-last.end<=5)last.end=y;else runs.push({start:y,end:y});}
  for(const run of runs.filter(r=>r.end-r.start>=16&&r.end-r.start<=65).slice(0,8)){
    const top=Math.max(b.top,crop.top+run.start-6),height=Math.min(b.top+b.height-top,run.end-run.start+15),rect={left:crop.left,top,width:Math.min(b.width-8,560),height};
    const key=crypto.createHash('sha256').update(await sharp(image).extract(rect).raw().toBuffer()).update(JSON.stringify(rect)).digest('hex');
    let labels=triggerCache.get(key);if(!labels){labels=await read(image,{crop:rect,scale:4});if(triggerCache.size>=100)triggerCache.delete(triggerCache.keys().next().value);triggerCache.set(key,labels);}
    for(const line of labels.lines)if(/DEFEATED|ON DEFEAT|STARTING STATE|TURN\s*\d|INTERRUPT|HP\s*[<≤>≥]/i.test(line.text)){
      // Replace the same physical row, rather than appending a second label or
      // leaving the trigger condition duplicated in the merged OCR text.
      const y=Math.min(...line.words.map(w=>w.y));ocr.lines=ocr.lines.filter(l=>!l.words.some(w=>Math.abs(w.y-y)<12));ocr.lines.push(line);
    }
  }
  const recovered=await require('./starting-state-ocr.cjs').recoverStartingState(image,ocr,identity.body,read,line);
  const preemptive=await require('./starting-state-ocr.cjs').recoverPreemptive(image,recovered,identity.body,read,line);
  return require('./starting-state-ocr.cjs').recoverInterruption(image,preemptive,identity.body,read,line);
}
function createBehaviorReader(io){
  let active;
  async function read(exe,device,progress=()=>{}){
    if(active)throw Error('Bir boss okuması zaten sürüyor.');const token={cancelled:false,controller:new AbortController()};active=token;const check=()=>{if(token.cancelled||token.controller.signal.aborted)throw Error('Boss okuma iptal edildi.');};check.signal=token.controller.signal;
    const update=t=>{check();progress(t);};
    const observe=async()=>{for(let attempt=0;attempt<8;attempt++){check();const snap=await io.capture(exe,device);check();const ocr=await io.ocr(snap.image,{signal:token.controller.signal}),identity=modalIdentity(ocr);check();if((io.pendingQuestModal||require('./quest-header.cjs').pendingQuestModal)(ocr)||!identity&&/QUEST\s+GUIDE/i.test(ocr.text)){update('Quest Guide yükleniyor; boss başlığı bekleniyor…');await (io.wait||pause)(650);continue;}if(!identity)throw Error('MuMu’da bossun Quest Guide / BEHAVIOR ekranını açık bırak. Okuma sırasında farklı ekrana geçildi.');return {...snap,ocr,identity,bar:await io.scrollbar(snap.image,identity.body),header:await io.headerHash(snap.image,snap.width,snap.height,identity,ocr)};}throw Error('Quest Guide başlığı yüklenemedi; eksik ekranla okuma yapılmadı.');};
    try{
      if(io.prepare)await io.prepare(exe,device,check,update);
      update('Boss başlığı ve seçili zorluk doğrulanıyor…');let snap=await observe();const first=snap;const difficulty=await io.difficulty(snap.image,snap.identity,token.controller.signal);check();const identity={...snap.identity,difficulty};
      if(identity.mode==='pka'&&io.readPKA)return await io.readPKA(exe,device,first,check,update);
      const restrictions=io.readRestrictions?await io.readRestrictions(exe,device,first,identity,check,update):undefined;
      if(io.readRestrictions){snap=await observe();if(!sameQuestModal(snap,first))throw Error('Boss veya zorluk değişti; eski okuma kullanılmadı.');}
      const guarded=async(action)=>{check();const current=io.reuseGuardedSnapshot?snap:await observe();if(!sameQuestModal(current,first))throw Error('Boss veya seçili zorluk değişti; eski okuma kullanılmadı.');await io.input(exe,device,action,current);await (io.wait||pause)(750);check();snap=await observe();if(!sameQuestModal(snap,first))throw Error('Boss veya zorluk değişti; tarama durduruldu.');};
      const atStart=()=>pageTokens(snap.ocr,identity).some(t=>t.kind==='heading');let seekDirection='up';const startPositions=new Set();
      for(;!atStart();){
        if(snap.bar.top)seekDirection='down';
        const position=seekDirection+'|'+crypto.createHash('sha256').update(await sharp(snap.image).extract(identity.body).raw().toBuffer()).digest('hex');if(startPositions.has(position))throw Error('BEHAVIOR başlangıcına ilerlenemedi; aynı konum tekrarlandı.');startPositions.add(position);
        update('BEHAVIOR başlangıcı bulunuyor…');await guarded(seekDirection);
      }
      let tokens=[],pages=0,complete=false,previousImage,previousTokens,staticCycleMs;const alignment=createScrollAlignment();
      for(;;pages++){
        // Test adapters can omit pixel tracking; production always enables it.
        let samples=0;
        const capture=async({pixelsOnly=false}={})=>{
          let s;
          if(pixelsOnly){
            check();const raw=await io.capture(exe,device);check();s={...raw,ocr:snap.ocr,identity:snap.identity,bar:await io.scrollbar(raw.image,identity.body),header:await io.headerHash(raw.image,raw.width,raw.height,snap.identity,snap.ocr)};
          }else if(io.marqueeOCR&&++samples%4!==0){
            check();const raw=await io.capture(exe,device);check();const ocr=await io.marqueeOCR(raw.image,snap.ocr,identity.body,{signal:token.controller.signal});check();
            s={...raw,ocr,identity:snap.identity,bar:await io.scrollbar(raw.image,identity.body),header:await io.headerHash(raw.image,raw.width,raw.height,snap.identity,ocr)};
          }else s=await observe();
          if(!sameQuestModal(s,first))throw Error('Boss veya zorluk değişti; tarama durduruldu.');return s;
        };
        const prior=io.marqueeOptions?.readOCR&&previousImage?await alignment.evidence(previousImage,snap.image,identity.body,{previous:previousTokens,next:pageTokens(snap.ocr,identity)}):null;
        const tracked=io.trackPixels?await collectMarquee(snap,{capture,tokens:s=>pageTokens(s.ocr,identity),body:identity.body,check,progress:update,wait:io.wait||pause,reuse:prior?.verified?{...prior,tokens:previousTokens}:undefined,staticCycleMs,signal:token.controller.signal,...(io.marqueeOptions||{})}):null;
        if(tracked){snap=tracked.snap;staticCycleMs=tracked.staticCycleMs||staticCycleMs;}
        let next=tracked?.tokens||pageTokens(snap.ocr,identity),merged;
        for(let retry=0;retry<3;retry++){
          const evidence=io.trackPixels&&previousImage?await alignment.evidence(previousImage,snap.image,identity.body,{previous:previousTokens,next}):undefined;
          io.onAlignment?.({beforeImage:previousImage,afterImage:snap.image,before:previousTokens,after:next,existing:tokens,evidence,page:pages+1,retry,body:identity.body});
          try{if(io.mergeNumbers){const result=await io.mergeNumbers({existing:tokens,next,previous:previousTokens,beforeImage:previousImage,afterImage:snap.image,evidence,body:identity.body,check,progress:update,signal:token.controller.signal,retainNumericConflicts:retry===2});merged=result.merged;next=result.next;io.onAlignment?.({beforeImage:previousImage,afterImage:snap.image,before:previousTokens,after:next,existing:tokens,evidence:result.evidence,page:pages+1,retry,body:identity.body});}else merged=mergeTokens(tokens,next,evidence);break;}catch(error){if(retry===2)throw error;update('Sayfa konumu ve kayan davranış metni yeniden doğrulanıyor…');snap=await capture();const retracked=io.trackPixels?await collectMarquee(snap,{capture,tokens:s=>pageTokens(s.ocr,identity),body:identity.body,check,progress:update,wait:io.wait||pause,staticCycleMs,signal:token.controller.signal,...(io.marqueeOptions||{})}):null;if(retracked)snap=retracked.snap;next=retracked?.tokens||pageTokens(snap.ocr,identity);}
        }
        tokens=merged;update(identity.title+' · davranış sayfası '+(pages+1)+' okunuyor…');
        if(snap.bar.bottom||io.completeAt?.(tokens)){complete=true;pages++;break;}
        const old=next.map(t=>t.text).join('\n');previousImage=snap.image;previousTokens=next;await guarded('down');const changed=pageTokens(snap.ocr,identity).map(t=>t.text).join('\n')!==old;
        if(!changed){if(snap.bar.known&&!snap.bar.bottom)throw Error('Liste kaymadı ve sonu görünmüyor; boss okuması tamamlanmadı.');if(!snap.bar.known){update('Liste sonu ikinci görüntüyle kontrol ediliyor…');await guarded('down');if(pageTokens(snap.ocr,identity).map(t=>t.text).join('\n')===old){complete=false;pages++;break;}}}
      }
      check();const result=encounterFromTokens(identity,io.transformTokens?io.transformTokens(tokens):tokens,{observedAt:new Date().toISOString(),complete,startVerified:true,pages,...(io.trackPixels?{marqueeChecked:true}:{})});if(restrictions)result.restrictions=restrictions;update(result.stages.length+' savaş aşaması '+(complete?'okundu.':'kısmen okundu; yeniden okut.'));return result;
    }finally{active=null;}
  }
  return {read,cancel:()=>{if(active){active.cancelled=true;active.controller.abort();}return true;}};
}
function createBossBehaviorService(onObserve,onAlignment,overrides={}){
  const {readLineOCR,readBlockOCR}=require('./line-ocr.cjs'),readPage=require('./behavior-page.cjs').createPageReader({readLineOCR});
  const restrictions=require('./quest-restrictions.cjs').createQuestRestrictionService(sameHeader,headerHash,onObserve);
  const pka=require('./pka-guide.cjs').createPKAService({readPage,scrollbar,headerHash,sameHeader,onObserve,readLineOCR,readBlockOCR,targetLevel:overrides.pkaLevel});
  return createBehaviorReader({trackPixels:true,reuseGuardedSnapshot:true,marqueeOptions:{readOCR:ocrBuffer,readLineOCR,readBlockOCR,retainPartial:true},onAlignment,mergeNumbers:options=>require('./behavior-numbers.cjs').mergeNumericRows({...options,readOCR:(image,settings={})=>ocrBuffer(image,{...settings,signal:options.signal})}),prepare:async(...args)=>{if(!await pka.prepare(...args)){if(overrides.requirePka)throw Error('MuMu’da PKA ana ekranını veya kendi Quest Guide penceresini aç.');await restrictions.prepare(...args);}},readPKA:pka.read,readRestrictions:restrictions.read,capture:async(exe,device)=>{const image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),m=await sharp(image).metadata();return {image,width:m.width,height:m.height};},ocr:async(image,{signal}={})=>{const ocr=await readPage(image,{signal});onObserve?.(image,ocr);return ocr;},scrollbar,headerHash,difficulty:difficultyNumber,
    input:async(exe,device,action,snap)=>{const binary=adb.validateAdb(exe),serial=adb.validateDevice(device),options={windowsHide:true,timeout:10000,maxBuffer:2*1024*1024};const {stdout}=await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],options);if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(stdout))throw Error('Global OPTC ön planda değil; boss kaydırması durduruldu.');const b=snap.identity.body,x=Math.round(b.left+b.width*.5),a=Math.round(b.top+b.height*.81),z=Math.round(b.top+b.height*(action==='down'?.43:.38));if(!['up','down'].includes(action))throw Error('Geçersiz boss kaydırması.');await execute(binary,['-s',serial,'shell','input','swipe',String(x),String(action==='down'?a:z),String(x),String(action==='down'?z:a),'650'],options);}
    ,...overrides});
}
module.exports={createBehaviorReader,createBossBehaviorService,scrollbar,headerHash,difficultyNumber,sameHeader,readBehaviorPage};
