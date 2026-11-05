const {encounterFromTokens}=require('./boss-behavior-core.cjs');
const URL_GUIDE='https://telegra.ph/KIZUNA-CLASH-VS-KOALA-SUPERBOSS-10-17';
const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
function matchesEvent(event){return /^https:\/\/e9wiki\.com\/optc\/en\/notices\/\d{1,8}$/.test(event?.url||'')&&/^Pirate Alliance Kizuna Clash!!\s*Vs\.\s*Koala$/i.test(event.title)&&event.startsAt==='2026-10-21T03:00:00.000Z'&&event.endsAt==='2026-10-25T13:59:00.000Z'&&Date.now()>=Date.parse(event.startsAt)&&Date.now()<Date.parse(event.endsAt);}
async function readFromTarget(reader,exe,device,options,progress,load=fetchGuide){
 const context=await reader.read(exe,device,{...options,collectBonuses:false,targetOnly:true},()=>{},progress);
 let reason='Bu hedef için tarihleri doğrulanmış internet rehberi yok.';
 if(matchesEvent(options.event)){
  try{progress('Boss mekanikleri internet rehberinden alınıyor…');const result=build(options.event,context,await load());if(result.mechanics.complete&&context.target.battles===result.boss.stages.length&&result.boss.stages.at(-1)?.battleNumber===context.target.battles)return result;if(result.mechanics.complete)reason='İnternet rehberindeki Battle sayısı seçili Kizuna hedefiyle eşleşmiyor.';else reason=result.mechanics.warnings[0];}
  catch(error){reason=error.message;}
 }
 progress('İnternet kapsamı eksik · '+context.target.difficulty+'★ Lv.'+context.target.level+' oyun içi rehberi okunuyor…');
 const result=await reader.read(exe,device,{...options,targetOnly:false},()=>{},progress),a=context.target,b=result.target;
 if(!require('./kizuna-live.cjs').sameName(a.title,b.title)||['difficulty','enemyType','level','maxHP','battles'].some(key=>a[key]!==b[key]))throw Error('Oyun içi rehber okunurken Kizuna hedefi değişti; önceki kayıt korundu.');
 if(!result.boss.observation?.complete||result.boss.observation.textComplete!==true||result.boss.stages.length!==b.battles||result.boss.stages.at(-1)?.battleNumber!==b.battles)throw Error('Seçili seviyenin oyun içi rehberi tam okunamadı; eksik mekaniklerle kadro doğrulanmadı. Yeniden oku.');
 return {...result,mechanics:{mode:'game',complete:true,warnings:[reason+' Mekanikler seçili seviyenin oyun içi rehberinden alındı.']}};
}
async function fetchGuide(){
 const r=await fetch(URL_GUIDE,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Boss rehberi alınamadı: HTTP '+r.status);
 const chunks=[];let size=0;const reader=r.body.getReader();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000){await reader.cancel();throw Error('Boss rehberi boyut sınırını aştı.');}chunks.push(Buffer.from(value));}
 return Buffer.concat(chunks).toString('utf8');
}
function parse(html){
 if(typeof html!=='string'||html.length>512000||!html.includes('2026-10-17T')||!/<h1[^>]*>KIZUNA CLASH VS KOALA &quot;SUPERBOSS&quot;/i.test(html)||!/article:author[^>]*content="OPTC NEWS \| CDR"/.test(html))throw Error('Boss rehberinin etkinliği, tarihi veya yazarı doğrulanamadı.');
 const article=html.match(/<article\b[^>]*id="_tl_editor"[^>]*>([\s\S]*?)<\/article>/i)?.[1];if(!article)throw Error('Boss rehberinin içeriği bulunamadı.');
 const sections=[...article.matchAll(/<aside\b[^>]*>([\s\S]*?)<\/aside>([\s\S]*?)(?=<aside\b|$)/gi)],result=new Map();
 for(const section of sections){
  const name=plain(section[1]),m=name.match(/^VS (?:"(SUPER BOSS)" )?(QCK|INT)$/);if(!m)continue;
  const key=(m[1]?'super':'normal')+':'+m[2];if(result.has(key))throw Error('Boss rehberinde tekrar eden varyant var.');
  const lines=[...section[2].matchAll(/<(p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m=>plain(m[2])).filter(Boolean);
  let stage=0,minLevel=1;const stages=[[],[],[]];
  for(const text of lines){if(/Dopo una certa soglia HP/.test(text)){const n=text.match(/Boss Lv\.\s*(\d+)\+/);if(!n)throw Error('Boss seviye aralığı okunamadı.');minLevel=Number(n[1]);continue;}
   const s=text.match(/^Stage ([123])$/);if(s){if(Number(s[1])!==stage+1)throw Error('Boss aşama sırası değişti.');stage++;continue;}
   if(stage)stages[stage-1].push(text);
  }
  if(stage!==3||stages.some(s=>!s.length))throw Error('Boss rehberinin üç aşaması tamamlanmadı.');result.set(key,{minLevel,stages});
 }
 if(result.size!==4)throw Error('Boss rehberindeki normal / Super varyantları tamamlanmadı.');return result;
}
function translate(line){
 const s=line.replace(/^-\s*/,'').replace(/[;.]$/,'');let m;
 if(s==='NAO')return 'Non-Normal Attacks deal 1 damage';
 if(s==='Immunità Totale')return 'Full Immunity';
 if(/^Immunità Totale eccetto/.test(s))return 'Full Immunity except Increased Damage Taken';
 if(s==='Immunità alle Special da KO')return 'Immune to instant defeat Specials';
 if(s==='Resistenza ai Cut del 100%')return 'Percentage damage resistance 100%';
 if(/^Weakness Class:/.test(s))return s;
 if((m=s.match(/^(\d+) turn[oi] (?:di|id) (Bind alla colonna sinistra|Paralisi|Resilience|ATK Down|Threshold Damage Reduction|Silence|Lock Slots|Territory|Nullify Damage)$/)))return m[1]+' turn(s) '+({'Bind alla colonna sinistra':'Left-Column Bind',Paralisi:'Paralysis','Lock Slots':'Slot Lock','Nullify Damage':'Damage Nullification'}[m[2]]||m[2]);
 if((m=s.match(/^(\d+) turn[oi] di Barriera da (\d+) (DEX Slots?|GREAT)$/)))return `${m[1]} turn(s) ${m[3].startsWith('DEX')?'Slot':'Tap-Timing'} Barrier (${m[3].startsWith('DEX')?'DEX':'GREAT'} ${m[2]} time(s))`;
 if((m=s.match(/^CD \((\d+)\), Super Switch \((\d+)\) e VS \((\d+)\) ridotti a (.+)$/)))return `Reduce Special Charge by ${m[1]} turns for ${m[4]}; Super Switch requirement reduction ${m[2]}; VS requirement reduction ${m[3]}`;
 if(s==='Cambio RCV Slots in BLOCK')return 'Change [RCV] Slots to [BLOCK] Slots';
 if(s==='Cambio Slots in RCV')return 'Change all Slots to [RCV] Slots';
 if(s==='Cambio Slots in BLOCK')return 'Change all Slots to [BLOCK] Slots';
 if(s==='Il nemico recupera tutti gli HP')return 'Full HP Recovery';
 if(s==='Rimozione Effetti Benefici, ST, SC e Valori Accumulati')return 'Beneficial Effects (including Super Type / Super Class) / Accumulated Values Removal';
 if((m=s.match(/^(\d+) turn[oi] di DEF x ([\d.]+)$/)))return m[1]+' turn(s) DEF Up x '+m[2].replace(/\./g,'');
 if((m=s.match(/^Cut del (\d+)% degli HP$/)))return "Reduce crew's current HP by "+m[1]+'%';
 if((m=s.match(/^(\d+) turn[oi] di Riduzione del [dD]anno delle (.+?) del (\d+)%$/))){const slots=[...(/Type/.test(m[2])?['STR','DEX','QCK','PSY','INT']:[]),...['RAINBOW','RCV','TND'].filter(v=>m[2].includes(v))];if(slots.length)return `${m[1]} turn(s) Slot Damage Reduction ${m[3]}% for ${slots.join(' ')}`;}
 if((m=s.match(/^(\d+) turn[oi] di (Slot Boost|ATK) x ([\d.]+) a (.+)$/)))return `Boosts ${m[2]==='ATK'?'ATK':'Orb Effects'} of ${m[4]} by ${m[3]}x for ${m[1]} turns`;
 return null;
}
function build(event,context,html){
 if(!matchesEvent(event)||!/^Vs\.\s*Koala$/i.test(context.target.title))throw Error('Bu etkinlik için doğrulanmış internet boss rehberi henüz yok.');
 const {target,restrictions}=context,mode=target.difficulty===13?'super':'normal',key=mode+':'+target.enemyType;
 let source=parse(html).get(key);const warnings=[],tokens=[];
 const verified=require('./kizuna-koala-levels.json'),profile=verified.profiles.find(p=>p.difficulty===target.difficulty&&p.enemyType===target.enemyType&&p.minLevel<=target.level&&p.maxLevel>=target.level);
 if(profile){source={...source,minLevel:profile.minLevel,stages:profile.stages||[...source.stages.slice(0,2),profile.stage3]};warnings.push('Lv.'+profile.minLevel+'–'+profile.maxLevel+' mekanikleri Global oyun içi QUEST GUIDE ile ayrıca doğrulandı.');}
 let coverage=source&&(profile||[10,13].includes(target.difficulty))?'':'İnternet rehberi bu tip / yıldız zorluğunu kapsamıyor.';
 if(source&&target.level<source.minLevel)coverage=`İnternet rehberi normal bossun son aşamasını yalnız Lv.${source.minLevel}+ için veriyor. Lv.${target.level} mekanikleri doğrulanmadı; yüksek seviyenin kuralları uygulanmadı.`;
 if(!Number.isInteger(target.level)||target.level<1||!['QCK','INT'].includes(target.enemyType)||![target.maxHP,target.remainingHP].every(v=>typeof v==='string'&&/^[1-9]\d{0,79}$/.test(v))||BigInt(target.remainingHP)>BigInt(target.maxHP)||!Number.isFinite(Date.parse(target.observedAt)))throw Error('İnternet rehberi için okunan hedef bilgileri geçersiz.');
 for(let i=0;i<3;i++){
  tokens.push({kind:'battle',number:i+1,text:'BATTLE '+(i+1)},{kind:'event',trigger:'preemptive',label:'İlk saldırı',text:'PREEMPTIVE'});
  if(coverage){tokens.push({kind:'line',text:coverage});continue;}
  let conditional=false;
  for(const raw of source.stages[i]){
   if(/^Interrupt -/.test(raw)){tokens.push({kind:'event',trigger:'interrupt',label:'NAO etkin değilse · her seferinde',text:'INTERRUPTION'});continue;}
   if(/^Quando gli HP della crew|^When crew HP is below 70%:/.test(raw)||/^Altrimenti\s*:$|^Otherwise:$/.test(raw)){
    tokens.push({kind:'event',trigger:'hp',label:/^(?:Quando|When)/.test(raw)?'Crew HP below 70%':'Crew HP at least 70%',text:'HP CONDITION'});
    warnings.push('Mürettebat HP’sine bağlı dal, her kadronun aşamaya girişte hesaplanan HP’siyle seçilir; önceki aşamada farklı hasar alınırsa yeniden hesaplanmalıdır.');continue;
   }
   if(/^Se sono presenti/.test(raw)){conditional=true;tokens.push({kind:'event',trigger:'unknown',label:'If at least 2 Revolutionary Army',text:'CONDITIONAL'});warnings.push('Super başlangıç etkileri en az 2 Revolutionary Army karakteri gerektirir. CD indirimi kadro etiketleriyle ayrıca kontrol edilir; koşullu ATK / slot / Super Switch / VS bonusları tam hesaplanmıyor.');continue;}
   const translated=profile&&(profile.stages||i===2)?raw:translate(raw);tokens.push({kind:'line',text:(conditional?'If at least 2 Revolutionary Army: ':'')+(translated||'Kaynak etkisi (IT): '+raw)});
   if(!translated)warnings.push('Bu kaynak etkisi motor tarafından tam hesaplanmıyor: '+raw.replace(/^-\s*/,''));
  }
 }
 if(coverage)warnings.unshift(coverage);
 const boss=encounterFromTokens({title:target.title,difficulty:target.difficulty,level:target.level},tokens,{observedAt:target.observedAt,complete:!coverage,startVerified:true,pages:0});
 boss.source=profile?'MuMu · Global Koala doğrulanmış seviye rehberi':URL_GUIDE;boss.id='kizuna-web-koala-'+target.difficulty+'-'+key.replace(':','-')+'-'+target.level;boss.restrictions=restrictions;
 if(profile)boss.observation.levelRange=[profile.minLevel,profile.maxLevel];
 boss.notes=(profile?'Boss mekanikleri Global oyun rehberinden doğrulanmış yıldız / seviye kaydından; ':'Boss mekanikleri CDR internet rehberinden; ')+'can, seviye, tip ve zorluk MuMu’dan. '+(coverage||'Seçili varyantın kaynak kapsamı eşleştirildi.');
 boss.observation.textComplete=!coverage;boss.observation.warnings=[...new Set([...warnings,...boss.observation.warnings])];
 boss.stages.at(-1).enemyType=target.enemyType;
 if(BigInt(target.maxHP)<=1000000000000000n)boss.stages.at(-1).hp=Number(target.maxHP);
 return {target,boss,bonusPages:context.bonusPages||[],bonusComplete:false,mechanics:{url:URL_GUIDE,mode:profile?'game':'online',complete:!coverage,warnings:[...new Set(warnings)]}};
}
module.exports={URL_GUIDE,matchesEvent,fetchGuide,parse,translate,build,readFromTarget};
