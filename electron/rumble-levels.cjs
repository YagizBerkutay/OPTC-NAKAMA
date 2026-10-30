const sharp=require('sharp'),templates=require('./rumble-levels.json');
async function levelGlyph(image,rect){
 const numeral={left:rect.left+Math.round(rect.width*.425),top:rect.top,width:Math.round(rect.width*.48),height:rect.height},raw=await sharp(image).extract(numeral).removeAlpha().raw().toBuffer({resolveWithObject:true}),ink=Buffer.alloc(raw.info.width*raw.info.height);let left=raw.info.width,right=-1,top=raw.info.height,bottom=-1;
 for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++){const p=(y*raw.info.width+x)*raw.info.channels,r=raw.data[p],g=raw.data[p+1],b=raw.data[p+2];if(r>110&&g>80&&b<g*.8){ink[y*raw.info.width+x]=255;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 if(right-left<3||bottom-top<8)return null;
 const width=right-left+1,height=bottom-top+1,pixels=await sharp(ink,{raw:{width:raw.info.width,height:raw.info.height,channels:1}}).extract({left,top,width,height}).resize(32,40,{fit:'contain',background:'#000'}).raw().toBuffer();
 return {aspect:width/height,pixels};
}
async function visualLevel(image,rect){const glyph=await levelGlyph(image,rect);if(!glyph)return null;const ranked=templates.samples.map(t=>{const reference=Buffer.from(t.ink,'base64'),error=reference.reduce((n,v,i)=>n+Math.abs(v-glyph.pixels[i]),0)/(reference.length*255)+Math.abs(t.aspect-glyph.aspect)*.25;return {level:t.level,error};}).sort((a,b)=>a.error-b.error);return ranked[0].error<.12&&ranked[1].error-ranked[0].error>.035?ranked[0].level:null;}
module.exports={levelGlyph,visualLevel};
