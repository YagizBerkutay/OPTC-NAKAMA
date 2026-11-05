const sharp=require('sharp'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const execute=promisify(execFile),adb=require('./adb.cjs'),{ocrBuffer}=require('./rule-ocr.cjs'),{readLineOCR}=require('./line-ocr.cjs');
const {signature,parseGrandPartyRules}=require('./grand-party-rules-core.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bodyRect=snap=>({left:Math.round(snap.width*.109),top:Math.round(snap.height*.3675),width:Math.round(snap.width*.782),height:Math.round(snap.height*.232)});
const home=snap=>/NEXT WIN REWARD/i.test(snap.ocr.text)&&/RULE\s*DETAILS/i.test(snap.ocr.text);
const popup=snap=>/GP Burst (?:Launch|Uses)|If leader is/i.test(snap.ocr.text)&&/\b[O0]K\b/i.test(snap.ocr.text);
async function readVerifiedGrandPartyRules(image,crop,{read=ocrBuffer,line=readLineOCR,check=()=>{},observe=()=>{},signal}={}){
 const pixels=await sharp(image).extract(crop).png().toBuffer();
 const first=await read(pixels,{scale:3,signal});check();observe(pixels,first,{stage:'gp-rule-body',scale:3});
 if(!first.lines.length)throw Error('Grand Party kural metni okunamadı.');
 const primary=[],secondary=[];
 for(const row of first.lines){
  check();if(!row.words?.length)throw Error('GP satır sınırları doğrulanamadı.');
  const top=Math.max(0,Math.floor(Math.min(...row.words.map(w=>w.y)))-4),bottom=Math.min(crop.height,Math.ceil(Math.max(...row.words.map(w=>w.y+w.height)))+4);
  const sample=await sharp(pixels).extract({left:0,top,width:crop.width,height:bottom-top}).extend({left:16,right:16,top:10,bottom:10,background:'#000'}).png().toBuffer();
  const other=await line(sample,{scale:3,signal});check();observe(sample,other,{stage:'gp-rule-independent-line'});
  let text=row.text;
  if(signature(text)!==signature(other.text)){
   let matched=false;
   for(const scale of [4,2]){const retry=await read(sample,{scale,signal});check();observe(sample,retry,{stage:'gp-rule-line-retry',scale});if(signature(retry.text)===signature(other.text)){text=retry.text;matched=true;break;}}
   if(!matched)throw Error('Grand Party kural satırı iki okuyucuyla doğrulanamadı: '+row.text);
  }
  primary.push(text);secondary.push(other.text);
 }
 const a=parseGrandPartyRules(primary.join(' ')),b=parseGrandPartyRules(secondary.join(' '));
 if(a.fingerprint!==b.fingerprint)throw Error('Grand Party hedefleri / sayıları iki okumada uyuşmadı.');
 return a;
}
function createGrandPartyReader(io){
 let active,restartPending=false;const wait=io.wait||pause;
 const cancel=()=>{if(active){active.cancelled=true;active.controller.abort();}return true;};
 async function read(input,progress=()=>{},observe=()=>{}){
  if(active){if(!active.cancelled||restartPending)throw Error('Grand Party okuması zaten sürüyor.');restartPending=true;try{await active.finished;}finally{restartPending=false;}}
  if(!input||typeof input.exe!=='string'||typeof input.device!=='string')throw Error('Grand Party okuma isteği geçersiz.');
  if(restartPending)throw Error('Grand Party okuması zaten sürüyor.');
  let finish;const token={cancelled:false,controller:new AbortController(),finished:new Promise(resolve=>finish=resolve)};active=token;const signal=token.controller.signal;
  const check=()=>{if(token.cancelled)throw Error('Grand Party okuma iptal edildi.');};
  const update=text=>{check();progress(text);};
  const capture=async()=>{check();const snap=await io.capture(input.exe,input.device);check();snap.ocr=await io.ocr(snap.image,{signal});check();observe(snap.image,snap.ocr);return snap;};
  const settle=async(expected)=>{for(let n=0;n<8;n++){const snap=await capture();if(expected(snap))return snap;if(!/connect|loading/i.test(snap.ocr.text)&&n>=2)break;await wait(500);check();}throw Error('Grand Party ekran geçişi doğrulanamadı.');};
  try{
   update('Grand Party ekranı doğrulanıyor…');let snap=await capture();
   if(!popup(snap)){if(!home(snap))throw Error('MuMu’da Grand Party ana ekranını aç.');await io.input(input.exe,input.device,snap,'rules',{check,signal});check();await wait(350);snap=await settle(popup);}
   update('Güncel GP lider koşulu, bonuslar ve Burst sayıları doğrulanıyor…');
   const result=await io.rules(snap.image,bodyRect(snap),{check,observe,signal});check();
   await io.input(input.exe,input.device,snap,'close',{check,signal});check();await wait(350);await settle(home);
   update('Grand Party kuralları hazır · '+result.season.leaderTargets.join(' / '));return result;
  }finally{if(active===token)active=undefined;finish();}
 }
 return {read,cancel};
}
function createGrandPartyService(){
 const capture=async(exe,device)=>{const image=Buffer.from((await adb.screenshot(exe,device)).split(',')[1],'base64'),meta=await sharp(image).metadata();return {image,width:meta.width,height:meta.height};};
 const ocr=async(image,{signal}={})=>{let result=await ocrBuffer(image,{signal});if(!popup({ocr:result})){
  for(const rect of [[.02,.75,.267,.0625],[.178,.625,.361,.044]]){const crop={left:Math.round(result.width*rect[0]),top:Math.round(result.height*rect[1]),width:Math.round(result.width*rect[2]),height:Math.round(result.height*rect[3])},part=await ocrBuffer(image,{crop,scale:3,signal});result={...result,lines:[...result.lines,...part.lines],text:result.text+'\n'+part.text};}
 }return result;};
 return createGrandPartyReader({capture,ocr,rules:readVerifiedGrandPartyRules,input:async(exe,device,snap,action,{check,signal})=>{
  check();const binary=adb.validateAdb(exe),serial=adb.validateDevice(device),options={windowsHide:true,timeout:10000,maxBuffer:2*1024*1024};
  const {stdout}=await execute(binary,['-s',serial,'shell','dumpsys','activity','activities'],options);check();
  if(!/(?:mResumedActivity|topResumedActivity).*com\.namcobandaigames\.spmoja010[Ee]\//.test(stdout))throw Error('Global OPTC ön planda değil.');
  const fresh=await capture(exe,device);check();fresh.ocr=await ocr(fresh.image,{signal});check();
  if(fresh.width!==snap.width||fresh.height!==snap.height||action==='rules'&&!home(fresh)||action==='close'&&!popup(fresh)||!['rules','close'].includes(action))throw Error('Grand Party ekranı değişti; giriş gönderilmedi.');
  if(action==='close'){
   const crop=bodyRect(snap),a=await sharp(snap.image).extract(crop).raw().toBuffer(),b=await sharp(fresh.image).extract(crop).raw().toBuffer();
   if(a.length!==b.length||a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/a.length>2)throw Error('Grand Party kuralları okuma sırasında değişti.');
  }
  const words=fresh.ocr.lines.flatMap(l=>l.words||[]),buttons=words.filter(w=>action==='rules'?/^RULE$/i.test(w.text)&&w.x<fresh.width*.3&&w.y>fresh.height*.73&&w.y<fresh.height*.82:/^[O0]K$/i.test(w.text)&&w.x>fresh.width*.35&&w.x<fresh.width*.65&&w.y>fresh.height*.60&&w.y<fresh.height*.70).filter((w,i,all)=>!all.slice(0,i).some(p=>Math.abs(p.x-w.x)<10&&Math.abs(p.y-w.y)<10));
  if(buttons.length!==1)throw Error('Grand Party düğmesi tekil olarak doğrulanamadı.');
  const button=buttons[0];check();await execute(binary,['-s',serial,'shell','input','tap',String(Math.round(button.x+button.width/2)),String(Math.round(button.y+button.height/2))],options);
 }});
}
module.exports={parseGrandPartyRules,readVerifiedGrandPartyRules,createGrandPartyReader,createGrandPartyService,home,popup};
