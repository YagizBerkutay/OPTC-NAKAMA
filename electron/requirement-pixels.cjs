const sharp=require('sharp'),{positioned}=require('./boss-behavior-core.cjs'),{createPixelMarquee,readStrip}=require('./marquee-panorama.cjs');
async function readRequirementPixels(images,button,identity,{readOCR=require('./rule-ocr.cjs').ocrBuffer,readLineOCR=require('./line-ocr.cjs').readLineOCR,check=()=>{},progress=()=>{},signal}={}){
 if(images.length<3)return null;const crops=[];
 for(const frame of images){check();if(frame?.image&&frame.rect){crops.push(frame.image);continue;}const image=frame?.image||frame,m=await sharp(image).metadata(),crop={left:Math.round(m.width*.108),top:Math.max(0,Math.round(button.y-m.height*.058)),width:Math.round(m.width*.687),height:Math.round(m.height*.048)};crops.push(await sharp(image).extract(crop).png().toBuffer());}
 const meta=await sharp(crops[0]).metadata(),body={left:0,top:12,width:meta.width,height:Math.min(48,meta.height-12)},strips=await Promise.all(crops.map(image=>readStrip(image,{left:0,top:12,width:meta.width-12,height:body.height})));
 // A paused head is not static: compare the entire held gesture before deciding.
 const moving=strips.some(s=>!s.mask.equals(strips[0].mask)),token=positioned({kind:'line',text:'',pixelDiscovered:true},{top:body.top+6,height:Math.max(8,body.height-28),left:0,contentLeft:0,rightClipped:moving}),tracker=createPixelMarquee([token],body);
 for(const image of crops){check();await tracker.observe(image);if(!tracker.pending())break;}
 if(tracker.pending())return null;progress('REQUIREMENT · birleştirilen görüntüden tam açıklama doğrulanıyor…');const texts=[];
 const capture=reader=>async(image,options={})=>{check();const value=await reader(image,{...options,signal:options.signal||signal});texts.push(value.text?.trim()||'');return value;};
 const result=await tracker.recognize(capture(readOCR),check,capture(readLineOCR),undefined,signal);if(result.retry.size)return null;
 const {parseRequirementTexts,parseRequirement}=require('./quest-restrictions.cjs'),rules=texts.map(s=>s.match(/^(.+?\bcharacters only)\s*\//i)?.[1]||s).map(parseRequirement).filter(r=>r?.complete&&r.prefix).map(({complete,prefix,...r})=>JSON.stringify(r));if(new Set(rules).size>1)return null;
 for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const parsed=parseRequirementTexts([texts[i],texts[j]],identity);if(parsed.status==='verified')return parsed;}
 return null;
}
module.exports={readRequirementPixels};
