const {parentPort,workerData}=require('node:worker_threads');
if(workerData.images){
 const path=require('node:path'),fs=require('node:fs/promises'),folder=path.resolve(workerData.diagnosticsDir||'.local','..','boss-imports');
 require('./boss-images.cjs').readImages(workerData.images,text=>parentPort.postMessage({type:'progress',text}),undefined,async(hash,buffer,format)=>{await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,hash+'.'+(format==='jpeg'?'jpg':format)),buffer);}).then(result=>parentPort.postMessage({type:'result',result}),error=>parentPort.postMessage({type:'error',message:error.message,stack:error.stack}));
}else{
const recorder=workerData.diagnosticsDir?require('./diagnostics.cjs').createScanRecorder(workerData.runDir||workerData.diagnosticsDir,workerData.runId):null;
const observe=recorder?Object.assign((image,ocr)=>recorder.observe(image,ocr),{pixelPair:data=>recorder.pixelPair(data)}):undefined;
const reader=require('./boss-behavior.cjs').createBossBehaviorService(observe,recorder?data=>recorder.alignment(data):undefined,workerData.pka?{requirePka:true,pkaLevel:workerData.pka.level}:{});
parentPort.on('message',message=>{if(message?.type==='cancel')reader.cancel();});
reader.read(workerData.exe,workerData.device,text=>parentPort.postMessage({type:'progress',text})).then(result=>parentPort.postMessage({type:'result',result}),error=>parentPort.postMessage({type:'error',message:error.message,stack:error.stack,cause:error.cause}));
}
