import type {Boss,Character,CrewRestrictions} from './model';

export function eligibleForQuest(character:Character,r?:CrewRestrictions,support=false):boolean{
 if(!support&&character.supportOnly)return false;
 if(!r)return true;
 if(r.excludedIds?.includes(character.id))return false;
 // Quest battle-slot restrictions are separate from the account's Support budget.
 if(support)return true;
 if(r.allowedClasses&&!character.classes.some(c=>r.allowedClasses!.includes(c)))return false;
 // Unknown dual form types cannot certify a restricted type entry.
 if(r.allowedTypes&&(!character.types.length||!character.types.every(t=>r.allowedTypes!.includes(t))))return false;
 if(r.maxCost!==undefined&&character.cost>r.maxCost)return false;
 if(r.maxStars!==undefined&&Number.parseFloat(character.stars)+(character.stars.includes('+')?.5:0)>r.maxStars)return false;
 return true;
}
export function questCrewFits(members:{character:Character;friend?:boolean}[],r?:CrewRestrictions):boolean{
 return members.every(m=>eligibleForQuest(m.character,r))&&(r?.maxTotalCost===undefined||members.filter(m=>!m.friend).reduce((n,m)=>n+m.character.cost,0)<=r.maxTotalCost);
}
export function restrictionSummary(r?:CrewRestrictions):string[]{
 if(!r)return [];
 return [...(r.allowedClasses?['İzin verilen sınıflar: '+r.allowedClasses.join(' / ')]:[]),...(r.allowedTypes?['İzin verilen tipler: '+r.allowedTypes.join(' / ')]:[]),...(r.maxCost===undefined?[]:['Karakter maliyeti en fazla '+r.maxCost]),...(r.maxTotalCost===undefined?[]:['5 karakterin toplam maliyeti en fazla '+r.maxTotalCost]),...(r.maxStars===undefined?[]:['Yıldız sayısı en fazla '+r.maxStars]),...(r.excludedIds?.length?['Bu görevde çıkarılan kartlar: '+r.excludedIds.map(id=>'#'+id).join(', ')]:[])];
}
export function questMapEffect(r?:CrewRestrictions):string{
 if(!r||!(r.mapEffect||r.unsupported==='Map Effect'))return '';
 // Accept the already-read v0.5.22 payload too. A mixed / unfinished
 // eligibility rule must never be bypassed just because it mentions a map.
 if(['allowedClasses','allowedTypes','maxCost','maxStars','maxTotalCost','excludedIds'].some(key=>Object.hasOwn(r,key)))return '';
 const match=r.text.trim().match(/^Map Effect:\s+([A-Za-z][A-Za-z '\-]{1,80})$/);
 if(!match||r.mapEffect!==undefined&&r.mapEffect!==match[1])return '';
 return match[1];
}
export function questPlanningWarning(boss?:Boss):string{
 const effect=questMapEffect(boss?.restrictions);
 const map=effect?`Harita etkisi: ${effect}. Kadro önerisi oluşturulabilir; bu etkinin hasarı, süresi ve tetikleri doğrulanmadı. Gösterilen HP / hasar tahmini bu etkiyi kapsamaz; hazırlık ve bekleme turlarında hayatta kalma ile kazanma doğrulanmış değildir.`:'';
 return [map,boss?.ambush?.warning||boss?.restrictions?.warnings?.find(w=>w.startsWith('Neo Ambush:'))||''].filter(Boolean).join(' ');
}
export function questRestrictionProblem(boss?:Boss):string{
 const r=boss?.restrictions;
 if(questMapEffect(r))return '';
 return r?.status==='partial'?(r.unsupported?`${r.unsupported} koşulu okundu; bu koşul türü henüz kadro hesabında desteklenmiyor. Okunan açıklama: ${r.text}.`:'Katılım koşulu tam okunamadı. REQUIREMENT yazısını yeniden okut; eksik kuralla kadro önerilmedi.'):'';
}
