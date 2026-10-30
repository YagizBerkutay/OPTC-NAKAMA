const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
let reference;
function loadReference(dataDir){
  if(reference?.dir===dataDir)return reference;
  const meta=JSON.parse(fs.readFileSync(path.join(dataDir,'recognition.json'),'utf8')),bytes=fs.readFileSync(path.join(dataDir,'recognition.bin'));
  if(meta.version!==1||meta.stride!==1920||bytes.length!==meta.templates.length*1920||createHash('sha256').update(bytes).digest('hex')!==meta.hash)throw Error('İkon indeksi eksik veya bozuk. Uygulamanın sağlam paketini yeniden aç.');
  const banner=JSON.parse(fs.readFileSync(path.join(dataDir,'box-banner.json'),'utf8'));reference={dir:dataDir,meta,bytes,banner};return reference;
}
function maskAt(x,y,size){const u=(x+.5)/size,v=(y+.5)/size;return u>.25&&u<.84&&v>.18&&v<.80&&!(u>.7&&v<.34);}
const coarseMask=[],fineMask=[];
for(const [size,target]of [[8,coarseMask],[24,fineMask]])for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(maskAt(x,y,size))target.push((y*size+x)*3);
function distance(a,b,offset,mask,robust=false){
  let total=0;const errors=[];
  for(const p of mask){const dr=a[p]-b[offset+p],dg=a[p+1]-b[offset+p+1],db=a[p+2]-b[offset+p+2],d=(dr*dr+dg*dg+db*db)/3;if(robust)errors.push(d);else total+=d;}
  if(robust){errors.sort((a,b)=>a-b);const keep=Math.floor(errors.length*.85);for(let i=0;i<keep;i++)total+=errors[i];return Math.sqrt(total/keep);}
  return Math.sqrt(total/mask.length);
}
function attribute(fine,offset=0){
  const counts={STR:0,PSY:0,DEX:0,QCK:0,INT:0};let pixels=0;
  for(let y=2;y<=6;y++)for(let x=2;x<=6;x++){
    const p=offset+(y*24+x)*3,r=fine[p]/255,g=fine[p+1]/255,b=fine[p+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
    if(max<.3||delta/max<.35)continue;
    let hue=max===r?60*((g-b)/delta%6):max===g?60*((b-r)/delta+2):60*((r-g)/delta+4);if(hue<0)hue+=360;
    const type=hue<32||hue>=345?'STR':hue<75?'PSY':hue<170?'DEX':hue<270?'QCK':'INT';counts[type]++;pixels++;
  }
  const [type,count]=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];return pixels>=8&&count/pixels>=.65?type:null;
}
function matchDescriptor(coarse,fine,ref,limit=5){
  const quick=[];for(let i=0;i<ref.meta.templates.length;i++)quick.push({i,d:distance(coarse,ref.bytes,i*1920,coarseMask)});quick.sort((a,b)=>a.d-b.d);
  const byId=new Map(),observedType=attribute(fine);
  for(const {i}of quick.slice(0,50)){
    const t=ref.meta.templates[i],expectedType=attribute(ref.bytes,i*1920+192),artworkError=distance(fine,ref.bytes,i*1920+192,fineMask,true);
    const error=artworkError+(observedType&&expectedType&&observedType!==expectedType?16:0);
    if(!byId.has(t.id)||byId.get(t.id).error>error)byId.set(t.id,{id:t.id,key:t.key,error});
  }
  const ranked=[...byId.values()].sort((a,b)=>a.error-b.error).slice(0,limit),best=ranked[0],next=ranked[1],margin=next?next.error-best.error:99;
  return {candidates:ranked.map(x=>({...x,similarity:Math.max(0,Math.round((1-x.error/100)*100))})),error:best?.error??100,margin,status:best&&best.error<=24&&margin>=5?'confident':best&&best.error<=42?'review':'unknown'};
}
function coarseError(coarse,ref){let best=Infinity;for(let i=0;i<ref.meta.templates.length;i++)best=Math.min(best,distance(coarse,ref.bytes,i*1920,coarseMask));return best;}
function validateImage(dataUrl){if(typeof dataUrl!=='string'||dataUrl.length>24*1024*1024||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl))throw Error('PNG, JPG veya WebP kutu görüntüsü kullan.');return Buffer.from(dataUrl.split(',')[1],'base64');}
async function headerCheck(image,w,h,banner){
  const area=banner.area,header=await image.clone().extract({left:Math.round(w*area.x),top:Math.round(h*area.y),width:Math.round(w*area.width),height:Math.round(h*area.height)}).flatten({background:'#000'}).removeAlpha().resize(24,4,{fit:'fill'}).raw().toBuffer();
  const expected=Buffer.from(banner.rgb,'base64');let error=0;for(let i=0;i<header.length;i++)error+=(header[i]-expected[i])**2;return Math.sqrt(error/header.length)<28;
}
async function verifyBoxImage(dataUrl,dataDir){
  const image=sharp(validateImage(dataUrl),{limitInputPixels:20*1024*1024}),{width:w,height:h}=await image.metadata(),banner=JSON.parse(fs.readFileSync(path.join(dataDir,'box-banner.json'),'utf8'));
  return {isCharacterBox:await headerCheck(image,w,h,banner),width:w,height:h};
}
function validateGrid(g,w,h){
  if(!g||!['x','y','size','pitchX','pitchY','columns','rows'].every(k=>Number.isFinite(g[k]))||!Number.isInteger(g.columns)||!Number.isInteger(g.rows)||g.columns<1||g.columns>10||g.rows<1||g.rows>12||g.size<30||g.size>w/2||g.pitchX<g.size*.8||g.pitchY<g.size*.8||g.x<0||g.y<0||g.x+g.size>w||g.y+g.size>h)throw Error('Tarama ızgarası görüntünün sınırları içinde olmalı.');return g;
}
async function descriptors(image,rect){
  const pipeline=image.clone().extract({left:Math.round(rect.x),top:Math.round(rect.y),width:Math.round(rect.size),height:Math.round(rect.size)}).flatten({background:'#000'}).removeAlpha();
  return {coarse:await pipeline.clone().resize(8,8,{fit:'fill'}).raw().toBuffer(),fine:await pipeline.clone().resize(24,24,{fit:'fill'}).raw().toBuffer()};
}
function horizontalCandidates(data,w,h){
  const edges=new Float64Array(w),gap=Math.max(2,Math.round(w/450));
  for(let xx=1;xx<w-1;xx++)for(let yy=Math.round(h*.32);yy<h*.73;yy+=Math.max(2,Math.round(w/300))){const a=(yy*w+xx-1)*3,b=(yy*w+xx+1)*3;edges[xx]+=Math.abs(data[a]-data[b])+Math.abs(data[a+1]-data[b+1])+Math.abs(data[a+2]-data[b+2]);}
  const ranked=[];
  for(let pitch=Math.round(w*.15);pitch<=w*.185;pitch++)for(let x=Math.round(w*.015);x<=w*.09;x++){
    const size=pitch-gap;if(x+pitch*4+size>w*.94)continue;let score=0;for(let col=0;col<5;col++)score+=edges[x+col*pitch]+edges[x+col*pitch+size-1];ranked.push({x,pitch,size,score});
  }
  ranked.sort((a,b)=>b.score-a.score);const selected=[];
  for(const g of ranked){if(selected.every(p=>Math.abs(p.x-g.x)>3||Math.abs(p.pitch-g.pitch)>2)){selected.push(g);if(selected.length===8)break;}}
  selected.push({x:Math.round(w*.0378),pitch:Math.round(w*.175),size:Math.round(w*.1733),score:0});return selected;
}
const positions=[[0,0],[0,1],[0,2],[1,0],[1,1]];
const bestThree=errors=>{errors.sort((a,b)=>a-b);return errors.slice(0,3).reduce((a,b)=>a+b,0)/Math.min(3,errors.length);};
async function autoGrid(image,w,h,ref,geometry=null){
  const {data}=await image.clone().flatten({background:'#000'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const horizontal=horizontalCandidates(data,w,h),{size,pitch,x}=geometry||horizontal.at(-1);
  let whites=0,pixels=0;
  for(let yy=Math.round(h*.256);yy<h*.29;yy+=Math.max(1,Math.round(w/225)))for(let xx=Math.round(w*.06);xx<w*.65;xx+=Math.max(1,Math.round(w/90))){const p=(yy*w+xx)*3;whites+=data[p]>205&&data[p+1]>205&&data[p+2]>205?1:0;pixels++;}
  const top=Math.round(h*(whites/pixels>.45?.31:.246)),bottom=Math.round(h*.749),edges=new Float64Array(h);
  for(let yy=top;yy<bottom;yy++)for(let col=0;col<5;col++)for(let k=5;k<24;k++){
    const xx=Math.min(w-1,x+col*pitch+Math.round(size*k/24)),a=((yy-1)*w+xx)*3,b=((yy+1)*w+xx)*3;edges[yy]+=Math.abs(data[a]-data[b])+Math.abs(data[a+1]-data[b+1])+Math.abs(data[a+2]-data[b+2]);
  }
  const scores=[];
  for(let y=top;y<Math.min(top+pitch,bottom-size);y++){let score=0;for(let row=0;row<4;row++){const yy=y+row*pitch;if(yy+size>bottom)break;score+=edges[yy]+edges[yy+size-1];}scores.push({y,score});}
  scores.sort((a,b)=>b.score-a.score);const peaks=[];
  for(const p of scores)if(peaks.every(y=>Math.abs(y-p.y)>5)){peaks.push(p.y);if(peaks.length===10)break;}
  if(Math.round(h*.3144)>=top&&Math.round(h*.3144)<top+pitch)peaks.push(Math.round(h*.3144));
  const shortlist=[];
  for(const y of new Set(peaks.flatMap(p=>[-2,0,2].map(d=>p+d)).filter(p=>p>=top&&p<top+pitch))){const errors=[];
    for(const [row,col]of positions){if(y+row*pitch+size>bottom)continue;const d=await descriptors(image,{x:x+col*pitch,y:y+row*pitch,size});errors.push(coarseError(d.coarse,ref));}shortlist.push({y,error:bestThree(errors)});
  }
  shortlist.sort((a,b)=>a.error-b.error);let best={y:shortlist[0].y,error:Infinity};
  for(const p of shortlist.slice(0,6)){const errors=[];for(const [row,col]of positions){if(p.y+row*pitch+size>bottom)continue;const d=await descriptors(image,{x:x+col*pitch,y:p.y+row*pitch,size});errors.push(matchDescriptor(d.coarse,d.fine,ref).error);}const error=bestThree(errors);if(error<best.error)best={y:p.y,error};}
  if(!geometry){const fitted=[];
    for(const g of horizontal)for(const dy of [-.13,-.065,0,.065,.13].map(v=>Math.round(v*g.size))){const errors=[];
      for(const [row,col]of positions){if(best.y+dy<top||best.y+dy+row*g.pitch+g.size>bottom)continue;const d=await descriptors(image,{x:g.x+col*g.pitch,y:best.y+dy+row*g.pitch,size:g.size});errors.push(coarseError(d.coarse,ref));}
      if(errors.length)fitted.push({g,y:best.y+dy,error:bestThree(errors)});
    }
    fitted.sort((a,b)=>a.error-b.error);let fit={g:{x,size,pitch},error:Infinity};
    for(const {g,y}of fitted.slice(0,4))for(const dy of [-2,0,2]){const errors=[];
      for(const [row,col]of positions){if(y+dy<top||y+dy+row*g.pitch+g.size>bottom)continue;const d=await descriptors(image,{x:g.x+col*g.pitch,y:y+dy+row*g.pitch,size:g.size});errors.push(matchDescriptor(d.coarse,d.fine,ref).error);}
      if(errors.length){const error=bestThree(errors);if(error<fit.error)fit={g,error};}
    }
    return autoGrid(image,w,h,ref,fit.g);
  }
  const rows=Math.max(1,Math.min(8,Math.floor((bottom-best.y-size)/pitch)+1));return {x,y:best.y,size,pitchX:pitch,pitchY:pitch,columns:5,rows};
}
async function recognize(dataUrl,grid,dataDir){
  const source=sharp(validateImage(dataUrl),{limitInputPixels:20*1024*1024}),{width:w,height:h}=await source.metadata();if(!w||!h||w<200||h<200)throw Error('Kutu görüntüsü çok küçük.');
  const rgb=await source.flatten({background:'#000'}).removeAlpha().raw().toBuffer(),image=sharp(rgb,{raw:{width:w,height:h,channels:3}});
  const ref=loadReference(dataDir),selected=validateGrid(grid||await autoGrid(image,w,h,ref),w,h),isCharacterBox=await headerCheck(image,w,h,ref.banner),detections=[];
  for(let row=0;row<selected.rows;row++)for(let col=0;col<selected.columns;col++){
    const rect={x:Math.round(selected.x+col*selected.pitchX),y:Math.round(selected.y+row*selected.pitchY),size:Math.round(selected.size)};if(rect.x+rect.size>w||rect.y+rect.size>h)continue;
    const d=await descriptors(image,rect),match=matchDescriptor(d.coarse,d.fine,ref);if(!isCharacterBox&&!grid&&match.status==='confident')match.status='review';
    const crop=await image.clone().extract({left:rect.x,top:rect.y,width:rect.size,height:rect.size}).resize(112,112).webp({quality:85}).toBuffer();detections.push({key:`${row}-${col}`,row,col,rect,...match,crop:`data:image/webp;base64,${crop.toString('base64')}`});
  }
  return {width:w,height:h,grid:selected,detections,isCharacterBox,coverage:ref.meta.coveredIds.length,totalTemplates:ref.meta.templates.length};
}
module.exports={recognize,loadReference,matchDescriptor,validateImage,validateGrid,verifyBoxImage,attribute};
