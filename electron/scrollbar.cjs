const sharp=require('sharp');
async function scrollbar(image,body){
 const {data,info}=await sharp(image).extract({left:body.left+body.width-7,top:body.top,width:6,height:body.height}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const bright=[];
 for(let y=0;y<info.height;y++){let n=0;for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels;if(data[i]>180&&Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])<20)n++;}if(n>=3)bright.push(y);}
 if(bright.length<15||bright.some((y,i)=>i>0&&y-bright[i-1]>2))return {known:false,top:false,bottom:false};
 const thumbTop=bright[0],thumbBottom=bright.at(-1);
 return {known:true,top:thumbTop<12,bottom:thumbBottom>info.height-16,thumbTop,thumbBottom,thumbHeight:thumbBottom-thumbTop+1,trackHeight:info.height};
}
module.exports={scrollbar};
