import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {readAssignment,buildCatalog} from './catalog-import.mjs';
const supplied=process.argv.indexOf('--source');
const sourceDir=supplied>=0?path.resolve(process.argv[supplied+1]):path.resolve('.local/catalog-upstream');
await fs.mkdir(sourceDir,{recursive:true});
async function get(url){for(let attempt=0;attempt<3;attempt++){try{const response=await fetch(url,{headers:{'User-Agent':'OPTC-Nakama'},signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('HTTP '+response.status+' '+url);return await response.text();}catch(error){if(attempt===2)throw error;}}}
let revision;
if(supplied<0){
 const commit=JSON.parse(await get('https://api.github.com/repos/2Shankz/optc-db.github.io/commits/master'));
 if(!/^[a-f0-9]{40}$/.test(commit.sha))throw Error('Invalid upstream revision');
 revision={sha:commit.sha,date:commit.commit.committer.date};
 await fs.writeFile(path.join(sourceDir,'commit.json'),JSON.stringify(revision));
 const files=['units.js','details.js','flags.js','cooldowns.js','evolutions.js','drops.js','tags.js','families.js','shops.js','rumble.json'];
 const results=await Promise.allSettled(files.map(async file=>{const text=await get(`https://raw.githubusercontent.com/2Shankz/optc-db.github.io/${revision.sha}/common/data/${file}`);await fs.writeFile(path.join(sourceDir,file),text);}));
 for(const result of results)if(result.status==='rejected')throw result.reason;
 // Read only the thumbnail tree; the complete repository can exceed GitHub limits.
 const treeURL=sha=>'https://api.github.com/repos/2Shankz/optc-db.github.io/git/trees/'+sha;
 let tree=JSON.parse(await get(treeURL(revision.sha)));
 for(const name of ['api','images','thumbnail']){const entry=tree.tree?.find(v=>v.path===name&&v.type==='tree');if(!entry)throw Error('Missing upstream directory: '+name);tree=JSON.parse(await get(treeURL(entry.sha)+(name==='thumbnail'?'?recursive=1':'')));}
 if(tree.truncated||!Array.isArray(tree.tree))throw Error('Incomplete icon tree');
 await fs.writeFile(path.join(sourceDir,'thumbnail-tree.json'),JSON.stringify(tree));
}else revision=JSON.parse(await fs.readFile(path.join(sourceDir,'commit.json'),'utf8'));
if(!/^[a-f0-9]{40}$/.test(revision.sha))throw Error('Invalid upstream revision');
const literal=async name=>readAssignment(await fs.readFile(path.join(sourceDir,name+'.js'),'utf8'),name);
const previous=JSON.parse(await fs.readFile('public/data/catalog.json','utf8'));
const catalog=buildCatalog({units:await literal('units'),details:await literal('details'),flags:await literal('flags'),rumble:JSON.parse(await fs.readFile(path.join(sourceDir,'rumble.json'),'utf8')),previous,revision});
if(catalog.characters.length<previous.characters.length)throw Error('Catalog shrank unexpectedly');
// Preserve a recoverable data snapshot before replacing the generated files.
const backup=path.join('.local','catalog-backup-'+Date.now());await fs.mkdir(backup,{recursive:true});
for(const name of ['catalog.json','planner.json','recognition.json','recognition.bin'])await fs.copyFile(path.join('public/data',name),path.join(backup,name));
await fs.mkdir('.local/planner-source',{recursive:true});
for(const file of ['units.js','details.js','flags.js','cooldowns.js','evolutions.js','drops.js','tags.js','families.js','shops.js','rumble.json','commit.json'])await fs.copyFile(path.join(sourceDir,file),path.join('.local/planner-source',file));
await fs.writeFile('public/data/catalog.json',JSON.stringify(catalog));
for(const script of ['scripts/build-planner-data.mjs','scripts/update-recognition.mjs']){
 const args=script.includes('recognition')?[script,sourceDir]:[script];
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.status!==0)throw Error('Data build failed: '+script+'; backup: '+backup);
}
console.log(JSON.stringify({revision,characters:catalog.characters.length,added:catalog.characters.filter(c=>!previous.characters.some(old=>old.id===c.id)).map(c=>({id:c.id,name:c.name})),backup}));
