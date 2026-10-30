import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {recognize,validateImage,validateGrid,matchDescriptor,loadReference,attribute}=require('../electron/recognition-core.cjs');
test('recognition rejects arbitrary file URLs and unbounded grids',()=>{
  for(const input of ['file:///C:/secret.png','https://example.com/test.png','data:text/html;base64,aGVsbG8='])assert.throws(()=>validateImage(input));
  const base={x:10,y:10,size:100,pitchX:110,pitchY:110,columns:5,rows:4};
  assert.equal(validateGrid(base,900,1600).columns,5);
  for(const patch of [{columns:99},{size:-10},{x:1000},{pitchX:0},{y:NaN}])assert.throws(()=>validateGrid({...base,...patch},900,1600));
});
test('identical artwork with two different character IDs requires review',()=>{
  const reference=loadReference('public/data');const template=reference.bytes.subarray(0,1920);
  const tied={meta:{templates:[{id:'1',key:'0001'},{id:'2',key:'0002'}]},bytes:Buffer.concat([template,template])};
  const found=matchDescriptor(template.subarray(0,192),template.subarray(192),tied);
  assert.equal(found.status,'review');assert.equal(found.margin,0);
});
test('real MuMu box locates grid, distinguishes unit versions and rejects material tiles',{skip:!fs.existsSync('.local/recognition-box.png')},async()=>{
  const dataUrl='data:image/png;base64,'+fs.readFileSync('.local/recognition-box.png').toString('base64');
  const result=await recognize(dataUrl,null,'public/data');
  assert.ok(result.isCharacterBox);
  const found=result.detections.filter((d:any)=>d.status==='confident');
  assert.deepEqual(found.map((d:any)=>d.candidates[0].id),['4068','4162','3592']);
  assert.ok(Math.abs(result.grid.y-503)<=3);
  assert.ok(result.detections.slice(3).every((d:any)=>d.status==='unknown'));
});
test('home screen does not produce automatic box registrations',{skip:!fs.existsSync('.local/recognition-live.png')},async()=>{
  const dataUrl='data:image/png;base64,'+fs.readFileSync('.local/recognition-live.png').toString('base64');
  const result=await recognize(dataUrl,null,'public/data');
  assert.equal(result.isCharacterBox,false);
  assert.equal(result.detections.filter((d:any)=>d.status==='confident').length,0);
});
test('attribute bubble distinguishes original and Neo versions of reused artwork',()=>{
  const ref=loadReference('public/data');
  for(const [key,type]of [['0794','INT'],['3321','QCK'],['0574','INT'],['1668','DEX']]){
    const i=ref.meta.templates.findIndex((t:any)=>t.key===key),start=i*1920;
    const coarse=ref.bytes.subarray(start,start+192),fine=ref.bytes.subarray(start+192,start+1920);
    assert.equal(attribute(fine),type);
    const result=matchDescriptor(coarse,fine,ref);
    assert.equal(result.candidates[0].key,key);assert.equal(result.status,'confident');
  }
});
test('scrolled box keeps the first full row and excludes rows covered by the counter',{skip:!fs.existsSync('.local/recognition-problem.png')},async()=>{
  const r=await recognize('data:image/png;base64,'+fs.readFileSync('.local/recognition-problem.png').toString('base64'),null,'public/data');
  assert.ok(r.isCharacterBox);assert.ok(Math.abs(r.grid.y-450)<=4);
  assert.deepEqual(r.detections.map((d:any)=>d.candidates[0].id),['3043','2428','2106','1810','1578','2341','2303','2564','794','1116','2088','3105','907','2654','1323','1569','352','352','739','2807']);
  assert.ok(r.detections.every((d:any)=>d.status==='confident'&&d.rect.y+d.rect.size<=1198));
});
test('scroll phase and overlay matching survive a smaller emulator resolution',{skip:!fs.existsSync('.local/recognition-problem.png')},async()=>{
  const png=await sharp('.local/recognition-problem.png').resize(540,960).png().toBuffer();
  const r=await recognize('data:image/png;base64,'+png.toString('base64'),null,'public/data');
  assert.ok(Math.abs(r.grid.y-270)<=4);assert.equal(r.detections.length,20);
  assert.deepEqual(r.detections.slice(0,5).map((d:any)=>d.candidates[0].id),['3043','2428','2106','1810','1578']);
  assert.ok(r.detections.every((d:any)=>d.status==='confident'));
});
test('reported broken crop is rejected instead of given a confident unrelated unit',{skip:!fs.existsSync('.local/recognition-reported-crop.png')},async()=>{
  const im=sharp('.local/recognition-reported-crop.png').extract({left:47,top:25,width:96,height:96}).flatten({background:'#000'}).removeAlpha();
  const coarse=await im.clone().resize(8,8,{fit:'fill'}).raw().toBuffer(),fine=await im.clone().resize(24,24,{fit:'fill'}).raw().toBuffer();
  assert.equal(matchDescriptor(coarse,fine,loadReference('public/data')).status,'unknown');
});
const dualIds=['4068','4162','3592','1985','2446','3164','2603','2802','2835','2860','2862','3493','3065','3253','3433','3708','3908','3922','4140','4257'];
test('real dual box recognizes reported units and keeps dual forms on their ownership IDs',{skip:!fs.existsSync('.local/recognition-dual-open.png')},async()=>{
  const r=await recognize('data:image/png;base64,'+fs.readFileSync('.local/recognition-dual-open.png').toString('base64'),null,'public/data');
  assert.deepEqual(r.detections.map((d:any)=>d.candidates[0].id),dualIds);
  assert.ok(r.detections.every((d:any)=>d.status==='confident'));
  assert.ok(Math.abs(r.grid.x-34)<=2);assert.ok(Math.abs(r.grid.pitchX-158)<=1);
});
test('measures horizontal origin and pitch instead of assuming a fixed screen fraction',{skip:!fs.existsSync('.local/recognition-spacing-fixture.png')},async()=>{
  const r=await recognize('data:image/png;base64,'+fs.readFileSync('.local/recognition-spacing-fixture.png').toString('base64'),null,'public/data');
  assert.ok(Math.abs(r.grid.x-50)<=2);assert.equal(r.grid.pitchX,144);assert.equal(r.grid.size,142);
  assert.deepEqual(r.detections.map((d:any)=>d.candidates[0].id),dualIds);
  assert.ok(r.detections.every((d:any)=>d.status==='confident'));
});
