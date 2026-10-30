import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {eligibleForQuest,questCrewFits,questRestrictionProblem,questMapEffect,questPlanningWarning} from '../src/quest-restrictions';
import {plan,type PlannerData} from '../src/planning';
import {newOwned,emptyState,validateState,type Character,type CrewRestrictions,type Boss} from '../src/model';
import {evaluatePve,solvePve} from '../src/engine';
const require=createRequire(import.meta.url),{parseRequirement,parseRequirementTexts,selectionButtons,createQuestRestrictionReader}=require('../electron/quest-restrictions.cjs');
const identity={title:'Clash!! Bartolomeo: Insincere',difficulty:5,level:null};
const rule:CrewRestrictions={status:'verified',source:'fixture',text:'Only Fighter/Slasher/Striker characters',quest:identity.title,difficulty:5,allowedClasses:['Fighter','Slasher','Striker'],warnings:[]};
const character=(id:string,classes=['Fighter']):Character=>({id,name:'Unit '+id,types:['STR'],classes,stars:'6',cost:20,maxLevel:99,atk:1000,hp:3000,rcv:100,global:true,captain:'Boosts ATK of all characters by 4x.',special:'',specialName:'',sailor:'',support:'',limit:'',llb:'',rumble:null});
const chars=[...Array.from({length:6},(_,i)=>character(String(i+1))),character('7',['Shooter','Driven']),character('8',['Cerebral','Powerhouse']),character('9',['Slasher']),character('10',['Driven'])];
chars[6].name='Imu';chars[7].name='Saintess Gunko';chars[6].atk=50000;chars[7].atk=50000;chars[8].atk=50000;chars[9].atk=100000;
const data:PlannerData={metadata:{source:'fixture',url:'https://example.com',sha:'test',builtAt:'2026-10-08'},locations:{},units:Object.fromEntries(chars.map(c=>[c.id,{captain:c.captain,special:'',cooldown:[10,5],limit:[],llb:[],families:[c.id],evolutions:[],rumble:null}]))};
data.units['7'].evolutions=[{to:'9',materials:[]}];data.units['1'].evolutions=[{to:'10',materials:[]}];
const box=chars.slice(0,8).map(c=>newOwned(c.id)),boss:Boss={id:'barto',name:identity.title,source:'fixture',training:false,restrictions:rule,stages:[{id:'1',name:'Battle 1',turn:0,requirements:[]}]};
test('real long-press tooltip combines clipped ends and corrects measured SIasher spelling',()=>{
 const texts=[0,1,2].map(i=>JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/requirement-tooltip-'+i+'.json',import.meta.url),'utf8')).text);
 const r=parseRequirementTexts(texts.map((s:string,i:number)=>i<2?'! '+s:s),identity);
 assert.equal(r.status,'verified');assert.deepEqual(r.allowedClasses,rule.allowedClasses);assert.equal(r.difficulty,5);assert.equal(r.quest,identity.title);
 const selection=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/requirement-selection.json',import.meta.url),'utf8'));assert.ok(selectionButtons(selection)?.requirement);
});
test('inconsistent, unfinished and unsupported conditions are never certified',()=>{
 for(const texts of [['Only Fighter characters','Only Shooter characters'],['Only Fighter characte','Only Fighter characte'],['Only Luffy characters','Only Luffy characters'],['Only STR Fighter characters','Only STR Fighter characters'],['Only Fighter characters except Imu','Only Fighter characters except Imu']])assert.equal(parseRequirementTexts(texts,identity).status,'partial');
 assert.deepEqual(parseRequirement('Only STR/DEX characters').allowedTypes,['STR','DEX']);assert.equal(parseRequirement('Characters with a cost of 50 or less').maxCost,50);
});
test('consistent map-only requirements allow provisional crews in all scenarios without certifying survival',()=>{
 const r=parseRequirementTexts(['Map Effect: Inferno Hell','Map Effect: Inferno Hell','Map Effect: Inferno Hell'],identity);
 assert.equal(r.status,'partial');assert.equal(r.mapEffect,'Inferno Hell');assert.equal(r.unsupported,undefined);assert.equal(r.text,'Map Effect: Inferno Hell');assert.equal(r.allowedClasses,undefined);
 const encounter={...boss,restrictions:r};assert.equal(questRestrictionProblem(encounter),'');assert.equal(questMapEffect(r),'Inferno Hell');
 const groups=plan({kind:'boss',box,characters:chars,data,boss:encounter});assert.equal(groups.length,3);
 for(const g of groups){assert.ok(g.teams.length);for(const t of g.teams){assert.equal(t.members.length,6);assert.ok(t.warnings.includes(questPlanningWarning(encounter)));assert.notEqual(t.combat?.status,'estimated');assert.ok(t.combat?.windows.every(w=>w.issues.some(s=>s.includes('Harita etkisi: Inferno Hell'))));}}
 const state=emptyState();state.bosses=[{...boss,restrictions:r}];assert.deepEqual(validateState(state,new Set(chars.map(c=>c.id))).bosses[0].restrictions,r);
 for(const texts of [['Map Effect: Inferno Hell','Only Fighter characters'],['Only Fighter characters','Only Fighter characters','Map Effect: Inferno Hell'],['Map Effect: Inferno Hell'],['Map Effect: Inferno Hell','Map Effect: Different Map']]){const mixed=parseRequirementTexts(texts,identity);assert.equal(mixed.mapEffect,undefined);assert.ok(questRestrictionProblem({...boss,restrictions:mixed}));}
 assert.throws(()=>validateState({...state,bosses:[{...boss,restrictions:{...r,unsupported:42}}]},new Set(chars.map(c=>c.id))),/katılım/);
 assert.throws(()=>validateState({...state,bosses:[{...boss,restrictions:{...r,mapEffect:42}}]},new Set(chars.map(c=>c.id))),/katılım/);
});

test('actual Magellan 11-star v0.5.22 map payload works without re-reading and preserves incomplete mechanics',()=>{
 const encounter=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/magellan-map-effect.json',import.meta.url),'utf8')),before=structuredClone(encounter);
 assert.equal(encounter.restrictions.unsupported,'Map Effect');assert.equal(encounter.observation.textComplete,false);assert.equal(encounter.stages.length,5);
 assert.equal(questRestrictionProblem(encounter),'');assert.equal(questMapEffect(encounter.restrictions),'Inferno Hell');
 const groups=plan({kind:'boss',box,characters:chars,data,boss:encounter,preparation:16});
 for(const g of groups){assert.ok(g.teams.length);assert.ok(g.teams.every(t=>t.members.length===6&&t.warnings.some(w=>w.includes('Harita etkisi: Inferno Hell'))&&t.combat?.status!=='estimated'));}
 assert.deepEqual(encounter,before);
 // A map marker cannot excuse unresolved character eligibility or mixed text.
 for(const r of [{...encounter.restrictions,text:'Map Effect: Inferno Hell\nOnly Fighter characters'},{...encounter.restrictions,allowedClasses:['Fighter']},{...encounter.restrictions,mapEffect:'Different Map'}]){assert.equal(questMapEffect(r),'');assert.ok(questRestrictionProblem({...encounter,restrictions:r}));assert.ok(plan({kind:'boss',box,characters:chars,data,boss:{...encounter,restrictions:r}}).every(g=>!g.teams.length));}
});
test('Bartolomeo class rule uses OR between permitted classes and applies to every final form',()=>{
 assert.equal(eligibleForQuest(chars[6],rule),false);assert.equal(eligibleForQuest(chars[7],rule),false);
 assert.equal(eligibleForQuest(character('x',['Shooter','Slasher']),rule),true);
 assert.equal(eligibleForQuest(chars[6],rule,true),true);
 assert.equal(eligibleForQuest(chars[6],{...rule,excludedIds:['7']},true),false);
});
test('all three scenarios exclude illegal captains, crewmates, friends and evolutions; legal evolution survives',()=>{
 const before=structuredClone(box),groups=plan({kind:'boss',box,characters:chars,data,boss});
 assert.equal(groups.length,3);for(const g of groups){assert.ok(g.teams.length);for(const t of g.teams){assert.equal(t.members.length,6);assert.ok(t.members.every(m=>eligibleForQuest(m.character,rule)));assert.ok(!t.members.some(m=>['7','8','10'].includes(m.character.id)));assert.ok(t.reasons.some(s=>s.includes('İzin verilen sınıflar')));}}
 assert.ok(groups[2].teams.some(t=>t.members.some(m=>m.character.id==='9'&&m.sourceId==='7')));assert.deepEqual(box,before);
});
test('partial conditions stop the planner instead of silently calculating unrestricted crews',()=>{
 const groups=plan({kind:'boss',box,characters:chars,data,boss:{...boss,restrictions:{...rule,status:'partial'}}});
 assert.ok(groups.every(g=>!g.teams.length&&g.diagnostic.includes('tam okunamadı')));
});
test('individual cost, total owned cost, stars and type restrictions combine conservatively',()=>{
 assert.equal(eligibleForQuest({...chars[0],cost:99},{...rule,maxCost:50}),false);
 assert.equal(eligibleForQuest({...chars[0],stars:'6+'},{...rule,maxStars:6}),false);
 assert.equal(eligibleForQuest({...chars[0],types:['STR','DEX']},{...rule,allowedTypes:['STR']}),false);
 assert.equal(eligibleForQuest({...chars[0],types:[]},{...rule,allowedTypes:['STR']}),false);
 assert.equal(questCrewFits([{character:chars[0]},{character:{...chars[1],cost:99},friend:true}],{...rule,maxTotalCost:20}),true);
 const groups=plan({kind:'boss',box,characters:chars,data,boss:{...boss,restrictions:{...rule,maxTotalCost:90}}});assert.ok(groups.every(g=>!g.teams.length));
});
test('legacy solver and direct evaluator reject a forbidden helper',()=>{
 const b=box.map(o=>({...o,ability:{...o.ability,captainVerified:true}}));assert.deepEqual(solvePve(b,chars,boss,'7'),[]);
 assert.ok(evaluatePve([{character:chars[6],owned:b[6],friend:true}],boss).missing[0].includes('katılım'));
});
test('restrictions persist through save validation; invalid rule scopes cannot bypass validation',()=>{
 const state=emptyState();state.bosses=[boss];assert.deepEqual(validateState(state,new Set(chars.map(c=>c.id))).bosses[0].restrictions,rule);
 for(const r of [{...rule,allowedClasses:['Fake']},{...rule,maxCost:-1},{...rule,status:'whatever'},{...rule,excludedIds:['unknown']}])assert.throws(()=>validateState({...state,bosses:[{...boss,restrictions:r as CrewRestrictions}]},new Set(chars.map(c=>c.id))),/katılım/);
});
function readerFixture(changed=false){
 const selection={ocr:JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/requirement-selection.json',import.meta.url),'utf8')),identity:null},modal={identity,header:'same',ocr:{}};
 let index=0;const inputs:string[]=[],pages=[selection,selection,{...modal,header:changed?'different':'same'}];
 const reader=createQuestRestrictionReader({observe:async()=>pages[Math.min(index++,2)],sameHeader:(a:string,b:string)=>a===b,input:async(_e:string,_d:string,action:string)=>{inputs.push(action);return ['Only Fighter/Slasher/Striker characters','Only Fighter/Slasher/Striker characters'];},tooltip:async(s:string)=>s});
 return {reader,inputs,modal};
}
test('requirement reader returns to same quest before accepting a rule and never starts battle',async()=>{
 const f=readerFixture(),r=await f.reader.read('adb','device',f.modal,identity,()=>{},()=>{});assert.equal(r.status,'verified');assert.deepEqual(f.inputs,['closeGuide','holdRequirement','openDetails','questGuide']);
 const changed=readerFixture(true);await assert.rejects(changed.reader.read('adb','device',changed.modal,identity,()=>{},()=>{}),/Boss veya zorluk/);assert.deepEqual(changed.inputs,['closeGuide','holdRequirement','openDetails']);
});
test('the native requirement adapter accepts a verified pixel caption without remerging corrupt OCR fragments',async()=>{
 const single=JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/cp9-single-head.json',import.meta.url),'utf8')),selection={ocr:JSON.parse(fs.readFileSync(new URL('./fixtures/boss-behavior/requirement-selection.json',import.meta.url),'utf8')),identity:null},modal={identity:single.identity,header:'same',ocr:{}};let seen=0;
 const reader=createQuestRestrictionReader({observe:async()=>++seen<3?selection:modal,sameHeader:(a:string,b:string)=>a===b,input:async(_e:string,_d:string,action:string)=>action==='holdRequirement'?single.texts:undefined,tooltip:async()=>assert.fail('Verified pixels must not fall back to fragments'),pixelTooltip:async()=>({status:'verified',allowedTypes:['QCK','PSY']})});
 const result=await reader.read('fake','fake',modal,single.identity,()=>{},()=>{});assert.equal(result.status,'verified');assert.deepEqual(result.allowedTypes,['QCK','PSY']);
});
test('wrong entry screen and cancellation stop navigation before an input',async()=>{
 const inputs:string[]=[],reader=createQuestRestrictionReader({observe:async()=>({ocr:{height:1600,lines:[]},identity:null}),input:async(_e:string,_d:string,a:string)=>inputs.push(a)});
 await assert.rejects(reader.prepare('adb','device',()=>{},()=>{}),/zorluk seçim/);await assert.rejects(reader.prepare('adb','device',()=>{throw Error('cancelled');},()=>{}),/cancelled/);assert.deepEqual(inputs,[]);
});
