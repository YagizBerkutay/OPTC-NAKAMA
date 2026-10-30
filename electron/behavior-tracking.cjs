const sharp=require('sharp');
const {joinMarquee,preferRow,positioned,conflictingNumbers,eventLabel}=require('./boss-behavior-core.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// The left icon / trigger lane does not move horizontally with the text.
// Compare it across screenshots; identical repeated text alone is insufficient.
async function lane(image,body){
 const crop={left:body.left+8,top:body.top,width:Math.min(68,body.width-16),height:body.height};
 const {data,info}=await sharp(image).extract(crop).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const mask=new Uint8Array(info.width*info.height);
 for(let i=0;i<mask.length;i++){const p=i*info.channels;mask[i]=data[p]+data[p+1]+data[p+2]>440?1:0;}
 return {mask,width:info.width,height:info.height};
}
async function estimateScroll(before,after,body,{range}={}){
 const a=await lane(before,body),b=await lane(after,body),scores=[];
 const lower=range?.verified?Math.max(0,Math.ceil(range.min)):0,upper=range?.verified?Math.min(600,Math.floor(a.height*.64),Math.floor(range.max)):Math.min(600,Math.floor(a.height*.64));
 for(let shift=lower;shift<=upper;shift++){
  let union=0,intersection=0,activeRows=[];
  for(let y=12;y<a.height-shift-12;y++){
   let matched=0;
   for(let x=0;x<a.width;x+=2){const old=a.mask[(y+shift)*a.width+x],now=b.mask[y*b.width+x];union+=old|now;intersection+=old&now;matched+=old&now;}
   if(matched>=3)activeRows.push(y);
  }
  let bands=0,last=-100;for(const y of activeRows){if(y-last>8)bands++;last=y;}
  if(union>=120&&bands>=3)scores.push({shift,score:intersection/union,support:intersection,bands});
 }
 scores.sort((x,y)=>y.score-x.score);const best=scores[0],runner=scores.find(v=>best&&Math.abs(v.shift-best.shift)>8);
 if(!best||best.score<.84||runner&&best.score-runner.score<.035)return null;
 return {...best,verified:true};
}
function createScrollAlignment({measure=estimateScroll,readBar=require('./scrollbar.cjs').scrollbar}={}){
 let calibration,samples=0,geometry;
 const reset=()=>{calibration=undefined;samples=0;};
 return {evidence:async(before,after,body,headings)=>{
  const shape=JSON.stringify(body);if(shape!==geometry){reset();geometry=shape;}
  const [a,b]=await Promise.all([readBar(before,body),readBar(after,body)]),anchors=require('./quest-scroll-anchor.cjs'),primary=await measure(before,after,body)||await anchors.headingScrollEvidence(before,after,body,headings)||await anchors.stationaryTextScrollEvidence(before,after,body,headings);
  if(!a.known||!b.known||!Number.isFinite(a.thumbTop)||!Number.isFinite(b.thumbTop)||Math.abs(a.thumbHeight-b.thumbHeight)>2||a.trackHeight!==b.trackHeight){reset();return primary;}
  const dy=b.thumbTop-a.thumbTop;
  if(dy<0){reset();return primary;}
  const range=samples>=2&&calibration?{verified:true,min:Math.max(0,(dy-1)*calibration.min-4),max:(dy+1)*calibration.max+4}:undefined;
  // Learn the scale only from independent, unambiguous icon-pixel matches.
  // Count each pair once; retries of the same page are not more calibration.
  if(primary?.shift>0&&dy>2){
   const low=(primary.shift-4)/(dy+1),high=(primary.shift+4)/(dy-1),pair=a.thumbTop+':'+b.thumbTop;
   if(calibration?.pair!==pair){const min=Math.max(calibration?.min??low,low),max=Math.min(calibration?.max??high,high);if(min>max){calibration={min:low,max:high,pair};samples=1;}else{calibration={min,max,pair};samples++;}}
  }
  if(primary)return primary;
  if(!range||range.max-range.min>40||range.max>600)return null;
  // The thumb bounds the search. It never supplies a guessed verified shift:
  // pixels or three distinct text anchors must still establish alignment.
  return await measure(before,after,body,{range})||{range};
 }};
}
const key=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const hasHead=s=>/^(?:For\s+\d+\s*turn|\d+\s*turn|Weakness Class\s*:|(?:Super Switch Effect requirement|VS Effect gauge) reduction\s*:|(?:Change|Changes|Remove|Retreat|Until|Self Heal|Top-Row|Bottom-Row|Crewmate|If|When|After)\b)/i.test(s);
function createMarqueeTracker(tokens,{body}={}){
 const laneStart=body?body.left+body.width*.11:undefined;
 const parts=t=>{
  const prefix=t.kind==='event'?t.text.match(/^(?:PRE[ -]?EMPTIVE|STARTING STATE|INTERRUPTION?)\b/i)?.[0]:'';
  let text=prefix?t.text.slice(prefix.length).trim():t.text;
  // The last glyph at the right mask can be half a letter. Do not pin that
  // unstable fragment as the sentence beginning; later frames supply it.
  if(t.position?.rightClipped&&text.split(/\s+/).length>=4)text=text.replace(/\s+[A-Za-z|!]$/,'');
  return {prefix:prefix||'',token:positioned({...t,text},t.position)};
 };
 const entry=t=>{const p=parts(t),content=p.token,head=hasHead(content.text),suffix=t.kind==='line'&&!head&&/^[a-z]/.test(content.text);return {prefix:p.prefix,token:content,fragments:[content.text],moving:false,clipped:!!t.position?.rightClipped||suffix,head,headText:head?content.text:null,tail:head&&!t.position?.rightClipped?content.text:null,incoming:content};};
 const tracks=tokens.map(entry);
 const observe=next=>{
  for(const raw of next){const t=parts(raw).token,track=tracks.find(v=>v.token.kind===t.kind&&Math.abs(v.token.position.top-t.position.top)<=5);if(!track){const sameRow=tracks.find(v=>Math.abs(v.token.position.top-t.position.top)<=5);if(!sameRow)tracks.push(entry(raw));else if(sameRow.token.kind==='line'&&t.kind==='event')Object.assign(sameRow,entry(raw));continue;}
   if(t.kind==='battle'&&(track.token.number!==t.number||track.token.variant!==t.variant)||t.kind==='event'&&track.token.trigger!==t.trigger)throw Error('Davranış başlığı aynı konumda değişti; kayan metin okuması durduruldu.');
   if(key(track.fragments.at(-1))!==key(t.text))track.moving=true;
   if(!t.position.edge&&conflictingNumbers(track.token,t)){track.conflict=true;continue;}
   if(track.head&&hasHead(t.text)&&!key(t.text).startsWith(key(track.headText))){
    const a=key(track.headText),b=key(t.text);let shared=0;
    while(shared<Math.min(a.length,b.length)&&a[shared]===b[shared])shared++;
    // Two observed beginnings can agree through a word whose final glyph was
    // clipped in the first frame. Keep only their literal common prefix.
    if(shared>=14){let letters=0,end=0;for(;end<t.text.length&&letters<shared;end++)if(/[a-z0-9]/i.test(t.text[end]))letters++;track.headText=t.text.slice(0,end);}
   }
   const incoming=track.incoming,oldKey=key(incoming.text),newKey=key(t.text),textLane=track.prefix&&body?body.left+body.width*.28:laneStart;
   // An unknown sentence beginning is also observable: on wraparound its
   // first words enter from the right, then move left together. A middle
   // fragment clipped at the left margin cannot provide this evidence.
   const entered=Number.isFinite(textLane)&&Number.isFinite(incoming.position.left)&&Number.isFinite(t.position.left)&&incoming.position.left>textLane+36&&t.position.left<incoming.position.left-12&&oldKey.length>=6&&/[a-z]{3}/i.test(oldKey)&&newKey.startsWith(oldKey);
   if((!track.head||entered&&!track.entryVerified)&&(hasHead(t.text)||entered)){
    track.fragments=entered?[incoming.text,t.text]:[t.text];track.token=t;track.head=true;track.entryVerified=entered;track.headText=entered?incoming.text:t.text;track.tail=null;
   }else if(!track.fragments.includes(t.text))track.fragments.push(t.text);
   track.incoming=t;track.clipped||=!!t.position.rightClipped;
   if(track.head&&t.text&&!t.position.rightClipped&&!t.position.edge&&(!Number.isFinite(textLane)||!Number.isFinite(t.position.left)||t.position.left<=textLane+16))track.tail=t.text;
   // Keep separate literal fragments until an actual overlap connects them.
   let result=track.token;
   for(let pass=0;pass<2;pass++)for(const fragment of track.fragments){const joined=joinMarquee(result.text,fragment);if(joined&&joined.length>=result.text.length)result=positioned({...result,text:joined},t.position);}
   if(result.text===track.token.text)result=preferRow(result,t);
   // A longer disconnected suffix must not erase an observed beginning and
   // then certify itself as the whole row. Keep the head until literal overlap
   // or a directly observed complete frame connects it to the tail.
   if(track.head&&!key(result.text).startsWith(key(track.headText)))result=track.token;
   track.token=positioned({...result},t.position);
  }
 };
 const unresolved=v=>v.conflict||(v.clipped||v.moving)&&!(v.head&&v.tail&&key(v.token.text).startsWith(key(v.headText))&&key(v.token.text).includes(key(v.tail)));
 const readable=v=>v.token.kind==='line'||v.token.kind==='event'&&!!v.prefix;
 return {observe,pending:()=>tracks.filter(v=>readable(v)&&!v.token.position.edge&&unresolved(v)).length,
  waitingForHead:()=>tracks.filter(v=>readable(v)&&!v.token.position.edge&&(v.clipped||v.moving)&&!v.head).length,
  result:()=>{const page=Symbol();return [...tracks].sort((a,b)=>a.token.position.top-b.token.position.top).map(v=>{const text=v.prefix?v.prefix+(v.token.text?' '+v.token.text:''):v.token.text;return positioned({...v.token,text,...(v.prefix?eventLabel(text):{}),...(readable(v)&&(v.clipped||v.moving)?{marquee:{complete:!unresolved(v),samples:v.fragments.length}}:{})},{...v.token.position,page});});}};
}
// Wait for observed completion or cancellation, regardless of animation length.
async function collectMarquee(first,{capture,tokens,body,check,progress,wait=sleep,maxDuration=Infinity,maxSamples=Math.ceil(maxDuration/450)+1,now=Date.now,measure=estimateScroll,readOCR,readLineOCR,readBlockOCR,reuse,staticCycleMs}){
 if(readOCR)return require('./marquee-panorama.cjs').collectPixelMarquee(first,{capture,tokens,body,check,progress,wait,measure,readOCR,readLineOCR,readBlockOCR,reuse,staticCycleMs});
 const tracker=createMarqueeTracker(tokens(first),{body}),started=now();let snap=first;
 // Two samples also detect rows whose initial frame is in the end pause.
 for(let sample=1;sample<maxSamples;sample++){
  if(now()-started>=maxDuration)break;
  if(sample>2&&!tracker.pending())break;
  check();progress(tracker.waitingForHead()?'Kayan yazının başa dönmesi bekleniyor · '+tracker.waitingForHead()+' satır…':'Kayan yazının devamı okunuyor · görüntü '+(sample+1)+'…');await wait(450);check();const next=await capture();check();
  const position=await measure(snap.image,next.image,body);
  if(!position||position.shift>3)throw Error('Davranış listesi okuma sırasında hareket etti; aynı satırın kayan metni doğrulanamadı.');
  tracker.observe(tokens(next));snap=next;
 }
 return {snap,tokens:tracker.result()};
}
module.exports={estimateScroll,createScrollAlignment,createMarqueeTracker,collectMarquee};
