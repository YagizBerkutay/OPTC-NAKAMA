const sharp=require('sharp'),crypto=require('node:crypto');
const {modalIdentity,pageTokens,eventLabel,encounterFromTokens,conflictingNumbers}=require('./boss-behavior-core.cjs');
const {parseRequirement}=require('./quest-restrictions.cjs');
function validateImages(images){
 if(!Array.isArray(images)||!images.length||images.length>20)throw Error('1–20 görüntü ekle.');
 let total=0;for(const image of images){if(!image||typeof image.name!=='string'||image.name.length>200||typeof image.dataUrl!=='string'||image.dataUrl.length>14*1024*1024||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image.dataUrl))throw Error('Yalnız PNG, JPEG veya WebP görüntüsü ekle (en fazla 10 MB).');total+=image.dataUrl.length;}
 if(total>60*1024*1024)throw Error('Toplam görüntü boyutu 45 MB sınırını aşıyor.');return images;
}
async function readImages(images,progress=()=>{},ocr=require('./rule-ocr.cjs').ocrBuffer,save=async()=>{}){
 validateImages(images);const result=[];
 for(const [index,image]of images.entries()){
  progress(`Fotoğraf ${index+1} / ${images.length} okunuyor…`);
  const buffer=Buffer.from(image.dataUrl.split(',')[1],'base64'),meta=await sharp(buffer,{limitInputPixels:16777216}).metadata();
  if(!['png','jpeg','webp'].includes(meta.format)||!meta.width||!meta.height||meta.width>4096||meta.height>4096)throw Error('Görüntü boyutu en fazla 4096 × 4096 olmalı.');
  const hash=crypto.createHash('sha256').update(buffer).digest('hex'),decoded=await ocr(buffer,{scale:Math.min(2,4096/meta.width)}),identity=modalIdentity(decoded);
  const tokens=identity?pageTokens(decoded,identity).filter(t=>t.kind!=='heading'):null;
  const text=tokens?.length?tokens.map(t=>t.text).join('\n'):decoded.text;
  await save(hash,buffer,meta.format);result.push({name:image.name,hash,text,identity:identity?{title:identity.title,difficulty:identity.difficulty,level:identity.level}:undefined,warnings:['Kayan veya kesilmiş satır varsa eksik parçayı ekle; metni görselle karşılaştır.']});
 }
 return result;
}
function assembleImages(input){
 if(!input||typeof input.title!=='string'||input.title.trim().length<3||input.title.length>160||input.mode!=='pka'&&(!Number.isInteger(input.difficulty)||input.difficulty<1||input.difficulty>20)||input.confirmed!==true||!Array.isArray(input.pages)||!input.pages.length||input.pages.length>20)throw Error('Boss adı, yıldız zorluğu ve bütün aşamaların kontrol edildiği onayı gerekli.');
 if(input.mode==='pka'&&(!Array.isArray(input.levelRange)||input.levelRange.length!==2||input.levelRange.some(v=>!Number.isInteger(v)||v<1||v>99999)||input.levelRange[0]>input.levelRange[1]))throw Error('PKA için fotoğraflardaki Lv. aralığını yaz (ör. 80-99).');
 if(input.mode==='pka'&&input.level!=null&&(input.level<input.levelRange[0]||input.level>input.levelRange[1]))throw Error('Sayısal Lv. seçilen rehber aralığının dışında.');
 if(input.level!==null&&input.level!==undefined&&(!Number.isInteger(input.level)||input.level<1||input.level>99999))throw Error('Boss seviyesi geçersiz.');
 if(input.mode!==undefined&&!['quest','pka'].includes(input.mode))throw Error('Görev türü geçersiz.');
 const identity={title:input.title.trim(),difficulty:input.mode==='pka'?null:input.difficulty,level:input.level||null,...(input.mode==='pka'?{mode:'pka',levelRange:input.levelRange}:{})},sections=new Map();
 for(const page of input.pages){
  if(typeof page.text!=='string'||page.text.length>20000||!Number.isInteger(page.battle)||page.battle<1||page.battle>10||typeof page.hash!=='string'||!/^[a-f0-9]{64}$/.test(page.hash))throw Error('Her görüntüye Battle numarası ata ve metnini kontrol et.');
  let battle,group,event;
  const begin=(number,variant='')=>{battle=number;const key=number+(variant?'-'+variant:'');group=sections.get(key);if(!group){group={number,variant,events:[]};sections.set(key,group);}event=undefined;};
  begin(page.battle);
  for(const line of page.text.split('\n').map(s=>s.trim()).filter(Boolean)){
   if(/^BEHAVIO[RU]$/i.test(line))continue;
   const heading=line.match(/^BATTLE\s*(10|[1-9])(?:\s*-\s*(\d+))?$/i);if(heading){begin(Number(heading[1]),heading[2]||'');continue;}
   if(/^BATTLE\b/i.test(line))throw Error('Battle başlığı belirsiz; fotoğraf metnindeki başlığı düzelt.');
   const label=eventLabel(line);
   if(label){event=group.events.find(e=>e.text===line);if(!event){event={kind:'event',...label,text:line,lines:[]};group.events.push(event);}continue;}
   if(!event){const label=eventLabel(page.trigger||'');if(!label)throw Error('Battle '+battle+': bu parçanın PREEMPTIVE / TURN / diğer tetiğini seç.');event=group.events.find(e=>e.text===page.trigger);if(!event){event={kind:'event',...label,text:page.trigger,lines:[]};group.events.push(event);}}
   const row={kind:'line',text:line},letters=s=>s.replace(/\d+(?:[,.]\d+)*/g,'').toLowerCase().replace(/[^a-z]/g,'');
   if(event.lines.some(old=>letters(old.text)===letters(line)&&conflictingNumbers(old,row)))throw Error('Battle '+battle+': tur / hasar sayıları çelişiyor; ilgili fotoğraf metnini düzelt.');
   if(!event.lines.some(old=>old.text===line))event.lines.push(row);
   if(event.lines.reduce((n,row)=>n+row.text.length+1,0)>20000||group.events.length>100||sections.size>30)throw Error('Bu aşamada çok fazla metin var; parçaları kontrol et.');
  }
 }
 const ordered=[...sections.values()].sort((a,b)=>a.number-b.number||Number(a.variant||0)-Number(b.variant||0)),tokens=ordered.flatMap(s=>[{kind:'battle',number:s.number,variant:s.variant,text:'BATTLE '+s.number+(s.variant?'-'+s.variant:'')},...s.events.flatMap(e=>{const {lines,...token}=e;return [token,...lines];})]);
 const result=encounterFromTokens(identity,tokens,{observedAt:new Date().toISOString(),pages:input.pages.length,complete:true,startVerified:true});
 if(result.stages.some(s=>s.events.length>100||s.notes.length>40000))throw Error('Aşama metni veya tetik sayısı sınırı aşıldı.');
 if(input.mode==='pka'){result.difficulty='PKA · Lv.'+input.levelRange.join('–');result.observation.levelRange=input.levelRange;}
 const ruleText=typeof input.requirement==='string'?input.requirement.trim():'';if(ruleText.length>20000)throw Error('Katılım koşulu metni çok uzun.');
 const base={source:'Kullanıcının fotoğraf / metin kontrolü',text:ruleText,quest:identity.title,difficulty:identity.difficulty,warnings:['Katılım koşulu kullanıcı tarafından kontrol edildi; otomatik OCR mutabakatı değildir.']};
 const rule=parseRequirement(ruleText);
 if(input.noRestrictions===true){if(ruleText)throw Error('Katılım koşulu yazılıyken kısıtlama yok seçilemez.');result.restrictions={...base,status:'verified',text:'Kullanıcı bu görevde katılım kısıtlaması olmadığını doğruladı.'};}
 else if(rule?.complete&&rule?.prefix){const {complete,prefix,...limits}=rule;result.restrictions={...base,status:'verified',...limits};}
 else result.restrictions={...base,status:'partial',warnings:[...base.warnings,'Katılım koşulu tam çözümlenemedi; metni düzelt.']};
 result.source='Yerel fotoğraflar · '+input.pages.map(p=>p.hash.slice(0,12)).join(', ');result.notes+=' Fotoğraf metinleri ve bütün liste kullanıcı tarafından kontrol edildi. Kaynak görüntüler yerel boss-imports klasöründe saklanır.';
 result.observation.warnings.push('Fotoğraf listesi elle doğrulandı; kayan metnin görünmeyen kısmı tahmin edilmedi.');return result;
}
function reviewedRequirements(identity,text,none){
 if(typeof text!=='string'||text.length>20000||typeof none!=='boolean')throw Error('Katılım koşulu geçersiz.');text=text.trim();
 const base={source:'Kullanıcının kaynak kontrolü',quest:identity.title,difficulty:identity.difficulty,text,warnings:['Katılım koşulu kullanıcı tarafından doğrulandı.']};
 if(none){if(text)throw Error('Koşul yazılıyken kısıtlama yok seçilemez.');return {...base,status:'verified',text:'Kullanıcı katılım kısıtlaması olmadığını doğruladı.'};}
 const parsed=parseRequirement(text);if(parsed?.complete&&parsed?.prefix){const {complete,prefix,...limits}=parsed;return {...base,status:'verified',...limits};}
 return {...base,status:'partial',warnings:['Katılım koşulu tam çözümlenemedi; metni düzelt.']};
}
module.exports={validateImages,readImages,assembleImages,reviewedRequirements};
