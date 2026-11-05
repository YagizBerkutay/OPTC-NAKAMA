const path=require('node:path'),sharp=require('sharp');
const unpack=file=>file.replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
async function localWorker(){
 const {createWorker}=require('tesseract.js');
 return createWorker('eng',1,{workerPath:unpack(require.resolve('tesseract.js/src/worker-script/node/index.js')),langPath:unpack(path.join(path.dirname(require.resolve('@tesseract.js-data/eng')),'4.0.0_best_int')),cacheMethod:'none',errorHandler:()=>{}});
}
function createLineOCR({factory=localWorker,timeout=30000,idleTimeout=10000,terminateTimeout=1000,pageSegmentation='7'}={}){
  if(!['6','7'].includes(String(pageSegmentation)))throw Error('OCR metin düzeni desteklenmiyor.');
 let worker,boot,staleBoot,idle,active,epoch=0,queue=Promise.resolve(),retiring;
 const retire=value=>{let timer;const record={settled:false,failed:false,timedOut:false,deadline:null};record.done=Promise.resolve().then(()=>value.terminate()).then(()=>{record.settled=true;},()=>{record.settled=true;record.failed=true;});record.deadline=Promise.race([record.done.then(()=>false),new Promise(resolve=>{timer=setTimeout(()=>resolve(true),terminateTimeout);})]).then(timedOut=>{record.timedOut=timedOut;clearTimeout(timer);});retiring=record;return record;};
 const close=(error=Error('Satır okuyucu kapatıldı.'))=>{epoch++;clearTimeout(idle);active?.reject(error);const old=worker;if(!old&&boot)staleBoot=boot;worker=undefined;boot=undefined;if(old)retire(old);return retiring?.deadline||Promise.resolve();};
 const awaitRetirement=async()=>{const record=retiring;if(!record)return;if(record.failed)throw Error('Tesseract worker kapatılamadı; yeni worker başlatılmadı.');if(record.settled){retiring=undefined;return;}await record.deadline;if(record.failed)throw Error('Tesseract worker kapatılamadı; yeni worker başlatılmadı.');if(record.settled){retiring=undefined;return;}throw Error('Tesseract worker kapatma zaman aşımına uğradı; eski worker sonlanana kadar yeni worker başlatılmadı.');};
 const awaitStaleBoot=async()=>{const prior=staleBoot;if(!prior)return;let timer;const expired=await Promise.race([prior.then(()=>false,()=>false),new Promise(resolve=>{timer=setTimeout(()=>resolve(true),terminateTimeout);})]);clearTimeout(timer);if(expired)throw Error('Tesseract worker başlatma/kapatma durumu belirsiz; yeni worker başlatılmadı.');if(staleBoot===prior)staleBoot=undefined;};
 const start=()=>{
  if(!boot){const owner=epoch;const pending=awaitStaleBoot().then(awaitRetirement).then(()=>factory()).then(async value=>{if(owner!==epoch){retire(value);await awaitRetirement();throw Error('Satır okuyucu kapatıldı.');}worker=value;value.worker?.unref();const failed=error=>{if(worker===value)close(error instanceof Error?error:Error('Satır okuyucu beklenmedik şekilde kapandı.'));};value.worker?.once('error',failed);value.worker?.once('exit',failed);await value.setParameters({tessedit_pageseg_mode:String(pageSegmentation),preserve_interword_spaces:'1',user_defined_dpi:'300'});return value;});boot=pending;pending.catch(()=>{if(boot===pending)boot=undefined;});}
  return boot;
 };
 const abortable=(promise,signal)=>{
  if(!signal)return promise;if(signal.aborted)return Promise.reject(Error('OCR request cancelled.'));
  return new Promise((resolve,reject)=>{const finish=(action,value)=>{signal.removeEventListener('abort',abort);action(value);},abort=()=>finish(reject,Error('OCR request cancelled.'));signal.addEventListener('abort',abort,{once:true});promise.then(value=>finish(resolve,value),error=>finish(reject,error));});
 };
 const read=(image,{scale=2,signal}={})=>{
  if(signal?.aborted)return Promise.reject(Error('OCR request cancelled.'));
  const owner=epoch;clearTimeout(idle);
  const task=queue.catch(()=>{}).then(async()=>{
   if(owner!==epoch)throw Error('Satır okuyucu kapatıldı.');if(signal?.aborted)throw Error('OCR request cancelled.');clearTimeout(idle);await awaitRetirement();if(owner!==epoch)throw Error('Satır okuyucu kapatıldı.');if(signal?.aborted)throw Error('OCR request cancelled.');let timer;
   try{return await Promise.race([new Promise((_,reject)=>{active={reject};timer=setTimeout(()=>close(Error('Tek satır OCR isteği yanıt vermedi.')),timeout);}), (async()=>{
    const value=await start(),meta=await sharp(image).metadata(),input=await sharp(image).resize({width:Math.round(meta.width*scale)}).png().toBuffer(),{data}=await value.recognize(input,{}, {text:true,blocks:true});
    const lines=(data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.map(l=>({text:l.text,words:l.words.map(w=>({text:w.text,confidence:w.confidence,x:w.bbox.x0/scale,y:w.bbox.y0/scale,width:(w.bbox.x1-w.bbox.x0)/scale,height:(w.bbox.y1-w.bbox.y0)/scale}))}))));return {width:meta.width,height:meta.height,text:data.text.trim(),lines};
   })()]);}catch(error){close(error);throw error;}finally{clearTimeout(timer);active=undefined;if(owner===epoch){idle=setTimeout(()=>close(),idleTimeout);idle.unref?.();}}
  });queue=task;task.catch(()=>{});return abortable(task,signal);
 };
 return {read,close};
}
const client=createLineOCR(),block=createLineOCR({pageSegmentation:'6'});
module.exports={createLineOCR,readLineOCR:require('./ocr-cache.cjs').cacheOCR(client.read),readBlockOCR:require('./ocr-cache.cjs').cacheOCR(block.read),closeLineOCR:()=>Promise.all([client.close(),block.close()])};
