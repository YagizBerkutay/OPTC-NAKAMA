import {test} from 'node:test';import assert from 'node:assert/strict';import {runPlanningJob,type PlanningMessage} from '../src/planning-jobs';import type {Scenario} from '../src/planning';
const fake=(scenario:Scenario)=>({scenario,title:scenario,diagnostic:'fixture',teams:[]});
test('single request computes and emits only the chosen scenario',async()=>{
 const calls:Scenario[]=[],messages:PlanningMessage[]=[];await runPlanningJob({scenario:'evolve'} as any,m=>messages.push(m),s=>{calls.push(s);return fake(s);});assert.deepEqual(calls,['evolve']);assert.equal(messages.length,1);assert.ok('result'in messages[0]&&messages[0].result[0].scenario==='evolve');
});
test('catalogue streams each category before it starts the next one and calculates 13 not 39 groups',async()=>{
 const messages:PlanningMessage[]=[],calls:string[]=[];await runPlanningJob({scenario:'power',catalogue:true}as any,m=>messages.push(m),(s,c='')=>{if(calls.length)assert.ok(messages.some(m=>'row'in m&&m.row.category===calls.at(-1)));calls.push(c);assert.equal(s,'power');return fake(s);});assert.equal(calls.length,13);assert.equal(messages.filter(m=>'row'in m).length,13);assert.ok('done'in messages.at(-1)!);
});
