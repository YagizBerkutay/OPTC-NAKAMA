import type {PlanMember,PlanTeam,Scenario} from './planning';
export type AssaultRule={boss:string;targets:string[];percent:number;match:'any'|'unknown'};
export type AssaultEnemy={id?:string;name:string;types:string[];classes:string[];tags:string[];level:number|null;abilityLevel:number|null;specialLevel:number|null;stats:{hp?:number;atk?:number;def?:number;spd?:number;rcv?:number};details:Partial<Record<'ability'|'special'|'resistance'|'pattern'|'priority',string>>;complete:boolean};
export type AssaultContext={version:1;mode:'assault';bosses:string[];selectedBoss:string;level:number|null;maxLevel:boolean;rules:AssaultRule[];lateSeconds:number;stacking:'unknown';text:string;fingerprint:string;observedAt:string;source:string;warnings:string[];limits:{main:5;sub:3;cost:number;verified:boolean};enemies:Record<string,AssaultEnemy>;trusty:{ownershipOnly:true;entries:{id:string;multiplier:number}[];complete:boolean};cached?:boolean};
export type AssaultObjective='progression'|'score';
export type AssaultReport={boss:string;level:number|null;objective:AssaultObjective;ranking:'lower'|'upper';ruleMatches:{id:string;clauses:string[];low:number;high:number}[];pressure:number;pressureHigh:number;survival:number;stackingSensitive:boolean;instructions:string[];warnings:string[]};
export type AssaultRequest={context:AssaultContext;boss:string;objective:AssaultObjective;ruleInterpretation?:'lower'|'upper'};
export type AssaultJob=AssaultRequest&{box:import('./model').Owned[];characters:import('./model').Character[];data:import('./planning').PlannerData;scenario:Scenario;category:string;all?:boolean;deep?:boolean};
export type AssaultResult={boss:string;teams:PlanTeam[];diagnostic:string;elapsedMs:number};
const string=(v:unknown,max=180):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const strings=(v:unknown,max=20):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(s=>string(s));
export function validateAssault(value:unknown):AssaultContext {
 const v=value as AssaultContext;
 if(!v||v.version!==1||v.mode!=='assault'||!strings(v.bosses,10)||!v.bosses.length||new Set(v.bosses).size!==v.bosses.length||!v.bosses.includes(v.selectedBoss)||!(v.level===null&&v.maxLevel||Number.isInteger(v.level)&&v.level!>=1&&v.level!<=999&&!v.maxLevel)||typeof v.maxLevel!=='boolean'||!string(v.text,16000)||!string(v.source,500)||!/^[a-f0-9]{64}$/.test(v.fingerprint)||!Number.isFinite(Date.parse(v.observedAt))||v.stacking!=='unknown'||!Number.isInteger(v.lateSeconds)||v.lateSeconds<1||v.lateSeconds>100||!strings(v.warnings,50))throw Error('Assault bağlamı geçersiz; güncel Rules ekranını yeniden oku.');
 if(!Array.isArray(v.rules)||!v.rules.length||v.rules.length>60||v.rules.some(r=>!r||r.boss!=='all'&&!v.bosses.includes(r.boss)||!strings(r.targets)||!r.targets.length||!Number.isInteger(r.percent)||!r.percent||Math.abs(r.percent)>100||!['any','unknown'].includes(r.match)))throw Error('Assault kural maddeleri geçersiz.');
 if(!v.limits||v.limits.main!==5||v.limits.sub!==3||!Number.isInteger(v.limits.cost)||v.limits.cost<1||v.limits.cost>500||typeof v.limits.verified!=='boolean'||!v.trusty||v.trusty.ownershipOnly!==true||typeof v.trusty.complete!=='boolean'||!Array.isArray(v.trusty.entries)||v.trusty.entries.length>200||v.trusty.entries.some(e=>!/^\d+(?:\.\d+)?$/.test(e.id)||!Number.isFinite(e.multiplier)||e.multiplier<1||e.multiplier>10))throw Error('Assault limit / Trusty bilgisi geçersiz.');
 if(!v.enemies||typeof v.enemies!=='object'||Array.isArray(v.enemies)||Object.entries(v.enemies).some(([boss,e])=>!v.bosses.includes(boss)||!e||!string(e.name)||!strings(e.types,2)||e.types.some(t=>!['STR','DEX','QCK','PSY','INT'].includes(t))||!strings(e.classes,2)||!strings(e.tags,40)||!e.stats||Object.entries(e.stats).some(([k,n])=>!['hp','atk','def','spd','rcv'].includes(k)||!Number.isFinite(n)||n!<0||n!>1e10)||!e.details||Object.entries(e.details).some(([k,t])=>!['ability','special','resistance','pattern','priority'].includes(k)||!string(t,12000))||typeof e.complete!=='boolean'||e.id!==undefined&&!/^\d+(?:\.\d+)?$/.test(e.id)||[e.level,e.abilityLevel,e.specialLevel].some(n=>n!==null&&(!Number.isInteger(n)||n<1||n>999))))throw Error('Assault rakip gözlemi geçersiz.');
 return structuredClone(v);
}
export function assaultRuleText(r:AssaultRule){return `${r.boss==='all'?'Bütün bosslar':r.boss} · ${r.targets.join(' / ')} kaynaklı gelen hasar ${r.percent>0?'+':''}%${r.percent}`;}
const norm=(s:string)=>s.replace(/[\[\]]/g,'').toLowerCase().trim();
export function assaultRuleBounds(member:PlanMember,tags:string[],rules:AssaultRule[],boss:string){
 const values=[...member.character.types,...member.character.classes,...tags].map(norm),matched=rules.filter(r=>(r.boss===boss||r.boss==='all')&&r.targets.some(t=>values.includes(norm(t))));
 const certain=matched.filter(r=>r.match==='any'||r.targets.every(t=>values.includes(norm(t)))),possible=matched.filter(r=>!certain.includes(r));
 const factors=certain.map(r=>1+r.percent/100),sum=1+certain.reduce((n,r)=>n+r.percent/100,0),product=factors.reduce((n,v)=>n*v,1);
 const optional=possible.reduce((n,r)=>n+Math.max(0,r.percent)/100,0),penalties=possible.reduce((n,r)=>n+Math.min(0,r.percent)/100,0),positiveProduct=possible.reduce((n,r)=>n*(1+Math.max(0,r.percent)/100),1),negativeProduct=possible.reduce((n,r)=>n*(1+Math.min(0,r.percent)/100),1);
 return {low:Math.max(0,Math.min(sum+penalties,product*negativeProduct)),high:Math.max(0,sum+optional,product*positiveProduct),clauses:matched.map(assaultRuleText),uncertain:possible.length>0||Math.abs(sum-product)>.001};
}
