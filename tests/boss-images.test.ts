import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{assembleImages,validateImages,readImages}=require('../electron/boss-images.cjs');
const hash='a'.repeat(64),base=()=>({title:'Clash!! Fixture',difficulty:10,level:null,requirement:'Only Fighter/Slasher/Striker characters',noRestrictions:false,confirmed:true,pages:[{hash,text:'BATTLE 1\nBATTLE 3\nPREEMPTIVE\n5 turn(s) DEF Up\nBATTLE 4\nPREEMPTIVE\n5 turn(s) Damage Threshold',battle:1,trigger:''},{hash,text:'BATTLE 4\nDEFEATED\n30000 damage\nBATTLE 5\nPREEMPTIVE\n7 turn(s) Despair',battle:4,trigger:''}]});
test('reviewed photos share normal stage, restriction and on-defeat parsing without scroll merging',()=>{
 const result=assembleImages(base());assert.equal(result.stages.length,5);assert.equal(result.stages[1].behaviorStatus,'notListed');assert.deepEqual(result.stages[2].requirements,[{mechanic:'defenseUp',turns:5}]);assert.equal(result.stages[3].events.find((e:any)=>e.trigger==='defeated').text,'30000 damage');assert.equal(result.restrictions.status,'verified');assert.deepEqual(result.restrictions.allowedClasses,['Fighter','Slasher','Striker']);assert.equal(result.observation.complete,true);assert.match(result.restrictions.source,/Kullanıcının/);
});
test('manual review never bypasses contradictory numbers, unlabeled fragments or incomplete requirements',()=>{
 const conflict=base();conflict.pages.push({hash,battle:3,trigger:'PREEMPTIVE',text:'BATTLE 3\nPREEMPTIVE\n9 turn(s) DEF Up'});assert.throws(()=>assembleImages(conflict),/sayıları çelişiyor/);
 const fragment=base();fragment.pages=[{hash,battle:3,trigger:'',text:'5 turn(s) DEF Up'}];assert.throws(()=>assembleImages(fragment),/tetiğini seç/);
 fragment.pages[0].trigger='PREEMPTIVE';assert.equal(assembleImages(fragment).stages[2].requirements[0].turns,5);
 const missing=base();missing.requirement='Only Fighter characte';assert.equal(assembleImages(missing).restrictions.status,'partial');assert.throws(()=>assembleImages({...base(),confirmed:false}),/onayı gerekli/);
 assert.throws(()=>assembleImages({...base(),noRestrictions:true}),/yazılıyken/);assert.equal(assembleImages({...base(),noRestrictions:true,requirement:''}).restrictions.status,'verified');
});
test('image input rejects URLs, SVG, oversized batches and arbitrary filenames as paths',async()=>{
 for(const dataUrl of ['https://example.com/screen.png','file:///C:/private.png','data:image/svg+xml;base64,AAAA'])assert.throws(()=>validateImages([{name:'x',dataUrl}]),/PNG/);
 assert.throws(()=>validateImages(Array.from({length:21},()=>({name:'x',dataUrl:'data:image/png;base64,AAAA'}))),/1–20/);
 const bytes=fs.readFileSync(new URL('./fixtures/boss-behavior/heal-number-after.png',import.meta.url));let saved=false;
 const result=await readImages([{name:'../../outside.png',dataUrl:'data:image/png;base64,'+bytes.toString('base64')}],()=>{},async()=>({text:'BATTLE 3\nPREEMPTIVE',lines:[],width:900,height:1600}),async(name:string)=>{assert.match(name,/^[a-f0-9]{64}$/);saved=true;});assert.equal(saved,true);assert.equal(result[0].text,'BATTLE 3\nPREEMPTIVE');
});
test('PKA photo imports preserve the explicitly selected level range and do not invent stars',()=>{
 const result=assembleImages({...base(),mode:'pka',difficulty:null,levelRange:[80,99]});assert.deepEqual(result.observation.levelRange,[80,99]);assert.equal(result.observation.difficulty,null);assert.match(result.difficulty,/80–99/);assert.throws(()=>assembleImages({...base(),mode:'pka',levelRange:[100,80]}),/Lv. aralığını/);
});
