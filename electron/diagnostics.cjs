const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const errorInfo=error=>error?{message:error.message||String(error),stack:error.stack,cause:error.cause}:null;
function createDiagnostics(dir,{maxBytes=1024*1024,maxScanRuns=8}={}){
 const safe=action=>{try{fs.mkdirSync(dir,{recursive:true});return action();}catch{return undefined;}};
 const activeScans=new Set(),retention=Math.max(1,maxScanRuns),pruneScans=()=>safe(()=>{const scans=path.join(dir,'scans');if(!fs.existsSync(scans))return;const entries=fs.readdirSync(scans,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>({name:e.name,time:fs.statSync(path.join(scans,e.name)).mtimeMs})).sort((a,b)=>a.time-b.time);while(entries.length>retention){const index=entries.findIndex(e=>!activeScans.has(path.join(scans,e.name)));if(index<0)break;const [old]=entries.splice(index,1);fs.rmSync(path.join(scans,old.name),{recursive:true,force:true});}});
 const write=(name,value)=>safe(()=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)));
 const record=(kind,message,details)=>safe(()=>{
  const file=path.join(dir,'app.jsonl'),line=JSON.stringify({time:new Date().toISOString(),kind,message,details})+'\n';
  if(fs.existsSync(file)&&fs.statSync(file).size+Buffer.byteLength(line)>maxBytes){const old=path.join(dir,'app-previous.jsonl');if(fs.existsSync(old))fs.unlinkSync(old);fs.renameSync(file,old);}
  fs.appendFileSync(file,line.length>64000?JSON.stringify({time:new Date().toISOString(),kind,message,truncated:true})+'\n':line);
 });
 const beginScan=kind=>{
  const id=randomUUID(),safeKind=String(kind||'reader').replace(/[^a-z0-9-]/gi,'-').slice(0,32)||'reader',runDir=path.join(dir,'scans',safeKind+'-'+id);
  safe(()=>{fs.mkdirSync(runDir,{recursive:true});activeScans.add(runDir);});pruneScans();
  const run={id,runDir,startedAt:new Date().toISOString(),kind:safeKind};record('scan-start',safeKind,{runId:id});return run;
 };
 const finishScan=run=>{if(run?.runDir)activeScans.delete(run.runDir);pruneScans();};
 return {dir,record,beginScan,finishScan,beginBoss(){
  const run=beginScan('boss');
  safe(()=>{const current=path.join(dir,'boss-last.json');if(fs.existsSync(current))fs.copyFileSync(current,path.join(dir,'boss-previous.json'));});
  write('boss-last.json',{...run,status:'running',last:'Boss okuması başlatılıyor…'});record('boss-start',run.id);
  return run;
 },bossProgress(run,text){write('boss-last.json',{...run,status:'running',last:text});record('boss-progress',text,{runId:run.id});},finishBoss(run,error,result,last){
  write('boss-last.json',{...run,finishedAt:new Date().toISOString(),status:error?'error':'complete',last,error:errorInfo(error),result});record(error?'boss-error':'boss-result',error?.message||result?.name||'Okuma tamamlandı',{runId:run.id,error:errorInfo(error),complete:result?.observation?.complete,warnings:result?.observation?.warnings});finishScan(run);
 }};
}
function createScanRecorder(dir,runId,{maxImageBytes=8*1024*1024}={}){
 let sequence=0;const safe=action=>{try{fs.mkdirSync(dir,{recursive:true});action();}catch{}};
 const saveImage=(file,image)=>{const imageBytes=Buffer.isBuffer(image)?image.length:0,imageSaved=Buffer.isBuffer(image)&&image.length<=maxImageBytes;if(imageSaved)fs.writeFileSync(file,image);else fs.rmSync(file,{force:true});return {imageSaved,imageBytes,...(imageSaved?{}:{omissionReason:Buffer.isBuffer(image)?'image-size-limit':'image-missing'})};};
 return {observe(image,ocr,metadata){safe(()=>{
  const imageBytes=Buffer.isBuffer(image)?image.length:0,imageSaved=Buffer.isBuffer(image)&&imageBytes<=maxImageBytes,payload={runId,sequence:sequence++,time:new Date().toISOString(),imageSaved,imageBytes,...(imageSaved?{}:{omissionReason:Buffer.isBuffer(image)?'image-size-limit':'image-missing'}),...(metadata?{metadata}:{}),ocr};
  const latest=path.join(dir,'boss-frame.png'),json=path.join(dir,'boss-frame.json');
  const previousImage=path.join(dir,'boss-frame-previous.png'),previousJson=path.join(dir,'boss-frame-previous.json');
  if(fs.existsSync(latest)&&fs.existsSync(json)){fs.copyFileSync(latest,previousImage);fs.copyFileSync(json,previousJson);}else{fs.rmSync(previousImage,{force:true});fs.rmSync(previousJson,{force:true});}
  saveImage(latest,image);fs.writeFileSync(json,JSON.stringify(payload,null,2));
  if(payload.sequence===0){saveImage(path.join(dir,'boss-frame-first.png'),image);fs.writeFileSync(path.join(dir,'boss-frame-first.json'),JSON.stringify(payload,null,2));}
  const list=ocr.lines?.map(l=>l.text)||[],file=path.join(dir,'boss-ocr.jsonl'),line=JSON.stringify({runId,sequence:payload.sequence,time:payload.time,lines:list})+'\n';
  if(payload.sequence===0||fs.existsSync(file)&&fs.statSync(file).size+Buffer.byteLength(line)>4*1024*1024)fs.writeFileSync(file,'');fs.appendFileSync(file,line);
  });},pixelPair(data){safe(()=>{
   const stem=path.join(dir,'boss-marquee-motion-pair'),before=stem+'.before.png',after=stem+'.after.png',json=stem+'.json';
   if(fs.existsSync(json))return;
   const beforeBytes=Buffer.isBuffer(data.beforeImage)?data.beforeImage.length:0,afterBytes=Buffer.isBuffer(data.afterImage)?data.afterImage.length:0;
   const beforeReason=!Buffer.isBuffer(data.beforeImage)?'image-missing':beforeBytes>maxImageBytes?'image-size-limit':null,afterReason=!Buffer.isBuffer(data.afterImage)?'image-missing':afterBytes>maxImageBytes?'image-size-limit':null,bothSaved=!beforeReason&&!afterReason;
   const imageInfo=(imageBytes,ownReason)=>({imageSaved:bothSaved,imageBytes,...(bothSaved?{}:{omissionReason:ownReason||'pair-counterpart-omitted'})});
   const payload={runId,pairSequence:0,time:new Date().toISOString(),reason:data.reason??null,measured:data.measured??null,scrollbars:data.scrollbars??null,header:data.header??null,range:data.range??null,images:{before:imageInfo(beforeBytes,beforeReason),after:imageInfo(afterBytes,afterReason)}};
   const token=randomUUID(),beforeTemp=before+'.'+token+'.tmp',afterTemp=after+'.'+token+'.tmp',jsonTemp=json+'.'+token+'.tmp';
   try{
    fs.rmSync(before,{force:true});fs.rmSync(after,{force:true});
    if(bothSaved){fs.writeFileSync(beforeTemp,data.beforeImage,{flag:'wx'});fs.writeFileSync(afterTemp,data.afterImage,{flag:'wx'});fs.renameSync(beforeTemp,before);fs.renameSync(afterTemp,after);}
    fs.writeFileSync(jsonTemp,JSON.stringify(payload,null,2),{flag:'wx'});fs.renameSync(jsonTemp,json);
   }catch{
    for(const file of [beforeTemp,afterTemp,jsonTemp])fs.rmSync(file,{force:true});
    if(!fs.existsSync(json)){fs.rmSync(before,{force:true});fs.rmSync(after,{force:true});}
   }
  });},alignment(data){if(!data.beforeImage)return;safe(()=>{
  const pages=new Map(),encode=list=>list?.map(t=>{const p=t.position;if(p&&!pages.has(p.page))pages.set(p.page,pages.size+1);return {...t,...(p?{position:{...p,page:pages.get(p.page)}}:{})};});
  const beforeImage=saveImage(path.join(dir,'boss-alignment-before.png'),data.beforeImage),afterImage=saveImage(path.join(dir,'boss-alignment-after.png'),data.afterImage);
  fs.writeFileSync(path.join(dir,'boss-alignment.json'),JSON.stringify({runId,time:new Date().toISOString(),page:data.page,retry:data.retry,body:data.body,evidence:data.evidence,images:{before:beforeImage,after:afterImage},existing:encode(data.existing),before:encode(data.before),after:encode(data.after)},null,2));
 });}};
}
module.exports={createDiagnostics,createScanRecorder};
