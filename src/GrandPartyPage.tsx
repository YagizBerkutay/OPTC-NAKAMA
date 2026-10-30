import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Shield, Sparkles, X } from 'lucide-react';
import type { AppState, Catalog, Character } from './model';
import { SCENARIOS, TYPES, CLASSES, type PlannerData } from './planning';
import { NEUTRAL_SEASON, OCTOBER_GP_SEASON, gpConditionText, type GPGroup, type GPSeason } from './grand-party';
import { getData, Portrait, TeamCard, SourceLink } from './PlannerPage';
import { skillDescription } from './rumble-planner';
import { download } from './storage';
import { teamMaterials } from './evolution-materials';
import './planner.css';
import {TabBar,SCENARIO_TABS,friendlyError} from './ui';

export default function GrandPartyPage({state,catalog,onEdit}:{state:AppState;catalog:Catalog;onEdit:(character:Character)=>void}) {
  const [data,setData]=useState<PlannerData>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const [groups,setGroups]=useState<GPGroup[]>([]),[leaderId,setLeaderId]=useState(''),[limit,setLimit]=useState(300),[activeScenario,setActiveScenario]=useState('power'),[outcome,setOutcome]=useState('');
  const [season,setSeason]=useState<GPSeason>(()=>structuredClone(new Date().toISOString().startsWith('2026-10')?OCTOBER_GP_SEASON:NEUTRAL_SEASON)),[seasonOpen,setSeasonOpen]=useState(false),[scope,setScope]=useState('STR'),[attribute,setAttribute]=useState('ATK'),[level,setLevel]=useState(3),[duration,setDuration]=useState(100),[leaderScope,setLeaderScope]=useState(season.leaderTargets.join(', '));
  const [selected,setSelected]=useState<Record<string,number>>({});
  const worker=useRef<Worker|null>(null),run=useRef(0);
  const characters=useMemo(()=>new Map(catalog.characters.map(c=>[c.id,c])),[catalog]);
  useEffect(()=>{let live=true;void getData().then(d=>{if(live)setData(d);}).catch(e=>{if(live)setError(friendlyError(e));});return()=>{live=false;};},[]);
  useEffect(()=>{run.current++;worker.current?.terminate();worker.current=null;setBusy(false);setGroups([]);setOutcome('');},[state.box,leaderId,limit,season]);
  useEffect(()=>()=>{worker.current?.terminate();},[]);
  const leaders=state.box.filter(o=>data?.units[o.id]?.rumble?.gpability?.length||data?.units[o.id]?.rumbleForms?.some(f=>data.units[f.id]?.rumble?.gpability?.length)||data?.units[o.id]?.evolutions.some(e=>data.units[e.to]?.rumble?.gpability?.length));
  const start=()=> {
    if(!data)return;
    worker.current?.terminate();const id=++run.current,w=new Worker(new URL('./grand-party.worker.ts',import.meta.url),{type:'module'});
    worker.current=w;setBusy(true);setError('');setOutcome('');setGroups([]);setSelected({});setProgress('Kutun hazırlanıyor…');
    const finish=()=>{w.terminate();if(worker.current===w)worker.current=null;setBusy(false);};
    w.onmessage=event=>{if(id!==run.current)return;const message=event.data;if(message.progress)setProgress(message.progress);if(message.partial)setGroups(message.partial);if(message.groups){setGroups(message.groups);setOutcome('Grand Party hesabı tamamlandı. Üç geliştirme seçeneği hazır.');finish();}if(message.error){setError(message.error);finish();}};
    w.onerror=event=>{if(id===run.current){setError(event.message||'Grand Party hesabı tamamlanamadı.');finish();}};
    w.postMessage({box:state.box,characters:catalog.characters,data,leaderId:leaderId||undefined,costLimit:limit,season});
  };
  return <div className="planner-page grand-party-page">
    <section className="panel"><div className="plan-intro"><Shield/><strong>Üç kadro. Bir GP lideri.</strong><p>Mevcut hâl, Lv.100 evrimsiz ve Lv.100 evrimli seçeneklerde karakterleri üç takıma birlikte dağıtır; GP leader skill, ortak Burst hakkı ve 5 aktif + en fazla 3 yedeği karşılaştırır. İki güçlü kadroyu ve işe yarayan üçüncü kadroyu birlikte hedefler.</p></div>
      <div className="form-grid"><label>GP lideri<select aria-label="GP lideri" value={leaderId} onChange={e=>setLeaderId(e.target.value)}><option value="">Kutumdan otomatik seç</option>{leaders.map(o=><option key={o.id} value={o.id}>#{o.id} {characters.get(o.id)?.name}</option>)}</select></label><label>Kadro başına maliyet sınırı<input aria-label="Grand Party maliyet sınırı" type="number" min={1} max={300} value={limit} onChange={e=>setLimit(Math.max(1,Math.min(300,Number(e.target.value)||1)))}/></label></div>
      <div className="notice">Etkinlik bonusu: {season.effects.length||season.leaderTargets.length?season.name:'Güncel kurallar doğrulanmadı; normal yeteneklerle hesaplanacak.'}</div>
      <p className="muted">{season.note}</p><button className="secondary" aria-expanded={seasonOpen} aria-controls="gp-season-settings" onClick={()=>setSeasonOpen(v=>!v)}>{seasonOpen?'Etkinlik ayarlarını kapat':'Etkinlik bonuslarını ekle'}</button>
      {seasonOpen&&<div className="gp-season" id="gp-season-settings"><p className="muted">Oyunun Grand Party Rules ekranındaki değerleri ekle. Hedef seçenekleri birleştirildiğinde herhangi biriyle eşleşmesi yeterlidir. Varsayılan olarak etkinlik bonusu uygulanmaz.</p>
        <label>Etkinlik adı<input aria-label="GP etkinlik adı" value={season.name} maxLength={120} onChange={e=>setSeason(s=>({...s,name:e.target.value}))}/></label>
        <div className="form-grid"><label>Buff hedefi<select aria-label="GP buff hedefi" value={scope} onChange={e=>setScope(e.target.value)}>{['crew',...TYPES,...CLASSES].map(v=><option key={v} value={v}>{v==='crew'?'Tüm kadro':v}</option>)}</select></label><label>Güçlenen özellik<select value={attribute} onChange={e=>setAttribute(e.target.value)}>{['ATK','HP','DEF','SPD','RCV','Special CT','Guard','Accuracy','Shield','CRIT'].map(v=><option key={v}>{v}</option>)}</select></label><label>Buff seviyesi<input type="number" min={-20} max={20} value={level} onChange={e=>setLevel(Math.max(-20,Math.min(20,Number(e.target.value))))}/></label><label>Geçerli süre (saniye)<input type="number" min={1} max={100} value={duration} onChange={e=>setDuration(Math.max(1,Math.min(100,Number(e.target.value))))}/></label></div>
        <button className="secondary" disabled={!level||season.effects.length>=20} onClick={()=>setSeason(s=>({...s,effects:[...s.effects,{effect:level>0?'buff':'penalty',level:Math.abs(level),attributes:[attribute],duration,targeting:{targets:[scope]}}]}))}>Buff / debuff ekle</button>
        {season.effects.map((e,i)=><div className="gp-rule" key={i}><span>{skillDescription(e)}</span><button className="icon" aria-label={`Etkinlik etkisi ${i+1} sil`} onClick={()=>setSeason(s=>({...s,effects:s.effects.filter((_,n)=>n!==i)}))}><X size={15}/></button></div>)}
        <label className="check"><input type="checkbox" checked={season.effectsRequireLeader||false} onChange={e=>setSeason(s=>({...s,effectsRequireLeader:e.target.checked}))}/>Kadro buffları için de lider etiketi koşulu aransın</label><label>Lider etiket eşleşmesi<select value={season.leaderMatch||'any'} onChange={e=>setSeason(s=>({...s,leaderMatch:e.target.value as 'any'|'all'}))}><option value="any">Etiketlerden en az biri</option><option value="all">Etiketlerin tümü</option></select></label><div className="form-grid"><label>Bonus alacak liderin tipi / sınıfı / etiketi<input aria-label="Bonus lider hedefleri" value={leaderScope} placeholder="Fighter, Straw Hat Pirates" onChange={e=>{setLeaderScope(e.target.value);setSeason(s=>({...s,leaderTargets:e.target.value.split(',').map(v=>v.trim()).filter(Boolean).slice(0,20)}));}}/></label><label>Ek Burst kullanım hakkı<input aria-label="Ek GP Burst hakkı" type="number" min={-2} max={5} value={season.extraUses} onChange={e=>setSeason(s=>({...s,extraUses:Math.max(-2,Math.min(5,Number(e.target.value)))}))}/></label><label>GP barı dolma hız çarpanı<input type="number" min={.1} max={3} step={.1} value={season.chargeMultiplier} onChange={e=>setSeason(s=>({...s,chargeMultiplier:Math.max(.1,Math.min(3,Number(e.target.value)||1))}))}/></label></div>
        <div className="actions"><button className="secondary" onClick={()=>{setSeason(structuredClone(NEUTRAL_SEASON));setLeaderScope('');}}>Etkinlik bonuslarını sıfırla</button><button className="secondary" onClick={()=>{setSeason(structuredClone(OCTOBER_GP_SEASON));setLeaderScope(OCTOBER_GP_SEASON.leaderTargets.join(', '));}}>6 Ekim boostunu yükle</button></div>
      </div>}
      <div className="actions gp-actions"><button className="primary" aria-busy={busy} aria-describedby="gp-requirements" disabled={!data||busy||state.box.length<3} onClick={start}><Sparkles size={17}/>Grand Party kadrolarını kur</button>{busy&&<button className="secondary" onClick={()=>{run.current++;worker.current?.terminate();worker.current=null;setBusy(false);setOutcome('Grand Party hesabı durduruldu; tamamlanan seçenekler korunur.');}}>Durdur</button>}</div>
      <p id="gp-requirements" className="disabled-hint">{!data?'Yetenek verileri yükleniyor.':state.box.length<3?'Üç kadro oluşturmak için kutuna en az 3 karakter ekle.':''}</p>{outcome&&<div className="completion-status" role="status">{outcome}</div>}
      {busy&&<p className="plan-progress" role="status">{progress}</p>}{error&&<div className="error" role="alert">{error}</div>}
    </section>
    {groups.length>0&&<TabBar prefix="gp" className="scenario-tabs" label="Grand Party geliştirme senaryosu" items={SCENARIO_TABS} value={activeScenario} onChange={setActiveScenario}/> }
    {groups.length>0&&SCENARIO_TABS.filter(t=>!groups.some(g=>g.scenario===t.id)).map(t=><div role="tabpanel" id={'gp-panel-'+t.id} aria-labelledby={'gp-tab-'+t.id} hidden={activeScenario!==t.id} key={t.id} className="panel plan-empty">{t.label} için hesaplama sürüyor…</div>)}
    {data&&groups.map(group=>{
      const plan=group.plans[selected[group.scenario]||0];
      return <section className="scenario-section" data-gp-scenario={group.scenario} role="tabpanel" id={'gp-panel-'+group.scenario} aria-labelledby={'gp-tab-'+group.scenario} hidden={activeScenario!==group.scenario} key={group.scenario}><div className="scenario-heading"><span>GP</span><div><h2>{SCENARIOS.find(s=>s.id===group.scenario)?.name}</h2><p>{group.leadersChecked} GP lider formu incelendi · kutun değiştirilmez</p></div></div>
        {!plan?<div className="panel plan-empty">{group.diagnostic}</div>:<>
          {group.plans.length>1&&<label className="gp-alternatives">Lider ve üçlü kadro alternatifi<select aria-label={`${group.scenario} GP alternatifi`} value={selected[group.scenario]||0} onChange={e=>setSelected(v=>({...v,[group.scenario]:Number(e.target.value)}))}>{group.plans.map((p,i)=><option key={i} value={i}>{i===0?'Önerilen':'Alternatif '+i} · #{p.leader.member.character.id} {p.leader.member.character.name} · {Math.round(p.score)} uyum</option>)}</select></label>}
          <article className="panel gp-leader"><div className="gp-leader-heading"><button className="icon" aria-label="GP liderinin karakter detayını aç" onClick={()=>onEdit(characters.get(plan.leader.member.sourceId)||plan.leader.member.character)}><Portrait character={plan.leader.member.character}/></button><div><small className="eyebrow">ÖNERİLEN GP LİDERİ</small><h3>#{plan.leader.member.character.id} {plan.leader.member.character.name}</h3><p>GP ability Lv.{plan.leader.abilityLevel} · Burst Lv.{plan.leader.burstLevel} · {plan.leader.uses} ortak kullanım</p><p>{plan.leader.member.path.length?'Hedef evrim: #'+plan.leader.member.sourceId+' → #'+plan.leader.member.character.id:'Kutundaki mevcut form'}{plan.leader.seasonal?' · Etkinlik lider bonusu karşılandı':''}</p></div></div>
            <div className="gp-coverage">{plan.teams.map((t,i)=><span className="tag" key={i}>Kadro {i+1}: {plan.coverage[i]}/{t.members.length} aktif üyeye lider buffı</span>)}</div>
            <details open><summary>GP Burst ne zaman kullanılmalı?</summary><ol>{plan.burstPlan.map((v,i)=><li key={i}>{v}</li>)}</ol></details>
            <details><summary>Lider yeteneği, Burst ve seçim gerekçesi</summary><h4>GP leader skill</h4><p className="source-text">{(plan.leader.ability.effects||[]).map(skillDescription).join('\n')}</p><h4>GP Burst</h4><p className="source-text">{(plan.leader.burst.effects||[]).map(skillDescription).join('\n')}</p><p>Koşul: {gpConditionText(plan.leader.condition)}</p><ul>{plan.warnings.map((v,i)=><li key={i}>{v}</li>)}</ul></details>
          </article>
          {plan.teams.map((team,i)=><div className="gp-crew-section" key={i}><h3>Kadro {i+1}{i===plan.teams.map(t=>t.score).indexOf(Math.max(...plan.teams.map(t=>t.score)))?' · En yüksek uyum':''}</h3><TeamCard team={team} scenario={group.scenario} characters={characters} data={data} kind="rumble" onEdit={onEdit}/></div>)}
          <div className="actions plan-export"><button className="secondary" onClick={()=>download(`nakama-grand-party-${group.scenario}.json`,JSON.stringify({scenario:group.scenario,season,plan,evolutionMaterials:plan.teams.map(team=>teamMaterials(team,characters,data))},null,2))}><Download size={16}/>Bu Grand Party planını kaydet</button></div>
        </>}
      </section>;
    })}
    {data&&<p className="plan-source">Yetenek kaynağı: <SourceLink url={data.metadata.url}/>. Veri güncellemesi: {data.metadata.sha.slice(0,8)}. <SourceLink url="https://optc-ww.channel.or.jp/news/1736/">Resmî GP yetenek örneği</SourceLink></p>}
  </div>;
}
