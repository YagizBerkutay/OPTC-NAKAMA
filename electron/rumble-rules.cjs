const sharp=require('sharp');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile),adb=require('./adb.cjs'),{ocrBuffer}=require('./rule-ocr.cjs');
const {box,rulesButton,homePhase,isRulesScreen,phaseSection,parseRules}=require('./rumble-rules-core.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function createRuleReader(io){
  let active;
  const wait=io.wait||pause;
  async function read(exe,device,progress=()=>{}){
    if(active)throw Error('Bir kural okuması zaten sürüyor.');
    const token={cancelled:false};active=token;
    const check=()=>{if(token.cancelled)throw Error('Kural okuma iptal edildi.');};
    const update=text=>{check();progress(text);};
    const observe=async()=>{check();const capture=await io.capture(exe,device);check();let ocr=await io.ocr(capture.image);
      if(/PREVIOUS\s+RANKING/i.test(ocr.text)&&!/^UNDERWAY$/im.test(ocr.text)){
        const tab=await io.ocr(capture.image,{crop:{left:Math.round(capture.width*.122),top:Math.round(capture.height*.247),width:Math.round(capture.width*.35),height:Math.round(capture.height*.050)},scale:3});check();
        const lines=tab.lines.filter(l=>/^UNDERWAY$/i.test(l.text));ocr={...ocr,lines:[...ocr.lines,...lines],text:ocr.text+'\n'+lines.map(l=>l.text).join('\n')};
      }
      return {...capture,ocr};};
    const input=async(action,snap,rect)=>{check();await io.input(exe,device,action,snap,rect);check();await wait(1000);};
    const waitRules=async()=>{
      for(let attempt=0;attempt<6;attempt++){
        const s=await observe();if(isRulesScreen(s.ocr))return s;
        if(!/CONNEC|LOADING/i.test(s.ocr.text)&&!rulesButton(s.ocr))throw Error('MuMu Rules ekranında değil; kural okuma durduruldu.');
        await wait(1000);check();
      }
      throw Error('Rules ekranı yüklenemedi; bağlantıyı kontrol edip yeniden okut.');
    };
    let opened=false,phase;
    try{
      update('MuMu ekranı ve Rumble bölümü okunuyor…');
      let snap=await observe();
      if(isRulesScreen(snap.ocr)){
        await input('back',snap);snap=await observe();
      }
      const readPhase=async s=>{
        if(!rulesButton(s.ocr)){
          const button=await io.ocr(s.image,{crop:{left:Math.round(s.width*.28),top:Math.round(s.height*.57),width:Math.round(s.width*.30),height:Math.round(s.height*.10)},scale:3});
          s.ocr={...s.ocr,lines:[...s.ocr.lines,...button.lines],text:s.ocr.text+'\n'+button.text};
        }
        const crop={left:Math.round(s.width*.71),top:Math.round(s.height*.16),width:Math.round(s.width*.28),height:Math.round(s.height*.21)};
        const cropped=homePhase(s.ocr,await io.ocr(s.image,{crop,scale:3})),full=homePhase(s.ocr,s.ocr);
        if(cropped&&full&&cropped!==full)return null;
        if(cropped||full)return cropped||full;
        return homePhase(s.ocr,await io.ocr(s.image,{crop,scale:4}));
      };
      const confirmHome=async(first,expected)=>{
        let previous,count=0;
        for(let attempt=0;attempt<6;attempt++){
          const currentSnap=attempt===0&&first?first:await observe();
          const current=await readPhase(currentSnap);check();
          if(current){
            count=current===previous?count+1:1;previous=current;
            if(count>=2){
              if(expected&&current!==expected)throw Error('Aktif bölüm değişti; eski kurallar uygulanmadı.');
              return {snap:currentSnap,phase:current};
            }
          }
          if(attempt<5){await wait(300);check();}
        }
        throw Error(expected?'Rumble ana ekranına dönüş doğrulanamadı. Ekranın yüklenmesini bekleyip yeniden okut.':'Aktif Rumble bölümü tanınamadı. MuMu’da Rules düğmesinin göründüğü Rumble ana ekranını aç.');
      };
      // Require two matching observations; an unreadable loading/animation
      // frame is not evidence that the active phase has changed.
      ({snap,phase}=await confirmHome(snap));
      update(phase+' tanındı · Rules açılıyor…');
      await input('tap',snap,rulesButton(snap.ocr));opened=true;
      let targetSeen=false;
      for(let page=0;page<10;page++){
        snap=await waitRules();
        let underway=snap.ocr.lines.flatMap(l=>l.words).find(w=>/^UNDERWAY$/i.test(w.text));
        if(!underway){
          const tab=await io.ocr(snap.image,{crop:{left:Math.round(snap.width*.122),top:Math.round(snap.height*.247),width:Math.round(snap.width*.35),height:Math.round(snap.height*.050)},scale:3});check();
          underway=tab.lines.flatMap(l=>l.words).find(w=>/^UNDERWAY$/i.test(w.text)&&w.x>=snap.width*.122&&w.y>=snap.height*.247&&w.y+w.height<=snap.height*.30);
        }
        if(!underway)throw Error('Güncel Rules sekmesi doğrulanamadı.');
        if(page===0){await input('tap',snap,underway);snap=await waitRules();}
        update(phase+' kuralları okunuyor · sayfa '+(page+1)+' / 10…');
        const text=await io.ocr(snap.image,{scale:2});check();
        const section=phaseSection(text,phase);
        if(section)targetSeen=true;
        else if(targetSeen)throw Error(phase+' başlığı görünür alandan çıktı; Rules ekranını başa alıp yeniden okut.');
        if(section?.complete){
          const profile=parseRules(section.text,phase);
          update(phase+' · '+profile.effects.filter(e=>e.kind==='stat').length+' seviye bonusu okundu.');
          // Return to the same screen and verify this profile still belongs to its current phase.
          const last=await observe();if(!isRulesScreen(last.ocr))throw Error('Okuma sırasında ekran değişti.');
          await input('back',last);opened=false;
          update('Rumble ana ekranına dönüş ve '+phase+' bölümü doğrulanıyor…');
          await confirmHome(undefined,phase);
          return profile;
        }
        if(page===9)break;
        // Keep the selected block heading anchored while revealing its tail.
        // The former 38%-screen swipe could move a short block entirely above
        // the OCR viewport before its closing rule appeared.
        await input('scroll',snap,{fraction:.12,duration:450});
      }
      throw Error(phase+' kural metninin tamamı okunamadı. Rules ekranını yeniden okut.');
    }finally{
      // On cancellation/failure don't press Back against an unknown or user-changed screen.
      if(opened&&!token.cancelled){try{const s=await observe();if(isRulesScreen(s.ocr))await input('back',s);}catch{}}
      active=null;
    }
  }
  return {read,cancel:()=>{if(active)active.cancelled=true;return true;}};
}
function createRumbleService(onObserve){
  return createRuleReader({
    capture:async(exe,device)=>{const url=await adb.screenshot(exe,device),image=Buffer.from(url.split(',')[1],'base64'),m=await sharp(image).metadata();return {image,width:m.width,height:m.height};},
    ocr:async(image,options)=>{const result=await ocrBuffer(image,options);onObserve?.(image,result,options);return result;},
    input:async(exe,device,action,snap,rect)=>{
      const binary=adb.validateAdb(exe),serial=adb.validateDevice(device);
      const options={windowsHide:true,timeout:10000,maxBuffer:2*1024*1024};
      const {stdout}=await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],options);
      if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(stdout))throw Error('Global OPTC ön planda değil; ekran hareketi durduruldu.');
      const w=snap.width,h=snap.height;if(!Number.isInteger(w)||!Number.isInteger(h)||w<200||h<200||w>4096||h>4096)throw Error('Ekran boyutu geçersiz.');
      let args;
      if(action==='tap'){
        if(!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||rect.x<0||rect.y<h*.2||rect.x+rect.width>w||rect.y+rect.height>h*.91)throw Error('Kural düğmesi doğrulanamadı.');
        args=['tap',String(Math.round(rect.x+rect.width/2)),String(Math.round(rect.y+rect.height/2))];
      }else if(action==='scroll'){
        const fraction=rect?.fraction,duration=rect?.duration;
        if(!Number.isFinite(fraction)||fraction<=0||fraction>.15||!Number.isInteger(duration)||duration<350||duration>600)throw Error('Rumble Rules kaydırma adımı geçersiz.');
        args=['swipe',String(Math.round(w*.5)),String(Math.round(h*.82)),String(Math.round(w*.5)),String(Math.round(h*(.82-fraction))),String(duration)];
      }
      else if(action==='back')args=['keyevent','4'];
      else throw Error('Desteklenmeyen kural hareketi.');
      await execute(binary,['-s',serial,'shell','input',...args],options);
    }
  });
}
module.exports={createRuleReader,createRumbleService};
