const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),sharp=require('sharp');
const {correctLevels}=require('./rule-glyph.cjs'),client=require('./windows-ocr-client.cjs').createOCRClient();
async function ocrBuffer(image,{scale=1,crop}={}){
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'nakama-rule-ocr-'));
  const file=path.join(folder,'screen.png');
  try{
    let pipe=sharp(image);const meta=await pipe.metadata();
    if(!meta.width||!meta.height||meta.width>4096||meta.height>4096)throw Error('Ekran boyutu desteklenmiyor.');
    if(crop)pipe=pipe.extract(crop);
    const buffer=await pipe.resize({width:Math.round((crop?.width||meta.width)*scale)}).png().toBuffer();
    await fs.writeFile(file,buffer);
    let result=await client.read(file);
    if(scale>1)result=await correctLevels(buffer,result);
    result.lines=result.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x/scale+(crop?.left||0),y:w.y/scale+(crop?.top||0),width:w.width/scale,height:w.height/scale}))}));
    return {...result,width:meta.width,height:meta.height,text:result.lines.map(l=>l.text).join('\n')};
  }catch(e){throw Error(/OCR language is unavailable/.test(e.message)?'Windows İngilizce OCR paketi bulunamadı. Dil seçeneklerinden İngilizce metin tanımayı yükle.':`Ekran metni okunamadı: ${e.message}`);}
  finally{await fs.rm(file,{force:true});await fs.rmdir(folder);}
}
module.exports={ocrBuffer:require('./ocr-cache.cjs').cacheOCR(ocrBuffer),closeOCR:()=>{client.close();return require('./line-ocr.cjs').closeLineOCR();}};
