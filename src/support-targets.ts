import type {PlanMember,PlannerData} from './planning';

const types=['STR','DEX','QCK','PSY','INT'];
const classes=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'];
const canonicalCache=new Map<string,string>();
const canonical=(s:string)=>{let value=canonicalCache.get(s);if(value===undefined){value=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase().replace('trafalgardwaterlaw','trafalgarlaw');if(canonicalCache.size>=8192)canonicalCache.clear();canonicalCache.set(s,value);}return value;};
const nameCache=new Map<string,string[]>(),aliasCache=new Map<string,string[]>();
function named(target:PlanMember,name:string){
 let aliases=aliasCache.get(name);if(!aliases){aliases=[name.replace(/\([^)]*\)/g,''),...[...name.matchAll(/\(([^)]+)\)/g)].map(m=>m[1])].map(canonical).filter(Boolean);if(aliasCache.size>=4096)aliasCache.clear();aliasCache.set(name,aliases);}
 const key=target.character.name+'|'+target.families.join('|');let actual=nameCache.get(key);if(!actual){actual=[...target.families,...target.character.name.split(/\s+-\s+|:/)[0].split(/\s*&\s*/)].map(canonical);if(nameCache.size>=8192)nameCache.clear();nameCache.set(key,actual);}
 return aliases.some(n=>actual.includes(n));
}
type Attributes={types:string[];classes:string[];tags:string[];cost?:{value:number;maximum:boolean}};
function attributes(text:string):Attributes|null{
 const result:Attributes={types:[],classes:[],tags:[]};let rest=text;
 rest=rest.replace(/(?:with\s+)?cost\s*(\d+)\s*(or less|or lower|and below|or more|or higher|and above)/i,(_,n,comparison)=>{
  result.cost={value:Number(n),maximum:/less|lower|below/i.test(comparison)};return '';
 });
 rest=rest.replace(/\[([^\]]+)\]/g,(_,value:string)=>{
  const type=types.find(t=>t.toLowerCase()===value.trim().toLowerCase()),cls=classes.find(c=>c.toLowerCase()===value.trim().toLowerCase());
  if(type)result.types.push(type);else if(cls)result.classes.push(cls);else result.tags.push(value.trim());return '';
 });
 for(const type of types)rest=rest.replace(new RegExp(`\\b${type}\\b`,'gi'),()=>{result.types.push(type);return '';});
 for(const cls of classes)rest=rest.replace(new RegExp(`\\b${cls}\\b`,'gi'),()=>{result.classes.push(cls);return '';});
 rest=rest.replace(/\b(?:characters?|types?|classes?|with|tags?|and|or|only)\b/gi,'').replace(/[\s,/&.]/g,'');
 return rest||!result.types.length&&!result.classes.length&&!result.tags.length&&!result.cost?null:result;
}
function matches(a:Attributes,target:PlanMember,data:PlannerData){
 const c=target.character,tags=data.units[c.id]?.tags||[];
 return (!a.types.length||c.types.some(t=>a.types.includes(t)))&&(!a.classes.length||c.classes.some(cls=>a.classes.includes(cls)))&&(!a.tags.length||a.tags.some(tag=>tags.some(t=>canonical(t)===canonical(tag))))&&(!a.cost||(a.cost.maximum?c.cost<=a.cost.value:c.cost>=a.cost.value));
}
type TargetTest=(target:PlanMember,data:PlannerData)=>boolean;
const scopeTests=new Map<string,TargetTest>();
export function compileSupportTarget(scope:string):TargetTest{
 const cached=scopeTests.get(scope);if(cached)return cached;
 const result=buildSupportTarget(scope);if(scopeTests.size>=4096)scopeTests.clear();scopeTests.set(scope,result);return result;
}
function buildSupportTarget(scope:string):TargetTest{
 const text=scope.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();if(!text)return ()=>false;
 if(/^All characters[.!]?$/i.test(text))return ()=>true;
 // Names form an explicit OR list. Match whole identities / aliases rather
 // than arbitrary substrings (e.g. "Sabo" must not match "Saboala").
 if(!/\bcharacters?\b/i.test(text)){const names=text.split(/,|\s+and\s+|\s+or\s+/i).filter(Boolean).map(s=>s.trim());return target=>names.some(name=>named(target,name));}
 const all=attributes(text);if(!all)return ()=>false;
 // Preserve pairs such as STR Fighter / DEX Slasher; a global cross-product
 // would incorrectly admit STR Slasher. A shared prefix, e.g. INT Slasher and
 // Free Spirit, instead constrains both classes to INT.
 const bracketed:string[]=[];
 const masked=text.replace(/\[[^\]]+\]/g,value=>{bracketed.push(value);return `__scope${bracketed.length-1}__`;});
 const branches=masked.split(/,|\s+(?:and|or)\s+|\//i).map(s=>s.replace(/__scope(\d+)__/g,(_,i)=>bracketed[Number(i)])).map(s=>s.trim()).filter(Boolean).map(attributes);
 const dimensions=(a:Attributes)=>[!!a.types.length,!!a.classes.length,!!a.tags.length];
 const dims=dimensions(all),paired=dims.filter(Boolean).length>1&&branches.length>1&&branches.every(a=>a&&dimensions(a).every((v,i)=>v===dims[i]));
 if(paired){const alternatives=branches.map(a=>({...a!,cost:all.cost}));return (target,data)=>alternatives.some(a=>matches(a,target,data));}
 if(/\bor\b/i.test(text)&&!all.cost&&branches.length>1&&branches.every(Boolean))return (target,data)=>branches.some(a=>matches(a!,target,data));
 return (target,data)=>matches(all,target,data);
}
export function supportTargetMatches(scope:string,target:PlanMember,data:PlannerData){return compileSupportTarget(scope)(target,data);}
