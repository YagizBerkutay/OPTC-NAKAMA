const sharp=require('sharp'),{ocrBuffer}=require('./rule-ocr.cjs'),{readBlockOCR,readLineOCR}=require('./line-ocr.cjs'),{rows}=require('./boss-behavior-core.cjs');
async function detailLayout(image){
 const {data,info}=await sharp(image).removeAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height;let best;
 for(let x=Math.round(w*.845);x<Math.round(w*.89);x++){let start=-1;for(let y=Math.round(h*.29);y<Math.round(h*.78);y++){
  const p=(y*w+x)*info.channels,r=data[p],g=data[p+1],b=data[p+2],neutral=Math.min(r,g,b)>65&&Math.max(r,g,b)-Math.min(r,g,b)<25;
  if(neutral&&start<0)start=y;if((!neutral||y===Math.round(h*.78)-1)&&start>=0){const end=neutral?y:y-1;if(end-start>h*.15&&(!best||end-start>best.end-best.start))best={start,end,x};start=-1;}
 }}
 if(!best)return null;
 const point=y=>{const p=(y*w+best.x)*info.channels;return Math.min(data[p],data[p+1],data[p+2])>220;};
 const body={left:Math.round(w*.135),top:best.start,width:Math.round(w*.70),height:best.end-best.start+1},bars=[];let start=-1;
 for(let y=body.top;y<body.top+body.height;y++){let count=0;for(let x=body.left+25;x<body.left+body.width;x++){const p=(y*w+x)*info.channels,r=data[p],g=data[p+1],b=data[p+2];if(r>100&&g>50&&b<160&&r>b*1.3)count++;}
  if(count>body.width*.65&&start<0)start=y;if(count<=body.width*.65&&start>=0){if(!bars.length||start-bars.at(-1)>h*.05)bars.push(start);start=-1;}
 }
 const thumb=[];for(let y=best.start;y<=best.end;y++)if(point(y))thumb.push(y);
 return {body,bars,bottom:point(best.end-3)&&point(best.end-8),scrollbar:{x:best.x,start:best.start,end:best.end,thumbStart:thumb[0],thumbEnd:thumb.at(-1)},width:w,height:h};
}
const headerLevel=text=>{const m=text.trim().match(/^L\s*v[.·•♦:,“”‘’'"\s]*([0-9]{1,2}|[Il|])\s*$/i);return m?/^[Il|]$/.test(m[1])?1:Number(m[1]):null;};
async function readStaticSkill(image,level,{read=ocrBuffer,line=readLineOCR,block=readBlockOCR,check=()=>{}}={}){
 const layout=await detailLayout(image);if(!layout)throw Error('Yetenek ayrıntısının kaydırma alanı doğrulanamadı.');
 const readout=await block(await sharp(image).extract(layout.body).png().toBuffer());check();const headings=[];
 for(const y of layout.bars){const rect={left:Math.round(layout.width*.157),top:y+Math.round(layout.height*.009),width:Math.round(layout.width*.16),height:Math.round(layout.height*.026)};
  const pixels=await sharp(image).extract(rect).extend({top:6,bottom:6,left:8,right:8,background:'#161000'}).png().toBuffer(),[a,b]=await Promise.all([read(pixels,{scale:3}),line(pixels,{scale:2})]);check();
  const av=headerLevel(a.text),bv=headerLevel(b.text);let selected=av&&av===bv?av:null;
  if(!selected&&!(av&&bv&&av!==bv)){
   const visual=await require('./rumble-levels.cjs').visualLevel(image,rect);check();
   if(visual&&(av===visual||bv===visual||!av&&!bv&&/^L\s*v/i.test(a.text.trim())&&/^L\s*v/i.test(b.text.trim())))selected=visual;
  }
  if(!selected)continue;headings.push({level:selected,y});
 }
 layout.levels=headings.map(h=>h.level);
 const lines=readout.lines.map(l=>({...l,y:Math.min(...l.words.map(w=>w.y)),height:Math.max(...l.words.map(w=>w.height))}));
 const index=headings.findIndex(v=>v.level===level);if(index<0){const first=headings[0],part=lines.filter(r=>r.y>2&&(!first||r.y+layout.body.top<first.y-4)),last=part.at(-1);return {text:'',complete:false,headFound:false,continuation:part.map(r=>r.text.trim()).join('\n'),continuationComplete:!!first&&first.level>level||layout.bottom&&!!last&&last.y+last.height<layout.body.height-8,layout};}
 const head=headings[index],next=headings[index+1],end=next?.y??layout.body.top+layout.body.height;
 const bodyRows=lines.filter(r=>r.y+layout.body.top>head.y+layout.height*.035&&r.y+layout.body.top<end-4);
 const text=bodyRows.map(r=>r.text.trim()).join('\n'),last=bodyRows.at(-1);
 return {text,headFound:true,complete:!!text&&(!!next||layout.bottom&&!!last&&last.y+last.height<layout.body.height-8),layout};
}
module.exports={detailLayout,readStaticSkill,headerLevel};
