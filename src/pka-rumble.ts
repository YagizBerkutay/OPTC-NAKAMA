import type {AssaultEnemy} from './assault-rumble';
import type {Owned,Character} from './model';
import type {PlannerData,PlanTeam,Scenario} from './planning';
export type PkaRumbleContext={version:1;mode:'pka-rumble';opponent:string;enemies:(AssaultEnemy&{slot:number})[];bonus:Record<string,number>;limits:{main:5;sub:3;cost:300};source:string;observedAt:string;fingerprint:string;warnings:string[]};
export type PkaRumbleRequest={context:PkaRumbleContext;bonusInterpretation:'unscaled'|'all-stats'};
export type PkaRumbleJob={context:PkaRumbleContext;box:Owned[];characters:Character[];data:PlannerData;scenario:Scenario;category:string;deep?:boolean};
export type PkaRumbleResult={teams:PlanTeam[];elapsedMs:number;diagnostic:string};
const text=(v:unknown,max=500):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
export function validatePkaRumble(value:unknown):PkaRumbleContext{
 const v=value as PkaRumbleContext,types=['STR','DEX','QCK','PSY','INT'];
 if(!v||v.version!==1||v.mode!=='pka-rumble'||!text(v.opponent)||!text(v.source)||!Number.isFinite(Date.parse(v.observedAt))||!/^[a-f0-9]{64}$/.test(v.fingerprint)||!Array.isArray(v.warnings)||v.warnings.length>50||v.warnings.some(w=>!text(w,2000))||!v.limits||v.limits.main!==5||v.limits.sub!==3||v.limits.cost!==300)throw Error('PKA Rumble bağlamı geçersiz; rakip ekranını yeniden oku.');
 if(!v.bonus||Object.keys(v.bonus).length!==5||types.some(t=>!Number.isInteger(v.bonus[t])||v.bonus[t]<0||v.bonus[t]>100))throw Error('PKA Buddy tip bonusları geçersiz.');
 if(!Array.isArray(v.enemies)||v.enemies.length<1||v.enemies.length>8||new Set(v.enemies.map(e=>e.slot)).size!==v.enemies.length||!v.enemies.some(e=>e.slot<5))throw Error('PKA rakip yuvaları eksik.');
 for(const e of v.enemies){if(!Number.isInteger(e.slot)||e.slot<0||e.slot>7||!text(e.name)||!Array.isArray(e.types)||!e.types.length||e.types.length>2||e.types.some(t=>!types.includes(t))||!Array.isArray(e.classes)||e.classes.length>2||e.classes.some(t=>!text(t,60))||!Array.isArray(e.tags)||e.tags.length>40||e.tags.some(t=>!text(t,100))||!e.stats||Object.entries(e.stats).some(([k,n])=>!['hp','atk','def','spd','rcv'].includes(k)||!Number.isFinite(n)||n!<0||n!>1e8)||!e.details||Object.entries(e.details).some(([k,t])=>!['ability','special','resistance','pattern','priority'].includes(k)||!text(t,12000))||[e.level,e.abilityLevel,e.specialLevel].some(n=>n!==null&&(!Number.isInteger(n)||n<1||n>999))||typeof e.complete!=='boolean')throw Error('PKA rakip ayrıntıları geçersiz.');}
 return structuredClone(v);
}
export function pkaBuddyFactor(types:string[],request?:PkaRumbleRequest){return request?.bonusInterpretation==='all-stats'?1+Math.max(0,...types.map(t=>request.context.bonus[t]||0))/100:1;}
