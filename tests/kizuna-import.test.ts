import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {applyKizunaImport,identityFromText,parseKizunaImages,readEffects,setupFromGuide,type KizunaImagePage} from '../src/kizuna-import';
import {newKizunaSetup,validateKizunaSetup} from '../src/kizuna';
import type {Character} from '../src/model';
import type {Encounter} from '../src/boss-library';
const require=createRequire(import.meta.url);
const characters=[{id:'101',name:'Sanji - Halloween Party',types:['PSY'],stars:'5'},{id:'102',name:'Sanji - Black Leg',types:['STR'],stars:'5'}] as Character[];
const photo=(text:string):KizunaImagePage=>({name:'qa.png',hash:'a'.repeat(64),text,lines:[],cards:[]});
const basic='Special Effects\nNo. 101\nATK, HP and RCV x2\nTreasure tickets x1.3\nTokens x1.25\nSpecial cooldown reduced by 15 turns';

test('image import reads labelled stats, separate currencies and initial cooldown without typing rows',()=>{
 const r=parseKizunaImages([photo(basic)],characters);assert.equal(r.rows.length,1);const b=r.rows[0].bonus;
 assert.deepEqual([b.id,b.atk,b.hp,b.rcv,b.tickets,b.tokens,b.cooldown,b.friend],['101',2,2,2,1.3,1.25,15,false]);
 const original=newKizunaSetup(),applied=applyKizunaImport(original,r);assert.equal(applied.bonusesConfirmed,true);assert.equal(applied.bonuses[0].confirmed,true);assert.equal(original.bonuses.length,0);
 assert.deepEqual(validateKizunaSetup(applied,new Set(['101','102'])),applied);
});
test('separate factors never broadcast between HP, ATK and RCV',()=>{
 assert.deepEqual(readEffects('ATK x2 HP x3 RCV x1.5').values,{atk:2,hp:3,rcv:1.5,friend:false});
 assert.equal(readEffects('Treasure tickets x1.3').values.tokens,undefined);
 assert.equal(readEffects('ATK x2').values.hp,undefined);
});
test('conditional bonuses and captain skill damage are not unconditional event stats',()=>{
 const r=readEffects('If captain is STR, ATK x5\nCaptain Ability: Boosts ATK x6\nDeals ATK x100 damage\nTickets x1.2');
 assert.equal(r.values.atk,undefined);assert.equal(r.values.tickets,1.2);assert.ok(r.warnings.length>=3);
});
test('missing or corrupted numeric tokens block import rather than silently becoming neutral stats',()=>{
 for(const line of ['ATK','ATK x2.o','Tickets x1.3.5']){const r=parseKizunaImages([photo('Special Effects\nNo. 101\n'+line+'\nTokens x1.25')],characters);assert.throws(()=>applyKizunaImport(newKizunaSetup(),r));}
});

