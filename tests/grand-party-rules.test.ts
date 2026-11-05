import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import sharp from 'sharp';
import {validateGPRules} from '../src/grand-party-rules';
const require=createRequire(import.meta.url),{parseGrandPartyRules,createGrandPartyReader,readVerifiedGrandPartyRules}=require('../electron/grand-party-rules.cjs');
const current='If leader is Driven/Slasher, [Elbaph Arc] [Revolutionary Army] [Royalty] teammates DEF Up Lv.5, Special CT Speed Up Lv.5, team HP, ATK, SPD, RCV Up Lv.5, GP Burst Launch Requirement -40%, GP Burst Uses +1 (Special Rule will only affect the Combat Power); During the last 30 s of battle, Special CT Speed Up & Damage Up!';
test('current GP rules distinguish the leader condition from tagged teammates and inherit the CT target',()=>{
 const result=validateGPRules(parseGrandPartyRules(current)),s=result.season;
 assert.deepEqual(s.leaderTargets,['Driven','Slasher']);assert.equal(s.effectsRequireLeader,true);
 assert.deepEqual(s.effects.map(e=>e.targeting?.targets),[['Elbaph Arc','Revolutionary Army','Royalty'],['Elbaph Arc','Revolutionary Army','Royalty'],['crew']]);
 assert.deepEqual(s.effects.map(e=>e.attributes),[['DEF'],['Special CT'],['HP','ATK','SPD','RCV']]);
 assert.equal(s.extraUses,1);assert.equal(s.chargeMultiplier,1/.6);assert.match(s.note!,/Son 30/);assert.match(s.note!,/Combat Power/);
 assert.equal(parseGrandPartyRules(current.replace('HP, ATK','HP. ATK')).fingerprint,result.fingerprint);
});
test('older event targets and future levels are read from text without loading a historical preset',()=>{
 const raw=current.replace('Driven/Slasher','[Elbaph Arc] [World Government]').replace('[Elbaph Arc] [Revolutionary Army] [Royalty] teammates DEF','PSY/DEX teammates DEF').replace('Special CT Speed Up Lv.5','Striker/Powerhouse teammates Special CT Speed Up Lv.4');
 const s=parseGrandPartyRules(raw).season;
 assert.deepEqual(s.leaderTargets,['Elbaph Arc','World Government']);assert.deepEqual(s.effects[0].targeting.targets,['PSY','DEX']);assert.deepEqual(s.effects[1].targeting.targets,['Striker','Powerhouse']);assert.equal(s.effects[1].level,4);
});
test('incomplete tags, decimal / letter numbers, truncated tails and unsupported numerical rules fail closed',()=>{
 for(const bad of [current.replace('-40%','-00%'),current.replace('-40%','-4O%'),current.replace('-40%','-40.5%'),current.replace('Lv.5','Lv.59'),current.replace('[Royalty]','[Royalty'),current.replace('Uses +1','Uses +1.5'),current.replace('Damage Up!','Damage'),current.replace(', GP Burst Launch',', cost 200, GP Burst Launch')])assert.throws(()=>parseGrandPartyRules(bad));
});
test('renderer rejects foreign-mode or malformed GP observations before planning',()=>{
 const value=parseGrandPartyRules(current);assert.throws(()=>validateGPRules({...value,mode:'assault'}));assert.throws(()=>validateGPRules({...value,observedAt:'invalid'}));assert.throws(()=>validateGPRules({...value,season:{...value.season,chargeMultiplier:Infinity}}));assert.throws(()=>validateGPRules({...value,season:{...value.season,effects:[{effect:'buff',level:5,attributes:['HP'],targeting:{targets:[]}}]}}));
});
async function fixture(){
 const image=await sharp({create:{width:900,height:1600,channels:3,background:'#000'}}).png().toBuffer();let state='home';const moves:string[]=[];
 const io={wait:async()=>{},capture:async()=>({image,width:900,height:1600}),ocr:async()=>({text:state==='home'?'NEXT WIN REWARD\nRULE DETAILS':'If leader is Driven/Slasher\nGP Burst Uses +1\n0K',lines:[]}),rules:async()=>parseGrandPartyRules(current),input:async(_exe:string,_device:string,_snap:unknown,action:string)=>{moves.push(action);state=action==='rules'?'rules':'home';}};
 return {io,moves,reader:createGrandPartyReader(io)};
}
test('GP intake opens only Rule Details, verifies all rules, closes the popup and returns home',async()=>{
 const f=await fixture(),observed:unknown[]=[];const result=await f.reader.read({exe:'adb',device:'device'},()=>{},(...args:unknown[])=>observed.push(args));assert.deepEqual(f.moves,['rules','close']);assert.equal(result.season.extraUses,1);assert.ok(observed.length>=3);
});
test('unknown screens and unverified rules never trigger a battle or silent fallback',async()=>{
 const f=await fixture();f.io.ocr=async()=>({text:'Character Box',lines:[]});await assert.rejects(f.reader.read({exe:'adb',device:'device'}),/ana ekran/);assert.deepEqual(f.moves,[]);
 const g=await fixture();g.io.rules=async()=>{throw Error('numeric disagreement');};await assert.rejects(g.reader.read({exe:'adb',device:'device'}),/numeric disagreement/);assert.deepEqual(g.moves,['rules']);
});
test('cancelled capture drains before a single reserved restart; stale work cannot send input',async()=>{
 const f=await fixture(),capture=f.io.capture;let release!:()=>void,entered!:()=>void,first=true;
 const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);f.io.capture=async()=>{if(first){first=false;entered();await gate;}return capture();};
 const old=f.reader.read({exe:'adb',device:'device'});await started;f.reader.cancel();const oldRejected=assert.rejects(old,/iptal/),next=f.reader.read({exe:'adb',device:'device'});await assert.rejects(f.reader.read({exe:'adb',device:'device'}),/sürüyor/);assert.deepEqual(f.moves,[]);release();await oldRejected;assert.equal((await next).mode,'grand-party');assert.deepEqual(f.moves,['rules','close']);
});
test('two readers must agree on every GP rule line including recovered percentages',async()=>{
 const image=await sharp({create:{width:900,height:1600,channels:3,background:'#000'}}).png().toBuffer();
 const rows=[current.slice(0,current.indexOf('Requirement ')),current.slice(current.indexOf('Requirement '))],wrong=rows[1].replace('-40%','-00%');let calls=0;
 let lineCalls=0;const read=async()=>++calls===1?{text:current,lines:rows.map((text,i)=>({text:i?wrong:text,words:[{x:0,y:100+i*40,width:600,height:30}]}))}:{text:rows[1]},line=async()=>({text:rows[lineCalls++]});
 const result=await readVerifiedGrandPartyRules(image,{left:0,top:0,width:900,height:1600},{read,line});assert.equal(result.season.chargeMultiplier,1/.6);
 calls=0;lineCalls=0;await assert.rejects(readVerifiedGrandPartyRules(image,{left:0,top:0,width:900,height:1600},{read:async()=>++calls===1?{text:current,lines:[{text:rows[1],words:[{x:0,y:100,width:600,height:30}]}]}:{text:rows[1]},line:async()=>({text:rows[1].replace('-40%','-4%')})}),/iki okuyucuyla/);
});
