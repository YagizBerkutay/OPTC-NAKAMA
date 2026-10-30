const sharp=require('sharp');
async function headingScrollEvidence(before,after,body,{previous,next}={}){
 if(!previous||!next)return null;
 const headings=tokens=>tokens.filter(t=>t.kind==='battle'&&t.position&&!t.position.edge&&t.position.top>=body.top+4&&t.position.top+t.position.height<=body.top+body.height-4);
 const a=headings(previous),b=headings(next),key=t=>t.number+'-'+t.variant;
 const unique=(list,k)=>list.filter(t=>key(t)===k).length===1;
 const verified=[];
 for(const u of a){
  if(!unique(a,key(u))||!unique(b,key(u)))continue;
  const v=b.find(t=>key(t)===key(u)),shift=u.position.top-v.position.top;
  if(shift<0||shift>600)continue;
  const height=Math.ceil(Math.min(u.position.height,v.position.height))+4;
  if(height<24||height>64)continue;
  const rect={left:Math.round(body.left+body.width*.25),top:Math.floor(u.position.top)-2,width:Math.round(body.width*.50),height};
  const pixels=await sharp(before).extract(rect).removeAlpha().raw().toBuffer();
  let ink=0;for(let i=0;i<pixels.length;i+=3)if(pixels[i]>170&&pixels[i+1]>170&&pixels[i+2]>170)ink++;
  if(ink<100)continue;
  const matches=[];
  for(let offset=-2;offset<=2;offset++){
   const top=Math.floor(v.position.top)-2+offset;
   if(top<body.top||top+height>body.top+body.height)continue;
   const other=await sharp(after).extract({...rect,top}).removeAlpha().raw().toBuffer();
   let different=0;for(let i=0;i<pixels.length;i++)if(Math.abs(pixels[i]-other[i])>12&&++different>24)break;
   if(different<=24)matches.push(rect.top-top);
  }
  if(matches.length===1)verified.push(matches[0]);
 }
 // A unique, complete Battle numeral must also match its actual stationary
 // pixels. Repeated labels, OCR alone and blank matching crops prove nothing.
 if(!verified.length||Math.max(...verified)-Math.min(...verified)>2)return null;
 return {shift:verified[0],verified:true,source:'battle-heading-pixels',anchors:verified.length};
}
async function stationaryTextScrollEvidence(before,after,body,{previous,next}={}){
 if(!previous||!next)return null;
 const {joinMarquee,conflictingNumbers}=require('./boss-behavior-core.cjs'),eligible=t=>t.kind==='line'&&t.position&&!t.position.edge&&t.text.replace(/[^a-z0-9]/gi,'').length>=14;
 const a=previous.filter(eligible),b=next.filter(eligible),shifts=new Set();
 for(const u of a)for(const v of b)if(!conflictingNumbers(u,v)&&joinMarquee(u.text,v.text)){const shift=Math.round(u.position.top-v.position.top);for(let d=-2;d<=2;d++)if(shift+d>=0&&shift+d<=600)shifts.add(shift+d);}
 if(!shifts.size)return null;
 const [old,now]=await Promise.all([before,after].map(image=>sharp(image).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true})));if(old.info.width!==now.info.width||old.info.height!==now.info.height)return null;
 const left=Math.round(body.left+body.width*.12),width=Math.floor(body.left+body.width-20-left),matches=[];
 for(const shift of shifts){const anchors=[];
  for(const token of a){const top=Math.floor(token.position.top)-3,height=Math.min(64,Math.ceil(token.position.height)+6),target=top-shift;if(top<body.top||target<body.top||top+height>body.top+body.height||target+height>body.top+body.height)continue;
   let ink=0,min=width,max=-1,dot=0,xx=0,yy=0,hit=0,union=0;const pixels=Buffer.alloc(width*height*3);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=((top+y)*old.info.width+left+x)*3,q=((target+y)*now.info.width+left+x)*3,k=(y*width+x)*3;
    old.data.copy(pixels,k,p,p+3);const u=Math.max(old.data[p],old.data[p+1],old.data[p+2]),v=Math.max(now.data[q],now.data[q+1],now.data[q+2]),a=u>100&&old.data[p]+old.data[p+1]+old.data[p+2]>180,b=v>100&&now.data[q]+now.data[q+1]+now.data[q+2]>180;dot+=u*v;xx+=u*u;yy+=v*v;hit+=a&&b?1:0;union+=a||b?1:0;
    if(a){ink++;min=Math.min(min,x);max=Math.max(max,x);}
   }
   if(dot/Math.sqrt(xx*yy)>=.995&&hit/union>=.92&&ink>=200&&max-min>=120&&!anchors.some(v=>Math.abs(v.top-top)<20))anchors.push({top,key:require('node:crypto').createHash('sha256').update(pixels).digest('hex')});
  }
  // Two different complete glyph patches must agree on one translation.
  // Repeated sentences or competing offsets never establish a scroll.
  const distinct=new Set(anchors.map(v=>v.key)).size;if(distinct>=2&&Math.max(...anchors.map(v=>v.top))-Math.min(...anchors.map(v=>v.top))>=40)matches.push({shift,anchors:distinct});
 }
 if(!matches.length||matches.some(v=>Math.abs(v.shift-matches[0].shift)>4))return null;
 return {...matches[0],verified:true,source:'stationary-text-pixels'};
}
module.exports={headingScrollEvidence,stationaryTextScrollEvidence};
