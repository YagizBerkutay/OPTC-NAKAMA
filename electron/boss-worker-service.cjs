const {Worker}=require('node:worker_threads');
const path=require('node:path');
const adb=require('./adb.cjs');
function createBossWorkerService({WorkerClass=Worker,totalMs=Infinity,idleMs=30000,cancelDrainMs=40000,validate=true,diagnostics}={}){
 let active;
 function read(exe,device,progress=()=>{},images,options){
  if(active)throw Error('Bir boss okuması zaten sürüyor.');
  if(images)require('./boss-images.cjs').validateImages(images);else if(validate){adb.validateAdb(exe);adb.validateDevice(device);}
  return new Promise((resolve,reject)=>{
   const run=diagnostics?.beginBoss();let worker;
   try{worker=new WorkerClass(path.join(__dirname,'boss-worker.cjs'),{workerData:{exe,device,...(options?{pka:options}:{}),...(images?{images}:{}),...(run?{diagnosticsDir:diagnostics.dir,runDir:run.runDir,runId:run.id}:{})}});}catch(error){if(run)diagnostics.finishBoss(run,error,undefined,'Boss worker başlatılamadı.');reject(error);return;}
   const job={worker,settled:false,last:'Boss okuması başlatılıyor…'};active=job;
   let idle,total,drain;
    const finish=(error,result)=>{if(job.settled)return;job.settled=true;clearTimeout(idle);clearTimeout(total);clearTimeout(drain);const complete=failure=>{if(active===job)active=undefined;if(run)diagnostics.finishBoss(run,failure,result,job.last);failure?reject(failure):resolve(result);};Promise.resolve().then(()=>worker.terminate()).then(()=>complete(error),cause=>{const failure=Error('Boss okuyucusu güvenli biçimde durdurulamadı.',{cause});failure.code='SCREEN_READ_UNDRAINED';complete(failure);});};
   const requestCancel=error=>{if(job.settled||job.cancelError)return;job.cancelError=error;clearTimeout(idle);clearTimeout(total);if(images){finish(error);return;}try{worker.postMessage({type:'cancel'});}catch(cause){const failure=Error('Boss okuyucusu iptal mesajını alamadı; native işin sonlandığı doğrulanamadı.',{cause});failure.code='SCREEN_READ_UNDRAINED';finish(failure);return;}try{progress('İptal isteği alındı · devam eden ekran işlemi tamamlanıyor. Son adım: '+job.last);}catch{}drain=setTimeout(()=>{const failure=Error('Boss okuyucusu iptalden sonra beklenen native işlemi sonlandıramadı. Son adım: '+job.last);failure.code='SCREEN_READ_UNDRAINED';finish(failure);},Math.max(1,cancelDrainMs));};
   const idleWatch=()=>{clearTimeout(idle);idle=setTimeout(()=>requestCancel(Error('Boss okuması '+Math.round(idleMs/1000)+' saniyedir ilerlemedi; işlem durduruldu. Son adım: '+job.last)),idleMs);};
   job.cancel=()=>requestCancel(Error('Boss okuma iptal edildi.'));idleWatch();
   if(Number.isFinite(totalMs))total=setTimeout(()=>requestCancel(Error('Boss okuması süre sınırına ulaştı ('+Math.round(totalMs/60000)+' dakika); işlem durduruldu. Eksik rehberle kadro hesabı yapılmadı.')),totalMs);
   worker.on('message',m=>{if(job.settled)return;if(m.type==='progress'){job.last=m.text;if(!job.cancelError)idleWatch();if(run)diagnostics.bossProgress(run,m.text);if(!job.cancelError)progress(m.text);}else if(m.type==='result')finish(job.cancelError||null,m.result);else if(m.type==='error'){const error=job.cancelError||Error(m.message||'Boss okuması başarısız.');if(m.stack&&!job.cancelError)error.stack=m.stack;if(m.cause&&!job.cancelError)error.cause=m.cause;finish(error);}});
   worker.once('error',e=>{e.code='SCREEN_READ_UNDRAINED';finish(e)});worker.once('exit',()=>{if(!job.settled){const error=Error('Boss okuyucusu sonuç vermeden kapandı.');error.code='SCREEN_READ_UNDRAINED';finish(error);}});
  });
 }
 const cancel=()=>{active?.cancel();return true;};
 return {read,readImages:(images,progress)=>read(undefined,undefined,progress,images),cancel,close:cancel};
}
module.exports={createBossWorkerService};
