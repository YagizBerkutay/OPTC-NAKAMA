import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{parseGamewith,jpNumber}=require('../electron/gamewith-guide.cjs'),{safeUrl,createGuideService}=require('../electron/guides.cjs');
// Numeric action-table facts from the cited Marco 10-star guide; no team prose.
const html='<h1>決戦マルコ 星10</h1><h3>4階のギミック解説</h3><table><tr><th>敵</th><th>HP</th><th>攻撃力</th><th>攻撃間隔</th></tr><tr><td>ジョズ</td><td>800万</td><td>8000</td><td>1</td></tr></table><h4>行動パターン</h4><table><tr><th>ﾀｰﾝ 体力</th><th>頻度 ﾀｲﾐﾝｸﾞ</th><th>内容</th></tr><tr><td>先制 -</td><td>- -</td><td>2万ダメージ<br>一定以上激減(5ターン)<br>防御アップ(200万/5ターン)</td></tr><tr><td>1 -</td><td>- -</td><td>ダメージ軽減(5ターン)</td></tr><tr><td>- -</td><td>- 撃破時</td><td>痺れ(10ターン)</td></tr></table>';
const url='https://xn--pck6bvfc.gamewith.jp/article/show/263248';
test('source action tables retain numbers and distinguish preemptive, subsequent turn and on-defeat',()=>{
 const r=parseGamewith(html,url),s=r.stages[0];assert.equal(s.hp,8000000);assert.equal(s.enemyAttack,8000);assert.deepEqual(s.requirements,[{mechanic:'threshold',turns:5},{mechanic:'defenseUp',turns:5}]);assert.deepEqual(s.events.map((e:any)=>e.trigger),['preemptive','turn','defeated']);assert.equal(s.events[1].battleTurn,2);assert.match(s.events[0].text,/20000 damage/);assert.match(s.events[0].text,/200万/);assert.equal(s.behaviorTextComplete,false);assert.equal(r.restrictions.status,'partial');assert.equal(jpNumber('1万2000'),12000);
});
test('only fixed provider hosts and guide paths are fetchable',()=>{
 assert.equal(safeUrl(url).hostname,'xn--pck6bvfc.gamewith.jp');for(const value of ['http://xn--pck6bvfc.gamewith.jp/article/show/1','https://evil.test/article/show/1','https://xn--pck6bvfc.gamewith.jp.evil.test/article/show/1',url+'?url=http://127.0.0.1',url+'#x','https://user@xn--pck6bvfc.gamewith.jp/article/show/1'])assert.throws(()=>safeUrl(value));
});
test('online confirmation requires a retrieved guide and matching difficulty, without certifying unknown source effects',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nakama-guide-test-'));try{
  fs.writeFileSync(path.join(dir,'guide-cache.json'),JSON.stringify({index:[],encounters:{[url]:parseGamewith(html,url)}}));const service=createGuideService(dir),input={title:'Clash!! Marco: Blue Flame',difficulty:10,requirement:'Only Fighter characters',noRestrictions:false,confirmed:true};
  assert.throws(()=>service.confirm(url,{...input,difficulty:7}),/eşleşmiyor/);assert.throws(()=>service.confirm(url,{...input,confirmed:false}),/doğrula/);const r=service.confirm(url,input);assert.equal(r.restrictions.status,'verified');assert.equal(r.stages[0].behaviorTextComplete,false);assert.equal(r.name,input.title);
 }finally{fs.unlinkSync(path.join(dir,'guide-cache.json'));fs.rmdirSync(dir);}
});
