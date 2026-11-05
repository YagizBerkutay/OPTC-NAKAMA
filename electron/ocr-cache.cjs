const crypto=require('node:crypto');
function cacheOCR(read,{entries=16,bytes=8*1024*1024}={}){
 const cache=new Map(),pending=new Map();let size=0;
 return async(image,options={})=>{
  const signal=options.signal;if(signal?.aborted)throw Error('OCR request cancelled.');
  const key=crypto.createHash('sha256').update(image).update(JSON.stringify([options.scale||1,options.crop||null])).digest('hex');
  const saved=cache.get(key);if(saved){cache.delete(key);cache.set(key,saved);return structuredClone(saved.value);}
  let job=pending.get(key);
  if(!job){const controller=new AbortController();job={controller,subscribers:0,settled:false,promise:null};job.promise=Promise.resolve().then(()=>read(image,{...options,signal:controller.signal})).then(value=>{job.settled=true;if(controller.signal.aborted)throw Error('OCR request cancelled.');const snapshot=structuredClone(value),weight=Buffer.byteLength(JSON.stringify(snapshot));if(weight<=bytes){while(cache.size&&(cache.size>=entries||size+weight>bytes)){const oldest=cache.keys().next().value;size-=cache.get(oldest).weight;cache.delete(oldest);}cache.set(key,{value:snapshot,weight});size+=weight;}return snapshot;},error=>{job.settled=true;throw error;}).finally(()=>{if(pending.get(key)===job)pending.delete(key);});job.promise.catch(()=>{});pending.set(key,job);}
  job.subscribers++;
  return structuredClone(await new Promise((resolve,reject)=>{
   let done=false;const release=()=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);job.subscribers--;};
   const abort=()=>{release();if(!job.settled&&job.subscribers===0){if(pending.get(key)===job)pending.delete(key);job.controller.abort();}reject(Error('OCR request cancelled.'));};
   signal?.addEventListener('abort',abort,{once:true});job.promise.then(value=>{release();resolve(value);},error=>{release();reject(error);});
  }));
 };
}
module.exports={cacheOCR};
