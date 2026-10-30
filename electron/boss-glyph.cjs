const sharp=require('sharp');
async function firstDigitGlyph(image,rect,requireSingle=false){
 const meta=await sharp(image).metadata(),left=Math.max(0,Math.floor(rect.x-2)),top=Math.max(0,Math.floor(rect.y-2)),width=Math.min(meta.width-left,Math.ceil(rect.width+4)),height=Math.min(meta.height-top,Math.ceil(rect.height+4));
 if(width<5||height<5)return null;
 const {data,info}=await sharp(image).extract({left,top,width,height}).removeAlpha().grayscale().threshold(190).raw().toBuffer({resolveWithObject:true});
 const runs=[];let start=-1;for(let x=0;x<=width;x++){let lit=false;for(let y=0;x<width&&y<height;y++)if(data[y*width+x]){lit=true;break;}if(lit&&start<0)start=x;if(!lit&&start>=0){runs.push({left:start,width:x-start});start=-1;}}
 if(requireSingle&&runs.length!==1)return null;
 const part=runs.find(r=>r.width>=height*.3);if(!part)return null;let min=height,max=-1;for(let y=0;y<height;y++)for(let x=part.left;x<part.left+part.width;x++)if(data[y*width+x]){min=Math.min(min,y);max=Math.max(max,y);}
 if(max-min<height*.5)return null;return sharp(data,{raw:{width:info.width,height:info.height,channels:1}}).extract({left:part.left,top:min,width:part.width,height:max-min+1}).resize(24,32,{fit:'fill',kernel:'nearest'}).raw().toBuffer();
}
async function correctBattleDigits(image,ocr){
 const reference=Buffer.from(require('./boss-glyphs.json')['4'],'base64');
 // OCR sometimes omits the numeral altogether. Inspect only the space directly
 // after an otherwise complete BATTLE label, and accept the measured 4 glyph.
 for(const line of ocr.lines){
  if(!/^BATTLE$/i.test(line.text))continue;
  const label=line.words.find(w=>/^BATTLE$/i.test(w.text));if(!label)continue;
  const rect={x:label.x+label.width+2,y:label.y,width:label.height*5,height:label.height};
  const glyph=await firstDigitGlyph(image,rect,true);if(!glyph||glyph.length!==reference.length)continue;
  const error=glyph.reduce((sum,v,i)=>sum+Math.abs(v-reference[i]),0)/(glyph.length*255);if(error>.12)continue;
  line.words.push({...rect,text:'4'});line.text='BATTLE 4';line.battleDigitVerified=true;
 }
 for(const line of ocr.lines){if(!/^BATTLE\s+a(?:\s*-?\s*\d+|\s*-?\s*[Il])?$/i.test(line.text))continue;const word=line.words.find(w=>/^a(?:-|$|[\dIl])/i.test(w.text));if(!word)continue;const glyph=await firstDigitGlyph(image,word);if(!glyph||glyph.length!==reference.length)continue;const error=glyph.reduce((sum,v,i)=>sum+Math.abs(v-reference[i]),0)/(glyph.length*255);if(error>.12)continue;word.text=word.text.replace(/^a/i,'4');line.text=line.words.map(w=>w.text).join(' ');line.battleDigitVerified=true;}
 return ocr;
}
module.exports={firstDigitGlyph,correctBattleDigits};
