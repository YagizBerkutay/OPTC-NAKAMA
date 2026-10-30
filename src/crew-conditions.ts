import type { Character } from './model';
const types=['STR','DEX','QCK','PSY','INT'];
const classes=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'];
type Clause={text:string;body?:string;kind?:'captain'|'crew';types:string[];classes:string[];required:number};
const compiled=new Map<string,Clause[]>();
export function resolveCrewText(text:string,captain:Character,crew:Character[]):string {
  let clauses=compiled.get(text);if(!clauses){clauses=text.split(/\.\s+|\n/).map(sentence=>{const condition=sentence.match(/^\s*If (?:your |the )?Captain is (?:a |an )?([^,]+),\s*/i),count=sentence.match(/^\s*If (?:your |the )?crew (?:has|contains|consists of) (?:at least )?(\d+) ([^,]+?) characters,\s*/i),scope=condition?.[1]||count?.[2]||'';return {text:sentence,body:condition?sentence.slice(condition[0].length):count?sentence.slice(count[0].length):undefined,kind:condition?'captain':count?'crew':undefined,types:types.filter(t=>scope.includes(t)),classes:classes.filter(c=>scope.toLowerCase().includes(c.toLowerCase())),required:Number(count?.[1]||0)};});if(compiled.size>=8192)compiled.clear();compiled.set(text,clauses);}
  return clauses.map(clause=>{
    if(clause.kind==='captain'&&(captain.types.length===1&&captain.types.some(t=>clause.types.includes(t))||captain.classes.some(c=>clause.classes.includes(c))))return clause.body;
    if(clause.kind==='crew'&&crew.filter(c=>c.classes.some(v=>clause.classes.includes(v))||c.types.length===1&&c.types.some(t=>clause.types.includes(t))).length>=clause.required)return clause.body;
    return clause.text;
  }).join('. ');
}
