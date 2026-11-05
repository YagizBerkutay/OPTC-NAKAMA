import type {GPSeason} from './grand-party';
export type GPRules={version:1;mode:'grand-party';season:GPSeason;text:string;fingerprint:string;source:string;observedAt:string};
const string=(v:unknown,max=500):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.length>0&&v.length<=20&&v.every(s=>string(s,100));
export function validateGPRules(value:unknown):GPRules{
 const v=value as GPRules,s=v?.season;
 if(!v||v.version!==1||v.mode!=='grand-party'||!string(v.text,16000)||!string(v.source)||!string(v.observedAt)||!Number.isFinite(Date.parse(v.observedAt))||!string(v.fingerprint,64)||!/^[a-f0-9]{64}$/.test(v.fingerprint)||!s||!string(s.name,120)||!strings(s.leaderTargets)||s.leaderMatch!=='any'||s.effectsRequireLeader!==true||!Number.isInteger(s.extraUses)||s.extraUses<1||s.extraUses>5||!Number.isFinite(s.chargeMultiplier)||s.chargeMultiplier<=1||s.chargeMultiplier>10.01||!string(s.note,2000)||!Array.isArray(s.effects)||!s.effects.length||s.effects.length>20||s.effects.some(e=>!e||!['buff','penalty'].includes(e.effect||'')||!Number.isInteger(e.level)||e.level!<1||e.level!>20||!strings(e.attributes)||e.attributes.some(a=>!['ATK','HP','DEF','SPD','RCV','Special CT','Guard','CRIT','Accuracy','Shield'].includes(a))||!strings(e.targeting?.targets)))throw Error('Grand Party kuralları doğrulanamadı; MuMu’dan yeniden oku.');
 return v;
}
