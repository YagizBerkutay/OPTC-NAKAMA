const sharp=require('sharp'),{parseSkillSection,skillLevel,normalize}=require('./assault-rumble-core.cjs');
const canonical=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const crop=(snap,x,y,w,h)=>({left:Math.round(snap.width*x),top:Math.round(snap.height*y),width:Math.round(snap.width*w),height:Math.round(snap.height*h)});
function statsFrom(text){const result={};for(const [key,label]of [['hp','H\\s*P'],['atk','ATK'],['def','DEF'],['spd','SPD'],['rcv','RCV']]){const m=text.match(new RegExp('\\b'+label+'[\\s:.[\\]()_|]*(\\d[\\d,]*)\\b','i'));if(m)result[key]=Number(m[1].replace(/,/g,''));}return result;}
function mergePages(a,b){const left=a.split(/\r?\n/).filter(Boolean),right=b.split(/\r?\n/).filter(Boolean);for(let n=Math.min(left.length,right.length);n>=2;n--)if(left.slice(-n).map(normalize).join('\n')===right.slice(0,n).map(normalize).join('\n'))return [...left,...right.slice(n)].join('\n');return a+'\n'+b;}
async function readRumbleInfo(io,{snap,selected,warnings,check,update,move,observe,settle,input={},last,cachePrefix,onCached}){
   const originalInfo=snap;
   const header=await io.ocr(snap.image,{crop:crop(snap,.52,.224,.455,.164),scale:2});check();
   const statsArea=crop(snap,.52,.224,.455,.164),secondary=await io.block(await sharp(snap.image).extract(statsArea).png().toBuffer());check();const a=statsFrom(header.text),b=statsFrom(secondary.text),stats={},statRows=[];for(const key of Object.keys(b)){
    if(a[key]===b[key]||header.lines.flatMap(l=>l.words||[]).some(w=>Number(w.text.replace(/,/g,''))===b[key]))stats[key]=b[key];
    else {const word=secondary.lines.flatMap(l=>l.words||[]).find(w=>Number(w.text.replace(/[^\d]/g,''))===b[key]);if(word){
      let row=statRows.find(r=>Math.abs(r.y-word.y)<12);if(!row){const rect={left:statsArea.left,top:Math.max(0,Math.floor(statsArea.top+word.y)-6),width:statsArea.width,height:Math.ceil(word.height)+12},pixels=await sharp(snap.image).extract(rect).png().toBuffer(),[native,line]=await Promise.all([io.ocr(pixels,{scale:3}),io.line(pixels)]);row={y:word.y,native,line,pixels};statRows.push(row);}
      const agrees=(r)=>statsFrom(r.line.text)[key]===b[key]&&(statsFrom(r.native.text)[key]===b[key]||r.native.text.match(/\d[\d,]*/g)?.some(n=>Number(n.replace(/,/g,''))===b[key]));
      if(agrees(row))stats[key]=b[key];else if(statsFrom(row.line.text)[key]===b[key]){if(!row.masked){const view=await sharp(row.pixels).removeAlpha().greyscale().threshold(200).negate().extend({top:8,bottom:8,left:12,right:12,background:'#fff'}).png().toBuffer(),[native,line]=await Promise.all([io.ocr(view,{scale:3}),io.line(view)]);row.masked={native,line};}if(agrees(row.masked))stats[key]=b[key];}
     }}
   }
   const candidates=(io.catalog?.characters.filter(c=>canonical(snap.ocr.text).includes(canonical(c.name.split(' - ')[0]))&&new RegExp('\\b'+selected+'\\b','i').test(c.name))||[]).sort((a,b)=>b.name.split(' - ')[0].length-a.name.split(' - ')[0].length),character=candidates[0]&&candidates[0].name.split(' - ')[0].length>(candidates[1]?.name.split(' - ')[0].length||0)?candidates[0]:undefined;
   const level=Number(header.text.match(/\bLv[.]?\s*(\d+)\s*\(?\s*MAX/i)?.[1])||null;
   const skillLevels=[];for(const [region,max]of [[crop(snap,.65,.467,.31,.034),10],[crop(snap,.76,.549,.20,.034),5]]){const reading=await io.line(await sharp(snap.image).extract(region).png().toBuffer());check();let selected=skillLevel(reading.text,max);if(selected===null){const native=await io.ocr(snap.image,{crop:region,scale:3});check();selected=skillLevel(native.text,max);}skillLevels.push(selected);}
   const [specialLevel,abilityLevel]=skillLevels;if(!specialLevel||!abilityLevel)throw Error('Bossun mevcut ability / special seviyeleri doğrulanamadı.');
   const classArea=crop(snap,.046,.1875,.334,.057),[classA,classB]=await Promise.all([io.ocr(snap.image,{crop:classArea,scale:2}),sharp(snap.image).extract(classArea).png().toBuffer().then(io.block)]),classes=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'].filter(c=>canonical(classA.text).includes(canonical(c))&&canonical(classB.text).includes(canonical(c)));
   if(character&&classes.some(c=>!character.classes.includes(c)))warnings.push('Boss NPC sınıfları koleksiyon kartından farklı; yalnız ekranda doğrulanan sınıflar kullanıldı.');
   const enemy={...(character?{id:character.id}:{}),name:character?.name||selected,types:[],classes,tags:[],level,abilityLevel,specialLevel,stats,details:{},complete:false};
   const cacheKey=JSON.stringify([cachePrefix,selected,enemy.id,enemy.name,level,abilityLevel,specialLevel,classes,stats]);
   if(!input.refresh&&last?.key===cacheKey){Object.assign(enemy,last.enemy);onCached?.();update('Aynı boss / seviye doğrulandı · kayıtlı ayrıntılar kullanılıyor…');}
   else for(const detail of ['special','ability','resistance','pattern','priority']){
    check();update(selected+' · '+detail+' sabit metni okunuyor…');await move(snap,'detail:'+detail);let panel=await observe();
    if(!/\b[O0]K\b/i.test(panel.ocr.text))throw Error('Boss ayrıntı penceresi doğrulanamadı.');
    let text='',previous,selectedSection,selectedText='',selectedSeen=false;const targetLevel=detail==='special'?specialLevel:detail==='ability'?abilityLevel:null;
    if(targetLevel>2&&io.seekSkill){await io.seekSkill(panel,targetLevel,detail==='special'?10:5,{check,input});panel=await observe();}
    for(;;){const view=crop(panel,.135,.3025,.728,.44),raw=await io.block(await sharp(panel.image).extract(view).png().toBuffer());check();const textPage=raw.lines.map(r=>r.text.trim()).join('\n');text=mergePages(text,textPage);
     if(targetLevel&&io.staticSkill){const section=await io.staticSkill(panel.image,targetLevel,{check});if(section.headFound)selectedSeen=true;if(section.complete){selectedText=mergePages(selectedText,section.text);selectedSection={...section,text:selectedText};break;}if(selectedSeen){selectedText=mergePages(selectedText,section.headFound?section.text:section.continuation||'');if(section.continuationComplete&&selectedText){selectedSection={text:selectedText,complete:true};break;}}else if(io.seekSkill&&section.layout?.levels?.length&&Math.min(...section.layout.levels)>targetLevel){previous=undefined;await move(panel,'scrollDetailUp');panel=await observe();continue;}}
     if(targetLevel){if(!io.staticSkill){try{selectedSection=parseSkillSection(text,targetLevel,detail,{endVerified:io.atBottom?await io.atBottom(panel,view):false});}catch{}if(selectedSection?.complete)break;}}
     else {text=textPage;if(detail==='resistance'){
       const native=await io.ocr(panel.image,{crop:view,scale:2});let verified=true;
       const additional=native.lines.find(l=>/ADDITIONAL RESISTANCES|UNLOCK REQUIREMENT/i.test(l.text)),cutoff=additional?Math.min(...additional.words.map(w=>w.y)):Infinity;
       for(const word of native.lines.flatMap(l=>l.words||[]).filter(w=>/^\d+%$/.test(w.text)&&w.y<cutoff)){const parent=native.lines.find(l=>l.words.includes(word)),top=Math.floor(Math.min(...parent.words.map(w=>w.y)))-2,bottom=Math.ceil(Math.max(...parent.words.map(w=>w.y+w.height)))+2,contextRect={left:view.left,top,width:view.width,height:bottom-top},rect={left:Math.floor(word.x),top:Math.floor(word.y),width:Math.ceil(word.width),height:Math.ceil(word.height)},value=io.number?await io.number(panel.image,rect,{check,percentExpected:true,contextRect}):word.text;if(value!==word.text){verified=false;break;}}
       if(verified)text=native.text.replace(/\bSpeciaI\b/g,'Special');else warnings.push('Boss direncindeki yüzde tam doğrulanmadı; HP kesme katkısı kesin sayılmadı.');
      }break;}
     if(previous===normalize(textPage))throw Error('Seçili '+detail+' seviyesinin sonu doğrulanamadı.');previous=normalize(textPage);await move(panel,'scrollDetail');panel=await observe();if(!/\b[O0]K\b/i.test(panel.ocr.text))throw Error('Ayrıntı ekranı okuma sırasında değişti.');
    }
    enemy.details[detail]=selectedSection?.text||normalize(text);await move(panel,'closeDetail');snap=await settle('info');if(io.verifyInfo)await io.verifyInfo(originalInfo,snap);check();
   }
 return {enemy,snap,cacheKey};
}
module.exports={readRumbleInfo,statsFrom,mergePages};
