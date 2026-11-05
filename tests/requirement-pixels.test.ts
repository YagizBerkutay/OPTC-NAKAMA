import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp'),{readRequirementPixels}=require('../electron/requirement-pixels.cjs'),{ocrBuffer,closeOCR}=require('../electron/rule-ocr.cjs'),meta=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/requirement-cycle.json',import.meta.url),'utf8')),sheet=fs.readFileSync(new URL('./fixtures/boss-behavior/requirement-cycle.png',import.meta.url));
const caption='QCK/PSY characters only/ You will be Neo Ambushed at a certain rate every time you clear the quest!';
async function frames(){const {left,top,width,height}=meta.crop;return Promise.all(Array.from({length:meta.count},async(_,i)=>{const input=await sharp(sheet).extract({left:0,top:i*height,width,height}).png().toBuffer();return sharp({create:{width:900,height:1600,channels:3,background:'black'}}).composite([{input,left,top}]).png().toBuffer();}));}
test('the real held-tooltip cycle is assembled before OCR and verifies the full eligibility and Ambush suffix',{skip:process.platform!=='win32'},async()=>{
 let calls=0;try{const result=await readRequirementPixels(await frames(),meta.button,meta.identity,{readOCR:async(...args:any[])=>{calls++;return ocrBuffer(...args);}});assert.equal(result?.status,'verified');assert.deepEqual(result.allowedTypes,['QCK','PSY']);assert.equal(result.text,caption);assert.equal(calls,2);}finally{closeOCR();}
});
test('storing only each recorded REQUIREMENT crop preserves the same verified result',{skip:process.platform!=='win32'},async()=>{
 let calls=0;try{const full=await frames(),roi=await Promise.all(full.map(image=>sharp(image).extract(meta.crop).png().toBuffer())),stored=roi.map(image=>({image,rect:meta.crop,source:{width:900,height:1600}})),readOCR=async(...args:any[])=>{calls++;return ocrBuffer(...args);},a=await readRequirementPixels(full,meta.button,meta.identity,{readOCR}),b=await readRequirementPixels(stored,meta.button,meta.identity,{readOCR});
  assert.equal(a?.status,'verified');assert.equal(b?.status,a?.status);assert.equal(b?.text,a?.text);assert.deepEqual(b?.allowedTypes,a?.allowedTypes);assert.equal(b?.text,caption);assert.equal(calls,4);
 }finally{closeOCR();}
});
test('an incomplete tooltip cycle or cancellation cannot certify its unseen caption',async()=>{
 const images=await frames();assert.equal(await readRequirementPixels(images.slice(0,2),meta.button,meta.identity),null);await assert.rejects(readRequirementPixels(images,meta.button,meta.identity,{check:()=>{throw Error('Cancelled');}}),/Cancelled/);
});
