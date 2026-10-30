import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {createRequire} from 'node:module';
import {buildCatalog,readAssignment} from '../scripts/catalog-import.mjs';
import {searchCharacters} from '../src/character-search';
import {candidates,parseEffects,type PlannerData} from '../src/planning';
import {newOwned,type Catalog} from '../src/model';
const catalog:Catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));
const data:PlannerData=JSON.parse(fs.readFileSync('public/data/planner.json','utf8'));
const require=createRequire(import.meta.url);
const {loadReference,matchDescriptor}=require('../electron/recognition-core.cjs');

test('the reported Halloween Sanji has matching identity, stats, skills and ownership ID',()=>{
 const sanji=catalog.characters.find(c=>c.id==='4654')!;
 assert.ok(sanji);assert.equal(sanji.name,'Sanji - Jolly Halloween Party');
 assert.deepEqual(sanji.types,['PSY']);assert.deepEqual(sanji.classes,['Cerebral','Powerhouse']);
 assert.equal(sanji.hp,3720);assert.equal(sanji.atk,1602);assert.equal(sanji.stars,'5');
 assert.equal(searchCharacters(catalog.characters,'Sanji Halloween','PSY')[0].id,'4654');
 assert.equal(catalog.metadata.total,catalog.characters.length);assert.equal((catalog.metadata as any).sha,data.metadata.sha);
 assert.ok(sanji.special.includes('Color Affinity'));assert.equal(data.units['4654'].special,sanji.special);
 const effects=parseEffects(sanji.special);
 assert.ok(effects.some(effect=>effect.mechanic==='despair'&&effect.turns===6));
 assert.ok(effects.some(effect=>effect.mechanic==='resilience'&&effect.turns===6));
 assert.ok((data.units['4654'].abilities?.support as any)[0].Characters.includes('[PSY] Cerebral'));
 const owned=newOwned('4654'),before=structuredClone(owned);
 for(const scenario of ['current','power','evolve'] as const){const member=candidates([owned],catalog.characters,data,scenario).find(m=>m.sourceId==='4654')!;assert.ok(member);assert.equal(member.character.id,'4654');assert.ok(member.specialText.includes('Resilience'));}
 assert.deepEqual(owned,before);
});

test('all five new units are searchable, have portraits and are confidently recognized',()=>{
 const ref=loadReference('public/data');
 for(const id of ['4652','4653','4654','4655','4656']){
  assert.equal(searchCharacters(catalog.characters,id)[0].id,id);assert.ok(data.units[id]);
  assert.ok(fs.existsSync('public/portraits/'+id+'.webp'));
  const index=ref.meta.templates.findIndex((t:any)=>t.id===id);assert.ok(index>=0);
  const bytes=ref.bytes.subarray(index*1920,(index+1)*1920);
  const result=matchDescriptor(bytes.subarray(0,192),bytes.subarray(192),ref);
  assert.equal(result.candidates[0].id,id);assert.equal(result.status,'confident');
 }
});

test('the actual reported screenshot recognizes Sanji despite its small in-game portrait',async()=>{
 const icon=sharp('tests/fixtures/catalog/sanji-halloween.png').extract({left:3,top:70,width:72,height:72}).flatten({background:'#000'}).removeAlpha();
 const coarse=await icon.clone().resize(8,8,{fit:'fill'}).raw().toBuffer();
 const fine=await icon.clone().resize(24,24,{fit:'fill'}).raw().toBuffer();
 const result=matchDescriptor(coarse,fine,loadReference('public/data'));
 assert.equal(result.candidates[0].id,'4654');assert.equal(result.status,'confident');
});

test('literal imports reject executable expressions and preserve deleted ownership IDs and dual types',()=>{
 assert.throws(()=>readAssignment('window.units = (()=>{throw Error("run")})()','units'));
 assert.throws(()=>readAssignment('window.details = {}','units'));
 assert.deepEqual(readAssignment('window.flags = {1:{global:1}};','flags'),{'1':{global:1}});
 const catalog=buildCatalog({units:{'3':{id:'3',name:'Dual',maxLevel:99},'3-1':{id:'3-1',name:'First',type:'DEX',class:'Fighter'},'3-2':{id:'3-2',name:'Second',type:'STR',class:'Fighter'}},details:{},flags:{'3':{global:1}},rumble:{units:[]},previous:{characters:[{id:'999',name:'Saved character'}]},revision:{sha:'fixture'}});
 assert.deepEqual(catalog.characters.find(c=>c.id==='3')!.types,['DEX','STR']);
 assert.equal(catalog.characters.find(c=>c.id==='3')!.global,true);
 assert.equal(catalog.characters.find(c=>c.id==='3-1')!.global,null);
 assert.ok(catalog.characters.some(c=>c.id==='999'));assert.equal(catalog.metadata.total,4);
});
