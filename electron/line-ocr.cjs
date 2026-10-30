const path=require('node:path'),sharp=require('sharp');
const unpack=file=>file.replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
async function localWorker(){
 const {createWorker}=require('tesseract.js');
 return createWorker('eng',1,{workerPath:unpack(require.resolve('tesseract.js/src/worker-script/node/index.js')),langPath:unpack(path.join(path.dirname(require.resolve('@tesseract.js-data/eng')),'4.0.0_best_int')),cacheMethod:'none',errorHandler:()=>{}});
}
function createLineOCR({factory=localWorker,timeout=30000,idleTimeout=10000,pageSegmentation='7'}={}){
  if(!['6','7'].includes(String(pageSegmentation)))throw Error('OCR metin düzeni desteklenmiyor.');
 let worker,boot,idle,active,epoch=0,queue=Promise.resolve();
 const close=(error=Error('Satır okuyucu kapatıldı.'))=>{epoch++;clearTimeout(idle);active?.reject(error);const old=worker;worker=undefined;boot=undefined;return old?.terminate().catch(()=>{});};
 const start=()=>{
  if(!boot){const owner=epoch;const pending=factory().then(async value=>{if(owner!==epoch){await value.terminate();throw Error('Satır okuyucu kapatıldı.');}worker=value;value.worker?.unref();const failed=error=>{if(worker===value)close(error instanceof Error?error:Error('Satır okuyucu beklenmedik şekilde kapandı.'));};value.worker?.once('error',failed);value.worker?.once('exit',failed);await value.setParameters({tessedit_pageseg_mode:String(pageSegmentation),preserve_interword_spaces:'1',user_defined_dpi:'300'});return value;});boot=pending;pending.catch(()=>{if(boot===pending)boot=undefined;});}
  return boot;
 };
 const read=(image,{scale=2}={})=>{
  const owner=epoch;clearTimeout(idle);
  const task=queue.catch(()=>{}).then(async()=>{
   if(owner!==epoch)throw Error('Satır okuyucu kapatıldı.');clearTimeout(idle);let timer;
   try{return await Promise.race([new Promise((_,reject)=>{active={reject};timer=setTimeout(()=>close(Error('Tek satır OCR isteği yanıt vermedi.')),timeout);}), (async()=>{
    const value=await start(),meta=await sharp(image).metadata(),input=await sharp(image).resize({width:Math.round(meta.width*scale)}).png().toBuffer(),{data}=await value.recognize(input,{}, {text:true,blocks:true});
    const lines=(data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.map(l=>({text:l.text,words:l.words.map(w=>({text:w.text,confidence:w.confidence,x:w.bbox.x0/scale,y:w.bbox.y0/scale,width:(w.bbox.x1-w.bbox.x0)/scale,height:(w.bbox.y1-w.bbox.y0)/scale}))}))));return {width:meta.width,height:meta.height,text:data.text.trim(),lines};
   })()]);}catch(error){close(error);throw error;}finally{clearTimeout(timer);active=undefined;if(owner===epoch){idle=setTimeout(()=>close(),idleTimeout);idle.unref?.();}}
  });queue=task;return task;
 };
 return {read,close};
}
const client=createLineOCR(),block=createLineOCR({pageSegmentation:'6'});
module.exports={createLineOCR,readLineOCR:require('./ocr-cache.cjs').cacheOCR(client.read),readBlockOCR:require('./ocr-cache.cjs').cacheOCR(block.read),closeLineOCR:()=>Promise.all([client.close(),block.close()])};
