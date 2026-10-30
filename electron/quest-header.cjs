const sharp=require('sharp');
const {rows}=require('./boss-behavior-core.cjs');
const PREFIX='quest-header:';
const normalize=text=>text.toLowerCase().replace(/[^a-z0-9]/g,'');
function titleWords(ocr){
 const left=ocr.width*.109,right=ocr.width*.891;
 return rows(ocr).filter(r=>r.y>ocr.height*.09&&r.y<ocr.height*.15).flatMap(r=>r.words).filter(w=>w.x>=left&&w.x+w.width<=right).map(w=>({text:normalize(w.text),x:w.x,width:w.width,edge:w.x<left+10||w.x+w.width>right-10})).filter(w=>w.text);
}
function pendingQuestModal(ocr){
 const list=rows(ocr),h=ocr.height;
 const guide=list.some(r=>/QUEST GUIDE/i.test(r.text)&&r.y>h*.12&&r.y<h*.3),ok=list.some(r=>/^[O0]K$/i.test(r.text)&&r.y>h*.77&&r.y<h*.92),difficulty=list.some(r=>/Difficulty/i.test(r.text)&&r.y<h*.25);
 return guide&&ok&&difficulty&&(/CONNE|LOADING/i.test(ocr.text)||!require('./boss-behavior-core.cjs').modalIdentity(ocr)||titleWords(ocr).filter(w=>!w.edge).reduce((n,w)=>n+w.text.length,0)<8);
}
async function questHeaderHash(image,width,height,identity,ocr){
 if(identity.mode==='pka')throw Error('PKA başlığı normal görev kontrolünde kullanılamaz.');
 const row=identity.difficultyRow;
 if(!row)throw Error('Görevin yıldız zorluğu okunamadı.');
 // The title is a marquee. The difficulty is fixed: retain its original pixels,
 // while binding the moving title through complete words at measured positions.
 const rect={left:Math.round(width*.30),top:Math.round(height*.16),width:Math.round(width*.40),height:Math.round(height*.035)};
 const pixels=(await sharp(image).extract(rect).removeAlpha().raw().toBuffer()).toString('base64');
 const left=width*.109,right=width*.891;
 const words=titleWords(ocr);
 return PREFIX+JSON.stringify({width,height,rect,pixels,words,left,right});
}
function sameQuestHeader(a,b,samePixels){
 if(!a.startsWith(PREFIX)||!b.startsWith(PREFIX))return false;
 let x,y;try{x=JSON.parse(a.slice(PREFIX.length));y=JSON.parse(b.slice(PREFIX.length));}catch{return false;}
 if(x.width!==y.width||x.height!==y.height||JSON.stringify(x.rect)!==JSON.stringify(y.rect)||!samePixels(x.pixels,y.pixels))return false;
 const shifts=x.words.flatMap(u=>y.words.filter(v=>u.text===v.text&&!u.edge&&!v.edge).map(v=>v.x-u.x));
 return shifts.some(shift=>{
  if(Math.abs(shift)>x.right-x.left)return false;
  const left=Math.max(x.left,y.left-shift)+10,right=Math.min(x.right,y.right-shift)-10;
  const complete=(words,offset)=>words.filter(w=>!w.edge&&w.x+offset>=left&&w.x+w.width+offset<=right);
  const xs=complete(x.words,0),ys=complete(y.words,-shift);
  if(!xs.length||!ys.length||xs.reduce((n,w)=>n+w.text.length,0)<8)return false;
  // Windows OCR may split CP-O into CP- and O when the body of the same
  // modal changes. Compare equal text spans and their measured bounds,
  // rather than requiring an identical number of OCR words.
  if(xs.map(w=>w.text).join('')!==ys.map(w=>w.text).join(''))return false;
  let i=0,j=0;
  while(i<xs.length&&j<ys.length){
   const startI=i,startJ=j;let u=xs[i++].text,v=ys[j++].text;
   while(u.length!==v.length){
    if(u.length<v.length){if(i===xs.length)return false;u+=xs[i++].text;}
    else {if(j===ys.length)return false;v+=ys[j++].text;}
   }
   const ux=xs[startI].x,vx=ys[startJ].x-shift;
   const uw=xs[i-1].x+xs[i-1].width-ux,vw=ys[j-1].x+ys[j-1].width-ys[startJ].x;
   // Allow minor OCR split differences and render jitter (up to 5px instead of 2px)
   if(u!==v||Math.abs(ux-vx)>5||Math.abs(uw-vw)>6)return false;
  }
  return i===xs.length&&j===ys.length;
 });
}
function sameQuestModal(a,b,sameHeader){
 return !!a.identity&&!!b.identity&&a.identity.mode===b.identity.mode&&a.identity.level===b.identity.level&&sameHeader(a.header,b.header)&&(a.header.startsWith(PREFIX)||a.identity.title===b.identity.title);
}
module.exports={questHeaderHash,sameQuestHeader,sameQuestModal,pendingQuestModal,PREFIX};
