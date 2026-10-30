const PHASES=['Block A','Block B','Block C','Championship','Exhibition'];
function phaseName(text){
  const t=text.replace(/[()]/g,' ').replace(/\s+/g,' ').trim();
  const block=t.match(/\bblock\s*([ABC])/i);if(block)return 'Block '+block[1].toUpperCase();
  if(/^championship\s*\/\s*exhibition/i.test(t))return 'Championship/Exhibition';
  if(/^championship\b/i.test(t))return 'Championship';
  if(/^exhibition\b/i.test(t))return 'Exhibition';
  return null;
}
const box=line=>{const ws=line.words||[];if(!ws.length)return null;const x=Math.min(...ws.map(w=>w.x)),y=Math.min(...ws.map(w=>w.y)),right=Math.max(...ws.map(w=>w.x+w.width)),bottom=Math.max(...ws.map(w=>w.y+w.height));return {x,y,width:right-x,height:bottom-y};};
function rulesButton(ocr){
  const words=ocr.lines.flatMap(l=>l.words||[]).filter(w=>/^RULES$/i.test(w.text));
  return words.length===1&&words[0].y>ocr.height*.25&&words[0].y<ocr.height*.86?words[0]:null;
}
function homePhase(ocr,phaseOcr){
  if(!rulesButton(ocr)||!/RUMBLE/i.test(ocr.text)||/grand\s*party|select character|shop\s*items/i.test(ocr.text))return null;
  const ends=phaseOcr.lines.map(l=>({text:l.text,rect:box(l)})).filter(v=>/Ends\s+in/i.test(v.text)&&v.rect);
  if(ends.length!==1)return null;
  // The closest label must itself be readable. Skipping an unreadable BLOCK C
  // (e.g. OCR "BLOCKE") incorrectly selects the CHAMPIONSHIP label above it.
  const before=phaseOcr.lines.map(l=>({phase:phaseName(l.text),rect:box(l)})).filter(v=>v.rect&&v.rect.y<ends[0].rect.y&&ends[0].rect.y-(v.rect.y+v.rect.height)<ocr.height*.07).sort((a,b)=>b.rect.y-a.rect.y);
  if(!before.length||!PHASES.includes(before[0].phase))return null;
  return before[0].phase;
}
function isRulesScreen(ocr){return /PREVIOUS\s+RANKING/i.test(ocr.text)&&/UNDERWAY|UPCOMING/i.test(ocr.text)&&ocr.lines.some(l=>!!phaseName(l.text));}
function phaseSection(ocr,phase){
  const lines=ocr.lines.filter(l=>{const r=box(l);return r&&r.y>ocr.height*.31&&r.y<ocr.height*.91}).sort((a,b)=>box(a).y-box(b).y);
  const start=lines.findIndex(l=>{const p=phaseName(l.text);return p===phase||p==='Championship/Exhibition'&&['Championship','Exhibition'].includes(phase);});
  if(start<0)return null;
  const after=lines.slice(start+1),end=after.findIndex(l=>!!phaseName(l.text));
  const body=(end>=0?after.slice(0,end):after).map(l=>l.text).join(' ');
  const complete=/During\s+the\s+last\s+\d+\s*(?:s|seconds)|Damage\s+Up!/i.test(body)&&(/Damage\s+Up!/i.test(body)||end>=0);
  return {phase,text:body,complete};
}
function normalize(text){return text.replace(/\s+/g,' ').replace(/L\s*v\s*\.\s*(\d+)/gi,'Lv.$1').replace(/(Lv\.\d+)•[,;]?/g,'$1;').replace(/Special CT S\s+eed/gi,'Special CT Speed').replace(/DEFU\b/g,'DEF Up').trim();}
function parseRules(section,phase){
  if(!PHASES.includes(phase))throw Error('Rumble bölümü doğrulanamadı.');
  const text=normalize(section),effects=[],warnings=[],matched=[];
  const targets='STR|DEX|QCK|PSY|INT|Free Spirit|Powerhouse|Fighter|Slasher|Striker|Shooter|Cerebral|Driven|crew|team|all characters';
  const attributes='Special CT(?: Speed)?|ATK|HP|DEF|SPD|RCV|Guard|CRIT|Accuracy|Shield';
  const pattern=new RegExp(`(${targets})(?:-type| type| class| characters| teammates)?\\s+((?:(?:${attributes})(?:\\s*[,/&]\\s*)?)+)\\s+(Up|Down)\\s+Lv\\.(\\d{1,2})`,'gi');
  for(const m of text.matchAll(pattern)){
    const level=Number(m[4]);if(level<1||level>20){warnings.push('Okunamayan bonus seviyesi: '+m[0]);continue;}
    const attrs=[...m[2].matchAll(new RegExp(attributes,'gi'))].map(v=>/^Special CT/i.test(v[0])?'Special CT':v[0].toUpperCase());
    const target=/crew|team|all characters/i.test(m[1])?'crew':m[1];
    effects.push({kind:'stat',targets:[target],attributes:attrs,level:m[3].toLowerCase()==='down'?-level:level});matched.push(m[0]);
  }
  // Bracket tags denote alternatives here; both percentage clauses share the same targets.
  const percentage=text.match(/((?:\[[^\]]+\]\s*)+)damage dealt to all classes\s+(\d{1,2})%\s+Up and\s+damage taken from all classes\s+(\d{1,2})%\s+Down/i);
  if(percentage){
    const tags=[...percentage[1].matchAll(/\[([^\[\]]+)\]/g)].map(m=>m[1].trim());
    if(tags.length!==(percentage[1].match(/\[/g)||[]).length)warnings.push('Bir etiketin köşeli parantezleri tam okunmadı; yalnız tamamen okunmuş etiketler kullanıldı.');
    const cpOnly=/Special Rule will only affect the Combat Power/i.test(text.slice(percentage.index+percentage[0].length,percentage.index+percentage[0].length+100));
    effects.push({kind:'damage',targets:tags,dealtPercent:Number(percentage[2]),takenPercent:-Number(percentage[3]),combatPowerOnly:cpOnly});matched.push(percentage[0]);
    if(cpOnly)warnings.push('Etiketlere verilen yüzde bonusu oyunda yalnızca Combat Power için belirtilmiş; gerçek hasar çarpanı olarak kullanılmadı.');
  }
  const tail=text.match(/During the last (\d{1,3})\s*(?:s|seconds) of battle,\s*Special CT Speed Up\s*&\s*Damage Up!/i);
  if(tail){effects.push({kind:'late',targets:['crew'],seconds:Number(tail[1])});matched.push(tail[0]);warnings.push('Son '+tail[1]+' saniyede CT / hasar artışının büyüklüğü yazmıyor; ek sayısal buff uydurulmadı.');}
  if(!effects.some(e=>e.kind==='stat'))throw Error('Bonuslar güvenilir biçimde okunamadı. MuMu’da Rules sayfasını yeniden okut.');
  const unknown=text.replace(new RegExp(matched.map(m=>m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gi'),'').replace(/\(Special Rule will only affect the Combat Power\)/gi,'').replace(/[;:.,]/g,'').trim();
  if(unknown)warnings.push('Puanlanmayan kural metni: '+unknown);
  if(/Lv\.|\d+%|\bcost\b/i.test(unknown))throw Error('Sayısal bir kural tam çözümlenemedi; kuralları yeniden okut.');
  if(/\b(?:Up|Down)\s+Lv\.[a-z?]/i.test(text)||effects.filter(e=>e.kind==='stat').length<(text.match(/\b(?:Up|Down)\s+Lv\./gi)||[]).length)throw Error('Bir bonusun seviyesi / hedefi belirsiz. Yanlış kadro önermemek için kuralları tekrar okut.');
  return {phase,text,effects,warnings,observedAt:new Date().toISOString(),source:'MuMu · Rules · Underway'};
}
module.exports={phaseName,box,rulesButton,homePhase,isRulesScreen,phaseSection,parseRules};
