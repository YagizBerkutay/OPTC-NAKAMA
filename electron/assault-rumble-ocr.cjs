const sharp=require('sharp');
const {ocrBuffer}=require('./rule-ocr.cjs'),{readBlockOCR,readLineOCR}=require('./line-ocr.cjs');
const {parseAssaultRules,normalize}=require('./assault-rumble-core.cjs');
const letters=text=>normalize(text).replace(/[^a-z]/gi,'').toLowerCase();
const number=(text,percentExpected=false,max=100)=>{let token=normalize(text).replace(/\s/g,'').replace(/^[\[\]()_|]+|[\[\]()_|]+$/g,'');
 // Windows can split the observed % glyph into 0/6. Only accept that suffix
 // in a percentage crop and when the independent line decoder agrees.
 if(percentExpected)token=token.replace(/^(\d{1,3})[0o]\/[06o]$/i,'$1%');
 const m=token.match(/^(\d{1,10})(%)?$/);return m&&!m[1].startsWith('0')&&Number(m[1])<=max?m[1]+(m[2]||''):null;};
async function verifyNumberCrop(image,rect,{read=ocrBuffer,line=readLineOCR,check=()=>{},percentExpected=false,max=100,contextRect}={}){
 if(contextRect&&percentExpected){const sample=await sharp(image).extract(contextRect).extend({top:6,bottom:6,left:8,right:8,background:'#000'}).png().toBuffer(),[a,b]=await Promise.all([read(sample,{scale:2}),line(sample,{scale:2})]);check();
  const values=text=>[...normalize(text).matchAll(/\b(\d{1,3})\s*%/g)].map(m=>number(m[1]+'%'));
  const av=values(a.text),bv=values(b.text);if(av.length===1&&bv.length===1&&av[0]&&av[0]===bv[0])return av[0];
 }
 for(const binary of [false,true]){
  let view=sharp(image).extract(rect).removeAlpha();if(binary)view=view.greyscale().threshold(155).negate();
  const sample=await view.extend({top:8,bottom:8,left:10,right:10,background:binary?'#fff':'#000'}).png().toBuffer();check();
  const [a,b]=await Promise.all([read(sample,{scale:3}),line(sample,{scale:3})]);check();const av=number(a.text,percentExpected,max),bv=number(b.text,false,max);if(av&&av===bv)return av;
 }
 return null;
}
async function readVerifiedRulePage(image,crop,{read=ocrBuffer,block=readBlockOCR,line=readLineOCR,check=()=>{}}={}){
 const pixels=await sharp(image).extract(crop).png().toBuffer();check();
 const [first,second]=await Promise.all([read(image,{crop,scale:2}),block(pixels,{scale:2})]);check();
 const primaryText=first.text.split(/CURRENT\s+TRUSTY|TRUSTY\s+CHARACTERS/i)[0].replace(/^.*?Special Rules Effect\s*/i,'');
 let secondaryText=second.text.split(/CURRENT\s+TRUSTY|TRUSTY\s+CHARACTERS/i)[0].replace(/^.*?Special Rules Effect\s*/i,'');
 let primary;try{primary=parseAssaultRules(primaryText);}catch{}
 const recovered=[];
 for(const row of second.lines){
  if(!row.words?.length)continue;
  for(const word of row.words){
   if(!/^\d+%?$/.test(word.text.trim()))continue;
   const same=first.lines.flatMap(l=>l.words||[]).find(w=>Math.abs(w.x-(crop.left+word.x))<10&&Math.abs(w.y-(crop.top+word.y))<8&&number(w.text)===number(word.text));
   if(same&&word.confidence>=80&&number(word.text))continue;
   const rect={left:Math.max(0,Math.floor(crop.left+word.x)-1),top:Math.max(0,Math.floor(crop.top+word.y)-1),width:Math.ceil(word.width)+3,height:Math.ceil(word.height)+3};
   const confirmed=await verifyNumberCrop(image,rect,{read,line,check,percentExpected:/%/.test(word.text)});
   if(!confirmed)throw Error('Assault Rules içindeki sayı bağımsız okumalarla doğrulanamadı: '+word.text);
   if(confirmed!==word.text.trim())recovered.push({old:word.text.trim(),value:confirmed,row:row.text});
   word.text=confirmed;
  }
 }
 // Use the second decoder's physical word order after local numeric recovery.
 secondaryText=second.lines.map(l=>(l.words||[]).map(w=>w.text).join(' ')).join('\n').split(/CURRENT\s+TRUSTY|TRUSTY\s+CHARACTERS/i)[0].replace(/^.*?Special Rules Effect\s*/i,'');
 let result;try{result=parseAssaultRules(secondaryText);}catch{}
 if(primary&&result&&primary.fingerprint!==result.fingerprint||letters(primaryText)!==letters(secondaryText))throw Error('Assault kurallarının hedefleri veya yüzdeleri iki okumada uyuşmadı.');
 return {text:secondaryText,numericRecovery:recovered.length};
}
async function readVerifiedRules(image,crop,options){const page=await readVerifiedRulePage(image,crop,options);return {...parseAssaultRules(page.text),numericRecovery:page.numericRecovery};}
module.exports={readVerifiedRules,readVerifiedRulePage,verifyNumberCrop};
