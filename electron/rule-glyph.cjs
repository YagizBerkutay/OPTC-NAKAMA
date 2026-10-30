const sharp=require('sharp');
async function levelGlyph(image,rect){
  const meta=await sharp(image).metadata();
  const left=Math.max(0,Math.floor(rect.x)),top=Math.max(0,Math.floor(rect.y));
  const width=Math.min(meta.width-left,Math.ceil(rect.width)),height=Math.min(meta.height-top,Math.ceil(rect.height));
  if(width<5||height<5)return null;
  const {data}=await sharp(image).extract({left,top,width,height}).greyscale().raw().toBuffer({resolveWithObject:true});
  const runs=[];let start=-1;
  for(let x=0;x<=width;x++){
    const lit=x<width&&Array.from({length:height},(_,y)=>data[y*width+x]).some(v=>v>=125);
    if(lit&&start<0)start=x;
    if(!lit&&start>=0){runs.push({left:start,width:x-start});start=-1;}
  }
  // Lv. + one digit + punctuation. Keep the digit's pixels, not an OCR letter substitution.
  if(runs.length<4||runs.length>6)return null;
  const part=runs[3];let minY=height,maxY=-1;
  for(let y=0;y<height;y++)for(let x=part.left;x<part.left+part.width;x++)if(data[y*width+x]>=125){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(maxY-minY<height*.5)return null;
  return sharp(image).extract({left:left+part.left,top:top+minY,width:part.width,height:maxY-minY+1}).greyscale().threshold(125).resize(24,32,{fit:'fill'}).raw().toBuffer();
}
async function correctLevels(image,ocr){
  const reference=Buffer.from(require('./rule-glyphs.json')['4'],'base64');let corrections=0;
  for(const line of ocr.lines)for(const word of line.words){
    if(!/^Lv\.[a-z][;,:•.]*$/i.test(word.text))continue;
    const glyph=await levelGlyph(image,word);if(!glyph)continue;
    const error=glyph.reduce((n,v,i)=>n+Math.abs(v-reference[i]),0)/(glyph.length*255);
    if(error>.09)continue;
    const changed=word.text.replace(/^(Lv\.)[a-z]/i,'$14');
    line.text=line.text.replace(word.text,changed);word.text=changed;corrections++;
  }
  ocr.text=ocr.lines.map(l=>l.text).join('\n');return {...ocr,corrections};
}
module.exports={levelGlyph,correctLevels};
