const {Worker}=require('node:worker_threads');
const path=require('node:path');
const adb=require('./adb.cjs');
function createBossWorkerService({WorkerClass=Worker,totalMs=Infinity,idleMs=30000,validate=true,diagnostics}={}){
 let active;
 function read(exe,device,progress=()=>{},images,options){
  if(active)throw Error('Bir boss okuması zaten sürüyor.');
  if(images)require('./boss-images.cjs').validateImages(images);else if(validate){adb.validateAdb(exe);adb.validateDevice(device);}
  return new Promise((resolve,reject)=>{
   const run=diagnostics?.beginBoss(),worker=new WorkerClass(path.join(__dirname,'boss-worker.cjs'),{workerData:{exe,device,...(options?{pka:options}:{}),...(images?{images}:{}),...(run?{diagnosticsDir:diagnostics.dir,runId:run.id}:{})}}),job={worker,settled:false,last:'Boss okuması başlatılıyor…'};active=job;
   let idle,total;
   const finish=(error,result)=>{if(job.settled)return;job.settled=true;clearTimeout(idle);clearTimeout(total);if(active===job)active=undefined;if(run)diagnostics.finishBoss(run,error,result,job.last);worker.terminate().catch(()=>{});error?reject(error):resolve(result);};
   const idleWatch=()=>{clearTimeout(idle);idle=setTimeout(()=>finish(Error('Boss okuması '+Math.round(idleMs/1000)+' saniyedir ilerlemedi; işlem durduruldu. Son adım: '+job.last)),idleMs);};
   job.cancel=()=>finish(Error('Boss okuma iptal edildi.'));idleWatch();
   if(Number.isFinite(totalMs))total=setTimeout(()=>finish(Error('Boss okuması süre sınırına ulaştı ('+Math.round(totalMs/60000)+' dakika); işlem durduruldu. Eksik rehberle kadro hesabı yapılmadı.')),totalMs);
   worker.on('message',m=>{if(job.settled)return;if(m.type==='progress'){job.last=m.text;idleWatch();if(run)diagnostics.bossProgress(run,m.text);progress(m.text);}else if(m.type==='result')finish(null,m.result);else if(m.type==='error'){const error=Error(m.message||'Boss okuması başarısız.');if(m.stack)error.stack=m.stack;if(m.cause)error.cause=m.cause;finish(error);}});
   worker.once('error',e=>finish(e));worker.once('exit',()=>{if(!job.settled)finish(Error('Boss okuyucusu sonuç vermeden kapandı.'));});
  });
 }
 const cancel=()=>{active?.cancel();return true;};
 return {read,readImages:(images,progress)=>read(undefined,undefined,progress,images),cancel,close:cancel};
}
module.exports={createBossWorkerService};
