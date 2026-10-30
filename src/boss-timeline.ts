import type {Boss,Effect,Stage} from './model';

export function crewHpBranch(stage:Stage,hp:number,maxHP:number):Stage {
 const alternatives=stage.events?.filter(e=>e.trigger==='hp')||[];
 if(alternatives.length!==2||!Number.isFinite(hp)||!(maxHP>0))return stage;
 const below=alternatives.find(e=>/^Crew HP below (\d{1,2})%$/.test(e.label)),above=alternatives.find(e=>/^Crew HP at least (\d{1,2})%$/.test(e.label));
 if(!below||!above||below.label.match(/\d+/)?.[0]!==above.label.match(/\d+/)?.[0])return stage;
 const chosen=hp*100<maxHP*Number(below.label.match(/\d+/)![0])?below:above;
 const events=stage.events!.filter(e=>e.trigger!=='hp').concat({...chosen,trigger:'preemptive'});
 const effects=[...stage.requirements,...chosen.requirements],requirements=[...new Set(effects.map(e=>e.mechanic))].map(mechanic=>({mechanic,turns:Math.max(...effects.filter(e=>e.mechanic===mechanic).map(e=>e.turns))}));
 return {...stage,events,requirements,notes:events.map(e=>e.label+'\n'+e.text).join('\n')};
}

// Header suffixes identify guide sections, not elapsed turns. Only an explicit
// numbered turn trigger creates a later action window in the same battle.
export function bossTimeline<T extends Boss>(boss:T):T {
 if(boss.stages.some(s=>s.conditionalTurn))return boss;
 const stages:Stage[]=[];let delay=0;
 for(const stage of boss.stages){
  // Only a read, explicit trigger condition creates a special restriction.
  // A beneficial-slot buff does not change slots and must remain usable.
  const slotInterrupt=stage.events?.some(e=>e.trigger==='interrupt'&&/Slot Change|Orb Change/i.test(e.label+'\n'+e.text.split('\n')[0]));
  const blockedSpecialPatterns=[...(stage.blockedSpecialPatterns||[]),...(slotInterrupt?[String.raw`\b(?:changes?|converts?|randomizes?|shuffles?)\b[^.;\n]{0,90}\b(?:orbs?|slots?)\b`]:[])];
  const guarded={...stage,...(blockedSpecialPatterns.length?{blockedSpecialPatterns}: {})};
  const start=stage.turn+delay;
  const firstTurn=stage.events?.filter(e=>e.trigger==='turn'&&e.battleTurn===1)||[];
  const merge=(effects:Effect[])=>[...new Set(effects.map(e=>e.mechanic))].map(mechanic=>({mechanic,turns:Math.max(...effects.filter(e=>e.mechanic===mechanic).map(e=>e.turns))}));
  // Later numbered effects belong to their own windows, including when no
  // starting event was listed. Do not leak their text through the notes fallback.
  const hasLater=stage.events?.some(e=>e.trigger==='turn'&&(e.battleTurn||1)>1);
  const initialEvents=hasLater?stage.events?.filter(e=>e.trigger!=='turn'||(e.battleTurn||1)<=1):stage.events;
  stages.push({...guarded,turn:start,events:initialEvents,notes:hasLater&&!initialEvents?.length?'':stage.notes,requirements:merge([...stage.requirements,...firstTurn.flatMap(e=>e.requirements)])});
  const turns=[...new Set(stage.events?.filter(e=>e.trigger==='turn'&&e.battleTurn&&e.battleTurn>1&&e.battleTurn<=20).map(e=>e.battleTurn!)||[])].sort((a,b)=>a-b);
  let specialLimit=stage.specialLimit,normalAttackOnly=stage.normalAttackOnly;
  for(const turn of turns){
   const events=stage.events!.filter(e=>e.trigger==='turn'&&e.battleTurn===turn);
   const limits=events.flatMap(e=>e.specialLimit===undefined?[]:[e.specialLimit]);
   if(limits.length)specialLimit=Math.min(specialLimit??Infinity,...limits);normalAttackOnly=normalAttackOnly||events.some(e=>e.normalAttackOnly);
   stages.push({...guarded,id:stage.id+':turn:'+turn,name:stage.name+' · Tur '+turn+' (kalırsan)',conditionalTurn:turn,turn:start+turn-1,events,requirements:merge(events.flatMap(e=>e.requirements)),cooldownRewind:Math.max(0,...events.map(e=>e.cooldownRewind||0)),specialLimit,normalAttackOnly});
  }
  delay+=turns.length?turns.at(-1)!-1:0;
 }
 return {...boss,stages};
}
