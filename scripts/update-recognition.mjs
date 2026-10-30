import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const sourceDir=process.argv[2]||'.local/catalog-upstream';
const revision=JSON.parse(await fs.readFile(path.join(sourceDir,'commit.json'),'utf8'));
const tree=JSON.parse(await fs.readFile(path.join(sourceDir,'thumbnail-tree.json'),'utf8'));
if(tree.truncated||!Array.isArray(tree.tree))throw Error('Incomplete thumbnail index');
const catalog=JSON.parse(await fs.readFile('public/data/catalog.json','utf8')),ids=new Set(catalog.characters.map(c=>c.id));
const meta=JSON.parse(await fs.readFile('public/data/recognition.json','utf8')),bytes=await fs.readFile('public/data/recognition.bin');
if(bytes.length!==meta.templates.length*meta.stride||createHash('sha256').update(bytes).digest('hex')!==meta.hash)throw Error('Existing recognition index is corrupt');
const templates=new Map(meta.templates.map((template,index)=>[template.key,{...template,bytes:bytes.subarray(index*meta.stride,(index+1)*meta.stride)}]));
const entries=new Map();
for(const region of ['jap','glo'])for(const file of tree.tree){
 if(file.type!=='blob'||!file.path.startsWith(region+'/'))continue;
 const key=path.basename(file.path,'.png'),id=String(Number(key.split('-')[0]));
 if(!/^\d+(?:-[12])?$/.test(key)||!ids.has(id))continue;
 entries.set(key,{key,id,source:'api/images/thumbnail/'+file.path,sha:file.sha});
}
const pending=[...entries.values()].filter(entry=>!templates.has(entry.key)||templates.get(entry.key).source!==entry.source||templates.get(entry.key).sha&&templates.get(entry.key).sha!==entry.sha);
await fs.mkdir('public/portraits',{recursive:true});await fs.mkdir('.local/icons',{recursive:true});
let cursor=0;
const results=await Promise.allSettled(Array.from({length:8},async()=>{while(cursor<pending.length){const item=pending[cursor++];let png;
 for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(`https://raw.githubusercontent.com/2Shankz/optc-db.github.io/${revision.sha}/${item.source}`,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('HTTP '+response.status);png=Buffer.from(await response.arrayBuffer());break;}catch(error){if(attempt===2)throw error;}}
 const image=sharp(png).flatten({background:'#000'}).removeAlpha();
 const coarse=await image.clone().resize(8,8,{fit:'fill'}).raw().toBuffer(),fine=await image.clone().resize(24,24,{fit:'fill'}).raw().toBuffer();
 if(coarse.length!==192||fine.length!==1728)throw Error('Unexpected icon descriptor');
 await image.clone().resize(112,112,{fit:'fill'}).webp({quality:85}).toFile(path.join('public/portraits',item.key+'.webp'));
 await fs.writeFile(path.join('.local/icons',item.key+'.png'),png);templates.set(item.key,{...item,revision:revision.sha,bytes:Buffer.concat([coarse,fine])});
}}));
for(const result of results)if(result.status==='rejected')throw result.reason;
const built=[...templates.values()].sort((a,b)=>Number(a.id)-Number(b.id)||a.key.localeCompare(b.key)),output=Buffer.concat(built.map(template=>template.bytes));
const coveredIds=[...new Set(built.map(template=>template.id))];
const metadata={...meta,createdAt:new Date().toISOString(),catalogHash:catalog.metadata.hash,hash:createHash('sha256').update(output).digest('hex'),revision:revision.sha,templates:built.map(({bytes,...template})=>template),coveredIds,missingIds:[...ids].filter(id=>!coveredIds.includes(id)),failures:[]};
await fs.writeFile('public/data/recognition.bin',output);await fs.writeFile('public/data/recognition.json',JSON.stringify(metadata));
console.log(JSON.stringify({newTemplates:pending.length,templates:built.length,covered:coveredIds.length,missing:metadata.missingIds.length,sanji:coveredIds.includes('4654')}));
