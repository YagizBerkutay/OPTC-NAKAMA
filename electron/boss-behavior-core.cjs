const crypto=require('node:crypto');
const LABELS={bind:'Bind',despair:'Despair',paralysis:'Paralysis',specialBind:'Special Bind',atkDown:'ATK Down',burn:'Burn',poison:'Poison',threshold:'Threshold',damageReduction:'Damage Reduction',defenseUp:'DEF Up',resilience:'Resilience',damageNullification:'Damage Nullification'};
function rows(ocr){
  const output=[];
  for(const line of ocr.lines||[]){if(!line.words?.length)continue;const y=Math.min(...line.words.map(w=>w.y)),height=Math.max(...line.words.map(w=>w.height));const row=output.find(r=>Math.abs(r.y-y)<Math.min(r.height,height)*.48);if(row)row.words.push(...line.words);else output.push({y,height,words:[...line.words]});}
  return output.sort((a,b)=>a.y-b.y).map(r=>({...r,text:r.words.sort((a,b)=>a.x-b.x).map(w=>w.text).join(' ').replace(/\s+/g,' ').trim()}));
}
function modalIdentity(ocr){
  const h=ocr.height,w=ocr.width,list=rows(ocr);
  const guide=list.find(r=>/QUEST GUIDE/i.test(r.text)&&r.y>h*.12&&r.y<h*.3),ok=list.find(r=>/^[O0][Kk]$/.test(r.text)&&r.y>h*.77&&r.y<h*.92);
  if(!guide||!ok)return null;
  const title=list.filter(r=>r.y>h*.09&&r.y<h*.15&&r.words.some(x=>x.x>w*.1&&x.x<w*.9)).map(r=>r.text).join(' ').trim();if(title.length<4||title.length>160)return null;
  if(/^Co.Op Quest\s*[-:]/i.test(title))return {title,level:null,difficulty:null,mode:'coop',body:{left:Math.round(w*.109),top:Math.round(h*.2525),width:Math.round(w*.783),height:Math.round(h*.529)}};
  // Level accordions can scroll to y=.246h, close to the old header cutoff.
  // Only information above the tab row belongs to the encounter header.
  const headerRows=list.filter(r=>r.y+r.height<=guide.y);
  if(/^Vs\.\s+\S/i.test(title)&&!headerRows.some(r=>/Difficulty/i.test(r.text)))return {title,level:Number(title.match(/\bLv\.?\s*(\d+)\b/i)?.[1])||null,difficulty:null,mode:'pka',body:{left:Math.round(w*.109),top:Math.round(h*.246),width:Math.round(w*.783),height:Math.round(h*.528)}};
  if(!headerRows.some(r=>/Difficulty|\bLv\.?\s*\d|\bLevel\b/i.test(r.text)))return /^Vs\.\s+\S/i.test(title)?{title,level:null,difficulty:null,mode:'pka',body:{left:Math.round(w*.109),top:Math.round(h*.246),width:Math.round(w*.783),height:Math.round(h*.528)}}:null;
  const levelText=list.filter(r=>r.y>h*.09&&r.y<h*.23).map(r=>r.text).join(' '),level=Number(levelText.match(/\b(?:Lv\.?|Level)\s*[:.]?\s*(\d{1,5})\b/i)?.[1])||null;
  const difficultyRow=list.find(r=>/Difficulty/i.test(r.text)&&r.y<h*.25),digits=difficultyRow?.text.match(/Difficulty\s*[^\d]{0,6}(\d[\d\s]*)$/i)?.[1]?.replace(/\s/g,'');const difficulty=digits&&Number(digits)>=1&&Number(digits)<=20?Number(digits):null;
  return {title,level,difficulty,body:{left:Math.round(w*.109),top:Math.round(h*.261),width:Math.round(w*.783),height:Math.round(h*.529)},difficultyRow};
}
function eventLabel(text){
  const t=text.trim().replace(/[|]/g,'I');
  if(/^PRE[ -]?EMPTIVE\b/i.test(t)){const condition=t.replace(/^PRE[ -]?EMPTIVE\b/i,'').trim();return {trigger:'preemptive',label:condition?'İlk saldırı · '+condition:'İlk saldırı'};}
  if(/^STARTING STATE\b/i.test(t))return {trigger:'starting',label:t};
  if(/^DEFEATED\b|^ON DEFEAT\b/i.test(t))return {trigger:'defeated',label:'Yenilince'};
  const numbered=t.match(/^(?:TURN\s*(\d+)|(\d+)(?:ST|ND|RD|TH)? TURN)\s*[:.]?$/i),after=t.match(/^AFTER\s*(\d+)\s*TURNS?\s*[:.]?$/i),every=t.match(/^EVERY\s*(\d+)?\s*TURNS?\s*[:.]?$/i);
  if(numbered||after||every)return {trigger:'turn',label:t,battleTurn:numbered?Number(numbered[1]||numbered[2]):Number(after?.[1]||every?.[1]||1)+1,...(every?{repeatEvery:Number(every[1]||1)}:{})};
  if(/^(?:ON ATTACK|AFTER ATTACK|BEFORE ATTACK|REGULAR ATTACK)\b/i.test(t))return {trigger:'turn',label:t};
  if(/^(?:HP\s*[<≤>≥]|WHEN HP|BELOW\s*\d+%|ABOVE\s*\d+%)/i.test(t))return {trigger:'hp',label:t};
  if(/^(?:INTERRUPT|SPECIAL REACTION|WHEN.*SPECIAL|AFTER.*SPECIAL|ON SPECIAL)/i.test(t))return {trigger:'interrupt',label:t};
  return null;
}
function durationEffects(text){
  const result=new Map(),unreadable=[];
  const patterns=[['specialBind',/Special (?:Bind|Silence)|Special Ability (?:Bind|Seal)/i],['despair',/Despair/i],['bind',/\bBind\b|\bBinding\b/i],['paralysis',/Paralysis|Paraly[sz]/i],['atkDown',/ATK(?:\s+\d+%)? Down|Attack Down|Decrease(?:s)? (?:crew['’]s? )?ATK/i],['burn',/Burn/i],['poison',/Poison/i],['threshold',/Damage Threshold|Threshold Damage|Dama[go]e (?:above|over)\s*\d/i],['damageReduction',/Damage Reduction|Reduce(?:s)? (?:Incoming|Received) Damage|Reduce(?:s)? damage taken/i],['defenseUp',/DEF(?:ENSE)? Up|Increased? DEF|DEF\s*x\s*\d/i],['resilience',/Resilience|Survive.*1 HP/i],['damageNullification',/Damage Nullification|Nullify Damage|Damage Negation/i]];
  for(const line of text.split('\n')){
    if(/immun(?:e|ity)|resist(?:ance)?|remove|recover|reduce.*duration/i.test(line))continue;
    const matching=patterns.filter(([key,re])=>re.test(line)&&!(key==='damageReduction'&&/Slot Damage Reduction/i.test(line))&&!(key==='bind'&&/Special|Slot|Orb|Ship/i.test(line))&&!(key==='poison'&&/Poison.*(?:Slot|Orb)|(?:Slot|Orb).*\[POISON\]/i.test(line)));
    if(!matching.length)continue;
    const before=line.match(/\b(\d{1,2})\s*turn(?:\(s\)|s)?\b/i),after=line.match(/(?:for|duration[: ]+)\s*(\d{1,2})\s*turn/i);const number=Number(before?.[1]||after?.[1]);
    const condition=line.replace(/\(?take damage when performing PERFEC[TIl](?: attacks?)?\)?/gi,'');
    if(!number||number>99||/\bif\b|\bwhen\b|\bchance\b/i.test(condition)){unreadable.push(line);continue;}
    for(const [key]of matching)result.set(key,Math.max(result.get(key)||0,number));
  }
  return {effects:[...result].map(([mechanic,turns])=>({mechanic,turns})),unreadable};
}
function pageTokens(ocr,identity){
  const body=identity.body,clipped={...ocr,lines:ocr.lines.map(l=>({...l,words:l.words.filter(w=>w.x>=body.left&&w.x+w.width<body.left+body.width&&w.y>=body.top&&w.y+w.height<body.top+body.height-6)}))};const list=rows(clipped),page=Symbol();const tokens=list.map(r=>{const heading=r.text.replace(/^(BATTLE\s*(?:[1-9]|10))\s*-?\s+([1-9]|[Il])$/i,(_,prefix,digit)=>prefix+'-'+(/[Il]/.test(digit)?'1':digit));const battle=heading.match(/^BATTLE\s*([1-9]|10)(?:\s*-\s*(\d+))?\s*$/i);if(/^BATTLE\b/i.test(r.text)&&!battle)return {kind:'invalidBattle',text:r.text};if(battle)return {kind:'battle',number:Number(battle[1]),variant:battle[2]||'',text:heading};if(/^BEHAVIO(?:R|UR)$/i.test(r.text))return {kind:'heading',text:r.text};const event=eventLabel(r.text);
    // A moving duration can briefly read "99 turn" at the right edge. Real
    // turn badges start in the fixed label gutter; a duration is effect text.
    if(event&&(event.trigger!=='turn'||r.words.some(w=>w.x<body.left+body.width*.11)))return {kind:'event',...event,text:r.text};
    // Effect icons occupy their own gutter. OCR can read the same icon as
    // 0, 8 or @; these pixels are not a duration or a damage value. Only remove
    // small isolated glyphs wholly in that gutter, never words in the text lane.
    const words=r.words.filter(w=>!(w.x+w.width<ocr.width*.19&&(w.text.length===1||/^[\d@O()]+$/i.test(w.text))));
    return {kind:'line',text:words.map(w=>w.text).join(' ').trim()};
  });tokens.forEach((t,i)=>{
    let words=t.kind==='line'?list[i].words.filter(w=>!(w.x+w.width<ocr.width*.19&&(w.text.length===1||/^[\d@O()]+$/i.test(w.text)))):list[i].words;
    const labelWords=t.kind==='event'?words.filter(w=>/^(?:PRE[ -]?EMPTIVE|STARTING|STATE|INTERRUPTION?|DEFEATED|DEFEAT|TURN)$/i.test(w.text)):[];
    const anchor=labelWords.length?labelWords:t.kind==='line'&&words.length?words:list[i].words;
    const top=Math.min(...anchor.map(w=>w.y)),height=Math.max(...anchor.map(w=>w.height));
    if(t.kind==='event')words=words.filter(w=>w.x>=body.left+body.width*.25);
    positioned(t,{top,height,left:words.length?Math.min(...words.map(w=>w.x)):undefined,...(labelWords.length?{contentLeft:Math.max(...labelWords.map(w=>w.x+w.width))+8}:{}),page,edge:top<body.top+16,rightClipped:['line','event'].includes(t.kind)&&words.some(w=>w.clippedAtRight||w.x+w.width>=body.left+body.width-42)});
  });const start=tokens.findIndex(t=>t.kind==='heading');return start>=0?tokens.slice(start):tokens;
}
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
function positioned(token,position){if(position)Object.defineProperty(token,'position',{value:position,enumerable:false});return token;}
function joinMarquee(a,b){
  // OCR also clips inside a word. Map a sufficiently long literal character
  // overlap back to the observed strings, preserving their punctuation.
  const mapped=s=>{let key='',ends=[];for(let i=0;i<s.length;i++)if(/[a-z0-9]/i.test(s[i])){key+=s[i].toLowerCase();ends.push(i+1);}return {key,ends};};
  const canonical=s=>normalize(s.replace(/Non-NormaI/gi,'Non-Normal'));
  const ca=canonical(a),cb=canonical(b);
  if(ca.length>=14&&cb.length>=14){
    if(ca===cb)return a.length<=b.length?a:b;
    if(ca.includes(cb))return a;
    if(cb.includes(ca))return b;
  }
  const duration=s=>s.match(/^\s*(\d+)\s+(?=turn)/i);
  for(const [prefix,suffix]of [[a,b],[b,a]]){
    const d=duration(prefix),tail=d?prefix.slice(d[0].length):prefix;
    if(d&&!duration(suffix)&&canonical(tail).length>=16&&canonical(suffix).startsWith(canonical(tail)))return d[0]+suffix;
    const words=prefix.split(/\s+/),other=suffix.split(/\s+/);
    for(let count=Math.min(words.length,other.length);count>=3;count--){
      const end=words.slice(-count);if(canonical(end.join(' ')).length<14)continue;
      if(end.every((w,i)=>canonical(w)===canonical(other[i])))return [...words,...other.slice(count)].join(' ');
    }
  }
  for(const [prefix,suffix]of [[a,b],[b,a]]){
    const x=mapped(prefix),y=mapped(suffix);
    for(let n=Math.min(x.key.length,y.key.length);n>=14;n--){
      if(x.key.slice(-n)!==y.key.slice(0,n))continue;
      const overlap=prefix.slice(x.ends[x.key.length-n-1]||0);
      if((overlap.match(/[a-z]+/gi)||[]).length<3)continue;
      return prefix+suffix.slice(y.ends[n-1]);
    }
  }
  return null;
}
function preferRow(old,next){
  const keep=t=>positioned({...t,...(old.marquee||next.marquee?{marquee:{complete:!!(old.marquee?.complete||next.marquee?.complete),samples:Math.max(old.marquee?.samples||0,next.marquee?.samples||0)}}:{})},next.position);
  if(next.kind==='line'&&next.position?.edge)return keep(old);
  if(old.kind==='line'&&next.kind==='line'&&numericFragment(old,next)){
    const full=/[a-z]/i.test(old.text)?old:next;return keep({...full,numericFragment:true});
  }
  // Only literal overlapping text is joined. No unseen word or number is
  // inferred; the caller has already established the physical row / overlap.
  if(old.kind==='line'&&next.kind==='line'){const joined=joinMarquee(old.text,next.text);if(joined)return keep({...old,text:joined});}
  // Keep observed damage + mechanic when the same marquee later shows only
  // its explanation. A longer suffix must not erase "10000 damage Burn".
  const damage=t=>/\b\d[\d,]*\s*damage (?:Burn|Poison)\b/i.test(t.text);
  if(damage(old)!==damage(next))return keep(damage(old)?old:next);
  const duration=t=>/^\s*\d+\s*turn/i.test(t.text);
  const best=duration(old)!==duration(next)?duration(old)?old:next:old.text.length>next.text.length?old:next;
  return keep(best);
}
function conflictingNumbers(a,b){
  if(numericFragment(a,b))return false;
  const duration=t=>t.text.match(/^\s*(?:For\s+)?(\d+)\s*turn/i)?.[1];
  const da=duration(a),db=duration(b);if(da&&db&&da!==db)return true;
  const numbers=t=>(t.text.replace(/^\s*(?:For\s+)?\d+\s*(?=turn)/i,'').match(/\d+/g)||[]);
  const x=numbers(a),y=numbers(b);
  // A marquee can hide numbers at either edge, but two visible values must
  // agree in order. A differing duration is never explained by clipping.
  if(!x.length||!y.length)return false;
  const short=x.length<y.length?x:y,long=x.length<y.length?y:x;
  return !long.some((_,i)=>i+short.length<=long.length&&short.every((n,j)=>n===long[i+j]));
}
function numericFragment(a,b){return a.kind==='line'&&b.kind==='line'&&((/^\s*\d+\s*$/.test(a.text)&&/[a-z]/i.test(b.text))||(/^\s*\d+\s*$/.test(b.text)&&/[a-z]/i.test(a.text)));}
function mergeByPosition(existing,next,evidence,onAlignment){
  const page=existing.at(-1)?.position?.page;if(!page||!next.every(t=>t.position))return null;
  const previous=existing.map((t,index)=>({t,index})).filter(v=>v.t.position?.page===page);
  const verified=Number.isFinite(evidence?.shift)&&evidence.verified===true;
  const range=evidence?.range?.verified&&Number.isFinite(evidence.range.min)&&Number.isFinite(evidence.range.max)?evidence.range:null;
  if(previous.length<3&&!verified)return null;
  const exact=(a,b)=>a.kind===b.kind&&normalize(a.text)===normalize(b.text);
  const shifts=[];
  for(const {t}of previous)for(const n of next)if(exact(t,n)){
    const shift=t.position.top-n.position.top;
    if(shift>=-4&&shift<=600&&!shifts.some(v=>Math.abs(v-shift)<=4))shifts.push(shift);
  }
  const candidates=shifts.map(shift=>{
    const used=new Set(),matches=[];
    for(const n of next){const p=previous.find(v=>!used.has(v.index)&&exact(v.t,n)&&Math.abs(v.t.position.top-n.position.top-shift)<=4);if(p){used.add(p.index);matches.push(p);}}
    return {shift,matches,distinct:new Set(matches.map(v=>v.t.kind+normalize(v.t.text))).size};
  }).filter(c=>(!range||c.shift>=range.min&&c.shift<=range.max)&&c.matches.length>=3&&c.distinct>=3&&Math.max(...c.matches.map(v=>v.t.position.top))-Math.min(...c.matches.map(v=>v.t.position.top))>=80).sort((a,b)=>b.matches.length-a.matches.length);
  const best=candidates[0];
  const shift=verified?evidence.shift:best?.shift;
  if(shift===undefined)return null;
  if(!verified&&candidates[1]&&best.matches.length-candidates[1].matches.length<2)throw Error('Kaydırma konumu belirsiz; sayfalar güvenle birleştirilemedi.');
  const joined=[...existing],pending=[];
  // A row temporarily omitted by OCR remains in the same physical list.
  // Reproject it as well, so a dropped final marquee does not lose the current
  // page reference or become a second copy when it is visible again.
  for(const p of previous)joined[p.index]=positioned({...p.t},{...p.t.position,top:p.t.position.top-shift,page:next[0].position.page});
  for(const n of next){
    // The top edge can cut away a fixed trigger badge and leave only a few
    // glyphs from its condition. Earlier pages already contain this row;
    // preserve that reading instead of treating the half label as a new kind.
    if(n.kind==='line'&&n.position.edge)continue;
    const top=n.position.top+shift;
    const matches=previous.filter(v=>Math.abs(v.t.position.top-top)<=4);
    if(matches.length>1)return null;
    if(matches.length){
      const p=matches[0];
      if(p.t.kind!==n.kind)return null;
      if(p.t.kind==='battle'&&(p.t.number!==n.number||p.t.variant!==n.variant))return null;
      if(p.t.kind==='event'&&(p.t.trigger!==n.trigger||p.t.battleTurn!==n.battleTurn))return null;
      // A clipped top-edge transcription cannot contradict the earlier full
      // row. preferRow already keeps that full reading; apply the same rule
      // before checking numbers rather than rejecting an unreadable half glyph.
      if(!(n.kind==='line'&&n.position.edge)&&conflictingNumbers(p.t,n)){
        // A tracked but incomplete horizontal fragment cannot overrule an
        // already observed row. Retain it as partial if neither is complete.
        // Untracked / complete conflicting values still fail the old guard.
        if(verified&&n.kind==='line'&&n.marquee?.complete===false){joined[p.index]=positioned({...p.t,marquee:{complete:!!p.t.marquee?.complete,samples:Math.max(p.t.marquee?.samples||0,n.marquee.samples||0)}},n.position);continue;}
        throw Error('Aynı davranış satırının tur / hasar sayıları çelişiyor; sayfalar güvenle birleştirilemedi.',{cause:{previous:p.t.text,current:n.text,alignment:{shift,verified:true,source:verified?'pixels':'unique-text-anchors'}}});
      }
      joined[p.index]=preferRow(p.t,n);
    }else{
      // Earlier rows were already read on previous pages. Newly visible rows
      // within this shared viewport are inserted by their measured position.
      if(top<previous[0].t.position.top-4||n.kind==='line'&&n.position.edge)continue;
      const after=previous.find(v=>v.t.position.top>top);
      pending.push({index:after?.index??existing.length,token:n});
    }
  }
  pending.sort((a,b)=>b.index-a.index||b.token.position.top-a.token.position.top);
  for(const p of pending)joined.splice(p.index,0,p.token);
  if(!orderedBattles(joined))return null;
  onAlignment?.({shift,verified:true,source:verified?'pixels':'unique-text-anchors'});
  return joined;
}
function orderedBattles(tokens){
  const seen=new Set();let last=0;
  for(const t of tokens.filter(t=>t.kind==='battle')){
    const key=t.number+'-'+t.variant;
    if(t.number<last||seen.has(key))return false;
    seen.add(key);last=t.number;
  }
  return true;
}
function clippedLine(a,b){
  if(a.kind!=='line'||b.kind!=='line')return false;
  const numbers=s=>s.match(/\d+/g)||[],an=numbers(a.text),bn=numbers(b.text);
  if(an.length&&bn.length&&JSON.stringify(an)!==JSON.stringify(bn))return false;
  const trim=s=>normalize(s.replace(/^\s*\d+\s*(?=turn)/i,'')),x=trim(a.text),y=trim(b.text),short=x.length<y.length?x:y,long=x.length<y.length?y:x;
  return short.length>=16&&short.length>=long.length*.45&&long.startsWith(short);
}
function mergeTokens(existing,next,evidence,onAlignment){
  if(!existing.length)return [...next];
  const clean=next.filter(t=>t.kind!=='heading');let overlap=0;
  if(existing.every(t=>t.kind==='heading'))return [...existing,...clean];
  // Three distinct stable rows must establish one unambiguous vertical shift.
  // This identifies physical rows even when their marquee text changes.
  const positionedMerge=mergeByPosition(existing,clean,evidence,onAlignment);if(positionedMerge)return positionedMerge;
  for(let n=1;n<=Math.min(existing.length,clean.length);n++)if(existing.slice(-n).every((t,i)=>t.kind===clean[i].kind&&normalize(t.text)===normalize(clean[i].text))&&orderedBattles([...existing,...clean.slice(n)]))overlap=n;
  if(overlap)return [...existing.slice(0,-overlap),...existing.slice(-overlap).map((t,i)=>preferRow(t,clean[i])),...clean.slice(overlap)];
  // Scrolling marquee text can be clipped differently in adjacent screenshots.
  // Require at least two unchanged rows plus a trigger/header in the overlap;
  // conflicting numeric effects never qualify as a clipped transcription.
  for(let n=3;n<=Math.min(existing.length,clean.length);n++){
    const tail=existing.slice(-n),same=tail.map((t,i)=>t.kind===clean[i].kind&&normalize(t.text)===normalize(clean[i].text));
    if(same.filter(Boolean).length<2||!tail.some((t,i)=>same[i]&&(t.kind==='battle'||t.kind==='event'))||!tail.every((t,i)=>same[i]||clippedLine(t,clean[i]))||!orderedBattles([...existing,...clean.slice(n)]))continue;
    overlap=n;
  }
  if(overlap){const offset=existing.length-overlap,joined=existing.map((t,i)=>{const newer=clean[i-offset];if(!newer)return t;return preferRow(t,newer);});return [...joined,...clean.slice(overlap)];}
  // Retain earlier behavior when a moving slot marquee changes the overlap.
  const anchor=clean.findIndex(t=>t.kind==='battle');
  if(anchor>=0){
    const t=clean[anchor],idx=existing.findIndex(v=>v.kind==='battle'&&v.number===t.number&&v.variant===t.variant);
    if(idx>=0){
      const oldHeadings=existing.slice(idx).filter(v=>v.kind==='battle'),newHeadings=clean.slice(anchor).filter(v=>v.kind==='battle');
      const joined=[...existing.slice(0,idx),...clean.slice(anchor)];
      // Identical effects in different subsections are not a page anchor.
      // Reconcile using a shared Battle heading, keeping every already observed
      // later heading in order; a backwards page cannot erase scanned stages.
      if(oldHeadings.every((v,i)=>newHeadings[i]?.number===v.number&&newHeadings[i]?.variant===v.variant)&&orderedBattles(joined))return joined;
    }
  }
  throw Error('Kaydırılan sayfalar güvenle birleştirilemedi. BEHAVIOR listesini başa alıp yeniden okut.');
}
function behaviorRules(text){
  const rewind=text.match(/(?:Special (?:Cooldown|Reverse|Rewind)|Rewind (?:Special|Cooldown))[^\n]*?(\d{1,2})\s*turn/i);
  const limit=text.match(/(?:Special (?:Use |Usage )?Limit|Limit.*Special)[^\n]*?(\d{1,2})\s*(?:time(?:\(s\)|s)?|uses|specials)/i);
  return {...(rewind?{cooldownRewind:Number(rewind[1])}:{}),...(limit?{specialLimit:Number(limit[1])}:{}),...(/Normal Attack(?:s)? Only|Only Normal Attack|Non-Norma[lI] Attacks deal 1 damage/i.test(text)?{normalAttackOnly:true}:{})};
}
function encounterFromTokens(identity,tokens,metadata){
  const stages=[],warnings=[],seen=new Set();let stage,event,sourceBattle='',lastNumber=0;
  const marquees=tokens.filter(t=>t.marquee);
  const partial=marquees.filter(t=>!t.marquee.complete);
  for(const t of partial)warnings.push('Kayan satırın tamamı doğrulanamadı · '+t.text);
  if(tokens.some(t=>t.numericFragment))warnings.push('Kayan satırın yalnız sayısı görünen eksik görüntüsü kullanılmadı; aynı konumdaki metinli okuma korundu.');
  for(const token of tokens){
    if(token.kind==='invalidBattle')throw Error('Bir Battle başlığı okunamadı; aşamalar birleştirilmedi. Yeniden okut.');
    if(token.kind==='battle'){
      sourceBattle='Battle '+token.number+(token.variant?'-'+token.variant:'');
      if(token.number<lastNumber||seen.has(sourceBattle))throw Error('Savaş başlıkları tekrarlandı veya sırası değişti; yeniden okut.');seen.add(sourceBattle);lastNumber=token.number;
      const previous=stages.find(s=>s.number===token.number);
      if(previous&&!token.variant)throw Error('Tekrarlanan savaş aşaması okunamadı.');
      if(previous)stage=previous;
      else{stage={id:'screen-battle-'+token.number,name:'Battle '+token.number,number:token.number,battleNumber:token.number,turn:token.number-1,requirements:[],notes:'',events:[],sourceSections:[]};stages.push(stage);}stage.sourceSections.push(sourceBattle);event=null;
    }else if(token.kind==='event'&&stage){
      if(token.marquee&&!token.marquee.complete)stage.behaviorTextComplete=false;
      if(event&&!event.text&&event.trigger===token.trigger&&event.label===token.label&&event.sourceBattle===sourceBattle&&event.battleTurn===token.battleTurn)continue;
      event={trigger:token.trigger,label:token.label,sourceBattle,...(token.battleTurn?{battleTurn:token.battleTurn}:{}),...(token.repeatEvery?{repeatEvery:token.repeatEvery}:{}),text:'',requirements:[]};stage.events.push(event);
    }
    else if(token.kind==='line'&&stage){if(token.marquee&&!token.marquee.complete)stage.behaviorTextComplete=false;if(!event){event={trigger:'unknown',label:'Tetik okunamadı',sourceBattle,text:'',requirements:[]};stage.events.push(event);}event.text+=(event.text?'\n':'')+token.text;}
    else if(token.kind==='event'||token.kind==='line')throw Error('Savaş başlığı olmayan davranış okundu; boş aşama olarak kabul edilmedi. Yeniden okut.');
  }
  if(!stages.length)throw Error('BEHAVIOR listesinde okunabilen bir Battle başlığı yok.');
  if(stages[0].number!==1||stages.some((s,i)=>s.number!==i+1)){
    if(!metadata.startVerified||!metadata.complete)throw Error('BEHAVIOR listesinin başı ve sonu doğrulanmalı; okunmayan aşamalar boş kabul edilmedi.');
    for(let number=1;number<=lastNumber;number++)if(!stages.some(s=>s.number===number))stages.push({id:'screen-battle-'+number,name:'Battle '+number,number,battleNumber:number,turn:number-1,requirements:[],notes:'Rehberde bu aşama için davranış listelenmedi.',events:[],sourceSections:[],behaviorStatus:'notListed'});
    stages.sort((a,b)=>a.number-b.number);
  }
  for(const s of stages){
    const merged=new Map();
    for(const e of s.events){const parsed=durationEffects(e.text);e.requirements=parsed.effects;
      Object.assign(e,behaviorRules(e.text));
      if(e.trigger==='preemptive'||e.trigger==='starting')for(const effect of parsed.effects)merged.set(effect.mechanic,Math.max(merged.get(effect.mechanic)||0,effect.turns));
      if(parsed.unreadable.length)warnings.push(s.name+': süre / koşul doğrulanamadı · '+parsed.unreadable.join(' / '));
      if(e.trigger==='unknown'||!e.text)warnings.push(s.name+': tetik veya davranış metni eksik.');
      if(e.repeatEvery)warnings.push(s.name+': '+e.label+' tekrarlanır; plan ilk tetiklenmeyi kapsar, sınırsız beklemeyi kapsamaz.');
      if(e.trigger==='turn'&&(!e.battleTurn||e.battleTurn>20))warnings.push(s.name+': '+e.label+' için kesin / desteklenen tur zamanı yok; yalnız davranış olarak gösterilir.');
    }
    s.requirements=[...merged].map(([mechanic,turns])=>({mechanic,turns}));
    const classes=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'];
    const weakness=[...new Set(s.events.flatMap(e=>e.text.split('\n').filter(l=>/^Weakness Class\s*:/i.test(l)).flatMap(l=>classes.filter(c=>new RegExp('\\b'+c+'\\b','i').test(l)))))];
    if(weakness.length)s.weaknessClasses=weakness;
    if(s.events.some(e=>/Weakness Class/i.test(e.text))&&!weakness.length)warnings.push(s.name+': Weakness Class sınıfı eksik okunmuş; avantaj varsayılmadı.');
    const initial=s.events.filter(e=>e.trigger==='preemptive'||e.trigger==='starting'),limits=initial.flatMap(e=>e.specialLimit===undefined?[]:[e.specialLimit]);
    if(limits.length)s.specialLimit=Math.min(...limits);const rewind=Math.max(0,...initial.map(e=>e.cooldownRewind||0));if(rewind)s.cooldownRewind=rewind;if(initial.some(e=>e.normalAttackOnly))s.normalAttackOnly=true;
    if(s.sourceSections.length>1)warnings.push(s.name+': '+s.sourceSections.join(' / ')+' alt bölümleri ayrı gösterilir. İlk saldırı gereksinimleri ortak kapsamla değerlendirilir; alt numara tek başına saldırı turu sayılmaz.');
    s.behaviorStatus=s.behaviorStatus||(s.events.length?'listed':'empty');
    if(s.events.length)s.notes=s.events.map(e=>e.sourceBattle+' · '+e.label+':\n'+e.text).join('\n\n');else if(!s.notes)s.notes='Bu aşamanın rehberdeki davranış bölümü boş.';delete s.number;
  }
  if(!metadata.complete)warnings.push('Listenin sonu doğrulanamadı; bu okuma kadro hesabında kullanılamaz.');
  if(identity.difficulty===null)warnings.push('Yıldız zorluğu okunamadı; başlıktaki varyant korunur.');
  if(identity.level===null)warnings.push('Sayısal boss seviyesi ekranda yok / okunamadı; başka seviyeler için tahmin yapılmaz.');
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify({title:identity.title,difficulty:identity.difficulty,level:identity.level,...(identity.levelRange?{levelRange:identity.levelRange}:{}),tokens})).digest('hex');
  return {id:'screen-'+fingerprint.slice(0,24),name:identity.title,source:'MuMu · seçili Quest Guide / BEHAVIOR ekranı',training:false,difficulty:[identity.difficulty?identity.difficulty+'★':null,identity.level?'Lv.'+identity.level:null].filter(Boolean).join(' · ')||'Ekrandaki varyant',reviewed:metadata.observedAt.slice(0,10),notes:'Seçili ekran anlık okundu. Başı ve sonu doğrulanmış listede atlanan aşamalar listelenmedi olarak korunur. İlk saldırı ve açık numaralı tur tetiklerinin tanınan mekanikleri planlanır. HP, yenilince ve karşı saldırı koşulları ayrı gösterilir; orb / bariyer / konum ve okunamayan etkiler kesin çözülmüş sayılmaz.',stages,observation:{...metadata,...(metadata.marqueeChecked?{textComplete:!partial.length,marquee:{tracked:marquees.length,completed:marquees.length-partial.length,partial:partial.length}}:{}),quest:identity.title,difficulty:identity.difficulty,level:identity.level,fingerprint,warnings:[...new Set(warnings)]}};
}
module.exports={rows,modalIdentity,pageTokens,mergeTokens,eventLabel,durationEffects,behaviorRules,encounterFromTokens,LABELS,joinMarquee,preferRow,positioned,conflictingNumbers};
