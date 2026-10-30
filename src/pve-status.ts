import type {Stage} from './model';

export function statusTargets(stage:Stage,kind:'bind'|'specialBind',index:number):boolean {
 const text=stage.events?.filter(e=>['preemptive','starting','turn'].includes(e.trigger)).map(e=>e.text).join('\n')||stage.notes||'';
 const label=kind==='bind'?'Bind':'Special (?:Bind|Silence)';
 const rows=[...text.matchAll(new RegExp('\\b(Top|Middle|Bottom)[ -]Row '+label+'\\b','gi'))];
 const columns=[...text.matchAll(new RegExp('\\b(Left|Right)[ -]Column '+label+'\\b','gi'))];
 if(rows.length||columns.length)return rows.some(m=>index>=({top:0,middle:2,bottom:4}[m[1].toLowerCase()]??0)&&index<({top:0,middle:2,bottom:4}[m[1].toLowerCase()]??0)+2)||columns.some(m=>index%2===(m[1].toLowerCase()==='left'?0:1));
 if(new RegExp('Crewmate '+label,'i').test(text))return index>=2;
 if(new RegExp('Captain '+label,'i').test(text))return index<2;
 return new RegExp('\\d+\\s*turn(?:\\(s\\)|s)?\\s+'+label+'\\b','i').test(text);
}
