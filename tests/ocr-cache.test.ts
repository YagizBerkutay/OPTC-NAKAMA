import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const require=createRequire(import.meta.url),{cacheOCR}=require('../electron/ocr-cache.cjs');
test('only identical pixels and OCR options share work, and callers cannot mutate cached geometry',async()=>{
 let reads=0;const read=cacheOCR(async()=>{reads++;await new Promise(r=>setTimeout(r,1));return {lines:[{text:'450',words:[{x:1}]}]};});const [a,b]=await Promise.all([read(Buffer.from('one')),read(Buffer.from('one'))]);assert.equal(reads,1);a.lines[0].words[0].x=9;assert.equal(b.lines[0].words[0].x,1);assert.equal((await read(Buffer.from('one'))).lines[0].words[0].x,1);
 await read(Buffer.from('two'));await read(Buffer.from('one'),{scale:2});await read(Buffer.from('one'),{crop:{left:0,top:0,width:1,height:1}});assert.equal(reads,4);
});
test('failed OCR retries normally and bounded cache evicts old images',async()=>{
 let reads=0;const read=cacheOCR(async()=>{if(++reads===1)throw Error('failure');return {text:'ok'};},{entries:1});await assert.rejects(read(Buffer.from('a')),/failure/);await read(Buffer.from('a'));await read(Buffer.from('b'));await read(Buffer.from('a'));assert.equal(reads,4);
});
