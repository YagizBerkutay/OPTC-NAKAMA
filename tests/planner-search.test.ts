import {test} from 'node:test';import assert from 'node:assert/strict';
import {candidates,solveAdventure,plan,type PlannerData} from '../src/planning';import {newOwned,type Character,type Boss} from '../src/model';
function fixture(){
 const chars:Character[]=Array.from({length:33},(_,i)=>({id:String(i+1),name:'Unit '+(i+1),types:['STR'],classes:['Fighter'],stars:'6',cost:20,maxLevel:99,hp:3000,atk:i===32?10:10000,rcv:100,global:true,captain:i===0?'Boosts ATK of all characters by 4x.':'',special:i===32?'Reduces Paralysis duration by 5 turns.':'',specialName:'',sailor:'',support:'',limit:'',llb:'',rumble:null}));
 const data:PlannerData={metadata:{source:'fixture',url:'https://example.com',sha:'v1',builtAt:''},locations:{},units:Object.fromEntries(chars.map(c=>[c.id,{captain:c.captain,special:c.special,cooldown:[5,1],limit:[],llb:[],evolutions:[],families:[c.id],rumble:null}]))};
 const box=chars.map(c=>({...newOwned(c.id),level:99,cooldown:1}));
 const boss:Boss={id:'rare',name:'Rare counter',source:'fixture',training:true,restrictions:{status:'verified',source:'fixture',quest:'Rare counter',difficulty:10,text:'Only STR characters',allowedTypes:['STR'],warnings:[]},stages:[{id:'s1',name:'Battle 1',turn:2,requirements:[{mechanic:'paralysis',turns:5}]}]};return {chars,data,box,boss};
}
test('required low-ATK remover survives member pruning and partial-team ranking',()=>{
 const f=fixture(),teams=solveAdventure(candidates(f.box,f.chars,f.data,'power'),'',f.boss,2,0,f.data);
 assert.ok(teams.length);assert.ok(teams.every(t=>!t.missing?.length));assert.ok(teams.every(t=>t.members.some(m=>m.character.id==='33')));assert.ok(teams[0].schedule?.some(s=>s.used.some(u=>u.includes('#33 '))));
});
test('one selected scenario is calculated without silently producing the others',()=>{
 const f=fixture();const result=plan({kind:'teams',box:f.box,characters:f.chars,data:f.data,scenario:'power'} as any);assert.deepEqual(result.map(g=>g.scenario),['power']);
});
test('a low-stat crew-wide damage booster is retained and compared using simultaneous actual buffs',()=>{
 const f=fixture();f.data.units['33'].special='Boosts ATK of all characters by 3x for 1 turn.';
 const teams=solveAdventure(candidates(f.box,f.chars,f.data,'power'),'',undefined,16,0,f.data);
 assert.ok(teams[0].members.some(m=>m.character.id==='33'));assert.ok(teams[0].benchmark);assert.ok(teams[0].benchmark!.used.some(s=>s.includes('#33 ')));
 const without=solveAdventure(candidates(f.box.slice(0,-1),f.chars,f.data,'power'),'',undefined,16,0,f.data);assert.ok(teams[0].benchmark!.low>without[0].benchmark!.low);assert.ok(teams[0].benchmark!.high>without[0].benchmark!.high);
});
