const sharp=require('sharp'),{loadReference,matchDescriptor}=require('./recognition-core.cjs');
async function portraitFrames(image){
 const {data,info}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height,mask=new Uint8Array(w*h),seen=new Uint8Array(w*h),frames=[];
 for(let y=Math.round(h*.25);y<Math.round(h*.735);y++)for(let x=Math.round(w*.12);x<Math.round(w*.85);x++){const p=(y*w+x)*info.channels,r=data[p],g=data[p+1],b=data[p+2];if(r>170&&g>110&&b<150&&r>b*1.35&&g>b*1.15)mask[y*w+x]=1;}
 for(let p=0;p<mask.length;p++){if(!mask[p]||seen[p])continue;const queue=[p];seen[p]=1;let left=p%w,right=left,top=Math.floor(p/w),bottom=top;
  for(let i=0;i<queue.length;i++){const q=queue[i],x=q%w,y=Math.floor(q/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(const n of [q-1,q+1,q-w,q+w])if(n>=0&&n<mask.length&&!seen[n]&&mask[n]){seen[n]=1;queue.push(n);}}
  const width=right-left+1,height=bottom-top+1;if(width>w*.12&&width<w*.18&&height>w*.12&&height<w*.18&&Math.abs(width-height)<w*.025)frames.push({left,top,width,height});
 }
 const unique=[];for(const frame of frames.sort((a,b)=>b.width*b.height-a.width*a.height))if(!unique.some(f=>Math.abs(f.left-frame.left)<10&&Math.abs(f.top-frame.top)<10))unique.push(frame);return unique.sort((a,b)=>a.top-b.top||a.left-b.left);
}
async function readTrustyPortraits(image,ocr,dataDir){
 const frames=await portraitFrames(image),reference=loadReference(dataDir),groups=ocr.lines.map(l=>({text:l.text,y:Math.min(...(l.words||[]).map(w=>w.y))})).filter(l=>/bonus for owning/i.test(l.text)),entries=[];let complete=frames.length>0;
 for(const frame of frames){const header=groups.filter(g=>g.y<frame.top).sort((a,b)=>b.y-a.y)[0],multiplier=Number(header?.text.match(/(\d[.,]\d{1,2})\s*[x×]/i)?.[1]?.replace(',','.'));if(!multiplier||multiplier<1||multiplier>10){complete=false;continue;}
  const picture=sharp(image).extract(frame).removeAlpha(),[coarse,fine]=await Promise.all([picture.clone().resize(8,8,{fit:'fill'}).raw().toBuffer(),picture.clone().resize(24,24,{fit:'fill'}).raw().toBuffer()]),match=matchDescriptor(coarse,fine,reference);
  if(match.status==='confident')entries.push({id:match.candidates[0].id,multiplier});else complete=false;
 }
 return {entries,complete,frames};
}
async function rulesAtBottom(image){const {data,info}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true});let hits=0;for(let y=Math.round(info.height*.722);y<Math.round(info.height*.731);y++)for(let x=Math.round(info.width*.907);x<Math.round(info.width*.92);x++){const p=(y*info.width+x)*info.channels;if(Math.min(data[p],data[p+1],data[p+2])>230)hits++;}return hits>info.width*info.height*.00004;}
module.exports={portraitFrames,readTrustyPortraits,rulesAtBottom};
