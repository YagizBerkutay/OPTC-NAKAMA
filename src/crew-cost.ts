import type {Character} from './model';
type Member={character:Character;friend?:boolean};
export function memberCost(member:Member){const cost=member.character.cost;return member.friend?0:Number.isInteger(cost)&&cost>=0?cost:Infinity;}
export function crewCost(members:Member[],supports:{member:Member}[]=[]){const active=members.reduce((n,m)=>n+memberCost(m),0),support=supports.reduce((n,s)=>n+memberCost(s.member),0);return {active,support,total:active+support};}
export function crewCostProblem(limit:number|undefined){return Number.isInteger(limit)&&limit!>0&&limit!<=9999?'':'Oyundaki Edit Crew ekranında görünen toplam cost sınırını yukarıya yaz (1–9999).';}
