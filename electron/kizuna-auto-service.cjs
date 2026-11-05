const path=require('node:path'),{Worker}=require('node:worker_threads');
function createService(folder,{WorkerClass=Worker,online=require('./kizuna-online.cjs').createService(folder),deviceApi=require('./adb.cjs'),withScreenRead=(_device,operation)=>operation(),beginScan,finishScan,cancelDrainMs=30000}={}){
 let active;
 const cancel=()=>{online.cancel();active?.cancel();return true;};
 async function read(input,progress=()=>{}){
  if(!input||![3,7,10,13].includes(input.difficulty)||typeof input.exe!=='string'||input.exe.length>2000||typeof input.device!=='string'||input.device.length>100)throw Error('Kizuna otomatik okuma isteği geçersiz.');
  if(active)throw Error('Kizuna otomatik okuması zaten sürüyor.');const job={cancelled:false};active=job;job.cancel=()=>{if(job.cancelled)return;job.cancelled=true;const worker=job.worker;if(!worker)return;try{worker.postMessage({type:'cancel'});}catch(cause){job.forceUndrained?.(cause);return;}job.cancelTimer=setTimeout(()=>job.forceUndrained?.(),cancelDrainMs);};
  try{
   let event,live;const warnings=[];
   if(!input.observe)try{event=await online.read(progress);}catch(e){if(job.cancelled)throw e;warnings.push('İnternet: '+e.message);}
   if(job.cancelled)throw Error('Kizuna otomatik okuması iptal edildi.');
   if(input.device){
    try{
     deviceApi.validateAdb(input.exe);deviceApi.validateDevice(input.device);if(!input.device.startsWith('emulator-'))await deviceApi.connect(input.exe,input.device);
     if(job.cancelled)throw Error('Kizuna otomatik okuması iptal edildi.');
     const runWorker=async()=>{const run=input.observe?undefined:beginScan?.('kizuna-auto');try{return await new Promise((resolve,reject)=>{
      const worker=new WorkerClass(path.join(__dirname,'kizuna-auto-worker.cjs'),{workerData:{exe:input.exe,device:input.device,...(run?{runDir:run.runDir,runId:run.id}:{}),options:{observe:input.observe===true,difficulty:input.difficulty,title:event?.title||'',event:event?{title:event.title,url:event.url,startsAt:event.startsAt,endsAt:event.endsAt}:undefined,collectBonuses:!event}}});let settled=false;job.worker=worker;
      const finish=(error,result,undrained=false)=>{if(settled)return;if(!error&&job.cancelled)error=Error('Kizuna otomatik okuması iptal edildi.');settled=true;clearTimeout(job.cancelTimer);job.forceUndrained=undefined;if(job.worker===worker)job.worker=undefined;Promise.resolve().then(()=>worker.terminate()).then(()=>{error?reject(error):resolve(result);},cause=>{const failure=Error('Kizuna okuyucusu güvenli biçimde durdurulamadı.',{cause});failure.code='SCREEN_READ_UNDRAINED';reject(failure);});if(undrained&&error)error.code='SCREEN_READ_UNDRAINED';};job.forceUndrained=cause=>{const error=Error('Kizuna iptal edilen okuyucunun native işlemi sonlandırdığı doğrulanamadı.',cause?{cause}:undefined);finish(error,undefined,true);};
      worker.on('message',m=>{if(settled)return;if(m.type==='progress'){if(!job.cancelled)progress(m.text);}else if(m.type==='result')finish(null,m.result);else if(m.type==='error')finish(Error(m.message));});worker.once('error',error=>finish(error,undefined,true));worker.once('exit',code=>{if(!settled){const error=Error('Kizuna okuyucusu sonuç vermeden kapandı ('+code+').');finish(error,undefined,true);}});
     });}finally{finishScan?.(run);}};
     live=await (input.observe?runWorker():withScreenRead(input.device,runWorker));
    }catch(e){if(job.cancelled)throw e;warnings.push('MuMu: '+e.message);}
   }else warnings.push('Bonuslar internetten alındı. Seçili bossun aşamaları için MuMu bağlantısından cihazını seçip Kizuna ana ekranında yeniden otomatik al.');
   if(!event&&!live&&(!input.observe||warnings.length))throw Error(warnings.join('\n'));
   return {event,live,warnings};
  }finally{if(active===job)active=undefined;}
 }
 return {read,cancel,readTarget:async input=>(await read({...input,observe:true})).live||null};
}
module.exports={createService};
