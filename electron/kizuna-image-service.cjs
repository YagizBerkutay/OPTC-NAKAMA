const {Worker}=require('node:worker_threads'),path=require('node:path');
function createService({WorkerClass=Worker}={}){
 let active;
 const cancel=()=>{active?.(Error('Special Effects okuması iptal edildi.'));return true;};
 function read(images,progress=()=>{}){
  require('./boss-images.cjs').validateImages(images);if(images.length>6)throw Error('Bir okumada en fazla 6 görüntü ekle.');if(active)throw Error('Special Effects okuması zaten sürüyor.');
  return new Promise((resolve,reject)=>{
   const worker=new WorkerClass(path.join(__dirname,'kizuna-image-worker.cjs'),{workerData:{images}});let done=false;
   const finish=(error,result)=>{if(done)return;done=true;active=undefined;worker.terminate().catch(()=>{});error?reject(error):resolve(result);};
   active=finish;
   worker.on('message',m=>{if(done)return;if(m.type==='progress')progress(m.text);else if(m.type==='result')finish(null,m.result);else if(m.type==='error')finish(Error(m.message));});
   worker.once('error',finish);worker.once('exit',()=>{if(!done)finish(Error('Special Effects okuyucusu sonuç vermeden kapandı.'));});
  });
 }
 return {read,cancel};
}
module.exports={createService};
