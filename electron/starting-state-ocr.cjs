const sharp=require('sharp'),crypto=require('node:crypto');
const cache=new Map();
async function outlinedTriggerBoxes(image,body,color='green'){
 const rect={left:body.left+8,top:body.top,width:Math.min(230,body.width-16),height:body.height};
 const {data,info}=await sharp(image).extract(rect).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pigment=(x,y)=>{const i=(y*info.width+x)*info.channels,r=data[i],g=data[i+1],b=data[i+2];return color==='yellow'?r>170&&g>130&&b<100&&r<g*1.6:color==='cyan'?b>150&&g>130&&b>r*1.45&&g>r*1.45:g>130&&g>r*1.5&&g>b*1.1;};
 const bands=[];
 for(let y=0;y<info.height;y++){
  let left=info.width,right=-1,n=0;for(let x=0;x<info.width;x++)if(pigment(x,y)){left=Math.min(left,x);right=x;n++;}
  if(n<40||right-left<90||left>35)continue;
  const last=bands.at(-1);if(last&&y-last.bottom<=2){last.bottom=y;last.left=Math.min(last.left,left);last.right=Math.max(last.right,right);}else bands.push({top:y,bottom:y,left,right});
 }
 const boxes=[];
 for(let i=0;i<bands.length;i++){
  if(boxes.some(box=>bands[i].top>=box.top-rect.top&&bands[i].top<box.top-rect.top+box.height))continue;
  let candidate;
  for(let j=i+1;j<bands.length;j++){
  const a=bands[i],b=bands[j],height=b.bottom-a.top+1;
  if(height<24||height>65||Math.abs(a.left-b.left)>4||Math.abs(a.right-b.right)>4)continue;
  const left=Math.min(a.left,b.left),right=Math.max(a.right,b.right);let edges=0,total=0;
  for(let y=a.bottom+3;y<b.top-2;y++){
   const near=x=>[-2,-1,0,1,2].some(d=>x+d>=0&&x+d<info.width&&pigment(x+d,y));
   total++;if(near(left)&&near(right))edges++;
  }
  if(total<8||edges/total<.7)continue;
  candidate={left:rect.left+left,top:rect.top+a.top,width:right-left+1,height};
  }
  if(candidate)boxes.push(candidate);
 }
 return boxes;
}
async function recoverOutlinedTrigger(image,ocr,body,readOCR,color,expected,readLineOCR){
 const boxes=await outlinedTriggerBoxes(image,body,color);
 for(const box of boxes){
  const crop={left:box.left-2,top:box.top-3,width:box.width+4,height:box.height+6};
  if(crop.top<body.top||crop.top+crop.height>body.top+body.height)continue;
  const raw=await sharp(image).extract(crop).png().toBuffer();
  const key=crypto.createHash('sha256').update(raw).digest('hex');
  let label=cache.get(key);
  if(!label){label=await readOCR(raw,{scale:4});if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,label);}
  if(label.text.replace(/\s+/g,'').toUpperCase()!==expected&&readLineOCR){const alternate=await readLineOCR(raw,{scale:3});if(alternate.text.replace(/\s+/g,'').toUpperCase()===expected&&alternate.lines.flatMap(l=>l.words).every(w=>w.confidence===undefined||w.confidence>=70)){label=alternate;cache.set(key,label);}}
  if(label.text.replace(/\s+/g,'').toUpperCase()!==expected)continue;
  // The coloured outline locates a crop; only literal OCR supplies the trigger.
  // Preserve the enemy name to the right on the same physical row.
  ocr.lines=ocr.lines.map(l=>({...l,words:l.words.filter(w=>!(w.x>=box.left-3&&w.x+w.width<=box.left+box.width+3&&w.y>=box.top-3&&w.y+w.height<=box.top+box.height+3))})).filter(l=>l.words.length);
  for(const line of label.lines)ocr.lines.push({...line,words:line.words.map(w=>({...w,x:w.x+crop.left,y:w.y+crop.top}))});
 }
 const lines=ocr.lines.map(l=>({...l,text:l.words.map(w=>w.text).join(' ')}));
 return {...ocr,lines,text:lines.map(l=>l.text).join('\n')};
}
const startingStateBoxes=(image,body)=>outlinedTriggerBoxes(image,body,'green');
const recoverStartingState=(image,ocr,body,readOCR,readLineOCR)=>recoverOutlinedTrigger(image,ocr,body,readOCR,'green','STARTINGSTATE',readLineOCR);
const recoverPreemptive=(image,ocr,body,readOCR,readLineOCR)=>recoverOutlinedTrigger(image,ocr,body,readOCR,'cyan','PREEMPTIVE',readLineOCR);
const recoverInterruption=(image,ocr,body,readOCR,readLineOCR)=>recoverOutlinedTrigger(image,ocr,body,readOCR,'yellow','INTERRUPTION',readLineOCR);
module.exports={startingStateBoxes,recoverStartingState,recoverPreemptive,recoverInterruption,outlinedTriggerBoxes};
