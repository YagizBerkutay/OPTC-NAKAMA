const sharp=require('sharp'),path=require('node:path'),crypto=require('node:crypto');
const {validateImages}=require('./boss-images.cjs');
// Special Effects uses free-standing icon rows, not the Character Box grid.
// Find framed squares, then reuse the catalog's existing portrait descriptors.
async function portraits(buffer,dataDir){
 const image=sharp(buffer),meta=await image.metadata(),scale=Math.min(1,900/meta.width);
 const {data,info}=await image.clone().resize({width:Math.round(meta.width*scale)}).flatten({background:'#000'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,mask=new Uint8Array(w*h),seen=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){const r=data[p*3],g=data[p*3+1],b=data[p*3+2];if(r>130&&g>85&&r>b*1.28&&g>b*1.12&&r>g*.9)mask[p]=1;}
 const boxes=[],queue=new Int32Array(w*h);
 for(let p=0;p<mask.length;p++){
  if(!mask[p]||seen[p])continue;let head=0,tail=1,minX=w,maxX=0,minY=h,maxY=0;queue[0]=p;seen[p]=1;
  while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,next=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&mask[next]&&!seen[next]){seen[next]=1;queue[tail++]=next;}}
  }
  const bw=maxX-minX+1,bh=maxY-minY+1;
  if(bw>=30&&bw<w*.4&&bh>=30&&Math.abs(bw-bh)<Math.max(5,bw*.12)&&tail>bw*1.5)boxes.push({x:Math.round(minX/scale),y:Math.round(minY/scale),size:Math.round(Math.max(bw,bh)/scale)});
 }
 const {loadReference,matchDescriptor}=require('./recognition-core.cjs'),ref=loadReference(dataDir),found=[];
 for(const rect of boxes.sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,60)){
  if(rect.x+rect.size>meta.width||rect.y+rect.size>meta.height||found.some(v=>Math.abs(v.rect.x-rect.x)<rect.size*.3&&Math.abs(v.rect.y-rect.y)<rect.size*.3))continue;
  const crop=image.clone().extract({left:rect.x,top:rect.y,width:rect.size,height:rect.size}).flatten({background:'#000'}).removeAlpha();
  const match=matchDescriptor(await crop.clone().resize(8,8,{fit:'fill'}).raw().toBuffer(),await crop.clone().resize(24,24,{fit:'fill'}).raw().toBuffer(),ref);
  if(match.error>42)continue;
  found.push({rect,...match,crop:'data:image/webp;base64,'+(await crop.resize(96,96).webp().toBuffer()).toString('base64')});
 }
 return found;
}
async function read(images,progress=()=>{},ocr=require('./rule-ocr.cjs').ocrBuffer,findPortraits=portraits){
 validateImages(images);if(images.length>6)throw Error('Bir okumada en fazla 6 görüntü ekle.');const pages=[];
 for(const [i,input]of images.entries()){
  progress(`Special Effects · ${i+1}/${images.length} görüntü okunuyor…`);
  const buffer=Buffer.from(input.dataUrl.split(',')[1],'base64'),meta=await sharp(buffer,{limitInputPixels:16777216}).metadata();
  if(!['png','jpeg','webp'].includes(meta.format)||!meta.width||!meta.height||meta.width>4096||meta.height>4096)throw Error('Görüntü en fazla 4096 × 4096 olmalı.');
  const decoded=await ocr(buffer,{scale:Math.min(2,4096/meta.width)});
  progress(`Special Effects · ${i+1}/${images.length} kartları eşleştiriliyor…`);
  const cards=await findPortraits(buffer,path.join(__dirname,'../dist/data'));
  pages.push({name:input.name,hash:crypto.createHash('sha256').update(buffer).digest('hex'),text:decoded.text.slice(0,30000),lines:decoded.lines.map(l=>({text:l.text,y:Math.min(...l.words.map(w=>w.y)),height:Math.max(...l.words.map(w=>w.height))})).filter(l=>Number.isFinite(l.y)),cards});
 }
 return pages;
}
module.exports={read,portraits};
