const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const errorInfo=error=>error?{message:error.message||String(error),stack:error.stack,cause:error.cause}:null;
function createDiagnostics(dir,{maxBytes=1024*1024}={}){
 const safe=action=>{try{fs.mkdirSync(dir,{recursive:true});return action();}catch{return undefined;}};
 const write=(name,value)=>safe(()=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)));
 const record=(kind,message,details)=>safe(()=>{
  const file=path.join(dir,'app.jsonl'),line=JSON.stringify({time:new Date().toISOString(),kind,message,details})+'\n';
  if(fs.existsSync(file)&&fs.statSync(file).size+Buffer.byteLength(line)>maxBytes){const old=path.join(dir,'app-previous.jsonl');if(fs.existsSync(old))fs.unlinkSync(old);fs.renameSync(file,old);}
  fs.appendFileSync(file,line.length>64000?JSON.stringify({time:new Date().toISOString(),kind,message,truncated:true})+'\n':line);
 });
 return {dir,record,beginBoss(){
  const run={id:randomUUID(),startedAt:new Date().toISOString()};
  safe(()=>{const current=path.join(dir,'boss-last.json');if(fs.existsSync(current))fs.copyFileSync(current,path.join(dir,'boss-previous.json'));});
  write('boss-last.json',{...run,status:'running',last:'Boss okuması başlatılıyor…'});record('boss-start',run.id);
  return run;
 },bossProgress(run,text){write('boss-last.json',{...run,status:'running',last:text});record('boss-progress',text,{runId:run.id});},finishBoss(run,error,result,last){
  write('boss-last.json',{...run,finishedAt:new Date().toISOString(),status:error?'error':'complete',last,error:errorInfo(error),result});record(error?'boss-error':'boss-result',error?.message||result?.name||'Okuma tamamlandı',{runId:run.id,error:errorInfo(error),complete:result?.observation?.complete,warnings:result?.observation?.warnings});
 }};
}
function createScanRecorder(dir,runId){
 let sequence=0;const safe=action=>{try{fs.mkdirSync(dir,{recursive:true});action();}catch{}};
 return {observe(image,ocr){safe(()=>{
  const payload={runId,sequence:sequence++,time:new Date().toISOString(),ocr};
  const latest=path.join(dir,'boss-frame.png'),json=path.join(dir,'boss-frame.json');
  if(fs.existsSync(latest))fs.copyFileSync(latest,path.join(dir,'boss-frame-previous.png'));
  if(fs.existsSync(json))fs.copyFileSync(json,path.join(dir,'boss-frame-previous.json'));
  fs.writeFileSync(latest,image);fs.writeFileSync(json,JSON.stringify(payload,null,2));
  if(payload.sequence===0){fs.writeFileSync(path.join(dir,'boss-frame-first.png'),image);fs.writeFileSync(path.join(dir,'boss-frame-first.json'),JSON.stringify(payload,null,2));}
  const list=ocr.lines?.map(l=>l.text)||[],file=path.join(dir,'boss-ocr.jsonl'),line=JSON.stringify({runId,sequence:payload.sequence,time:payload.time,lines:list})+'\n';
  if(payload.sequence===0||fs.existsSync(file)&&fs.statSync(file).size+Buffer.byteLength(line)>4*1024*1024)fs.writeFileSync(file,'');fs.appendFileSync(file,line);
 });},alignment(data){if(!data.beforeImage)return;safe(()=>{
  const pages=new Map(),encode=list=>list?.map(t=>{const p=t.position;if(p&&!pages.has(p.page))pages.set(p.page,pages.size+1);return {...t,...(p?{position:{...p,page:pages.get(p.page)}}:{})};});
  fs.writeFileSync(path.join(dir,'boss-alignment-before.png'),data.beforeImage);fs.writeFileSync(path.join(dir,'boss-alignment-after.png'),data.afterImage);
  fs.writeFileSync(path.join(dir,'boss-alignment.json'),JSON.stringify({runId,time:new Date().toISOString(),page:data.page,retry:data.retry,body:data.body,evidence:data.evidence,existing:encode(data.existing),before:encode(data.before),after:encode(data.after)},null,2));
 });}};
}
module.exports={createDiagnostics,createScanRecorder};
