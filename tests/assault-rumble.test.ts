import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseAssaultRules,parseAssaultHome,parseSkillSection}=require('../electron/assault-rumble-core.cjs');
export const RULES='Shanks Boss team damage taken from QCK 30% Up, damage taken from Driven 30% Up, and damage taken from DEX 30% Down! Hancock Boss team damage taken from QCK 30% Up, damage taken from Striker 30% Up, and damage taken from DEX 30% Down! Mihawk Boss team damage taken from QCK 30% Up, damage taken from Driven 30% Up, and damage taken from DEX 30% Down! All Boss teams damage taken from [Giant] [World Government] 40% Up, and damage taken from [Domi Reversi] 20% Up! During the last 30 s of battle, Special CT Speed Up & Damage Up!';
test('Assault rules retain enemy direction and separate three bosses, grouped tags and unknown late magnitude',()=>{
 const r=parseAssaultRules(RULES);
 assert.deepEqual(r.bosses,['Shanks','Hancock','Mihawk']);assert.equal(r.rules.length,11);
 assert.deepEqual(r.rules[4],{boss:'Hancock',targets:['Striker'],percent:30,match:'any'});
 assert.deepEqual(r.rules[9],{boss:'all',targets:['Giant','World Government'],percent:40,match:'unknown'});
 assert.equal(r.rules[2].percent,-30);assert.equal(r.lateSeconds,30);assert.equal(r.stacking,'unknown');
 assert.equal(parseAssaultRules(RULES.replaceAll(' ','\n')).fingerprint,r.fingerprint);
});
test('An omitted percentage, conflicting duplicate, malformed tag or unexplained clause cannot become trusted rules',()=>{
 for(const text of [RULES.replace('40%',''),RULES.replace('40%','400%'),RULES.replace('[Giant]','[Giant'),RULES.replace('and damage taken from DEX 30% Down!','and damage taken from QCK 25% Up!'),RULES+' ATK Up Lv.5',RULES.replace('Damage Up!','Damage')])assert.throws(()=>parseAssaultRules(text),text);
 assert.throws(()=>parseAssaultRules('Block A STR-type ATK Up Lv.4;'));
});
test('Home reads Assault level independently of character skill levels and does not invent dates',()=>{
 assert.deepEqual(parseAssaultHome('ASSAULT RUMBLE\nAssault Lv 1\nRULES\nCHALLENGE\nSETUP'),{level:1,maxLevel:false});
 assert.deepEqual(parseAssaultHome('ASSAULT RUMBLE Assault Lv. MAX RULES CHALLENGE SETUP'),{level:null,maxLevel:true});
 assert.equal(parseAssaultHome('Character Details Lv.50 Moonlit Cup Lv.1 / 10'),null);
 assert.equal(parseAssaultHome('RUMBLE Block A RULES CHALLENGE SETUP'),null);
});
test('Static details take only the selected skill level and retain its boundary',()=>{
 const text='Moonlit Cup\nLv.1 (Max Lv.10)\nRUMBLE SPECIAL\nLv.1 CT29\nTargets all enemies for 2500 damage, DEF Down Lv.1 (50 s); targets teammates for ATK Up Lv.1 (30 s)\nLv.2 CT29\nTargets all enemies for 2600 damage';
 const s=parseSkillSection(text,1,'special');assert.equal(s.cooldown,29);assert.ok(s.text.includes('2500'));assert.ok(!s.text.includes('2600'));assert.equal(s.complete,true);
 assert.equal(parseSkillSection(text,2,'special').complete,false,'a clipped last section must not be trusted');
 assert.throws(()=>parseSkillSection(text,10,'special'));
});
