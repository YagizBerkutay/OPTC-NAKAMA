import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,Swords,X} from 'lucide-react';
import type {AppState,Catalog,Character} from './model';
import {CLASSES,TYPES,type PlannerData,type Scenario} from './planning';
import {getData,TeamCard} from './PlannerPage';
import {validatePkaRumble,type PkaRumbleContext,type PkaRumbleResult} from './pka-rumble';
import {TabBar,SCENARIO_TABS,friendlyError} from './ui';
import {download} from './storage';
type Saved={context?:PkaRumbleContext;result?:PkaRumbleResult;scenario:Scenario;category:string;device:string;box:string;stale:boolean};
let saved:Saved|undefined;
export default function PkaRumblePage({state,catalog,onEdit,onBusy}:{state:AppState;catalog:Catalog;onEdit:(c:Character)=>void;onBusy:(busy:boolean)=>void}){
 const device=state.settings.adbPath+'|'+state.settings.device,box=JSON.stringify(state.box),initial=saved?.device===device?saved:undefined;
 const [data,setData]=useState<PlannerData>(),[context,setContext]=useState(initial?.context),[result,setResult]=useState(initial?.box===box?initial.result:undefined),[scenario,setScenario]=useState<Scenario>(initial?.scenario||'power'),[category,setCategory]=useState(initial?.category||''),[stale,setStale]=useState(initial?.stale??false);
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[elapsed,setElapsed]=useState(0),[provisional,setProvisional]=useState(false);
 const generation=useRef(0),reading=useRef(false),worker=useRef<Worker|null>(null),previous=useRef({device,box}),memory=useRef<Saved>({scenario,category,device,box,stale}),cache=useRef(new Map<string,PkaRumbleResult>());
 memory.current={context,result,scenario,category,device,box,stale:stale||busy};
 const characters=useMemo(()=>new Map(catalog.characters.map(c=>[c.id,c])),[catalog]);
 const stop=()=>{generation.current++;worker.current?.terminate();worker.current=null;if(reading.current)void window.nakama?.cancelPkaRumble();reading.current=false;setBusy(false);setProvisional(false);};
 useEffect(()=>{onBusy(busy);},[busy,onBusy]);
 useEffect(()=>{let mounted=true;getData().then(d=>{if(mounted)setData(d);}).catch(e=>{if(mounted)setError(friendlyError(e));});return()=>{mounted=false;saved=memory.current;generation.current++;worker.current?.terminate();if(reading.current)void window.nakama?.cancelPkaRumble();};},[]);
 useEffect(()=>window.nakama?.onPkaRumbleProgress(text=>{if(reading.current)setProgress(text);}),[]);
 useEffect(()=>{if(!busy)return;const start=performance.now(),timer=setInterval(()=>setElapsed(Math.floor((performance.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
 useEffect(()=>{if(previous.current.device===device&&previous.current.box===box)return;const changedDevice=previous.current.device!==device;previous.current={device,box};stop();cache.current.clear();setResult(undefined);if(changedDevice){setContext(undefined);setStale(true);}},[device,box]);
 const calculate=(ctx:PkaRumbleContext,s=scenario,c=category,deep=false,token=++generation.current)=>{
  if(!data)return;worker.current?.terminate();setBusy(true);setElapsed(0);setError('');setStale(false);setProvisional(false);setProgress('Kutundaki Rumble karakterleri karşılaştırılıyor…');
  const key=JSON.stringify([ctx.fingerprint,box,data.metadata.sha,s,c,deep]),remembered=cache.current.get(key);if(remembered){setResult(remembered);setBusy(false);setProgress('Aynı rakip ve kutu · kayıtlı hesap kullanıldı.');return;}
  setResult(undefined);const task=new Worker(new URL('./pka-rumble.worker.ts',import.meta.url),{type:'module'});worker.current=task;
  task.onmessage=event=>{if(token!==generation.current)return;const message=event.data;if(message.progress){setProgress(message.progress);return;}if(message.preview){setResult(message.preview);setProvisional(true);return;}if(message.result){setResult(message.result);cache.current.set(key,message.result);setProgress('Rakibe göre karşılaştırma tamamlandı · '+(message.result.elapsedMs/1000).toFixed(1)+' sn.');setProvisional(false);}if(message.error){setError(friendlyError(message.error));setStale(true);}setBusy(false);task.terminate();worker.current=null;};
  task.onerror=e=>{if(token!==generation.current)return;setError(e.message||'PKA Rumble hesaplanamadı.');setBusy(false);setStale(true);task.terminate();worker.current=null;};
  task.postMessage({context:ctx,box:state.box,characters:catalog.characters,data,scenario:s,category:c,deep});
 };
 const read=async(refresh=false)=>{
  if(!data)return;stop();const token=++generation.current;setBusy(true);setElapsed(0);setError('');setStale(true);reading.current=true;
  try{if(!window.nakama)throw Error('Ekran okuma masaüstü uygulamasında çalışır.');if(!state.settings.device)throw Error('MuMu bağlantısından cihazını seç.');await window.nakama.connect(state.settings.adbPath,state.settings.device);if(token!==generation.current)return;
   const ctx=validatePkaRumble(await window.nakama.pkaRumbleRead({exe:state.settings.adbPath,device:state.settings.device,refresh}));if(token!==generation.current)return;setContext(ctx);reading.current=false;calculate(ctx,scenario,category,false,token);
  }catch(e){if(token===generation.current){setError(friendlyError(e));setBusy(false);}}finally{if(token===generation.current)reading.current=false;}
 };
 const select=(s:Scenario,c:string)=>{stop();setScenario(s);setCategory(c);if(context&&!stale)calculate(context,s,c);else setResult(undefined);};
 const block=!data?'Karakter yetenekleri yükleniyor.':state.box.length<5?'Kutunda en az beş farklı Rumble karakteri gerekli.':'';
 return <div className="planner-page pka-rumble-page">
  <section className="panel"><h3>PKA Rumble · rakibe göre kadro</h3><p className="muted">PKA içindeki Confirm Opponent ekranını açık bırak. Uygulama rakiplerin bilgi pencerelerini ve BONUS panelini açıp okuyarak takım kurar.</p>
   <div className="actions"><button className="primary" disabled={busy||!!block} aria-busy={busy} onClick={()=>read()}><Swords size={17}/>Rakibi oku ve kadro kur</button>{context&&<button className="secondary" disabled={busy||!!block} onClick={()=>read(true)}>Ayrıntıları yeniden oku</button>}{busy&&<button className="secondary" onClick={()=>{stop();setStale(true);setProgress('İşlem iptal edildi.');}}><X size={16}/>İptal</button>}</div>
   {block&&<p className="disabled-hint">{block}</p>}{(busy||progress)&&<p className="plan-progress" role="status">{progress}{busy?' · '+elapsed+' sn':''}</p>}{error&&<p className="error" role="alert">{error}</p>}
  </section>
  {context&&<><section className="panel" data-pka-rumble-context><div className="row"><strong>{context.opponent}</strong><span className="tag">{context.enemies.filter(e=>e.slot<5).length} aktif + {context.enemies.filter(e=>e.slot>=5).length} yedek rakip</span></div>
   <p>Buddy tip bonusları: {TYPES.map(t=>t+' +%'+context.bonus[t]).join(' · ')}</p><p className="muted">{new Date(context.observedAt).toLocaleString('tr-TR')} · {context.source}</p>
   <p className="notice">Standart Rumble Rules uygulanmaz. Buddy yüzdelerinin kesin istatistik kapsamı eksik: temkinli aday ve bonus kapsamına duyarlı alternatif karşılaştırılır.</p>
   {stale&&<p className="notice" data-pka-rumble-stale>Önceki okuma gösteriliyor; güncel rakip için yeniden oku.</p>}
   <details><summary>Okunan rakip kadrosu ve yetenekler</summary>{context.enemies.map(e=><div key={e.slot}><h4>{e.slot<5?'Aktif':'Yedek'} {e.slot<5?e.slot+1:e.slot-4} · {e.name}</h4><p>{e.types.join(' / ')} · {e.classes.join(' / ')} · Lv.{e.level??'?'} · Ability {e.abilityLevel??'?'} / Special {e.specialLevel??'?'}</p><p>{Object.entries(e.stats).map(([k,n])=>k.toUpperCase()+' '+n).join(' · ')}</p>{Object.entries(e.details).map(([k,t])=><p className="source-text" key={k}><strong>{k}</strong><br/>{t}</p>)}</div>)}{context.warnings.map(w=><p className="muted" key={w}>{w}</p>)}</details>
   <label className="field">Takım türü<select aria-label="PKA Rumble takım türü" value={category} disabled={busy} onChange={e=>select(scenario,e.target.value)}><option value="">Karma · otomatik uyum</option>{[...TYPES,...CLASSES].map(t=><option key={t}>{t}</option>)}</select></label>
   <div className="actions"><button className="secondary" disabled={busy||stale||!!block} onClick={()=>calculate(context,scenario,category,true)}>Daha derin ara</button><button className="secondary" disabled={!result||busy} onClick={()=>download('nakama-pka-rumble.json',JSON.stringify({context,scenario,result},null,2))}><Download size={16}/>Sonucu kaydet</button></div>
  </section><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}><TabBar prefix="pka-rumble-scenario" label="PKA Rumble geliştirme senaryosu" items={SCENARIO_TABS} value={scenario} onChange={s=>select(s as Scenario,category)}/></fieldset>
  <div role="tabpanel" id={'pka-rumble-scenario-panel-'+scenario} aria-labelledby={'pka-rumble-scenario-tab-'+scenario}>{provisional&&<p className="notice" role="status">İlk aday · alternatifler karşılaştırılıyor.</p>}{result&&!result.teams.length&&<p className="notice">{result.diagnostic}</p>}{data&&result?.teams.map((team,i)=><details key={i} open={i===0} className={i?'alternatives':'pka-rumble-team'} data-pka-rumble-result><summary>{i?'Alternatif kadro '+i:'Önerilen PKA Rumble adayı'}</summary><TeamCard team={team} scenario={scenario} characters={characters} data={data!} kind="rumble" onEdit={onEdit}/></details>)}</div></>}
 </div>;
}
