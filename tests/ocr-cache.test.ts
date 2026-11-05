import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const require=createRequire(import.meta.url),{cacheOCR}=require('../electron/ocr-cache.cjs');
test('only identical pixels and OCR options share work, and callers cannot mutate cached geometry',async()=>{
 let reads=0;const read=cacheOCR(async()=>{reads++;await new Promise(r=>setTimeout(r,1));return {lines:[{text:'450',words:[{x:1}]}]};});const [a,b]=await Promise.all([read(Buffer.from('one')),read(Buffer.from('one'))]);assert.equal(reads,1);a.lines[0].words[0].x=9;assert.equal(b.lines[0].words[0].x,1);assert.equal((await read(Buffer.from('one'))).lines[0].words[0].x,1);
 await read(Buffer.from('two'));await read(Buffer.from('one'),{scale:2});await read(Buffer.from('one'),{crop:{left:0,top:0,width:1,height:1}});assert.equal(reads,4);
});
test('failed OCR retries normally and bounded cache evicts old images',async()=>{
 let reads=0;const read=cacheOCR(async()=>{if(++reads===1)throw Error('failure');return {text:'ok'};},{entries:1});await assert.rejects(read(Buffer.from('a')),/failure/);await read(Buffer.from('a'));await read(Buffer.from('b'));await read(Buffer.from('a'));assert.equal(reads,4);
});

test('coalesced OCR cancellation is per caller and only aborts backend work when all callers leave',async()=>{
 let reads=0,backendSignal!:AbortSignal,finish!:(value:any)=>void;const read=cacheOCR((_image:any,options:any)=>{reads++;backendSignal=options.signal;return new Promise(resolve=>{finish=resolve;});}),image=Buffer.from('shared'),aController=new AbortController(),bController=new AbortController();
 const a=read(image,{signal:aController.signal}).then(()=>false,()=>true),b=read(image,{signal:bController.signal});await new Promise(r=>setImmediate(r));aController.abort();assert.equal(await Promise.race([a,new Promise(r=>setTimeout(()=>r(false),100))]),true);assert.equal(backendSignal.aborted,false);finish({text:'ok'});assert.deepEqual(await b,{text:'ok'});assert.equal(reads,1);
 const cController=new AbortController(),retryImage=Buffer.from('all-abort'),next=read(retryImage,{signal:cController.signal}).then(()=>false,()=>true);await new Promise(r=>setImmediate(r));cController.abort();assert.equal(await Promise.race([next,new Promise(r=>setTimeout(()=>r(false),100))]),true);assert.equal(backendSignal.aborted,true);finish({text:'late'});await new Promise(r=>setImmediate(r));const retry=read(retryImage);await new Promise(r=>setImmediate(r));finish({text:'retry'});assert.deepEqual(await retry,{text:'retry'});assert.equal(reads,3);
});
