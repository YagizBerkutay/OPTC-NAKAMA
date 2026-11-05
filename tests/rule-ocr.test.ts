import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs/promises';
const require=createRequire(import.meta.url),sharp=require('sharp'),{createRuleOCR}=require('../electron/rule-ocr.cjs');
test('cancelled rule OCR keeps its temp image until backend drain and retries with a fresh file',async()=>{
 let entered!:()=>void,drain!:()=>void,reads=0;const started=new Promise<void>(r=>entered=r),files:string[]=[],client={read(file:string,{signal,onDrained}:any){files.push(file);if(++reads===1){drain=onDrained;return new Promise((_resolve,reject)=>{entered();signal.addEventListener('abort',()=>reject(Error('OCR request cancelled.')),{once:true});});}return Promise.resolve({text:'ok',lines:[{text:'ok',words:[]}]});},close(){}},ocr=createRuleOCR({client,closeLines:async()=>{}}),image=await sharp({create:{width:40,height:20,channels:3,background:'black'}}).png().toBuffer(),controller=new AbortController();
 const first=assert.rejects(ocr.ocrBuffer(image,{signal:controller.signal}),/cancel/i);await started;controller.abort();await first;await fs.access(files[0]);
 const retry=await ocr.ocrBuffer(image);assert.equal(retry.text,'ok');assert.equal(reads,2);assert.notEqual(files[0],files[1]);await fs.access(files[0]);await assert.rejects(fs.access(files[1]),{code:'ENOENT'});
 drain();await new Promise(r=>setTimeout(r,20));await assert.rejects(fs.access(files[0]),{code:'ENOENT'});
});
