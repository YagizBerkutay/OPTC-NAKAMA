const {spawn}=require('node:child_process'),path=require('node:path');
const children=new Set();process.once('exit',()=>{for(const child of children)child.kill();});
function createOCRClient({spawnProcess=spawn,timeout=30000,idleTimeout=10000}={}){
 let worker,idle,nextId=0;const pending=new Map();
 const stop=error=>{clearTimeout(idle);const child=worker;worker=undefined;if(child){children.delete(child);child.kill();}for(const job of pending.values()){clearTimeout(job.timer);job.reject(error);}pending.clear();};
 const rest=()=>{if(!pending.size){idle=setTimeout(()=>stop(Error('OCR worker closed.')),idleTimeout);idle.unref?.();}};
 const start=()=>{
  const script=path.join(__dirname,'windows-ocr.ps1').replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
  const child=spawnProcess(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-File',script,'-Server'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  worker=child;children.add(child);child.unref?.();for(const stream of [child.stdin,child.stdout,child.stderr])stream.unref?.();
  let output='',errors='';const fail=error=>{if(worker===child)stop(error);};
  child.stderr.on('data',chunk=>{errors=(errors+chunk.toString('utf8')).slice(-4096);});
  child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{
   if(worker!==child)return;output+=chunk;let newline;
   while((newline=output.indexOf('\n'))>=0){const line=output.slice(0,newline).trim();output=output.slice(newline+1);if(!line)continue;
    try{if(line.length>2*1024*1024)throw Error('OCR response is too large.');const reply=JSON.parse(line.replace(/^\uFEFF/,'')),job=pending.get(reply.id);if(!job||!reply.result&&!reply.error)throw Error('Unexpected OCR response.');pending.delete(reply.id);clearTimeout(job.timer);reply.error?job.reject(Error(reply.error)):job.resolve(reply.result);rest();}
    catch(error){fail(error);return;}
   }
   if(output.length>2*1024*1024)fail(Error('OCR response is too large.'));
  });
  child.on('error',fail);child.stdin.on('error',fail);child.on('exit',code=>{children.delete(child);fail(Error('OCR worker stopped ('+code+'). '+errors.trim()));});
 };
 return {read(file){clearTimeout(idle);return new Promise((resolve,reject)=>{try{if(!worker)start();const id=++nextId,timer=setTimeout(()=>stop(Error('OCR timed out.')),timeout);pending.set(id,{resolve,reject,timer});worker.stdin.write(JSON.stringify({id,file})+'\n');}catch(error){stop(error);reject(error);}});},close:()=>stop(Error('OCR worker closed.'))};
}
module.exports={createOCRClient};
