const {Worker}=require('node:worker_threads');
const path=require('node:path');
const {validateImage}=require('./recognition-core.cjs');
const active=new Set();
function scan(dataUrl,grid){
  validateImage(dataUrl);
  if(active.size>=2)throw Error('İki görüntü taranıyor; bitmesini bekle.');
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'recognition-worker.cjs'),{workerData:{dataUrl,grid,dataDir:path.join(__dirname,'../dist/data')}});active.add(worker);
    const timer=setTimeout(()=>{worker.terminate();reject(Error('Görüntü taraması zaman aşımına uğradı.'));},45000);
    worker.once('message',m=>{clearTimeout(timer);active.delete(worker);worker.terminate();m.error?reject(Error(m.error)):resolve(m.result);});
    worker.once('error',e=>{clearTimeout(timer);active.delete(worker);reject(e);});
    worker.once('exit',code=>{clearTimeout(timer);active.delete(worker);if(code!==0)reject(Error('Tanıma işlemi durduruldu.'));});
  });
}
function close(){for(const worker of active)worker.terminate();active.clear();}
module.exports={scan,close};
