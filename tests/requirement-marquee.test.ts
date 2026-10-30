import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {eligibleForQuest,questRestrictionProblem,questPlanningWarning} from '../src/quest-restrictions';
import type {Character} from '../src/model';
const require=createRequire(import.meta.url),{parseRequirementTexts,parseRequirement}=require('../electron/quest-restrictions.cjs');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-neo-requirement.json',import.meta.url),'utf8'));

test('the actual corrupted fragments cannot be certified by repeating their visible header',()=>{
 const single=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-single-head.json',import.meta.url),'utf8')),head=single.texts[0];assert.equal(parseRequirementTexts(single.texts,single.identity).status,'partial');
 assert.equal(parseRequirementTexts([...single.texts,head],single.identity).status,'partial');
 for(const extra of ['STR','STR/PSY','Only QCK characters','Except PSY'])assert.equal(parseRequirementTexts([...single.texts,head,extra],single.identity).status,'partial');
});
test('actual CP9 marquee verifies QCK/PSY entry without treating a random Neo Ambush as a character ban',()=>{
 const r=parseRequirementTexts(fixture.texts,fixture.identity);assert.equal(r.status,'verified');assert.deepEqual(r.allowedTypes,['QCK','PSY']);
 assert.equal(r.text,'QCK/PSY characters only/ You will be Neo Ambushed at a certain rate every time you clear the quest!');assert.ok(r.warnings.some((s:string)=>s.startsWith('Neo Ambush:')));
 const boss=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-10star-observed.json',import.meta.url),'utf8'));assert.equal(questRestrictionProblem(boss),'');assert.ok(questPlanningWarning(boss).includes('ek bir Neo savaşı'));
 for(const types of [['QCK'],['PSY'],['QCK','PSY']])assert.equal(eligibleForQuest({types} as Character,r),true);
 for(const types of [['STR'],['DEX'],['INT'],['QCK','DEX'],[]])assert.equal(eligibleForQuest({types} as Character,r),false);
 assert.deepEqual(parseRequirement('QCK/PSY characters only').allowedTypes,['QCK','PSY']);
});
test('missing marquee end, inconsistent entry types or an extra eligibility clause remain blocked',()=>{
 const full='QCK/PSY characters only/ You will be Neo Ambushed at a certain rate every time you clear the quest!';
 for(const texts of [fixture.texts.slice(0,2),[full,full.replace('QCK/PSY','STR/DEX')],[full,full,'Only Fighter characters'],[full,full,full+' Only 5-star characters'],['Unknown characters only/ You will be Neo','Unknown characters only/ You will be Neo'],[full]]){
  const r=parseRequirementTexts(texts,fixture.identity);assert.equal(r.status,'partial');assert.equal(r.allowedTypes,undefined);assert.ok(questRestrictionProblem({restrictions:r} as any));
 }
});
test('longer capture keeps a verified ordinary restriction while literal clipped tails cannot add a different rule',()=>{
 const full='Only Fighter/Slasher/Striker characters',r=parseRequirementTexts([full,full,'ter/Slasher/Striker characters','Striker characters'],fixture.identity);
 assert.equal(r.status,'verified');assert.deepEqual(r.allowedClasses,['Fighter','Slasher','Striker']);
 for(const extra of ['Only Shooter characters','Except Imu','Only characters with a cost of 99 or less'])assert.equal(parseRequirementTexts([full,full,extra],fixture.identity).status,'partial');
});
test('v0.5.28 production failure joins literal interiors despite corrupted clipped words at both edges',()=>{
 const failed=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-neo-requirement-failed-0528.json',import.meta.url),'utf8'));
 const r=parseRequirementTexts(failed.texts,failed.identity);
 assert.equal(r.status,'verified');assert.deepEqual(r.allowedTypes,['QCK','PSY']);assert.ok(r.warnings.some((s:string)=>s.startsWith('Neo Ambush:')));
 assert.equal(r.text,'QCK/PSY characters only/ You will be Neo Ambushed at a certain rate every time you clear the quest!');
});
test('edge recovery never supplies an unread gap or swallows a complete extra restriction',()=>{
 const full='QCK/PSY characters only/ You will be Neo Ambushed at a certain rate every time you clear the quest!';
 const failed=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-neo-requirement-failed-0528.json',import.meta.url),'utf8'));
 for(const texts of [
  [failed.texts[0],failed.texts[0],failed.texts[4]],
  [full,full,full+' Except Imu'],[full,full,full+' Except'],
  [full,full,'Unknown characters only/ You will be Neo'],
  [full,full,'STR/PSY characters only/ You will be Neo'],
  [full,full,'You will be Neo Ambushed with cost 50 at a certain rate'],
  [full,full,'Except You will be Neo Ambushed'],[full,full,'You will be Neo Ambushed Only'],
  [full,full,'Only Fighter characters'],[full,full,'Only 5-star characters'],
 ])assert.equal(parseRequirementTexts(texts,fixture.identity).status,'partial');
});
test('native narrow crop retains clipped slash and type fragments without converting them into a PSY-only rule',()=>{
 const live=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-neo-requirement-live-0529.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
 assert.ok(live.Texts.some((s:string)=>s.startsWith('</PSY')));
 const r=parseRequirementTexts(live.Texts,live.Identity);assert.equal(r.status,'verified');assert.deepEqual(r.allowedTypes,['QCK','PSY']);
 // The title behind an expired tooltip is never silently discarded.
 assert.equal(parseRequirementTexts([...live.Texts,'Clash!! CP-9: Six King Pistol'],live.Identity).status,'partial');
});
