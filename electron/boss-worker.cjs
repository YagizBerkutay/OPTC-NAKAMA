const {parentPort,workerData}=require('node:worker_threads');
if(workerData.images){
 const path=require('node:path'),fs=require('node:fs/promises'),folder=path.resolve(workerData.diagnosticsDir||'.local','..','boss-imports');
 require('./boss-images.cjs').readImages(workerData.images,text=>parentPort.postMessage({type:'progress',text}),undefined,async(hash,buffer,format)=>{await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,hash+'.'+(format==='jpeg'?'jpg':format)),buffer);}).then(result=>parentPort.postMessage({type:'result',result}),error=>parentPort.postMessage({type:'error',message:error.message,stack:error.stack}));
}else{
const recorder=workerData.diagnosticsDir?require('./diagnostics.cjs').createScanRecorder(workerData.diagnosticsDir,workerData.runId):null;
const reader=require('./boss-behavior.cjs').createBossBehaviorService(recorder?(image,ocr)=>recorder.observe(image,ocr):undefined,recorder?data=>recorder.alignment(data):undefined,workerData.pka?{requirePka:true,pkaLevel:workerData.pka.level}:{});
reader.read(workerData.exe,workerData.device,text=>parentPort.postMessage({type:'progress',text})).then(result=>parentPort.postMessage({type:'result',result}),error=>parentPort.postMessage({type:'error',message:error.message,stack:error.stack,cause:error.cause}));
}
