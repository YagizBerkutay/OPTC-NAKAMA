import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,RefreshCw,Shield,Swords,X} from 'lucide-react';
import type {AppState,Catalog,Character} from './model';
import type {PlannerData,Scenario} from './planning';
import {CLASSES,TYPES} from './planning';
import {getData,TeamCard} from './PlannerPage';
import {assaultRuleText,validateAssault,type AssaultContext,type AssaultObjective,type AssaultResult} from './assault-rumble';
import {TabBar,SCENARIO_TABS,friendlyError} from './ui';
import {download} from './storage';
let remembered:AssaultContext|undefined;
export default function AssaultRumblePage({state,catalog,onEdit}:{state:AppState;catalog:Catalog;onEdit:(c:Character)=>void}){
 const [data,setData]=useState<PlannerData>(),[context,setContext]=useState<AssaultContext|undefined>(remembered),[boss,setBoss]=useState(remembered?.selectedBoss||''),[objective,setObjective]=useState<AssaultObjective>(remembered?.maxLevel?'score':'progression');
 const [scenario,setScenario]=useState<Scenario>('power'),[category,setCategory]=useState(''),[rows,setRows]=useState<Record<string,AssaultResult>>({}),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[elapsed,setElapsed]=useState(0),[stale,setStale]=useState(false),[provisional,setProvisional]=useState(false);
 const generation=useRef(0),reading=useRef(false),worker=useRef<Worker|null>(null),cache=useRef(new Map<string,Record<string,AssaultResult>>()),deviceKey=state.settings.adbPath+'|'+state.settings.device,previousDevice=useRef(deviceKey);
 const characters=useMemo(()=>new Map(catalog.characters.map(c=>[c.id,c])),[catalog]);
 const stop=()=>{generation.current++;worker.current?.terminate();worker.current=null;if(reading.current)void window.nakama?.cancelAssault();reading.current=false;setBusy(false);};
 useEffect(()=>{let active=true;getData().then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(friendlyError(e));});return()=>{active=false;generation.current++;worker.current?.terminate();if(reading.current)void window.nakama?.cancelAssault();};},[]);
 useEffect(()=>window.nakama?.onAssaultProgress(text=>{if(reading.current)setProgress(text);}),[]);
 useEffect(()=>{if(!busy)return;const start=performance.now(),timer=setInterval(()=>setElapsed(Math.floor((performance.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
 useEffect(()=>{stop();cache.current.clear();setRows({});},[state.box]);
 useEffect(()=>{if(previousDevice.current===deviceKey)return;previousDevice.current=deviceKey;stop();setRows({});setStale(true);},[deviceKey]);
 const key=(ctx:AssaultContext,target:string,selectedScenario:Scenario,goal:AssaultObjective,scope:string,all=false,deep=false)=>JSON.stringify([ctx.fingerprint,ctx.level,ctx.maxLevel,ctx.enemies,ctx.limits,data?.metadata.sha,state.box,target,selectedScenario,goal,scope,all,deep]);
 const calculate=(ctx:AssaultContext,target:string,selectedScenario=scenario,goal=objective,scope=category,all=false,deep=false,token=++generation.current)=>{
  if(!data)return;worker.current?.terminate();setError('');setBusy(true);setElapsed(0);setProgress('Assault adayları hazırlanıyor…');setProvisional(false);setStale(false);
  const cacheKey=key(ctx,target,selectedScenario,goal,scope,all,deep),saved=cache.current.get(cacheKey);if(saved){setRows(saved);setBusy(false);setProgress('Aynı kutu ve kurallar · kayıtlı hesap kullanıldı.');return;}
  const previous=deep?rows:{},better=(next:AssaultResult)=>previous[next.boss]?.teams[0]?.score>next.teams[0]?.score?previous[next.boss]:next;
  if(!deep)setRows({});const task=new Worker(new URL('./assault-rumble.worker.ts',import.meta.url),{type:'module'});worker.current=task;let completed:Record<string,AssaultResult>={};
  task.onmessage=event=>{if(generation.current!==token)return;const m=event.data;
   if(m.progress){setProgress(m.progress);return;}
   if(m.preview){setRows(previous=>({...previous,[m.preview.boss]:better(m.preview)}));setProvisional(true);return;}
   if(m.row){const row=better(m.row);completed={...completed,[row.boss]:row};setRows(previous=>({...previous,[row.boss]:row}));setProvisional(false);return;}
   if(m.error){setError(friendlyError(m.error));setStale(true);}
   if(m.done){cache.current.set(cacheKey,completed);while(cache.current.size>24)cache.current.delete(cache.current.keys().next().value!);setProgress('Kadro karşılaştırması tamamlandı · '+(m.elapsedMs/1000).toFixed(1)+' sn.');}
   setBusy(false);task.terminate();worker.current=null;
  };
  task.onerror=event=>{if(generation.current!==token)return;setError(event.message||'Assault hesabı tamamlanamadı.');setBusy(false);setStale(true);task.terminate();};
  task.postMessage({context:ctx,boss:target,objective:goal,box:state.box,characters:catalog.characters,data,scenario:selectedScenario,category:scope,all,deep});
 };
 const readAndBuild=async(refresh=false)=>{
  if(!data)return;stop();const token=++generation.current;setBusy(true);setElapsed(0);setError('');setProgress('MuMu bağlantısı doğrulanıyor…');setStale(true);reading.current=true;
  try{if(!window.nakama)throw Error('Assault ekran okuması masaüstü uygulamasında çalışır.');if(!state.settings.device)throw Error('MuMu bağlantısından cihazını seç.');
   await window.nakama.connect(state.settings.adbPath,state.settings.device);if(token!==generation.current)return;
   const next=validateAssault(await window.nakama.assaultRead({exe:state.settings.adbPath,device:state.settings.device,refresh}));if(token!==generation.current)return;
   remembered=next;setContext(next);setBoss(next.selectedBoss);const goal=next.maxLevel?'score':objective;setObjective(goal);reading.current=false;calculate(next,next.selectedBoss,scenario,goal,category,false,false,token);
  }catch(e){if(token===generation.current){setError(friendlyError(e));setBusy(false);}}finally{if(token===generation.current)reading.current=false;}
 };
 const select=(values:{boss?:string;scenario?:Scenario;objective?:AssaultObjective;category?:string})=>{stop();const target=values.boss??boss,s=values.scenario??scenario,goal=values.objective??objective,scope=values.category??category;if(values.boss!==undefined)setBoss(target);if(values.scenario)setScenario(s);if(values.objective)setObjective(goal);if(values.category!==undefined)setCategory(scope);if(context&&!stale)calculate(context,target,s,goal,scope);else setRows({});};
 const block=!data?'Karakter yetenek verileri yükleniyor.':state.box.length<5?'Kutunda en az beş farklı Rumble karakteri gerekiyor.':'';
 const enemy=context?.enemies[boss];
 return <div className="planner-page assault-page">
  <section className="panel">
   <div className="row"><div><h3>Assault Rumble · kurala göre kadro</h3><p className="muted">MuMu’da Assault ana ekranını açık bırak. Rules ve sabit DETAILS pencereleri otomatik okunur.</p></div><Shield aria-hidden="true"/></div>
   <div className="actions"><button className="primary" disabled={busy||!!block} aria-busy={busy} onClick={()=>readAndBuild()}><Swords size={17}/>Kuralları oku ve kadro kur</button>{context&&<button className="secondary" disabled={busy||!!block} onClick={()=>readAndBuild(true)}><RefreshCw size={15}/>Boss ayrıntılarını yenile</button>}{busy&&<button className="secondary" onClick={()=>{stop();setProgress('Assault işlemi iptal edildi.');setStale(true);}}><X size={15}/>İptal</button>}</div>
   {block&&<p className="disabled-hint">{block}</p>}
   {(busy||progress)&&<p className="plan-progress" role="status">{progress}{busy?' · '+elapsed+' sn':''}</p>}
   {error&&<p className="error" role="alert">{error}</p>}
  </section>
  {context&&<>
   <section className="panel" data-assault-context>
    <div className="row"><strong>Assault {context.maxLevel?'MAX':'Lv.'+context.level} · {context.rules.length} kural maddesi</strong><span className="tag">{context.limits.cost} maliyet · 5 aktif + 3 yedek</span></div>
    <p className="muted">{new Date(context.observedAt).toLocaleString('tr-TR')} · {context.source}{context.cached?' · ayrıntılar aynı boss / seviyeden':''}</p>
    <p className="notice">Rules bonuslarıyla kadro adayı oluşturulur. Rakibin bütün kadrosu ve skor formülü tamamlanmadığından kesin galibiyet veya Assault Score hesaplanmaz.</p>
    {stale&&<p className="notice" data-assault-stale>Bu bağlam henüz yeniden doğrulanmadı. Güncel ekran için okuma düğmesini kullan.</p>}
    <div className="form-grid three"><label className="field">Boss<select aria-label="Assault bossu" value={boss} disabled={busy} onChange={e=>select({boss:e.target.value})}>{context.bosses.map(b=><option key={b}>{b}</option>)}</select></label><label className="field">Hedef<select aria-label="Assault hedefi" value={objective} disabled={busy} onChange={e=>select({objective:e.target.value as AssaultObjective})}><option value="progression">İlerleme · hasar ve sağkalım</option><option value="score">Yüksek skor · hasar ve kalan HP</option></select></label><label className="field">Takım türü<select aria-label="Assault takım türü" value={category} disabled={busy} onChange={e=>select({category:e.target.value})}><option value="">Karma · otomatik uyum</option>{[...TYPES,...CLASSES].map(v=><option key={v}>{v}</option>)}</select></label></div>
    <details><summary>Okunan Rules ve doğrulama kapsamı</summary><ul>{context.rules.filter(r=>r.boss===boss||r.boss==='all').map((r,i)=><li key={i}>{assaultRuleText(r)}</li>)}</ul><p>Son {context.lateSeconds} saniye: CT / hasar artışının miktarı belirtilmemiş.</p><p className="source-text">{context.text}</p>{context.warnings.map(w=><p className="muted" key={w}>{w}</p>)}</details>
    <details><summary>Bossun okunan ayrıntıları</summary>{enemy?<><p>{enemy.name} · Karakter Lv.{enemy.level??'?'} · Ability {enemy.abilityLevel??'?'} / Special {enemy.specialLevel??'?'}</p><p>INFO değerleri: HP {enemy.stats.hp?.toLocaleString('tr-TR')??'?'} · ATK {enemy.stats.atk??'?'} · DEF {enemy.stats.def??'?'} · SPD {enemy.stats.spd??'?'} · RCV {enemy.stats.rcv??'?'}</p><p>Sınıflar: {enemy.classes.join(' / ')||'Doğrulanmadı'} · Tip: {enemy.types.join(' / ')||'Doğrulanmadı'}</p>{Object.entries(enemy.details).map(([k,t])=><div key={k}><strong>{k}</strong><p className="source-text">{t}</p></div>)}</>:<p>Bu bossun INFO ayrıntısı okunmadı; kurallara göre adaylar gösterilebilir. MuMu’da ilgili boss seçiliyken yeniden oku.</p>}</details>
    <p className="muted">Trusty yalnız sahiplik bonusudur; kadroda bulunması gerekmez. Tam bonus çarpanı doğrulanmadan kesin skor gösterilmez.</p>
    <details data-assault-trusty><summary>Trusty sahiplik kontrolü · {context.trusty.entries.length} doğrulanan kart</summary>{context.trusty.entries.length>0&&<ul>{context.trusty.entries.map(e=><li key={e.id}>#{e.id} {characters.get(e.id)?.name||'Kart'} · sahiplik bonusu ×{e.multiplier} · {state.box.some(o=>o.id===e.id)?'Kutunda kayıtlı':'Kutunda kayıtlı değil'}</li>)}</ul>}{!context.trusty.complete&&<p>Listenin bütün kart / form eşleşmeleri doğrulanmadı; eksik eşleşmeden toplam bonus üretilmedi.</p>}</details>
    <div className="actions"><button className="secondary" disabled={busy||stale||!!block} onClick={()=>calculate(context,boss,scenario,objective,category,true)}>Üç bossu karşılaştır</button><button className="secondary" disabled={busy||stale||!!block} onClick={()=>calculate(context,boss,scenario,objective,category,false,true)}>Daha derin ara</button><button className="secondary" disabled={!Object.keys(rows).length||busy} onClick={()=>download('nakama-assault-kadrolari.json',JSON.stringify({context,scenario,objective,rows},null,2))}><Download size={15}/>Sonucu kaydet</button></div>
   </section>
   <TabBar prefix="assault" label="Assault geliştirme senaryosu" className="scenario-tabs" items={SCENARIO_TABS} value={scenario} onChange={s=>select({scenario:s as Scenario})}/>
   <div role="tabpanel" id={'assault-panel-'+scenario} aria-labelledby={'assault-tab-'+scenario}>
    {provisional&&<p className="notice" role="status">İlk aday hazır · alternatifler karşılaştırılıyor.</p>}
    {Object.values(rows).map(row=><section key={row.boss} data-assault-result={row.boss}><h3>{row.boss} · {row.boss===context.selectedBoss?context.maxLevel?'MAX':'Lv.'+context.level:'Seviye okunmadı'}</h3>{!row.teams.length&&<p className="notice">{row.diagnostic}</p>}{row.teams.map((team,i)=><details key={i} open={i===0} className={i?'alternatives':'assault-team'}><summary>{i?'Alternatif kadro '+i:'Önerilen Assault kadro adayı'}</summary>
     {team.assault&&<div className="notice assault-summary"><strong>{i?'Alternatif '+i:'Önerilen aday'} · {team.assault.ranking==='upper'?'Bonusların üst yorumuna göre':'Temkinli bonus yorumuna göre'}</strong><p>Doğrudan special döngü indeksi: {team.assault.pressure} – {team.assault.pressureHigh}. Bu değer HP hasarı veya Assault Score değildir.</p>{team.assault.stackingSensitive&&<p>Bonusların birleşimi belirsiz; iki yorum arasındaki aralık gösterilir.</p>}<details><summary>Bonus alan üyeler ve kullanım gerekçesi</summary><ul>{team.assault.ruleMatches.map(m=><li key={m.id}>#{m.id}: {m.clauses.join(' · ')||'Doğrudan etkinlik bonusu yok; ekip uyumu / destek katkısı değerlendirildi.'}</li>)}</ul>{team.assault.instructions.map(t=><p key={t}>{t}</p>)}</details></div>}
     {team.assault?.warnings.filter(w=>w.includes('karakterlerini özel hedefliyor:')).map(w=><p className="notice reading-warning" data-assault-threat key={w}>{w}</p>)}
     <TeamCard team={team} scenario={scenario} characters={characters} data={data!} kind="rumble" onEdit={onEdit}/>
    </details>)}</section>)}
   </div>
  </>}
  {!context&&<div className="panel plan-intro"><Shield/><h3>Üç boss, kendi kuralları.</h3><p>Shanks, Hancock ve Mihawk için kutundaki Rumble yetenekleri, CT desteği ve yedekler karşılaştırılır. İlk adım güncel oyun kurallarını okumaktır.</p></div>}
 </div>;
}