test('same short name never selects an arbitrary version; exact catalog title can',()=>{
 assert.equal(parseKizunaImages([photo('Special Effects\nSanji\nATK x2')],characters).rows.length,0);
 assert.equal(parseKizunaImages([photo('Special Effects\nSanji - Halloween Party\nATK x2')],characters).rows[0].bonus.id,'101');
});
test('unknown ID and inconclusive portraits require selection',()=>{
 const r=parseKizunaImages([photo(basic.replace('101','999'))],characters);assert.equal(r.rows[0].bonus.id,'');assert.throws(()=>applyKizunaImport(newKizunaSetup(),r));
});
test('overlap duplicates merge, conflicting amounts block import',()=>{
 const identical=parseKizunaImages([photo(basic),{...photo(basic),hash:'b'.repeat(64)}],characters);assert.equal(identical.rows.length,1);
 const conflict=parseKizunaImages([photo(basic),{...photo(basic.replace('tickets x1.3','tickets x1.5')),hash:'b'.repeat(64)}],characters);assert.throws(()=>applyKizunaImport(newKizunaSetup(),conflict));
 const one=readEffects('ATK x2\nATK x3');assert.ok(one.warnings.some(w=>/Çelişen/.test(w)));
});
test('no eligible-effect heading does not import an ordinary card special',()=>{
 assert.equal(parseKizunaImages([photo('No. 101\nSpecial Ability\nATK x5')],characters).rows.length,0);
});
test('identity reads exact HP and level band, and isolates Battle 1 charge',()=>{
 const text='Kizuna Clash vs. Koala\nBoss type: QCK\nLv. 31-40\nBoss HP: 9,007,199,254,740,993\nBATTLE 1\nFighter and STR special cooldown reduced by 15 turns\nBATTLE 2\nDEX special cooldown reduced by 5 turns';
 const p=identityFromText(text);assert.equal(p.event,'Kizuna Clash vs. Koala');assert.equal(p.enemyType,'QCK');assert.equal(p.maxHP,'9007199254740993');assert.equal(p.levelMax,40);assert.deepEqual(p.charge?.classes,['Fighter']);assert.deepEqual(p.charge?.types,['STR']);assert.equal(p.charge?.amount,15);
 assert.equal(identityFromText('Special Effects\nSTR special cooldown reduced by 15 turns').charge,undefined);
});
test('portrait groups share their description without borrowing the next groups bonus',()=>{
 const p=photo('Special Effects');p.cards=[{rect:{x:20,y:100,size:60},status:'confident',candidates:[{id:'101',key:'101',error:4,similarity:96}],crop:'data:image/png;base64,AA=='},{rect:{x:20,y:300,size:60},status:'review',candidates:[{id:'102',key:'102',error:35,similarity:65}],crop:'data:image/png;base64,AA=='}];p.lines=[{y:170,height:12,text:'ATK x2'},{y:370,height:12,text:'ATK x3'}];
 const r=parseKizunaImages([p],characters);assert.equal(r.rows[0].bonus.atk,2);assert.equal(r.rows[1].bonus.atk,3);assert.equal(r.rows[1].bonus.id,'');
});
test('live Trusty layout has wrapped descriptions above icons and separate owned-only reward groups',()=>{
 const text='TRUSTY CHARACTERS!\nWhen on the crew,\nboosts Kizuna Tickets earned\nfor Clear Rewards by 1.4x,\nboosts Super Boss Tokens\nearned for Clear Rewards by 1.2x,\nstats boosted by 5x, Damage Limit\nBreak effect boosted by +1.5, Special\ncharge time reduced by 15 turns at\nstart of quest, and makes character\nattacks effective against all enemy\ntypes!';
 const p=photo(text+'\nWhen owned,\nboosts Kizuna Tickets earned\nfor Clear Rewards by 1.2x!');p.cards=[{rect:{x:100,y:500,size:70},status:'confident',candidates:[{id:'101',key:'101',error:3,similarity:97}],crop:''},{rect:{x:100,y:800,size:70},status:'confident',candidates:[{id:'102',key:'102',error:3,similarity:97}],crop:''}];
 p.lines=text.split('\n').map((text,i)=>({text,y:40+i*25,height:20}));p.lines.push({text:'When owned,',y:650,height:20},{text:'boosts Kizuna Tickets earned',y:675,height:20},{text:'for Clear Rewards by 1.2x!',y:700,height:20});
 const r=parseKizunaImages([p],characters);assert.equal(r.rows.length,2);const b=r.rows[0].bonus;assert.deepEqual([b.atk,b.hp,b.rcv,b.tickets,b.tokens,b.cooldown],[5,5,5,1.4,1.2,15]);assert.equal(r.rows[1].scope,'owned');assert.equal(r.rows[1].bonus.tickets,1.2);
 const applied=applyKizunaImport(newKizunaSetup(),r);assert.deepEqual(applied.bonuses.map(b=>b.id),['101']);assert.ok(applied.otherEffects.includes('Sahiplik bonusu #102'));assert.ok(applied.otherEffects.includes('tam hesaplanmıyor'));
 const bad={...p,text:p.text.replace('1.4x','1 .ax'),lines:p.lines.map(l=>({...l,text:l.text.replace('1.4x','1 .ax')}))};assert.throws(()=>applyKizunaImport(newKizunaSetup(),parseKizunaImages([bad],characters)));
});
test('guide selects identity and clears another events bonus evidence without mutating guide',()=>{
 const guide={training:false,reviewed:'2026-10-21',notes:'QA',id:'next',name:'Kizuna Clash vs. Koala',difficulty:'10★ · Lv.31–40',source:'https://example.test/fixture',stages:[{id:'s',name:'Battle 3',turn:2,requirements:[],notes:'',hp:123456,enemyType:'QCK'}]} as Encounter;
 const old={...newKizunaSetup(),profileId:'previous',bonusesConfirmed:true,bonuses:applyKizunaImport(newKizunaSetup(),parseKizunaImages([photo(basic)],characters)).bonuses};
 const before=structuredClone(guide),next=setupFromGuide(old,guide);assert.equal(next.event,guide.name);assert.equal(next.level,31);assert.equal(next.enemyType,'QCK');assert.equal(next.maxHP,'123456');assert.equal(next.source,guide.source);assert.equal(next.bonuses.length,0);assert.deepEqual(guide,before);
});
test('import preserves unsupported effects as explicit draft context, not invented cap values',()=>{
 const r=parseKizunaImages([photo(basic+'\nDamage Limit Break x10')],characters),s=applyKizunaImport(newKizunaSetup(),r);assert.ok(s.otherEffects.includes('tam hesaplanmıyor'));assert.equal(s.statOrder,'unknown');assert.equal(s.rewardStack,'unknown');
});
test('identity conflicts in different images are not silently accepted',()=>{
 const r=parseKizunaImages([photo('Kizuna Clash vs. A\n'+basic),{...photo('Kizuna Clash vs. B\n'+basic),hash:'b'.repeat(64)}],characters);assert.throws(()=>applyKizunaImport(newKizunaSetup(),r));
});
test('dedicated image worker service reads without a deadline, cancels, and isolates concurrent runs',async t=>{
 const {createService}=require('../electron/kizuna-image-service.cjs');const workers:any[]=[];
 class FakeWorker extends EventEmitter {terminated=false;constructor(){super();workers.push(this);}async terminate(){this.terminated=true;}}
 const service=createService({WorkerClass:FakeWorker}),inputs=[{name:'qa.png',dataUrl:'data:image/png;base64,AA=='}];t.mock.timers.enable({apis:['setTimeout']});t.after(()=>service.cancel());
 const first=service.read(inputs);assert.throws(()=>service.read(inputs),/zaten/);service.cancel();await assert.rejects(first,/iptal/);assert.equal(workers[0].terminated,true);
 let settled=false;const progress:string[]=[];const second=service.read(inputs,(text:string)=>progress.push(text)).finally(()=>{settled=true;});t.mock.timers.tick(90001);await new Promise(r=>setImmediate(r));assert.equal(settled,false);assert.equal(workers[1].terminated,false);workers[1].emit('message',{type:'progress',text:'Special Effects okunuyor'});assert.deepEqual(progress,['Special Effects okunuyor']);workers[1].emit('message',{type:'result',result:[{name:'long read'}]});assert.deepEqual(await second,[{name:'long read'}]);assert.equal(workers[1].terminated,true);
 const third=service.read(inputs);workers[2].emit('message',{type:'result',result:[{name:'ok'}]});assert.deepEqual(await third,[{name:'ok'}]);
 assert.throws(()=>service.read(Array(7).fill(inputs[0])),/6/);
});
