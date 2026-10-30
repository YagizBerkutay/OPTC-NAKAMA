const sharp=require('sharp');
const {rows}=require('./boss-behavior-core.cjs');
async function readMarqueeRows(image,template,body,readOCR){
 const list=rows(template).filter(r=>r.y>=body.top+16&&r.y+r.height<body.top+body.height-8);
 const slots=[];let height=16;
 for(const row of list){
  if(/^BATTLE\b|^When\s+Lv/i.test(row.text))continue;
  const badge=row.words.filter(w=>/^(?:PRE[ -]?EMPTIVE|STARTING|STATE|INTERRUPTION?|DEFEATED|TURN)$/i.test(w.text));
  const left=Math.round(body.left+body.width*(badge.length?.28:.11)),top=Math.max(body.top,Math.floor(row.y-5));
  const crop={left,top,width:Math.floor(body.left+body.width-12-left),height:Math.ceil(row.height+10)};
  slots.push({row,badge,crop,y:height});height+=crop.height+20;
 }
 if(!slots.length)return template;
 const width=Math.max(...slots.map(s=>s.crop.width));
 const panels=await Promise.all(slots.map(async s=>({input:await sharp(image).extract(s.crop).png().toBuffer(),left:0,top:s.y})));
 const sheet=await sharp({create:{width,height,channels:3,background:'black'}}).composite(panels).png().toBuffer();
 const read=await readOCR(sheet,{scale:3}),replaced=new Set(slots.flatMap(s=>s.row.words));
 const lines=template.lines.map(l=>({...l,words:l.words.filter(w=>!replaced.has(w))})).filter(l=>l.words.length);
 for(const slot of slots){
  const words=read.lines.flatMap(l=>l.words).filter(w=>w.y>=slot.y&&w.y+w.height<=slot.y+slot.crop.height+2).map(w=>({...w,x:w.x+slot.crop.left,y:w.y-slot.y+slot.crop.top}));
  const edge=await sharp(image).extract({left:Math.round(body.left+body.width-36),top:slot.crop.top,width:6,height:slot.crop.height}).removeAlpha().raw().toBuffer();
  let ink=0;for(let i=0;i<edge.length;i+=3)if(edge[i]+edge[i+1]+edge[i+2]>570)ink++;
  if(words.length&&ink>=3)words[words.length-1].clippedAtRight=true;
  // Empty or damaged OCR never borrows text from another physical row.
  if(words.length)lines.push({text:[...slot.badge,...words].map(w=>w.text).join(' '),words:[...slot.badge,...words]});
 }
 return {...template,lines,text:lines.map(l=>l.text).join('\n')};
}
module.exports={readMarqueeRows};
