const {durationEffects,behaviorRules,eventLabel}=require('./boss-behavior-core.cjs');
const HOST='xn--pck6bvfc.gamewith.jp';
const plain=s=>s.replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*>/gi,' $1 ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/[ \t\r]+/g,' ').trim();
function jpNumber(s){s=s.replace(/[, ]/g,'');if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);const m=s.match(/^(?:(\d+(?:\.\d+)?)億)?(?:(\d+(?:\.\d+)?)万)?(\d+)?$/);return m?Number(m[1]||0)*1e8+Number(m[2]||0)*1e4+Number(m[3]||0):undefined;}
function translate(raw){
 const turns=Number(raw.match(/(\d+)ターン/)?.[1]),prefix=turns?turns+' turn(s) ':'',damage=raw.match(/([\d,.]+(?:億|万)?[\d,]*)ダメージ/),heal=raw.match(/体力([\d,.]+(?:億|万)?[\d,]*)回復/);
 if(heal)return {text:'Revive with '+jpNumber(heal[1])+' HP',complete:true};
 const flags=[[/スキルダメージ弱体化/,'Non-Normal Attacks deal 1 damage'],[/防御ダウン無効/,'DEF Down Immunity'],[/遅延無効/,'Delay Immunity'],[/状態異常無効/,'Debuff Immunity'],[/船長効果無効/,'Despair'],[/船員封じ/,'Bind on crewmates'],[/防御(?:力)?アップ/,'DEF Up'],[/一定以上激減|一定ダメージ激減/,'Damage Threshold'],[/ダメージ軽減/,'Damage Reduction'],[/体力1で耐える/,'Resilience'],[/毎ターン回復/,'Heal at end of turn'],[/痺れ/,'Paralysis'],[/必殺封じ/,'Special Bind'],[/攻撃力ダウン/,'ATK Down'],[/やけど|熱傷/,'Burn']];
 const effect=flags.find(([re])=>re.test(raw));
 if(effect){let label=effect[1];if(/中段/.test(raw))label='Middle-Row '+label;if(/下段/.test(raw))label='Bottom-Row '+label;
  const healAmount=raw.match(/回復\(([\d,.]+(?:億|万)?[\d,]*)\//);if(healAmount)label='Heal '+jpNumber(healAmount[1])+' HP at end of turn';
  const extraNumbers=(raw.match(/\d+/g)||[]).length>1&&!healAmount;
  return {text:prefix+label+(extraNumbers?' · source: '+raw:''),complete:!!turns&&!extraNumbers};
 }
 if(damage)return {text:jpNumber(damage[1])+' damage',complete:true};
 if(/不利スロット変換/.test(raw))return {text:'Change all slots to Unfavorable slots',complete:true};
 if(/\[空\]スロット変換/.test(raw))return {text:'Change all slots to [EMPTY]',complete:true};
 if(/必殺技なし|^なし$|^-$/.test(raw))return {text:'No additional action listed',complete:true};
 return {text:'未翻訳 / source: '+raw,complete:false};
}
function parseGamewith(html,url){
 const title=plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||''),stars=Number(title.match(/(?:星|★)\s*(\d+)/)?.[1])||null;
 const kizuna=/絆決戦|Kizuna/i.test(title);
 const headings=[...html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)],sections=headings.filter(h=>/^(?:\d+階のギミック解説|ボスの行動パターン)$/.test(plain(h[2]))),stages=[];
 for(const section of sections){
  const start=section.index+section[0].length,next=headings.find(h=>h.index>section.index&&Number(h[1])<=Number(section[1])),body=html.slice(start,next?.index||html.length),number=Number(plain(section[2]).match(/^(\d+)階/)?.[1])||(kizuna?0:5);
  if(!number)throw Error('Kizuna rehberinde boss aşama numarası açık değil; Battle 5 varsayılmadı. Fotoğraf yolunu kullan.');
  const tables=[...body.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(t=>[...t[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>plain(c[1]))));
  const stats=tables.find(t=>t.some(r=>r.includes('HP')&&r.some(c=>/攻撃/.test(c)))),statRow=stats?.find(r=>r.length>=4&&jpNumber(r[1])>0),events=[];let complete=true;
  for(const table of tables.filter(t=>t.some(r=>r.some(c=>/ﾀｰﾝ|タイミング|ﾀｲﾐﾝｸﾞ/.test(c)))))for(const row of table){
   if(row.length<3||/ﾀｰﾝ|ターン/.test(row[0]))continue;
   const cells=row.length===3?[...row[0].split(/\s+/),...row[1].split(/\s+/),row[2]]:row;if(cells.length!==5){complete=false;continue;}
   const [turn,hp,repeat,timing,content]=cells;let event;
   if(/先制/.test(turn))event=eventLabel('PREEMPTIVE');else if(/撃破時/.test(timing))event=eventLabel('DEFEATED');else if(/%/.test(hp))event={trigger:'hp',label:'HP ≤ '+hp};else if(/^\d+$/.test(turn))event=eventLabel('AFTER '+turn+' TURNS');else continue;
   const lines=content.split('\n').map(s=>s.trim()).filter(Boolean).map(translate);if(!lines.length)continue;complete&&=lines.every(l=>l.complete);
   const text=lines.map(l=>l.text).join('\n');events.push({...event,text,requirements:durationEffects(text).effects,...behaviorRules(text),...(/^毎\d+$/.test(repeat)?{repeatEvery:Number(repeat.slice(1))}:{})});
  }
  for(const table of tables.filter(t=>t[0]?.[0]==='条件'))for(const row of table.slice(1)){if(row[0]==='なし')continue;complete=false;events.push({trigger:'interrupt',label:row[0],text:'未翻訳 / source: '+row.join(' · '),requirements:[]});}
  if(!events.length)continue;
  const requirements=new Map();for(const e of events.filter(e=>e.trigger==='preemptive'))for(const r of e.requirements)requirements.set(r.mechanic,Math.max(requirements.get(r.mechanic)||0,r.turns));
  stages.push({id:'gamewith-'+number,name:'Battle '+number,battleNumber:number,turn:number-1,requirements:[...requirements].map(([mechanic,turns])=>({mechanic,turns})),events,behaviorTextComplete:complete,hp:statRow?jpNumber(statRow[1]):undefined,enemyAttack:statRow?jpNumber(statRow[2]):undefined,normalAttackOnly:events.some(e=>e.normalAttackOnly),notes:events.map(e=>e.label+': '+e.text).join('\n')});
 }
 if(!title||!stages.length||stages.length>10||new Set(stages.map(s=>s.battleNumber)).size!==stages.length)throw Error('Bu GameWith sayfasında tek zorluğa ait desteklenen aşama tabloları bulunamadı. Fotoğraf yolunu kullan.');
 return {id:'gamewith-'+new URL(url).pathname.split('/').at(-1),name:title.slice(0,160),source:url,reviewed:new Date().toISOString().slice(0,10),difficulty:stars?stars+'★ · JP rehberi':'JP rehberi',training:false,stages,restrictions:{status:'partial',source:url,text:'',quest:title.slice(0,160),difficulty:stars,warnings:['Global görevi, zorluk ve katılım koşulunu doğrula.'],unsupported:'Global görev eşleşmesi onaylanmadı'},notes:'JP kaynağı: Global görevi / zorluk ve REQUIREMENT kontrolü gerekli. Çevrilemeyen satırlar kaynak metniyle korunur; tam çözüm sayılmaz. Kaynakta olmayan DEF ve seviye değerleri eklenmez.'};
}
module.exports={HOST,parseGamewith,translate,jpNumber};
