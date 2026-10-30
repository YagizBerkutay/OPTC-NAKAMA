import {createPlannerSession,TYPES,CLASSES,type PlanRequest,type PlanGroup,type Scenario} from './planning';
export type PlanningJob=PlanRequest&{catalogue?:boolean};
export type PlanningMessage={progress:string}|{preview:{category:string;group:PlanGroup};elapsedMs:number}|{row:{category:string;groups:PlanGroup[]}}|{result:PlanGroup[];elapsedMs:number}|{done:true;elapsedMs:number};
export async function runPlanningJob(request:PlanningJob,emit:(message:PlanningMessage)=>void,providedSolve?:ReturnType<typeof createPlannerSession>){
 const start=performance.now(),scenario:Scenario=request.scenario||'power';
 const solve=providedSolve||createPlannerSession(request,(category,group)=>emit({preview:{category,group},elapsedMs:performance.now()-start}));
 if(!request.catalogue){emit({result:[solve(scenario,request.category||'')],elapsedMs:performance.now()-start});return;}
 for(const [index,category] of [...TYPES,...CLASSES].entries()){
  emit({progress:`${category} hesaplanıyor · ${index+1} / 13`});
  const group=solve(scenario,category);emit({row:{category,groups:[{...group,teams:group.teams.slice(0,1)}]}});
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 emit({done:true,elapsedMs:performance.now()-start});
}
