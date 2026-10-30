import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bossTimeline} from '../src/boss-timeline';
import {evaluatePve} from '../src/engine';
import {newOwned,type Boss,type Character} from '../src/model';
const boss=():Boss=>({id:'fixture',name:'Fixture',source:'fixture',training:true,stages:[
 {id:'1',name:'Battle 1',turn:0,requirements:[]},
 {id:'3',name:'Battle 3',turn:2,requirements:[{mechanic:'bind',turns:3}],cooldownRewind:1,events:[{trigger:'preemptive',sourceBattle:'Battle 3-2',label:'İlk saldırı',text:'3 turns Bind',requirements:[{mechanic:'bind',turns:3}]},{trigger:'turn',label:'TURN 2',text:'5 turns Paralysis',battleTurn:2,requirements:[{mechanic:'paralysis',turns:5}]}]},
 {id:'4',name:'Battle 4',turn:3,requirements:[]}
]});
test('later turn is a separate same-battle window and shifts subsequent cooldown timing',()=>{
 const b=boss(),before=structuredClone(b),r=bossTimeline(b);
 assert.deepEqual(r.stages.map(s=>s.turn),[0,2,3,4]);assert.equal(r.stages[2].conditionalTurn,2);assert.deepEqual(r.stages[2].requirements,[{mechanic:'paralysis',turns:5}]);assert.equal(r.stages[2].cooldownRewind,0);assert.deepEqual(b,before);
});
test('a PREEMPTIVE section numbered 3-2 adds no second-turn delay',()=>{
 const b=boss();b.stages[1].events=b.stages[1].events!.slice(0,1);assert.deepEqual(bossTimeline(b).stages.map(s=>s.turn),[0,2,3]);
});

test('future numbered effects are absent from initial active text and notes fallback',()=>{
 const b=boss();b.stages[0].events=[{trigger:'turn',battleTurn:2,label:'TURN 2',text:'3 turns Bind',requirements:[{mechanic:'bind',turns:3}]}];b.stages[0].notes='TURN 2: 3 turns Bind';
 const r=bossTimeline(b);assert.deepEqual(r.stages[0].events,[]);assert.equal(r.stages[0].notes,'');assert.match(r.stages[1].events![0].text,/Bind/);
 const initial=r.stages.find(s=>s.id==='3')!;assert.ok(initial.events!.every(e=>e.battleTurn!==2));assert.equal(b.stages[0].notes,'TURN 2: 3 turns Bind');
});
test('expanding an existing timeline does not insert the same conditional turn twice',()=>{
 const r=bossTimeline(boss());assert.deepEqual(bossTimeline(r),r);
});
test('the scheduler cannot reuse an unready special at the later trigger',()=>{
 const b=boss();b.stages[1].cooldownRewind=0;
 const o=newOwned('1');Object.assign(o,{readyTurn:0,cooldown:5});o.ability.verified=true;o.ability.effects=[{mechanic:'bind',turns:5},{mechanic:'paralysis',turns:5}];
 const member={character:{id:'1',name:'Remover'} as Character,owned:o,bindResistance:3};
 const r=evaluatePve([member],bossTimeline(b));assert.equal(r.missing.length,1);
 member.owned.cooldown=1;const ready=evaluatePve([member],bossTimeline(b));assert.deepEqual(ready.missing,[]);assert.ok(ready.schedule[2].used.length);
});
test('a later special limit is kept in following same-battle action windows',()=>{
 const b=boss();b.stages[1].events!.push({trigger:'turn',label:'TURN 3',text:'3 turns Despair',battleTurn:3,requirements:[{mechanic:'despair',turns:3}]});b.stages[1].events![1].specialLimit=1;
 const r=bossTimeline(b);assert.equal(r.stages[2].specialLimit,1);assert.equal(r.stages[3].specialLimit,1);assert.equal(r.stages[4].turn,5);
});
test('non-numbered, HP and defeat conditions are kept visible without a guessed schedule',()=>{
 const b=boss();b.stages[1].events=[{trigger:'turn',label:'ON ATTACK',text:'Bind',requirements:[]},{trigger:'defeated',label:'Yenilince',text:'Bind',requirements:[]},{trigger:'hp',label:'HP < 20%',text:'Bind',requirements:[]}];assert.equal(bossTimeline(b).stages.length,3);
});
