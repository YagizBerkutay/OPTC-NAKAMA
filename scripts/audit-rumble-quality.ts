import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {candidates,type PlanMember,type PlannerData} from '../src/planning';import {makeRumbleContext,solveRumble} from '../src/rumble-planner';
// Small exact searches are an oracle for the scoring model, not proof of a win.
const db=new DatabaseSync(path.join(process.env.APPDATA!,'optc-nakama/nakama.sqlite'),{readOnly:true}),state=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get()!.payload as string);db.close();
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8')),data:PlannerData=JSON.parse(fs.readFileSync('public/data/planner.json','utf8')),pool=candidates(state.box,catalog.characters,data,'power'),base=makeRumbleContext(pool,data,'attack');
const rows=[];for(const offset of [0,7,19]){
 const chosen:PlanMember[]=[],families=new Set<string>(),sources=new Set<string>();
 for(const p of [...base.prepared.slice(offset),...base.prepared.slice(0,offset)]){const m=p.m;if(p.cost!==55||sources.has(m.sourceId)||m.families.some(f=>families.has(f)))continue;chosen.push(m);sources.add(m.sourceId);m.families.forEach(f=>families.add(f));if(chosen.length===12)break;}
 if(chosen.length<6)continue;const limit=275,context=makeRumbleContext(chosen,data,'attack','',limit);let count=0,best=-Infinity,bestIds:string[]=[];
 const visit=(start:number,crew:PlanMember[])=>{if(crew.length===5){count++;const value=context.score(crew,crew);if(value>best){best=value;bestIds=crew.map(m=>m.character.id);}return;}for(let i=start;i<=chosen.length-(5-crew.length);i++)visit(i+1,[...crew,chosen[i]]);};
 const started=performance.now();visit(0,[]);const result=solveRumble(chosen,data,limit,'attack','')[0];assert.ok(result);assert.equal(result.reserves?.length||0,0,'Equal cost oracle must not hide reserve choices');const found=context.score(result.members,result.members);assert.ok(found<=best+1e-6,'Oracle and production scoring disagree');rows.push({offset,pool:chosen.length,combinations:count,exactScore:best,searchScore:found,regret:best-found,exactIds:bestIds,searchIds:result.members.map(m=>m.character.id),elapsedMs:performance.now()-started});
}
const report={scope:'Exact five-member, equal-cost subsets; same approximate scoring model; no battle-win proof',box:state.box.length,cases:rows};fs.mkdirSync('.local/planner-audit-v57',{recursive:true});fs.writeFileSync('.local/planner-audit-v57/quality.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
