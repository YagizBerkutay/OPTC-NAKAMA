const sharp=require('sharp'),{createHash}=require('node:crypto');
const {positioned,eventLabel,conflictingNumbers}=require('./boss-behavior-core.cjs');

async function readStrip(image,rect){
 const {data,info}=await sharp(image).extract(rect).removeAlpha().raw().toBuffer({resolveWithObject:true}),mask=Buffer.alloc(info.width*info.height),columns=new Uint32Array(info.width+1),points=[];let left=info.width,right=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const p=(y*info.width+x)*info.channels;if(Math.max(data[p],data[p+1],data[p+2])>100&&data[p]+data[p+1]+data[p+2]>180){mask[y*info.width+x]=1;points.push(y*info.width+x);columns[x+1]++;left=Math.min(left,x);right=Math.max(right,x);}}
 for(let x=1;x<columns.length;x++)columns[x]+=columns[x-1];return {data,mask,columns,points,width:info.width,height:info.height,left,right};
}
function horizontalShift(a,b){
 if(a.width!==b.width||a.height!==b.height)return null;const scores=[];
 if(a.mask.equals(b.mask))return {shift:0,score:1,hit:a.points.length};
 // Compare interior glyphs; the two viewport masks fade different edge letters.
 for(let shift=-a.width+48;shift<=a.width-48;shift++){
  const left=Math.max(8,shift+8),right=Math.min(a.width-40,b.width-40+shift);if(right-left<20)continue;
  const oldCount=a.columns[right]-a.columns[left],newCount=b.columns[right-shift]-b.columns[left-shift];if(Math.min(oldCount,newCount)<80)continue;
  let hit=0;for(const p of a.points){const x=p%a.width;if(x>=left&&x<right)hit+=b.mask[p-shift]||0;}
  const score=hit/(oldCount+newCount-hit);if(score>.68)scores.push({shift,score,quality:score*Math.min(1,(right-left)/200),hit});
 }
 scores.sort((a,b)=>b.quality-a.quality);const best=scores[0],runner=scores.find(v=>Math.abs(v.shift-best.shift)>5);
 return best&&(!runner||best.quality-runner.quality>.06)?best:null;
}
function prepareStrip(data,width,height){
 const columns=new Uint32Array(width),colors=new Set(),votes=Array.from({length:width},()=>new Uint16Array(6));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*3,r=data[p],g=data[p+1],b=data[p+2],max=Math.max(r,g,b),difference=max-Math.min(r,g,b);if(max>100&&r+g+b>180)columns[x]++;if(difference>60&&max>80){const color=r>g*1.3&&r>b*1.3?0:g>r*1.3&&g>b*1.3?1:b>r*1.3&&b>g*1.3?2:r>b*1.5&&g>b*1.5?3:r>g*1.3&&b>g*1.3?4:5;votes[x][color]++;if(difference>100&&max>140)colors.add(color);}}
 let cuts=[];const max=Math.max(...columns);
 if(colors.size>=3&&max>=16){const runs=[];for(let x=0;x<width;x++)if(columns[x]>=max*.9){const last=runs.at(-1);if(last&&x-last.end<=2)last.end=x;else runs.push({start:x,end:x});}
  cuts=[...runs.slice(1).flatMap((t,i)=>t.start-runs[i].end<=8&&t.end-t.start<=4&&runs[i].end-runs[i].start<=4?[Math.round((t.start+runs[i].end)/2)]:[]),...runs.filter(t=>t.end-t.start>=6&&t.end-t.start<=11).map(t=>Math.round((t.start+t.end)/2))].sort((a,b)=>a-b);
  const colored=[];for(let x=0;x<width;x++){const count=Math.max(...votes[x]);if(count<2)continue;const color=votes[x].indexOf(count),last=colored.at(-1);if(last&&last.color===color&&x-last.end<=14)last.end=x;else colored.push({color,start:x,end:x});}
  cuts.push(...colored.filter(r=>r.end-r.start>=12).flatMap(r=>[r.start,r.end+1]));const unique=[];for(const cut of cuts.filter(x=>x>0&&x<width).sort((a,b)=>a-b))if(!unique.length||cut-unique.at(-1)>18)unique.push(cut);cuts=unique;
 }
 // Dense ][ slot labels form one enormous OCR word. Add background spacing
 // between their observed stems without changing any glyph or slot label.
 if(cuts.length>=3){const expanded=width+cuts.length*14,pixels=Buffer.alloc(expanded*height*3),expandedColumns=new Uint32Array(expanded);for(let y=0;y<height;y++){let k=0;for(let x=0;x<width;x++){while(k<cuts.length&&cuts[k]<=x)k++;data.copy(pixels,(y*expanded+x+k*14)*3,(y*width+x)*3,(y*width+x+1)*3);if(y===0)expandedColumns[x+k*14]=columns[x];}}return {data:pixels,width:expanded,height,columns:expandedColumns};}
 return {data,width,height,columns};
}
function recognitionView({data,width,height},threshold){
 let left=width,right=-1,top=height,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=(y*width+x)*3;if(Math.max(data[p],data[p+1],data[p+2])>100&&data[p]+data[p+1]+data[p+2]>180){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 if(right<left)return null;
 const w=right-left+41,h=bottom-top+25,pixels=Buffer.alloc(w*h*3,255);
 // OCR page layout can drop an inline percentage. Isolate its full glyph band,
 // remove shadows, and add a light border instead of rerunning the same pixels.
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const p=(y*width+x)*3,q=((y-top+12)*w+x-left+20)*3;if(Math.max(data[p],data[p+1],data[p+2])>threshold&&data[p]+data[p+1]+data[p+2]>180)pixels.fill(0,q,q+3);}
 return {data:pixels,width:w,height:h,x:left-20,y:top-12};
}
const slotLabels=text=>[...text.matchAll(/\[(EMPTY|STR|DEX|QCK|PSY|INT|G|RCV|TND|BOMB|BLOCK|RAINBOW)\]/gi)];
function mergeSlotWords(lists){
 const groups=[];let ambiguous=false;
 for(const [view,list]of lists.entries())for(const word of list){const labels=slotLabels(word.text);if(labels.length!==1||labels[0].index!==0||/\d/.test(word.text))continue;const label='['+labels[0][1].toUpperCase()+']';let group=groups.find(g=>Math.abs(g.x-word.x)<=10);if(!group){group={x:word.x,labels:new Map()};groups.push(group);}let entry=group.labels.get(label);if(!entry){entry={label,views:new Set(),word};group.labels.set(label,entry);}entry.views.add(view);if(word.text.length>entry.word.text.length)entry.word=word;}
 const chosen=[];for(const group of groups){const candidates=[...group.labels.values()].sort((a,b)=>b.views.size-a.views.size);if(candidates[1]?.views.size===candidates[0].views.size){ambiguous=true;continue;}const value=candidates[0];chosen.push({...value.word,text:value.word.text.replace(value.word.text.match(/^\[[^\]]+\]/)[0],value.label),label:value.label});}
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
 return {ambiguous,lists:lists.map(list=>{const result=[],used=new Set();for(const word of list){const slot=chosen.find(s=>overlap(s,word)>Math.min(s.width,word.width)*.45);
   if(slot&&/[\[\]]/.test(word.text)){const labels=slotLabels(word.text);if(labels.length>1){result.push(word);for(const s of chosen)if(labels.some(m=>'['+m[1].toUpperCase()+']'===s.label)&&overlap(s,word)>s.width*.5)used.add(s);}
    else if(Math.abs(word.x-slot.x)<=12&&slot.width>=word.width*.85){result.push(slot);used.add(slot);}
    else if(labels.length===1){result.push({...word,text:word.text.replace(labels[0][0],slot.label)});used.add(slot);}
    else result.push(word);
   }else if(!slot||!slot.text.toLowerCase().includes(word.text.toLowerCase())||overlap(slot,word)<word.width*.75)result.push(word);
  }for(const slot of chosen)if(!used.has(slot))result.push(slot);return result.sort((a,b)=>a.x-b.x);})};
}
function createPixelMarquee(tokens,body,reuse,{now=Date.now,staticCycleMs,retainPartial=false}={}){
 const sources=[...tokens],tracks=[],failedImages=new Set(),failedEffectImages=new Map();let cycleMs=staticCycleMs,badgeBoxes;
 const addTrack=(token,index)=>{
  const p=token.position;if(!p||!['line','event'].includes(token.kind)||token.kind==='line'&&!Number.isFinite(p.contentLeft)&&p.left<body.left+body.width*.10||/^When\s*Lv/i.test(token.text)||p.edge||p.top+p.height+6>=body.top+body.height-8)return;
  const old=reuse?.verified&&reuse.tokens.find(t=>t.marquee?.complete&&t.kind===token.kind&&t.trigger===token.trigger&&t.position&&!t.position.edge&&Math.abs(t.position.top-reuse.shift-p.top)<=4&&!conflictingNumbers(t,token));
  if(old){sources[index]=positioned({...old},p);return;}
  const prefix=token.kind==='event'?token.text.match(/^(?:PRE[ -]?EMPTIVE|STARTING STATE|INTERRUPTION?|DEFEATED|ON DEFEAT)\b/i)?.[0]||'':'';
  if(!token.pixelDiscovered&&!token.text.slice(prefix.length).trim())return;
  const left=Math.round(Number.isFinite(p.contentLeft)?p.contentLeft:body.left+body.width*(prefix?.28:.11)),top=Math.max(body.top,Math.floor(p.top-6)),height=Math.min(Math.ceil(p.height+12),body.top+body.height-top);
  tracks.push({token,index,prefix,rect:{left,top,width:Math.floor(body.left+body.width-12-left),height},samples:0});
 };
 sources.forEach(addTrack);
 const discover=async image=>{
  badgeBoxes??=(await Promise.all(['green','cyan','yellow'].map(color=>require('./starting-state-ocr.cjs').outlinedTriggerBoxes(image,body,color)))).flat();
  const left=Math.round(body.left+body.width*.11),width=Math.floor(body.left+body.width-36-left),{data,info}=await sharp(image).extract({left,top:body.top,width,height:body.height}).removeAlpha().raw().toBuffer({resolveWithObject:true}),bands=[];
  for(let y=0;y<info.height;y++){let ink=0;for(let x=0;x<info.width;x++){const p=(y*info.width+x)*info.channels;if(Math.max(data[p],data[p+1],data[p+2])>100&&data[p]+data[p+1]+data[p+2]>180)ink++;}if(ink>=4&&ink<info.width*.70){const last=bands.at(-1);if(last&&y-last.end<=4)last.end=y;else bands.push({start:y,end:y});}}
  // OCR boxes describe recognized words and can omit taller/missed glyphs.
  // The physical foreground band supplies the crop, including its descenders.
  for(const track of tracks)if(!track.samples){const center=track.token.position.top+track.token.position.height/2,band=bands.filter(b=>b.end-b.start>=7&&b.end-b.start<=38).sort((a,b)=>Math.abs(body.top+(a.start+a.end)/2-center)-Math.abs(body.top+(b.start+b.end)/2-center))[0];if(band&&Math.abs(body.top+(band.start+band.end)/2-center)<=20){track.rect.top=Math.max(body.top,body.top+band.start-8);track.rect.height=Math.min(band.end-band.start+17,body.top+body.height-track.rect.top);}}
  // OCR may put a fixed badge and its moving condition on separate rows. The
  // outlined rectangle supplies a crop boundary, without guessing its meaning.
  for(const track of tracks)if(!track.samples)for(const box of badgeBoxes){const overlap=Math.min(box.top+box.height,track.rect.top+track.rect.height)-Math.max(box.top,track.rect.top),right=box.left+box.width+8;if(box.left<track.rect.left&&right>track.rect.left&&overlap>=Math.min(box.height,track.rect.height)*.6){track.rect.width-=right-track.rect.left;track.rect.left=right;}}
  for(const band of bands){const top=body.top+band.start,height=band.end-band.start+1;
   if(height<8||height>38||top<Math.max(body.top+16,Math.min(...tokens.filter(t=>t.position).map(t=>t.position.top))-6)||top+height+6>=body.top+body.height-8||sources.some(t=>t.position&&Math.abs(t.position.top+t.position.height/2-top-height/2)<(t.position.height+height)/2+7))continue;
   const token=positioned({kind:'line',text:'',pixelDiscovered:true},{top,height,left,page:tokens[0]?.position?.page,rightClipped:false}),index=sources.length;sources.push(token);addTrack(token,index);
  }
 };
 const reset=(track,strip,startSeen=false)=>{track.previous=strip;track.startSeen=startSeen;track.headPlaced=startSeen&&strip.left<12;track.headVerified=track.headPlaced;track.headStrip=track.headPlaced?strip:undefined;track.endCandidate=undefined;track.offset=startSeen?-strip.left:0;track.width=0;track.pixels=Buffer.alloc(0);track.moving=false;track.still=0;track.stillSince=now();track.done=false;};
 const add=(track,strip)=>{
  const width=Math.max(track.width,track.offset+strip.width);if(width>4096)throw Error('Kayan satır görüntüsü Windows OCR boyutunu aştı; metin tamamlanmış sayılmadı.');
  if(width>track.width){const pixels=Buffer.alloc(width*strip.height*3);for(let y=0;y<strip.height;y++)track.pixels.copy(pixels,y*width*3,y*track.width*3,(y+1)*track.width*3);track.pixels=pixels;track.width=width;}
  // Keep the brightest observation of each glyph so the viewport fade cannot erase it.
  for(let y=0;y<strip.height;y++)for(let x=0;x<strip.width;x++){const targetX=x+track.offset;if(targetX<0)continue;const a=(y*strip.width+x)*3,b=(y*track.width+targetX)*3;if(strip.data[a]+strip.data[a+1]+strip.data[a+2]>track.pixels[b]+track.pixels[b+1]+track.pixels[b+2])strip.data.copy(track.pixels,b,a,a+3);}
 };
 return {
  async observe(image){
   await discover(image);
   for(const track of tracks){if(track.done)continue;const strip=await readStrip(image,track.rect);track.samples++;if(strip.points.length<30){track.previous=undefined;continue;}
    track.observedSince??=now();const displacement=track.previous?horizontalShift(track.previous,strip):null,boundary=strip.width-24;
    // The same head may re-enter partway across the viewport between captures.
    // A pause without an observed entrance is only a candidate head: require its
    // pixels to recur after traversing the text, rather than accepting its tail.
    const headMatch=track.headPlaced&&track.moving&&track.headStrip&&(!displacement||displacement.shift<-3)?horizontalShift(track.headStrip,strip):null;
    const returnedHead=headMatch&&headMatch.shift<=2;
    if(track.headPlaced&&track.moving&&(!displacement||displacement.shift<-3)&&(returnedHead||strip.left>strip.width*.55||track.headVerified&&displacement?.shift<-3)&&(track.headVerified||track.endCandidate)){Object.assign(track,track.endCandidate||{},{done:true});continue;}
    if(!track.previous||!displacement){reset(track,strip,strip.left>strip.width*.55);}
    else if(displacement.shift<-3){reset(track,strip,strip.left<12);}
    else{const shift=Math.max(0,displacement.shift);
     if(shift>2&&!track.headPlaced&&!track.startSeen&&track.still>=1&&track.previous.left<12){track.headPlaced=true;track.headVerified=false;track.headStrip=track.previous;}
     track.offset+=shift;track.moving||=shift>2;track.still=shift<=2?track.still+1:0;if(shift>2){track.endCandidate=undefined;track.stillSince=now();}}
    // The entrance ends in a head pause. Only subsequent leftward motion can
    // establish the ending; a whole last word may still be outside the viewport.
    if(track.startSeen&&!track.headPlaced&&strip.left<12){track.headPlaced=true;track.headVerified=true;track.headStrip=strip;track.moving=false;track.still=0;}
    add(track,strip);track.previous=strip;
    const tail=strip.right<boundary-6;
    if(track.headPlaced&&track.headVerified&&track.moving&&track.still>=1&&tail)track.done=true;
    else if(track.headPlaced&&track.moving&&track.still>=1&&!track.endCandidate)track.endCandidate={pixels:Buffer.from(track.pixels),width:track.width};
    else if(!track.startSeen&&!track.moving&&track.still>=2&&tail&&strip.right-strip.left<boundary*.9&&!track.token.position.rightClipped)track.done=true;
   }
   const completed=tracks.filter(t=>t.done&&t.headPlaced&&t.moving).map(t=>now()-t.observedSince).filter(ms=>ms>0);if(!cycleMs&&completed.length)cycleMs=Math.min(...completed);
   // A wide static caption can fill the viewport. Its unchanged pixels must
   // outlast a complete observed marquee cycle, rather than an arbitrary width.
   if(cycleMs)for(const track of tracks)if(!track.done&&!track.startSeen&&!track.moving&&track.still>=2&&now()-track.stillSince>=cycleMs&&!track.token.position.rightClipped&&track.previous?.right<track.rect.width-30)track.done=true;
  },calibration:()=>cycleMs,pending:()=>tracks.filter(t=>!t.done).length,waitingText:()=>tracks.filter(t=>!t.done).map(t=>t.token.text||'İlk görüntüde okunamayan satır').join(' · ').slice(0,160),
  retry(indices){for(const track of tracks)if(indices.has(track.index)){track.previous=undefined;track.done=false;}},
  async recognize(readOCR,check,readLineOCR,readBlockOCR,signal){
   const panels=[];let height=20;for(const track of tracks){if(track.resolved)continue;const rendered=prepareStrip(track.pixels,track.width,track.rect.height),png=await sharp(rendered.data,{raw:{width:rendered.width,height:rendered.height,channels:3}}).png().toBuffer();panels.push({track,rendered,top:height,png});height+=track.rect.height+24;}
   if(!panels.length)return {tokens:sources,retry:new Set()};
   if(!retainPartial&&panels.some(p=>p.track.token.requiresEffectProof&&failedEffectImages.get(p.track.index)===createHash('sha256').update(p.png).digest('hex')))return {tokens:sources,retry:new Set(panels.map(p=>p.track.index)),awaitingFreshPixels:true};
   const width=Math.max(...panels.map(p=>p.rendered.width))+40,sheet=await sharp({create:{width,height,channels:3,background:'black'}}).composite(panels.map(p=>({input:p.png,left:20,top:p.top}))).png().toBuffer();check();
   const a=await readOCR(sheet,{scale:3,signal});check();const b=await readOCR(sheet,{scale:2,signal});check();const result=[...sources],retry=new Set();
   const fromWords=(list,p,reader)=>{const covered=new Uint8Array(p.rendered.width);for(const w of list)covered.fill(1,Math.min(covered.length,Math.max(0,Math.floor(w.x-20)-3)),Math.max(0,Math.min(covered.length,Math.ceil(w.x+w.width-20)+3)));let ink=0,read=0;const missing=[];for(let x=0;x<covered.length;x++){ink+=p.rendered.columns[x];if(covered[x])read+=p.rendered.columns[x];else if(p.rendered.columns[x]){const last=missing.at(-1);if(last&&x-last.end<=4){last.end=x;last.ink+=p.rendered.columns[x];}else missing.push({start:x,end:x,ink:p.rendered.columns[x]});}}return {list,text:list.map(w=>w.text).join(' ').trim(),coverage:ink?read/ink:0,missingWord:missing.some(r=>r.end-r.start>=10&&r.ink>=30),reader};};
   const words=(ocr,p,reader)=>fromWords(ocr.lines.flatMap(l=>l.words).filter(w=>w.y+w.height/2>=p.top-2&&w.y+w.height/2<=p.top+p.track.rect.height+2&&w.height<=p.track.rect.height+16).sort((a,b)=>a.x-b.x),p,reader);
   const numbers=s=>s.match(/\d+/g)||[],uncertain=s=>/§\d*%/.test(s)||/\breduction\s*:\s*$|\bby\s*$|^(?:[a-z|]+\s+)?turn\(s\)(?=\s|$)/i.test(s)||[...s.matchAll(/\b(?:by|over|above|below|x|reduction\s*:?)\s*([0-9IlOo|]+)(?=\s|%|$)|\b([0-9IlOo|]+)\s*(?=turn(?:\(s\)|s)?\b|%)/gi)].some(m=>/[IlOo|]/.test(m[1]||m[2]));
   const confident=s=>!s.missingWord&&!s.list?.some(w=>w.confidence!==undefined&&w.confidence<(/\d/.test(w.text)?80:45));
   const effectProof=(s,p)=>{const conditionWords=/\b(?:if|when|chance|chain|multiplier|or less|or more|below|above|at least|at most)\b/i.test(s.text),condition=p.track.token.requiresEffectCondition||conditionWords,m=s.text.match(condition?/^(\d{1,2})\s+turn\(s\)\s+if\b.+(?<![\d.])(\d+(?:\.\d+)?)\s+or\s+(less|more)\b.*\b(?:(?:ATK\s+(\d{1,3})%)|((\d{1,3})%\s+ATK))\s+Down\b/i:/^(\d{1,2})\s+turn\(s\)(?:\s|$).*\b(?:(?:ATK\s+(\d{1,3})%)|((\d{1,3})%\s+ATK))\s+Down\b/i),percent=+(condition?(m?.[4]||m?.[6]):(m?.[2]||m?.[4]));return !!m&&+m[1]>=1&&+m[1]<=99&&(!condition||+m[2]>0)&&percent>=1&&percent<=100&&[...s.text.matchAll(/\b\d+(?:\.\d+)?%?/g)].every(v=>{const w=s.list?.find(w=>w.text===v[0]);return !!w&&w.confidence>=90;});};
   const agree=(values,p)=>values.filter((s,i)=>s.text&&!s.ambiguousSlots&&!uncertain(s.text)&&confident(s)&&s.coverage>=.88&&(!numbers(p.track.token.text).length||numbers(s.text).length)&&(!p.track.token.requiresEffectProof||effectProof(s,p))&&values.some((other,j)=>i!==j&&other.text&&!uncertain(other.text)&&confident(other)&&JSON.stringify(numbers(s.text))===JSON.stringify(numbers(other.text))&&(!p.track.token.requiresEffectProof||other.reader!==s.reader&&effectProof(other,p)))).sort((a,b)=>b.coverage-a.coverage||b.text.length-a.text.length)[0];
   let third;
   for(const panel of panels){const fingerprint=createHash('sha256').update(panel.png).digest('hex');const values=[words(a,panel,'ocr'),words(b,panel,'ocr')],slotMode=values.some(v=>slotLabels(v.text).length>=3),choose=()=>{if(!slotMode)return agree(values,panel);const merged=mergeSlotWords(values.map(v=>v.list||[]));return agree(values.map((v,i)=>v.list?{...fromWords(merged.lists[i],panel,v.reader),ambiguousSlots:merged.ambiguous}:v),panel);};let lineRead=false,cleaned;
    const isolated=async scale=>{const read=await readOCR(panel.png,{scale,signal});check();values.push(words({lines:read.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x+20,y:w.y+panel.top}))}))},panel,'ocr'));};
    if(slotMode)await isolated(2.5);let text=choose();if(!text&&panel.track.token.requiresEffectProof&&readLineOCR){lineRead=true;const read=await readLineOCR(panel.png,{scale:2,signal});check();values.push(words({lines:read.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x+20,y:w.y+panel.top}))}))},panel,'line'));text=choose();}
    if(!text){if(!third){third=await readOCR(sheet,{scale:4,signal});check();}values.push(words(third,panel,'ocr'));text=choose();}
    if(!text&&readLineOCR&&!lineRead){
     const read=await readLineOCR(panel.png,{scale:2,signal});check();values.push(words({lines:read.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x+20,y:w.y+panel.top}))}))},panel,'line'));text=choose();
     if(!text){const view=recognitionView(panel.rendered,140);if(view){const image=await sharp(view.data,{raw:{width:view.width,height:view.height,channels:3}}).png().toBuffer(),read=await readLineOCR(image,{scale:2,signal});cleaned={image,view};check();values.push(words({lines:read.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x+view.x+20,y:w.y+view.y+panel.top}))}))},panel,'line'));text=choose();}}
    }
    // An open-top duration digit can be transcribed as a letter by page OCR.
    // Require a second confident layout reading of the same complete pixels.
    if(!text&&readBlockOCR&&values.some(v=>/^\d+\s+turn\(s\)/i.test(v.text)&&confident(v))){const read=await readBlockOCR(panel.png,{scale:2,signal});check();values.push(words({lines:read.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x+20,y:w.y+panel.top}))}))},panel,'block'));text=choose();
     if(!text&&cleaned){const {image,view}=cleaned,read=await readBlockOCR(image,{scale:2,signal});check();values.push(words({lines:read.lines.map(l=>({...l,words:l.words.map(w=>({...w,x:w.x+view.x+20,y:w.y+view.y+panel.top}))}))},panel,'block'));text=choose();}
    }
    if(!text&&!panel.track.moving&&!panel.track.startSeen){values.push({text:panel.track.token.text,coverage:0});text=choose();}
    if(!text){for(const scale of [3,2,1.5]){await isolated(scale);text=choose();if(text)break;}}
    if(!text){
     const t=panel.track,previousFailure=failedEffectImages.get(t.index);
     if(retainPartial&&previousFailure===fingerprint){
      result[t.index]=positioned({...t.token,marquee:{complete:false,samples:t.samples}},t.token.position);
      sources[t.index]=result[t.index];
      t.resolved=true;
      continue;
     }
     if(retainPartial||t.token.requiresEffectProof){failedEffectImages.set(t.index,fingerprint);retry.add(t.index);continue;}
     if(failedImages.has(fingerprint))throw Error('Kayan satır aynı görüntüde farklı okuma yöntemleriyle doğrulanamadı; eksik metinle devam edilmedi: '+(t.token.text||'İlk görüntüde okunamayan satır'));
     failedImages.add(fingerprint);retry.add(t.index);continue;
    }
    failedImages.delete(fingerprint);failedEffectImages.delete(panel.track.index);
    const t=panel.track,full=(t.prefix?t.prefix+' ':'')+text.text;result[t.index]=positioned({...t.token,...(t.token.kind==='event'?eventLabel(full):{}),text:full,marquee:{complete:true,samples:t.samples,method:'pixels'}},{...t.token.position,rightClipped:false});
    if(retainPartial){sources[t.index]=result[t.index];t.resolved=true;}
   }
   return {tokens:result.sort((a,b)=>(a.position?.top||0)-(b.position?.top||0)),retry};
  }
 };
}
async function collectPixelMarquee(first,{capture,tokens,body,check,progress,wait,measure,readOCR,readLineOCR,readBlockOCR,reuse,staticCycleMs,signal,retainPartial}){
 const tracker=createPixelMarquee(tokens(first),body,reuse,{staticCycleMs,retainPartial});let snap=first,samples=0,unknownFrames=0;await tracker.observe(first.image);
 for(;;){
   check();if(!tracker.pending()){
   const result=await tracker.recognize(readOCR,check,readLineOCR,readBlockOCR,signal);if(!result.retry.size)return {snap,tokens:require('./behavior-effect-ocr.cjs').restoreVerifiedEffects(result.tokens,snap.ocr),staticCycleMs:tracker.calibration()};tracker.retry(result.retry);progress(result.awaitingFreshPixels?'ATK Down satırını doğrulamak için yeni görüntü bekleniyor · '+result.retry.size+' satır…':'Kayan satırdaki sayılar yeniden görüntüden doğrulanıyor · '+result.retry.size+' satır…');
  }
  progress('Kayan yazılar görüntüden birleştiriliyor · '+tracker.pending()+' satır · kare '+(++samples)+(tracker.pending()===1?' · '+tracker.waitingText():'')+'…');await wait(80);check();const next=await capture({pixelsOnly:true});check();
  const position=await measure(snap.image,next.image,body);check();
  if(retainPartial&&!position?.verified&&++unknownFrames<3){progress('Belirsiz görüntü atlandı, sayfa konumu yeniden ölçülüyor…');continue;}
  if(!position?.verified||position.shift>3){const measured=position?{verified:!!position.verified,...(Number.isFinite(position.shift)?{shift:position.shift}:{}),...(position.source?{source:position.source}:{})}:null;await snap.recordPixelPair?.(snap,next,measured,position?.verified?'verified-motion':'motion-unverified');throw Error(position?.verified?'Davranış listesi okuma sırasında hareket etti; aynı satırın kayan metni doğrulanamadı.':'Davranış listesinin hareketi doğrulanamadı; eksik kayan metinle devam edilmedi.');}
  unknownFrames=0;
  await tracker.observe(next.image);snap=next;
 }
}
module.exports={readStrip,horizontalShift,prepareStrip,mergeSlotWords,createPixelMarquee,collectPixelMarquee};
