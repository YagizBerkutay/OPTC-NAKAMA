import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const tree=JSON.parse(await fs.readFile('.local/image-tree.json','utf8')).tree;
const catalog=JSON.parse(await fs.readFile('public/data/catalog.json','utf8'));
const ids=new Set(catalog.characters.map(c=>c.id));
const entries=new Map();
for(const region of ['jap','glo'])for(const file of tree){
  if(file.type!=='blob'||!file.path.startsWith(`api/images/thumbnail/${region}/`))continue;
  const key=path.basename(file.path,'.png');
  if(!/^\d+(?:-[12])?$/.test(key)||!ids.has(String(Number(key.split('-')[0]))))continue;
  entries.set(key,{key,id:String(Number(key.split('-')[0])),source:file.path});
}
await fs.mkdir('.local/icons',{recursive:true});await fs.mkdir('public/portraits',{recursive:true});
const all=[...entries.values()];const built=[];const failures=[];let cursor=0,done=0;
console.log(`Preparing ${all.length} icon variants for ${ids.size} catalog characters`);
async function job(){while(cursor<all.length){const item=all[cursor++];try{
  const cache=path.join('.local/icons',item.key+'.png');let png;
  try{png=await fs.readFile(cache);}catch{
    for(let retry=0;retry<3;retry++){try{const response=await fetch('https://raw.githubusercontent.com/2Shankz/optc-db.github.io/master/'+item.source,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);png=Buffer.from(await response.arrayBuffer());if(png.length<100)throw Error('Empty icon');await fs.writeFile(cache,png);break;}catch(e){if(retry===2)throw e;}}
  }
  const image=sharp(png).flatten({background:'#000'}).removeAlpha();
  const coarse=await image.clone().resize(8,8,{fit:'fill'}).raw().toBuffer();
  const fine=await image.clone().resize(24,24,{fit:'fill'}).raw().toBuffer();
  if(coarse.length!==192||fine.length!==1728)throw Error('Unexpected channels');
  await image.clone().resize(112,112,{fit:'fill'}).webp({quality:85}).toFile(`public/portraits/${item.key}.webp`);
  built.push({...item,coarse,fine});
}catch(e){failures.push({id:item.id,source:item.source,error:e.message});}
done++;if(done%250===0||done===all.length)console.log(`${done}/${all.length} processed; ${failures.length} failed`);
}}
await Promise.all(Array.from({length:24},job));
if(built.length<1000)throw Error('Insufficient reference coverage');
built.sort((a,b)=>Number(a.id)-Number(b.id)||a.key.localeCompare(b.key));
const bytes=Buffer.concat(built.flatMap(x=>[x.coarse,x.fine]));
const metadata={version:1,source:catalog.metadata.url,createdAt:new Date().toISOString(),catalogHash:catalog.metadata.hash,hash:crypto.createHash('sha256').update(bytes).digest('hex'),stride:1920,coarseSize:8,fineSize:24,templates:built.map(({id,key,source})=>({id,key,source})),coveredIds:[...new Set(built.map(x=>x.id))],missingIds:[...ids].filter(id=>!built.some(x=>x.id===id)),failures};
await fs.writeFile('public/data/recognition.bin',bytes);await fs.writeFile('public/data/recognition.json',JSON.stringify(metadata));
console.log(JSON.stringify({templates:built.length,covered:metadata.coveredIds.length,missing:metadata.missingIds.length,bytes:bytes.length,failures:failures.length},null,2));
