const {parentPort,workerData}=require('node:worker_threads');
const live=require('./kizuna-live.cjs'),reader=live.createLiveReader();
async function run(){
 if(workerData.options.observe){
  const snap=await reader.observe(workerData.exe,workerData.device);
  if(snap.kind!=='main')return null;
  return {...live.mainValues(snap.ocr),enemyType:await live.mainType(snap.image,snap.width,snap.height)};
 }
 const guide=require('./kizuna-guide-online.cjs'),progress=text=>parentPort.postMessage({type:'progress',text});
 return guide.readFromTarget(reader,workerData.exe,workerData.device,workerData.options,progress);
}
run().then(result=>parentPort.postMessage({type:'result',result}),e=>parentPort.postMessage({type:'error',message:e.message,stack:e.stack}));
