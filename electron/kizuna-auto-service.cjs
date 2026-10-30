const path=require('node:path'),{Worker}=require('node:worker_threads');
function createService(folder,{WorkerClass=Worker,online=require('./kizuna-online.cjs').createService(folder),deviceApi=require('./adb.cjs')}={}){
 let active;
 const cancel=()=>{online.cancel();active?.cancel();return true;};
 async function read(input,progress=()=>{}){
  if(!input||![3,7,10,13].includes(input.difficulty)||typeof input.exe!=='string'||input.exe.length>2000||typeof input.device!=='string'||input.device.length>100)throw Error('Kizuna otomatik okuma isteği geçersiz.');
  if(active)throw Error('Kizuna otomatik okuması zaten sürüyor.');const job={cancelled:false};active=job;job.cancel=()=>{job.cancelled=true;job.finish?.(Error('Kizuna otomatik okuması iptal edildi.'));};
  try{
   let event,live;const warnings=[];
   if(!input.observe)try{event=await online.read(progress);}catch(e){if(job.cancelled)throw e;warnings.push('İnternet: '+e.message);}
   if(job.cancelled)throw Error('Kizuna otomatik okuması iptal edildi.');
   if(input.device){
    try{
     deviceApi.validateAdb(input.exe);deviceApi.validateDevice(input.device);if(!input.device.startsWith('emulator-'))await deviceApi.connect(input.exe,input.device);
     if(job.cancelled)throw Error('Kizuna otomatik okuması iptal edildi.');
     live=await new Promise((resolve,reject)=>{
      const worker=new WorkerClass(path.join(__dirname,'kizuna-auto-worker.cjs'),{workerData:{exe:input.exe,device:input.device,options:{observe:input.observe===true,difficulty:input.difficulty,title:event?.title||'',event:event?{title:event.title,url:event.url,startsAt:event.startsAt,endsAt:event.endsAt}:undefined,collectBonuses:!event}}});let settled=false;
      const finish=(error,result)=>{if(settled)return;settled=true;job.finish=undefined;worker.terminate().catch(()=>{});error?reject(error):resolve(result);};
      job.finish=finish;
      worker.on('message',m=>{if(settled)return;if(m.type==='progress')progress(m.text);else if(m.type==='result')finish(null,m.result);else if(m.type==='error')finish(Error(m.message));});worker.once('error',finish);worker.once('exit',()=>{if(!settled)finish(Error('Kizuna okuyucusu sonuç vermeden kapandı.'));});
     });
    }catch(e){if(job.cancelled)throw e;warnings.push('MuMu: '+e.message);}
   }else warnings.push('Bonuslar internetten alındı. Seçili bossun aşamaları için MuMu bağlantısından cihazını seçip Kizuna ana ekranında yeniden otomatik al.');
   if(!event&&!live&&(!input.observe||warnings.length))throw Error(warnings.join('\n'));
   return {event,live,warnings};
  }finally{if(active===job)active=undefined;}
 }
 return {read,cancel,readTarget:async input=>(await read({...input,observe:true})).live||null};
}
module.exports={createService};
