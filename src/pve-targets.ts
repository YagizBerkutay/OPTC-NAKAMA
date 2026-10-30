import type {Character} from './model';
import type {PlannerData} from './planning';
const types=['STR','DEX','QCK','PSY','INT'],classes=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'];
const sentenceCache=new Map<string,string[]>();
export function sentences(text:string){let value=sentenceCache.get(text);if(!value){value=text.replace(/\b([A-Z])\.\s/g,'$1\u0000 ').split(/\.\s+|\n/).map(v=>v.replace(/\u0000/g,'.'));if(sentenceCache.size>=8192)sentenceCache.clear();sentenceCache.set(text,value);}return value;}
export function scopeMatches(scope:string,member:Character,data?:PlannerData,source?:Character):boolean{
  if(/this character|character's own|self/i.test(scope))return !!source&&source.id===member.id;
  const cost=scope.match(/Cost\s*(\d+)\s*(or (?:more|higher|less|lower)|and (?:above|below))/i);
  if(cost)return /less|lower|below/i.test(cost[2])?member.cost<=Number(cost[1]):member.cost>=Number(cost[1]);
  if(/all (?:other )?characters|all others|crew(?:'s)?|all units/i.test(scope))return true;
  const selectedTypes=types.filter(v=>new RegExp(`\\b${v}\\b`,'i').test(scope)),selectedClasses=classes.filter(v=>scope.toLowerCase().includes(v.toLowerCase()));
  const tags=data?.units[member.id]?.tags||[];
  const tagScopes=[...scope.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1]).filter(v=>!types.includes(v)&&!classes.includes(v));
  if(!/\band\b|\bor\b|,/i.test(scope)&&(selectedTypes.length&&selectedClasses.length||tagScopes.length&&(selectedTypes.length||selectedClasses.length)))return (!selectedTypes.length||member.types.some(v=>selectedTypes.includes(v)))&&(!selectedClasses.length||member.classes.some(v=>selectedClasses.includes(v)))&&(!tagScopes.length||tagScopes.some(v=>tags.some(t=>v.toLowerCase()===t.toLowerCase())));
  return member.types.some(v=>selectedTypes.includes(v))||member.classes.some(v=>selectedClasses.includes(v))||tags.some(v=>scope.toLowerCase().includes(v.toLowerCase()))||member.name.split(/\s+-\s+|:/)[0].split(/\s*&\s*/).some(v=>v.length>3&&scope.toLowerCase().includes(v.toLowerCase()));
}
