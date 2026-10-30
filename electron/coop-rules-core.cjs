const normalize=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
function parseCommon(text){
 const common=normalize(text).split(/COMMON RULES/i).at(-1).split(/CO.OP RULES|DUEL RULES|RESTRICTED CHARACTERS/i)[0],clauses=[];let end=0;
 for(const m of common.matchAll(/Reduce Special Charge(?: time| Turns)? by (\d{1,2}) (?:turns )?at start of quest/gi)){
  const source=common.slice(end,m.index).trim();end=m.index+m[0].length;const cooldown=Number(m[1]),atk=Number(source.match(/ATK\s+(\d+(?:\.\d+)?)\s*[x×]/i)?.[1]||1),hp=Number(source.match(/HP\s+(\d+(?:\.\d+)?)\s*[x×]/i)?.[1]||1),tags=[...source.matchAll(/\[([^\]]+)\]/g)].map(m=>m[1].replace(/\s*[|/]\s*/g,' / ').trim()),classes=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'].filter(c=>new RegExp('\\b'+c+'\\b','i').test(source)),types=['STR','DEX','QCK','PSY','INT'].filter(t=>new RegExp('\\b'+t+'\\b').test(source));
  const scope=tags.length?'tag':classes.length?'class':types.length?'type':null,targets=tags.length?tags:classes.length?classes:types;if(!scope||cooldown>99||atk>10||hp>10)continue;clauses.push({scope,targets,atk,hp,cooldown});
 }return clauses;
}
const key=c=>JSON.stringify([c.scope,[...c.targets].sort(),c.atk,c.hp,c.cooldown]);
function verifyCommon(primary,secondary){const a=parseCommon(primary),b=parseCommon(secondary),keys=new Set(b.map(key));return {clauses:a.filter(c=>keys.has(key(c))),unverified:Math.max(a.length,b.length)-a.filter(c=>keys.has(key(c))).length};}
module.exports={parseCommon,verifyCommon};
