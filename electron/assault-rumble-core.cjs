const {createHash}=require('node:crypto');
const normalize=text=>String(text).replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const clean=text=>normalize(text).replace(/^[\s,;.!:&-]*/,'').replace(/^and\b\s*/i,'').replace(/[\s,;.!:&-]*$/,'').trim();
function parseAssaultRules(value){
 if(typeof value!=='string'||value.length>16000)throw Error('Assault Rules metni geçersiz.');
 const text=normalize(value),tail=text.match(/During the last (\d{1,3})\s*(?:s|seconds) of battle,?\s*Special CT Speed Up\s*&\s*Damage Up!/i);
 if(!tail||Number(tail[1])<1||Number(tail[1])>100||clean(text.slice(tail.index+tail[0].length)))throw Error('Assault Rules sonu doğrulanamadı.');
 const body=text.slice(0,tail.index),rules=[],bosses=[],seen=new Set();let boss,cursor=0;
 const pattern=/(?:(All|[A-Za-z][A-Za-z '\-]{0,60}?)\s+Boss teams?\s+)?damage taken from\s+((?:\[[^\[\]]{1,90}\]\s*)+|Free Spirit|Powerhouse|Fighter|Slasher|Striker|Shooter|Cerebral|Driven|STR|DEX|QCK|PSY|INT)\s*(\d{1,3})\s*%\s*(Up|Down)/gi;
 for(const m of body.matchAll(pattern)){
  if(clean(body.slice(cursor,m.index)))throw Error('Assault kural hedefi veya yüzdesi eksik: '+body.slice(cursor,m.index).slice(0,100));
  if(m[1]){boss=normalize(m[1]);if(/^all$/i.test(boss))boss='all';else if(!bosses.includes(boss))bosses.push(boss);}
  if(!boss)throw Error('Assault kuralının bossu bilinmiyor.');
  const percent=Number(m[3])*(m[4].toLowerCase()==='down'?-1:1),tags=[...m[2].matchAll(/\[([^\]]+)\]/g)].map(v=>normalize(v[1]));
  if(Math.abs(percent)>100||percent===0||m[3].startsWith('0'))throw Error('Assault bonus yüzdesi doğrulanamadı.');
  const targets=tags.length?tags:[normalize(m[2])],key=boss+'|'+targets.join('|');
  if(seen.has(key))throw Error('Aynı hedef için yinelenen veya çelişen Assault bonusu.');seen.add(key);
  rules.push({boss,targets,percent,match:targets.length>1?'unknown':'any'});cursor=m.index+m[0].length;
 }
 if(clean(body.slice(cursor))||!bosses.length||bosses.length>10||rules.length>60||!rules.length)throw Error('Assault Rules maddeleri tam çözümlenemedi.');
 const result={bosses,rules,lateSeconds:Number(tail[1]),stacking:'unknown'};
 return {...result,text,fingerprint:createHash('sha256').update(JSON.stringify(result)).digest('hex')};
}
function parseAssaultHome(text){
 if(typeof text!=='string'||!['RULES','SETUP'].every(v=>new RegExp('\\b'+v+'\\b','i').test(text))||!(/ASSAULT\s+RUMBLE/i.test(text)&&/CHALLENGE/i.test(text)||/\bINFO\b/i.test(text))||/Character Details|Special Rules Effect|About Assault/i.test(text))return null;
 const matches=[...text.matchAll(/Assault\s+L[vV][.]?\s*[:.]?\s*(MAX|\d{1,3})\b/gi)];if(matches.length!==1)return null;
 const value=matches[0][1].toUpperCase();return value==='MAX'?{level:null,maxLevel:true}:Number(value)>=1?{level:Number(value),maxLevel:false}:null;
}
function parseSkillSection(value,level,kind,{endVerified=false}={}){
 if(typeof value!=='string'||value.length>24000||!Number.isInteger(level)||level<1||level>10||!['ability','special'].includes(kind))throw Error('Yetenek bölümü geçersiz.');
 const lines=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean),heads=[];
 for(let i=0;i<lines.length;i++){const m=lines[i].match(/^Lv\s*\.?\s*(\d{1,2})\s*(?:['‘’]?C[Tt1Il]\s*[:.]?\s*(\d{1,3}))?\s*$/i);if(m)heads.push({i,level:Number(m[1]),cooldown:m[2]?Number(m[2]):null});}
 const start=heads.findIndex(h=>h.level===level);if(start<0)throw Error('Seçili yetenek seviyesi ayrıntıda bulunamadı.');
 const head=heads[start],next=heads[start+1],text=lines.slice(head.i+1,next?.i??lines.length).join(' ');
 return {level,cooldown:head.cooldown,text,complete:!!text&&(!!next||endVerified)};
}
function skillLevel(text,max){
 const value=normalize(text),fraction=value.match(new RegExp('\\b(?:Lv[.]?\\s*)?(\\d+)\\s*\\/\\s*'+max+'\\b','i'));
 if(fraction)return +fraction[1]>=1&&+fraction[1]<=max?+fraction[1]:null;
 return /\b[fI|]?Lv{1,2}[.]?\s*MAX\b/i.test(value)?max:null;
}
const rect=line=>{const words=line.words||[];if(!words.length)return null;const x=Math.min(...words.map(v=>v.x)),y=Math.min(...words.map(v=>v.y)),right=Math.max(...words.map(v=>v.x+v.width)),bottom=Math.max(...words.map(v=>v.y+v.height));return {x,y,width:right-x,height:bottom-y};};
function wordRect(ocr,pattern,minY=0,maxY=1){const words=ocr.lines.flatMap(l=>l.words||[]).filter(w=>pattern.test(w.text)&&w.y>ocr.height*minY&&w.y+w.height<ocr.height*maxY);return words.length===1?words[0]:null;}
module.exports={normalize,parseAssaultRules,parseAssaultHome,parseSkillSection,skillLevel,rect,wordRect};
