const crypto=require('node:crypto');
function cacheOCR(read,{entries=16,bytes=8*1024*1024}={}){
 const cache=new Map(),pending=new Map();let size=0;
 return async(image,options={})=>{
  const key=crypto.createHash('sha256').update(image).update(JSON.stringify([options.scale||1,options.crop||null])).digest('hex');
  const saved=cache.get(key);if(saved){cache.delete(key);cache.set(key,saved);return structuredClone(saved.value);}
  let job=pending.get(key);
  if(!job){job=Promise.resolve().then(()=>read(image,options)).then(value=>{const snapshot=structuredClone(value),weight=Buffer.byteLength(JSON.stringify(snapshot));if(weight<=bytes){while(cache.size&&(cache.size>=entries||size+weight>bytes)){const oldest=cache.keys().next().value;size-=cache.get(oldest).weight;cache.delete(oldest);}cache.set(key,{value:snapshot,weight});size+=weight;}return snapshot;}).finally(()=>pending.delete(key));pending.set(key,job);}
  return structuredClone(await job);
 };
}
module.exports={cacheOCR};
