const {parentPort,workerData}=require('node:worker_threads');
const recorder=workerData.runDir?require('./diagnostics.cjs').createScanRecorder(workerData.runDir,workerData.runId):null;
const live=require('./kizuna-live.cjs'),reader=live.createLiveReader({onObserve:(image,ocr)=>recorder?.observe(image,ocr,{reader:'kizuna-auto'})}),controller=new AbortController();let cancelled=false;
parentPort.on('message',message=>{if(message?.type==='cancel'){cancelled=true;controller.abort(Error('Kizuna otomatik okuması iptal edildi.'));}});
const check=()=>{if(cancelled)throw Error('Kizuna otomatik okuması iptal edildi.');};check.signal=controller.signal;
async function run(){
 if(workerData.options.observe){
  check();const snap=await reader.observe(workerData.exe,workerData.device,check.signal);check();
  if(snap.kind!=='main')return null;
  return {...live.mainValues(snap.ocr),enemyType:await live.mainType(snap.image,snap.width,snap.height)};
 }
 check();const read=reader.read.bind(reader);reader.read=(exe,device,options,_check,progress)=>read(exe,device,options,check,progress);
 const guide=require('./kizuna-guide-online.cjs'),progress=text=>parentPort.postMessage({type:'progress',text});
 return guide.readFromTarget(reader,workerData.exe,workerData.device,workerData.options,progress);
}
run().then(result=>parentPort.postMessage({type:'result',result}),e=>parentPort.postMessage({type:'error',message:e.message,stack:e.stack}));
