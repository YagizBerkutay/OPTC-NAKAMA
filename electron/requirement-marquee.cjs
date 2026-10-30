const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const separators=s=>s.replace(/(STR|DEX|QCK|PSY|INT)[I|l1](STR|DEX|QCK|PSY|INT)/g,'$1/$2');
function parseNeoRequirement(texts,parseRule){
 const raw=texts.filter(Boolean).map(s=>separators(s.trim().replace(/^[!.·(]+\s*/,'')));
 const head=s=>s.match(/^(.+?\bcharacters only)\s*\/\s*You will be\b/i)?.[1];
 const rules=raw.map(head).filter(Boolean).map(parseRule).filter(r=>r?.complete&&r?.prefix);
 const values=rules.map(({complete,prefix,...rule})=>JSON.stringify(rule));
 if(rules.length<2||new Set(values).size!==1)return null;
 const validHead=s=>{const text=head(s),rule=text&&parseRule(text);return !!rule?.complete&&!!rule?.prefix;};
 const entryPrefix=head(raw.find(validHead));
 const caption=entryPrefix+'/ You will be Neo Ambushed at a certain rate every time you clear the quest!';
 const key=normalize(caption),prefixKey=normalize(entryPrefix),spans=[];
 // Recognize only this known encounter note. Every character must be observed
 // in overlapping fragments; the template never fills an unobserved gap.
 for(const text of raw){
  const declared=head(text);
  if(declared&&!parseRule(declared)){
   const clipped=normalize(declared);
   // A clipped left edge may contain one or two OCR remnants of the preceding
   // glyph. An unknown or different complete eligibility clause cannot pass.
   if(![0,1,2].some(n=>clipped.length-n>=16&&prefixKey.endsWith(clipped.slice(n))))return null;
  }
  const tokens=text.split(/\s+/),matches=[];
  for(const left of [0,1])for(const right of [0,1]){
   if(left&&validHead(text))continue;
   const clause=/^(?:only|except|unless|cost|stars?|cannot|allowed|required|without|must|not|and|but)$/i;
   if(left&&clause.test(tokens[0])||right&&clause.test(tokens.at(-1)))continue;
   // Once the literal ending is visible, extra text is an extra clause, not
   // a clipped right edge. Keep it so that the entire read remains unverified.
   if(right&&/\bquest\b/i.test(text))continue;
   const part=tokens.slice(left,tokens.length-right).join(' '),partKey=normalize(part);
   if((part.match(/[a-z]+/gi)||[]).length<3||partKey.length<9)continue;
   const start=key.indexOf(partKey);
   if(start>=0)matches.push({start,end:start+partKey.length});
  }
  if(!matches.length)return null;
  spans.push(matches.reduce((a,b)=>a.end-a.start>=b.end-b.start?a:b));
 }
 // Literal prefix and ending, joined by at least nine shared characters at
 // each hand-off. Unread middle text cannot be supplied by the known note.
 let end=0;
 for(const span of spans.sort((a,b)=>a.start-b.start||b.end-a.end)){
  if(span.start===0||span.start<=end-9)end=Math.max(end,span.end);
 }
 if(end!==key.length)return null;
 const rule=parseRule(entryPrefix);if(!rule?.complete||!rule?.prefix)return null;
 const {complete,prefix,...restriction}=rule;
 if(JSON.stringify(restriction)!==values[0])return null;
 return {restriction,text:caption,warning:'Neo Ambush: Görevi tamamladıktan sonra rastgele ek bir Neo savaşı çıkabilir. Bu öneri okunan rehber aşamalarını kapsar; ek savaşın davranışları okunmadan Neo karşılaşmasının kazanılması doğrulanmaz.'};
}
module.exports={parseNeoRequirement,separators};
