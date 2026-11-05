const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const {correctLevels}=require('./rule-glyph.cjs'),{cacheOCR}=require('./ocr-cache.cjs'),defaultClient=require('./windows-ocr-client.cjs').createOCRClient();
function createRuleOCR({client=defaultClient,closeLines=()=>require('./line-ocr.cjs').closeLineOCR()}={}){
async function readBuffer(image,{scale=1,crop,signal}={}){
  if(signal?.aborted)throw Error('OCR request cancelled.');
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'nakama-rule-ocr-'));
  const file=path.join(folder,'screen.png');
  let deferredCleanup=false,drained=false,cleanupPromise;
  const cleanup=()=>cleanupPromise||=fs.rm(file,{force:true}).then(()=>fs.rmdir(folder));
  try{
    let pipe=sharp(image);const meta=await pipe.metadata();
    if(!meta.width||!meta.height||meta.width>4096||meta.height>4096)throw Error('Ekran boyutu desteklenmiyor.');
    if(crop)pipe=pipe.extract(crop);
    const buffer=await pipe.resize({width:Math.round((crop?.width||meta.width)*scale)}).png().toBuffer();
    await fs.writeFile(file,buffer);
    let result=await client.read(file,{signal,onDrained:()=>{drained=true;if(deferredCleanup)void cleanup().catch(()=>{});}});
    if(scale>1)result=await correctLevels(buffer,result);
    result.lines=result.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x/scale+(crop?.left||0),y:w.y/scale+(crop?.top||0),width:w.width/scale,height:w.height/scale}))}));
    return {...result,width:meta.width,height:meta.height,text:result.lines.map(l=>l.text).join('\n')};
  }catch(e){if(signal?.aborted||/OCR request cancelled/i.test(e.message)){deferredCleanup=true;throw e;}throw Error(/OCR language is unavailable/.test(e.message)?'Windows İngilizce OCR paketi bulunamadı. Dil seçeneklerinden İngilizce metin tanımayı yükle.':`Ekran metni okunamadı: ${e.message}`);}
  finally{if(!deferredCleanup||drained)await cleanup();}
}
return {ocrBuffer:cacheOCR(readBuffer),closeOCR:async()=>{await client.close();return closeLines();}};
}
module.exports={...createRuleOCR(),createRuleOCR};
