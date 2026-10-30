const sharp=require('sharp');
const {rows}=require('./boss-behavior-core.cjs');
async function readRequirementButton(image,ocr,readOCR){
 const words=rows(ocr).flatMap(r=>r.words),battle=words.find(w=>/^Battle[:.]?$/i.test(w.text)&&w.y>ocr.height*.55&&w.y<ocr.height*.84),detail=words.find(w=>/^DETAIL$/i.test(w.text)&&w.y>ocr.height*.55&&w.y<ocr.height*.84);
 if(!battle||!detail)return null;
 const rect={left:Math.round(ocr.width*.52),top:Math.max(0,Math.round(battle.y-ocr.height*.025)),width:Math.round(ocr.width*.25),height:Math.round(ocr.height*.065)};
 const {data,info}=await sharp(image).extract(rect).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const red=(x,y)=>{const i=(y*info.width+x)*info.channels;return data[i]>145&&data[i+1]<105&&data[i+2]<105&&data[i]>data[i+1]*1.6;};
 const runs=[];for(let y=0;y<info.height;y++){let left=info.width,right=-1,n=0;for(let x=0;x<info.width;x++)if(red(x,y)){left=Math.min(left,x);right=x;n++;}if(n>=8&&right-left>=ocr.width*.10){const last=runs.at(-1);if(last&&y-last.bottom<=Math.round(ocr.height*.008)){last.bottom=y;last.left=Math.min(last.left,left);last.right=Math.max(last.right,right);}else runs.push({top:y,bottom:y,left,right});}}
 const boxes=runs.filter(r=>r.bottom-r.top>=ocr.height*.015&&r.bottom-r.top<=ocr.height*.04&&r.right-r.left<ocr.width*.23);
 if(boxes.length!==1)return null;const box=boxes[0],crop={left:rect.left+box.left,top:rect.top+box.top,width:box.right-box.left+1,height:box.bottom-box.top+1};
 // Red lettering on a black button is missed by full-screen OCR. Read the
 // measured button's ink on white; no coordinate alone authorizes a press.
 const ink=Buffer.alloc(crop.width*crop.height,255);
 for(let y=4;y<crop.height-4;y++)for(let x=Math.round(crop.width*.21);x<crop.width-5;x++)if(red(box.left+x,box.top+y))ink[y*crop.width+x]=0;
 const label=await readOCR(await sharp(ink,{raw:{width:crop.width,height:crop.height,channels:1}}).png().toBuffer(),{scale:4});
 if(!label.text.replace(/\s+/g,'').match(/^REQUIREMENT$/i))return null;
 return {text:'REQUIREMENT',x:crop.left,y:crop.top,width:crop.width,height:crop.height};
}
module.exports={readRequirementButton};
