import { memo,useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Shield, Sparkles, Swords, X } from 'lucide-react';
import type { AppState, Catalog, Character, Owned } from './model';
import { MECHANICS } from './model';
import { CLASSES, TYPES, type PlanGroup, type PlanMember, type PlannerData, type PlanTeam,type Scenario } from './planning';
import { BOSS_LIBRARY, type Encounter } from './boss-library';
import { teamMaterials } from './evolution-materials';
import { download } from './storage';
import BossSource from './BossSource';
import {TabBar,SCENARIO_TABS,friendlyError} from './ui';
import './planner.css';
import {ruleDescription,type RumbleRules} from './rumble-rules';
import {crewCostProblem} from './crew-cost';
import {questRestrictionProblem,questPlanningWarning} from './quest-restrictions';

let cached: Promise<PlannerData> | undefined;
export function getData() {
  return cached ??= fetch('./data/planner.json').then(async response => { if (!response.ok) throw Error('Takım / evrim verileri yüklenemedi.'); return response.json(); }).catch(error => { cached = undefined; throw error; });
}
export function SourceLink({ url, children = 'Kaynağı aç' }: { url: string; children?: string }) {
  return <button className="source-link" onClick={() => { if (window.nakama?.openExternal) void window.nakama.openExternal(url); else window.open(url, '_blank', 'noopener,noreferrer'); }}><ExternalLink size={13} />{children}</button>;
}
export function Portrait({ character }: { character: Character }) {
  const [attempt, setAttempt] = useState(0);
  return <div className={`avatar ${character.types[0]}`}>
    {attempt < 2 ? <img src={`./portraits/${character.id.includes('.')?character.id.split('.')[0].padStart(4,'0')+'-'+character.id.split('.')[1]:character.id.padStart(4, '0')}${attempt ? character.id.includes('.')?'':'-1' : ''}.webp`} alt={character.name} loading="lazy" onError={() => setAttempt(x => x + 1)} /> : <span>#{character.id}</span>}
    <small>#{character.id}</small>
  </div>;
}
export const TeamCard=memo(function TeamCard({ team, scenario, characters, data, kind, onEdit }: { team: PlanTeam; scenario: string; characters: Map<string, Character>; data: PlannerData; kind: string; onEdit: (c: Character) => void }) {
  const incomplete=!!team.missing?.length||kind==='boss'&&team.combat?.status==='blocked';
  const roster = [...team.members,...team.reserves || [],...team.synergy?.supports.map(s=>s.member)||[]];
  const evolved = roster.filter(m => !m.friend && m.path.length);
  const materials = teamMaterials(team, characters, data);
  return <article className="panel plan-result" data-plan-status={kind==='boss'?(incomplete?'incomplete':'mechanics-covered'):undefined}>
    <div className="row"><h3>{kind === 'rumble' ? 'Rumble kadrosu' : incomplete?'Eksik taslak · savaşa hazır değil':'Önerilen kadro'}</h3><span className="tag">{Math.round(team.score)} uyum puanı{team.cost !== undefined ? ` · ${team.cost} maliyet` : ''}</span></div>
    {team.costBreakdown&&<p className="notice" data-crew-cost>Cost: {team.cost}{team.costLimit!==undefined?' / '+team.costLimit:''} · Kendi karakterlerin {team.costBreakdown.active} + Support {team.costBreakdown.support}. Arkadaş kaptan hariç.</p>}
    {team.benchmark&&<div className="notice" data-benchmark><strong>Ortak hedefte normal saldırı: {team.benchmark.low.toLocaleString('tr-TR')} – {team.benchmark.high.toLocaleString('tr-TR')}</strong><p>DEF 0, gelen hasar 0, Tur {team.benchmark.turn}. Orb / rakip tipi belirsizliği aralığa dahildir. Boss seçilince gerçek savunmalar ve hayatta kalma ayrıca değerlendirilir.</p><details><summary>Bu hasar için planlanan special’lar</summary><ul>{team.benchmark.used.map((s,i)=><li key={i}>{s}</li>)}</ul></details></div>}
    {team.missing && <div className={incomplete ? 'error' : 'notice'} data-mechanic-summary>{team.missing.length ? `Eksik: ${team.missing.join(' · ')}` : team.combat?.status==='blocked'?'Mekanik azaltma planı var; kalan savunma / hasar / ölüm riski nedeniyle güvenli bir savaş çözümü bulunamadı.':team.combat?.status==='unverified'?'Desteklenen mekanikler için kullanım planı var; tek turda geçiş ve hayatta kalma henüz doğrulanamadı.':'Planlanan turlarda desteklenen mekaniklere çözüm bulundu. Ek boss koşulları ayrıca kontrol edilmeli.'}{incomplete&&<p>Eksik özellikleri karşılayan karakterlerini ve kayıtlı special / geliştirme seviyelerini kontrol et; bu taslak güvenli geçiş önerisi değildir.</p>}</div>}
    {scenario==='current'&&team.warnings.some(w=>w.startsWith('Seviye bilinmiyor:'))&&<div className="notice" data-current-level-warning>Bu kadroda seviyesi bilinmeyen karakterler var; Lv.1 varsayımı kullanıldı. Gerçek mevcut gücün doğrulanamaz. Seviyeleri kaydet veya Lv.100 hedefi sekmelerini karşılaştır.</div>}
    {team.warnings.filter(w=>w.startsWith('Harita etkisi:')).map(w=><div className="notice reading-warning" data-team-map-warning key={w}>{w}</div>)}
    {team.warnings.filter(w=>/^(?:Neo )?Ambush:/.test(w)).map(w=><div className="notice reading-warning" data-team-ambush-warning key={w}>{w}</div>)}
    <div className={`plan-crew ${kind === 'rumble' ? 'five' : ''}`}>{team.members.map((m, i) => <button className="plan-slot" key={`${m.sourceId}-${m.character.id}-${i}`} onClick={() => onEdit(characters.get(m.sourceId) || m.character)} title={`${m.character.name} · #${m.character.id} · karakter detayını aç`}>
      <span className="slot">{kind === 'coop'?i===0?'NORMAL KAPTAN':i===1?'CO-OP KAPTANI':`ÜYE ${i-1}`:kind === 'rumble' ? `ÜYE ${i + 1}` : m.friend ? 'ARKADAŞ ÖNERİSİ' : i === 0 ? 'KAPTAN' : `ÜYE ${i - 1}`}</span>
      {kind==='boss'&&<small className="crew-position">{i<2?'Üst sıra':i<4?'Orta sıra':'Alt sıra'} · {i%2===0?'sol':'sağ'}</small>}
      <Portrait character={m.character} /><strong>{m.character.name}</strong>
      <span className={`type ${m.character.types[0]}`}>{m.character.types.join(' / ')||'DUAL · tipsiz'}</span>
      <small>{m.character.classes.join(' · ')}</small><small>{kind==='coop'&&i===1?`Co-Op Ability ${m.owned.coop?.captainLevel??'?'} / Special ${m.owned.coop?.specialLevel??'?'}`:`${m.estimatedLevel}. seviye${kind === 'rumble' ? ` · A${m.abilityLevel} / S${m.specialLevel}` : ''}`}</small>
      {kind!=='rumble'&&m.notes.some(n=>n.startsWith('Special formu:'))&&<small className="crew-position">{m.notes.find(n=>n.startsWith('Special formu:'))}</small>}
      {m.path.length > 0 && <span className="evolution-label">{m.character.stars.includes('+') ? 'SUPER EVOLUTION' : 'EVRİM'} · #{m.sourceId} → #{m.character.id}</span>}
    </button>)}</div>
    {kind === 'rumble' && <div className="rumble-reserves"><h4>Yedekler · {team.reserves?.length || 0} / 3</h4><div className="plan-crew reserves">{team.reserves?.map((m,i)=><button className="plan-slot" key={m.sourceId} onClick={()=>onEdit(characters.get(m.sourceId)||m.character)}><span className="slot">YEDEK {i+1}</span><Portrait character={m.character}/><strong>{m.character.name}</strong><span className={`type ${m.character.types[0]}`}>{m.character.types.join(' / ')||'DUAL · tipsiz'}</span><small>{m.character.classes.join(' · ')}</small><small>A{m.abilityLevel} / S{m.specialLevel} · maliyet {data.units[m.character.id]?.rumble?.cost}</small></button>)}</div>{!team.reserves?.length&&<p className="muted">{team.provisional?'Yedekler ve alternatifler karşılaştırılıyor.':'Bu maliyet sınırında uygun yedek eklenemedi.'}</p>}</div>}
    {team.synergy && <div className="pve-synergy">
      <h4>Captain, crewmate ve geliştirme katkıları</h4>
      <p>Captain pasif hasar azaltma: %{team.synergy.damageReduction} · faydalı orb kapsamı: {team.synergy.orbCoverage} / {team.members.length}</p>
      <p>Crewmate base katkısı: ATK +{Math.round(team.synergy.passiveAttack)} · HP +{Math.round(team.synergy.passiveHP)} · RCV +{Math.round(team.synergy.passiveRCV)}{team.synergy.chain>0?' · Chain etkisi de değerlendirildi.':''}</p>
      <details><summary>Bu önerinin geliştirme varsayımları</summary>{team.synergy.development.map(text=><p className="muted" key={text}>{text}</p>)}</details>
      {team.synergy.supports.length>0&&<details className="support-plans"><summary>Takılacak Support karakterleri · {team.synergy.supports.length}</summary>{team.synergy.supports.map(s=><div className="support-plan" data-target-scope={s.targetScope} key={s.targetId}><button className="support-portrait" onClick={()=>onEdit(characters.get(s.member.sourceId)||s.member.character)}><Portrait character={s.member.character}/></button><div><strong>#{s.member.character.id} {s.member.character.name}</strong><p>→ #{s.targetId} {team.members.find(m=>m.character.id===s.targetId)?.character.name} · Support Lv.{s.level}</p><p className="muted">Takılabildiği karakterler: {s.targetScope}</p><small>ATK +{Math.round(s.attack)} · HP +{Math.round(s.health)} · RCV +{Math.round(s.recovery)}{s.effects.length?' · boss tetiği aşama planında kullanılır':''}</small><details><summary>Support etkisi ve geliştirmesi</summary><p className="source-text">{s.text}</p><p className="muted">{s.member.path.length?'Bu destek formuna evrim gerekiyor; malzemeleri aşağıda.':'Kutundaki form kullanılır.'} Support skill-up için kopya / uygun destek materyali gerekebilir.</p></details></div></div>)}</details>}
      {!team.synergy.supports.length&&<p className="muted">Bu hâlde kayıtlı seviyeler ve mevcut kaynaklarla puanlanabilen uygun Support bulunamadı. Maksimum öneriler Support Lv.5 hedefini ayrıca karşılaştırır.</p>}
      {team.synergy.conditional.length>0&&<details><summary>İleri yeteneklerin kullanım koşulları</summary><ul>{team.synergy.conditional.map(text=><li key={text}>{text}</li>)}</ul><p className="muted">Koşula bağlı fırsat katkısı sıralamada kullanılır; orb, sıra, HP ve tetik sağlanmadan garanti hasar veya boss çözümü sayılmaz.</p></details>}
    </div>}
    {team.offense && <div className="rumble-offense" data-offense-risk={team.offense.risk}>
      <div className="row"><h4>Special hasarı ve döngüsü</h4><span className="tag">Hücumda süre riski: {team.offense.risk==='high'?'yüksek':team.offense.risk==='elevated'?'orta':'daha düşük'}</span></div>
      <p>{team.offense.directSources} / {team.members.length} doğrudan hasar kaynağı · {team.offense.areaSources} alan / çoklu hedef · {team.offense.cutSources} HP kesme · {team.offense.dotSources} DoT</p>
      <ul>{team.offense.members.map(m=><li key={m.id}><strong>#{m.id} {m.name}</strong> · temel CT {m.cooldown??'?'} · {m.direct>0?'Doğrudan hasar':m.cut||m.dot?[m.cut?'HP kesme':'',m.dot?'DoT':''].filter(Boolean).join(' + '):'Destek / kontrol'}{m.direct>0&&(m.cut||m.dot)?` + ${[m.cut?'HP kesme':'',m.dot?'DoT':''].filter(Boolean).join(' + ')}`:''}{m.uncertain>0?` · ${m.uncertain} hasar etkisi koşul / rakip nedeniyle belirsiz`:''}</li>)}</ul>
      {team.offense.risk!=='lower'&&<p className="offense-warning">{team.offense.risk==='high'?'Hasar döngüsü zayıf; güçlü bufflarla bile süre dolabilir.':'Hasar tek üyeye bağımlı veya düşük; rakip dayanıklıysa süre dolabilir.'}</p>}
      <p className="muted">Başlangıç kadrosu değerlendirilir; yedekler sahaya girince ayrıca puanlanır. Temel CT, special sıklığının karşılaştırılması içindir. Rakip, pozisyon ve savaş içi tetikler bilinmediğinden bu değerlendirme kazanma garantisi veya kesin hasar hesabı değildir.</p>
    </div>}
    {team.skillAudit && <details className="skill-audit"><summary>Yetenek denetimi · {team.skillAudit.length} kayıt</summary>{team.skillAudit.map((a,i)=><details key={i}><summary>#{a.id} · {a.name}</summary><strong>{a.status}</strong><p className="muted">{a.condition}</p><p className="source-text">{a.text}</p></details>)}</details>}
    <p className="plan-reasons">{team.reasons[0]}</p>
    {team.combat&&<section className="boss-combat" data-combat-status={team.combat.status}>
      <div className="row"><h4>Hasar, savunma ve hayatta kalma</h4><span className="tag">{team.combat.status==='blocked'?'Riskli kadro':team.combat.status==='unverified'?'Eksik savaş verisi':'Koşullu hasar tahmini'}</span></div>
      <p>Maksimum HP: <strong>{team.combat.maxHP.toLocaleString('tr-TR')}</strong> · Kaptan etkilerinden sonra başlangıç HP: <strong>{team.combat.initialHP.toLocaleString('tr-TR')}</strong>. Düşman HP / ATK bilinmiyorsa tek turda geçiş doğrulanmaz.</p>
      {team.combat.startEffects.map((text,i)=><p className="notice" key={i}>{text}</p>)}
      {team.combat.windows.map((w,i)=><details key={i} className="combat-window" data-combat-window={w.status} open={w.status==='blocked'||w.incoming>0||!!w.counterplay?.length}><summary>{w.stage} · {w.status==='blocked'?'Çözülmemiş risk':w.status==='unverified'?'Kontrol gerekli':'Hasar tahmini'}</summary>
        <p>Normal saldırı tahmini: <strong>{w.damageLow.toLocaleString('tr-TR')} – {w.damageHigh.toLocaleString('tr-TR')}</strong> · Düşman HP: {w.enemyHP?.toLocaleString('tr-TR')||'Okunmadı'}</p>
        {(!!w.specialDamage||!!w.endDamage)&&<p data-special-damage>Special hasarı: <strong>{w.specialDamage?.toLocaleString('tr-TR')||'0'}</strong> · Tur sonu bitirme hasarı: <strong>{w.endDamage?.toLocaleString('tr-TR')||'0'}</strong>{w.enemyRemainingHP!==undefined?' · Kalan düşman HP üst sınırı: '+w.enemyRemainingHP.toLocaleString('tr-TR'):''}</p>}
        {w.counterplay?.map((c,n)=><div className="notice" data-counterplay-status={c.status} key={n}><strong>{c.status==='verified'?'Alternatif çözüm doğrulandı':'Alternatif çözüm · koşul gerekli'} · {MECHANICS[c.mechanic as keyof typeof MECHANICS]||c.mechanic}</strong><p>{c.method} · {c.sources.join(' / ')}</p><p>{c.condition}</p></div>)}
        {w.barriers?.map((b,n)=><div className="notice" data-barrier-kind={b.kind} data-barrier-status={b.status} key={'barrier-'+n}><strong>{b.label} · {b.status==='manual'?'Vuruşla açılır':b.status==='resolved'?'Çözüm planlandı':b.status==='bypassed'?'Hasarla aşıldı':'Koşul gerekli'}</strong><p>{b.detail}</p></div>)}
        <p>Special öncesi HP: {w.hpBefore.toLocaleString('tr-TR')} · Saldırı öncesi HP: <strong>{w.hpAttack.toLocaleString('tr-TR')}</strong>{w.selfCost>0?` · Special HP maliyeti: ${w.selfCost.toLocaleString('tr-TR')}`:''}</p>
        <p>Alınacak hasar / risk hesabı: {w.incoming.toLocaleString('tr-TR')} · Aşama sonrası HP tahmini: <strong>{w.hpAfter.toLocaleString('tr-TR')}</strong>{w.incoming>0?` · Altı vuruş ve bilinen sonraki hasar öncesi gereken HP: ${w.requiredHP.toLocaleString('tr-TR')}`:''}</p>
        {(w.burnDamage>0||w.poisonSlotCount>0||w.completedPerfects<team.members.length)&&<p className="notice">Tamamlanabilen PERFECT: {w.completedPerfects} / {team.members.length} · Burn hasarı: {w.burnDamage.toLocaleString('tr-TR')} · Zehir slotu: {w.poisonSlotCount} · Zehir slotu hasarı / riski: {w.poisonSlotDamage.toLocaleString('tr-TR')}</p>}
        {w.instructions.map((text,n)=><p key={n}>{text}</p>)}{w.issues.length>0&&<ul>{w.issues.map((text,n)=><li key={n}>{text}</li>)}</ul>}
      </details>)}
      {team.combat.tandem.length>0&&<details className="combat-tandem"><summary>Tandem koşulları ve kaldırdığı savunmalar</summary>{team.combat.tandem.map((text,i)=><p className="source-text" key={i}>{text}</p>)}</details>}
      <details><summary>Hasar hesabının kapsamı</summary>{team.combat.assumptions.map((text,i)=><p className="muted" key={i}>{text}</p>)}</details>
    </section>}
    {team.schedule && <details open><summary>Special kullanım planı</summary>{team.schedule.map((s, i) => <div className="schedule" key={i}><strong>{s.stage} · toplam {s.turn}. tur</strong><p>{s.used.join(' / ') || 'Bu tur special ayrılmadı; geçiş hasarı ve bekleme riski savaş değerlendirmesinden kontrol edilmeli.'}</p></div>)}</details>}
    {evolved.length > 0 && <details className="evolution-recipes"><summary>Evrim malzemeleri ve edinme yolları</summary><p className="muted">Aktif kadro, yedekler ve seçilen Support formlarının toplam reçetesi. Elindeki malzeme adedi bilinmediğinden bu sayılar eksik adet değil, gereken toplamdır. Mağaza fiyatı / stok canlı okunmadı.</p><div className="material-list">{materials.map(row => <div className="material-item" data-material={row.id} key={row.id}><div className="material-heading">{row.info.image && <img src={row.info.image} alt={row.info.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}<div><strong className={row.info.rare ? 'rare-material' : ''}>{row.count}× {row.info.name}</strong><small>Kullanıldığı evrim: {row.uses.join(' · ')}</small></div></div>{row.info.routes.filter(r => r.status !== 'recorded-reward').map((r, i) => <div className="material-route" key={i}><span className="material-status">{r.status === 'shop-check' ? 'Kontrol edilecek mağaza' : r.status === 'unknown' ? 'Edinme yeri bilinmiyor' : 'Görev / drop yolu'}</span><p className="material-path">{r.path}</p>{r.currency && <p>Gerekli para: <strong>{r.currency}</strong> · Birim fiyat: oyundan kontrol et.</p>}<p className="muted">{r.note}</p><SourceLink url={r.url} /></div>)}{row.info.routes.some(r => r.status === 'recorded-reward') && <details className="material-history"><summary>Kaynakta kayıtlı görev / etkinlik ödülleri</summary><p className="muted">Bunlar ödül geçmişidir; bugün açık görev veya güncel mağaza stoku anlamına gelmez.</p>{row.info.routes.filter(r => r.status === 'recorded-reward').map((r, i) => <div className="material-route" key={i}><p className="material-path">{r.path}</p><SourceLink url={r.url} /></div>)}</details>}</div>)}</div>{evolved.map(m => <details className="recipe" key={m.sourceId}><summary>#{m.sourceId} {characters.get(m.sourceId)?.name} → #{m.character.id} {m.character.name}</summary>{m.path.map(edge => <div key={edge.to}><small>Adım: #{edge.from} → #{edge.to}</small>{edge.materials.length ? <p>{[...new Set(edge.materials)].map(id => `${edge.materials.filter(v => v === id).length}× ${materials.find(row => row.id === id)?.info.name || id}`).join(' · ')}</p> : <p className="muted">Bu dönüşüm için kaynakta malzeme reçetesi yok.</p>}</div>)}</details>)}</details>}
    {scenario === 'evolve' && !evolved.length && <p className="muted">Bu öneride evrim gerekmiyor; kutundaki mevcut formlar daha yüksek puan aldı.</p>}
    {scenario !== 'current' && <details><summary>Geliştirme hedefleri</summary><ul>{roster.filter(m => !m.friend).map(m => <li key={m.sourceId}>#{m.character.id}: Lv.{m.estimatedLevel}, special cooldown {m.owned.cooldown ?? '?'}, LB{m.owned.llb ? ' + LLB' : ''} maks.{kind === 'rumble' ? `; Rumble ability ${m.abilityLevel} / special ${m.specialLevel}` : ''}{m.owned.llb ? ' · LLB için kopya / poster, LB için materyal ve varsa anahtar gerekir.' : ''}</li>)}</ul></details>}
    <details><summary>Uyum, varsayımlar ve kaynak yetenekler</summary>{team.reasons.slice(1).map(reason => <p className="muted" key={reason}>{reason}</p>)}<ul>{team.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>{team.members.filter(m => !m.friend).map(m => <details key={m.sourceId}><summary>#{m.character.id} · {m.roles.join(' / ') || 'Yetenek metni'}</summary><p className="source-text">Captain: {m.captainText}</p><p className="source-text">Special: {m.specialText}</p></details>)}</details>
  </article>;
});
export default function PlannerPage({ kind, state, catalog, setting, onEdit, onCustomBoss }: { kind: 'teams' | 'rumble' | 'boss'; state: AppState; catalog: Catalog; setting: (v: Partial<AppState['settings']>) => void; onEdit: (c: Character) => void; onCustomBoss: (boss?: Encounter) => void }) {
  const [data, setData] = useState<PlannerData>();
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [selectedBoss,setSelectedBoss]=useState<Encounter>();
  const [guideBusy,setGuideBusy]=useState(false);
  const [activeScenario,setActiveScenario]=useState<Scenario>('power');
  const [preparation, setPreparation] = useState(16), [sockets, setSockets] = useState(0);
  const [groups, setGroups] = useState<PlanGroup[] | null>(null);
  const [catalogue, setCatalogue] = useState<{ category: string; groups: PlanGroup[] }[] | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''),[outcome,setOutcome]=useState('');
  const [autoRules,setAutoRules]=useState(!!window.nakama),[rumbleRules,setRumbleRules]=useState<RumbleRules>();
  const runId=useRef(0),readingRules=useRef(false);
  const worker = useRef<Worker | null>(null);
  const catalogueMode=useRef(false);
  const rulesSignature=useRef('');
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{if(!busy)return;setElapsed(0);const start=performance.now(),timer=setInterval(()=>setElapsed(Math.floor((performance.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
  const characters = useMemo(() => new Map(catalog.characters.map(c => [c.id, c])), [catalog]);
  const boss = selectedBoss;
  useEffect(() => { let active = true; getData().then(d => { if (active) setData(d); }).catch(e => { if (active) setError(friendlyError(e)); }); return () => { active = false;runId.current++; worker.current?.terminate();if(readingRules.current)void window.nakama?.cancelRumbleRules(); }; }, []);
  useEffect(()=>window.nakama?.onRumbleProgress(text=>{if(readingRules.current)setProgress(text);}),[]);
  useEffect(() => { runId.current++;worker.current?.terminate();if(readingRules.current)void window.nakama?.cancelRumbleRules();setBusy(false); setGroups(null); setCatalogue(null); setError('');setOutcome('');setRumbleRules(undefined); }, [state.box, state.settings.costLimit, state.settings.crewCostLimit, state.settings.rumbleMode,state.settings.adbPath,state.settings.device, category, selectedBoss, guideBusy, preparation, sockets, kind,autoRules]);
  const cancel=()=>{runId.current++;worker.current?.terminate();if(readingRules.current)void window.nakama?.cancelRumbleRules();readingRules.current=false;setBusy(false);setOutcome('Kadro oluşturma iptal edildi.');};
  const run = async(all = false,scenario:Scenario=activeScenario) => {
    if(kind!=='rumble'&&crewCostProblem(state.settings.crewCostLimit)){setError(crewCostProblem(state.settings.crewCostLimit));return;}
    if (!data || kind==='boss' && (!boss || guideBusy || boss.observation?.complete===false||questRestrictionProblem(boss))) return;
    const generation=++runId.current;let rules:RumbleRules|undefined;
    catalogueMode.current=all;
    worker.current?.terminate(); setError('');setOutcome(''); setBusy(true);if(all){setGroups(null);setCatalogue(rows=>rows||[]);}else setCatalogue(null);setProgress('Seçili gelişim için karakterler karşılaştırılıyor…');
    if(kind==='rumble'&&autoRules){
      setRumbleRules(undefined);readingRules.current=true;
      try{
        if(!window.nakama)throw Error('Otomatik kural okuma masaüstü uygulamasında çalışır.');
        if(!state.settings.device)throw Error('Önce MuMu bağlantısı bölümünden cihazını seç.');
        await window.nakama.connect(state.settings.adbPath,state.settings.device);
        if(runId.current!==generation)return;
        rules=await window.nakama.rumbleRules(state.settings.adbPath,state.settings.device);
        if(runId.current!==generation)return;
        const signature=JSON.stringify({phase:rules.phase,effects:rules.effects});if(rulesSignature.current&&rulesSignature.current!==signature){setGroups(null);setCatalogue(null);}rulesSignature.current=signature;
        setRumbleRules(rules);setProgress(rules.phase+' bonuslarına göre kadrolar hesaplanıyor…');
      }catch(e){if(runId.current===generation){setError(String(e));setBusy(false);}return;}
      finally{if(runId.current===generation)readingRules.current=false;}
    }
    const task = new Worker(new URL('./planning.worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
    task.onmessage = event => {
      if(runId.current!==generation)return;
      if (event.data.progress) { setProgress(event.data.progress); return; }
      if(event.data.preview){const {group,category:previewCategory}=event.data.preview;setProgress('İlk aday hazır · en iyi alternatifler karşılaştırılıyor…');if(all)setCatalogue(previous=>{const rows=previous||[],old=rows.find(r=>r.category===previewCategory);if(old?.groups.some(g=>g.scenario===scenario&&!g.provisional))return rows;const next={category:previewCategory,groups:[...(old?.groups||[]).filter(g=>g.scenario!==scenario),group]};return old?rows.map(r=>r===old?next:r):[...rows,next];});else setGroups(previous=>[...(previous||[]).filter(g=>g.scenario!==scenario),group]);return;}
      if(event.data.row){const row=event.data.row as {category:string;groups:PlanGroup[]};setCatalogue(previous=>{const rows=previous||[],old=rows.find(r=>r.category===row.category),next={category:row.category,groups:[...(old?.groups||[]).filter(g=>g.scenario!==scenario),...row.groups]};return old?rows.map(r=>r===old?next:r):[...rows,next];});return;}
      setBusy(false);
      if (event.data.error) setError(event.data.error);
      else if (event.data.done) setOutcome('Seçili gelişim için 13 takım türü hazır · '+(event.data.elapsedMs/1000).toFixed(1)+' sn.');
      else {setGroups(previous=>[...(previous||[]).filter(g=>g.scenario!==scenario),...event.data.result]);setOutcome('Seçili gelişim hesaplandı · '+(event.data.elapsedMs/1000).toFixed(1)+' sn. Diğer sekmeler seçildiğinde hesaplanır.');if(kind==='boss')void window.nakama?.reportDiagnostic?.({kind:'planner-result',message:boss?.name||kind,details:{kind,category,preparation,sockets,elapsedMs:event.data.elapsedMs,groups:(event.data.result as PlanGroup[]).map(g=>({scenario:g.scenario,teams:g.teams.map(t=>({ids:t.members.map(m=>m.character.id),missing:t.missing,status:t.combat?.status}))}))}}).catch(()=>{});}
      task.terminate();
    };
    task.onerror = () => { setBusy(false); setError('Hesaplama tamamlanamadı. Tekrar dene veya daha dar bir takım türü seç.'); task.terminate(); };
    task.postMessage({ kind, box: state.box, characters: catalog.characters, data, scenario,category, boss, preparation, sockets, costLimit: Math.min(300,state.settings.costLimit), crewCostLimit:kind==='rumble'?undefined:state.settings.crewCostLimit, mode: state.settings.rumbleMode, catalogue: all,rumbleRules:rules });
  };
  const selectScenario=(value:string)=>{const scenario=value as Scenario;setActiveScenario(scenario);if(!(groups||catalogue))return;const ready=catalogueMode.current?catalogue?.filter(r=>r.groups.some(g=>g.scenario===scenario&&!g.provisional)).length===13:groups?.some(g=>g.scenario===scenario&&!g.provisional);if(ready)return;if(busy)cancel();void run(catalogueMode.current,scenario);};
  const blockReason=kind!=='rumble'&&crewCostProblem(state.settings.crewCostLimit)?crewCostProblem(state.settings.crewCostLimit):!data?'Yetenek verileri yükleniyor.':state.box.length<5?'Kadro oluşturmak için kutuna en az 5 karakter ekle.':kind==='boss'&&guideBusy?'Boss okumasının tamamlanmasını bekle.':kind==='boss'&&!boss?'Önce MuMu’dan bossu oku veya kayıtlı bir profil seç.':kind==='boss'&&boss?.observation?.complete===false?'BEHAVIOR okuması tamamlanmadı; listenin sonu doğrulanmadığı için kadro oluşturulmadı. Bossu yeniden oku.':kind==='boss'?questRestrictionProblem(boss):'';
  useEffect(()=>{const report=window.nakama?.reportDiagnostic;if(report)void report({kind:'planner-state',message:busy?'Kadro hesabı sürüyor.':blockReason||'Kadro oluşturma kullanılabilir.',details:{kind,canBuild:!busy&&!blockReason,guideBusy,boss:boss?.name,complete:boss?.observation?.complete,restrictionStatus:boss?.restrictions?.status,boxCount:state.box.length}}).catch(()=>{});},[blockReason,busy,guideBusy,boss?.id,boss?.observation?.complete,boss?.restrictions?.status,kind,state.box.length]);
  const renderGroups = (list: PlanGroup[]) => list.map(group => <section className="scenario-section" data-scenario={group.scenario} data-provisional={!!group.provisional} hidden={group.scenario!==activeScenario} key={group.scenario}><div className="scenario-heading"><span>{group.scenario === 'current' ? '01' : group.scenario === 'power' ? '02' : '03'}</span><div><h2>{group.title}</h2><p>{group.scenario === 'current' ? 'Kaydedilmiş değerler; bilinmeyenler düşük seviye varsayımıyla gösterilir.' : group.scenario === 'power' ? 'Aynı karakter formları; Lv.100 hedefi, special / LB / LLB maks.; evrim yok.' : 'Lv.100 hedefinde kutundaki karakterlerin evrim / Super Evolution yolları da karşılaştırılır.'}</p></div></div>{group.provisional&&<p className="notice" role="status">İlk aday · arama sürüyor. Son sıralama ve hasar karşılaştırması henüz tamamlanmadı.</p>}{group.teams.length ? <><TeamCard team={group.teams[0]} scenario={group.scenario} characters={characters} data={data!} kind={kind} onEdit={onEdit} />{group.teams.length > 1 && <details className="alternatives"><summary>{group.teams.length - 1} alternatif kadro</summary>{group.teams.slice(1).map((team, index) => <TeamCard key={index} team={team} scenario={group.scenario} characters={characters} data={data!} kind={kind} onEdit={onEdit} />)}</details>}</> : <div className="panel plan-empty">{group.diagnostic}</div>}</section>);
  return <div className="planner-page">
    <section className="panel">
      {kind==='rumble'&&<div className="rumble-rules-panel">
        <h4>Oynadığım bölümün kurallarına göre seç</h4>
        <label className="check"><input aria-label="MuMu kurallarını otomatik oku" type="checkbox" checked={autoRules} disabled={busy} onChange={e=>setAutoRules(e.target.checked)}/>MuMu’dan bölümü ve Rules bonuslarını otomatik oku</label>
        <p className="muted">MuMu’da Rumble ana ekranını açık bırak. Kadro kur düğmesi önce aktif bölümü tanır, Rules → Underway sayfasını açar, o bölümün bonuslarını okur ve geri dönüp karakterleri seçer. Her hesaplamada kurallar yeniden okunur.</p>
        {rumbleRules&&<div className="notice" data-rumble-rules><strong>{rumbleRules.phase} · ekrandan okundu</strong><ul>{rumbleRules.effects.map((e,i)=><li key={i}>{ruleDescription(e)}</li>)}</ul><small>{new Date(rumbleRules.observedAt).toLocaleString('tr-TR')} · {rumbleRules.source}</small><details><summary>Okunan Rules metni</summary><p className="source-text">{rumbleRules.text}</p>{rumbleRules.warnings.map(w=><p className="muted" key={w}>{w}</p>)}</details></div>}
        {!autoRules&&<p className="muted">Ekran kuralları kapalı: kadrolar etkinlik bonusu eklenmeden hesaplanacak.</p>}
      </div>}
      <div className="row"><h3>{kind === 'teams' ? 'Kutumdan en iyi kadrolar' : kind === 'rumble' ? 'Otomatik Rumble kadrosu' : 'Boss davranışına göre kadro'}</h3><span className="tag">{state.box.length} KARAKTER</span></div>
      {kind === 'boss' && <BossSource settings={state.settings} saved={state.bosses} onChange={setSelectedBoss} onBusy={setGuideBusy} onEdit={onCustomBoss}/>}
      <div className="form-grid three"><label className="field">Takım türü<select aria-label="Takım türü" value={category} onChange={e => setCategory(e.target.value)}><option value="">Karma · otomatik uyum</option><optgroup label="Tip takımları">{TYPES.map(t => <option value={t} key={t}>{t} team</option>)}</optgroup><optgroup label="Sınıf takımları">{CLASSES.map(c => <option value={c} key={c}>{c} team</option>)}</optgroup></select></label>
      {kind === 'rumble' && <><label className="field">Öncelik<select aria-label="Rumble önceliği" value={state.settings.rumbleMode} onChange={e => setting({ rumbleMode: e.target.value as 'attack' | 'defense' })}><option value="attack">Hücum</option><option value="defense">Savunma</option></select></label><label className="field">5 aktif + 3 yedek toplam maliyet sınırı<input aria-label="Maliyet sınırı" type="number" min={1} max={300} value={Math.min(300,state.settings.costLimit)} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 1 && value <= 300) setting({ costLimit: value }); }} /></label></>}
      {kind === 'boss' && <><label className="field">Ek hazırlık / stall turu<input aria-label="Hazırlık turu" type="number" min={0} max={99} value={preparation} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 99) setPreparation(n); }} /></label><label className="field">Bind / Despair socket azaltması<select value={sockets} onChange={e => setSockets(Number(e.target.value))}>{[0, 1, 2, 3].map(n => <option value={n} key={n}>{n} tur</option>)}</select></label></>}
      </div><div className="actions"><button className="primary" aria-describedby="planner-requirements" aria-busy={busy} disabled={busy || !!blockReason} onClick={() => run()}>{kind === 'rumble' ? <Shield size={17} /> : kind === 'boss' ? <Swords size={17} /> : <Sparkles size={17} />}{busy ? 'Kadrolar hesaplanıyor…' : kind === 'rumble' ? 'En güçlü Rumble kadrolarını kur' : kind === 'boss' ? 'Bu bossa göre otomatik kadro kur' : 'En iyi kadroları oluştur'}</button>{kind === 'teams' && <button className="secondary" disabled={busy || !data || state.box.length < 5 || !!crewCostProblem(state.settings.crewCostLimit)} onClick={() => run(true)}>Seçili gelişimde 13 tip / sınıf öner</button>}{busy && <button className="secondary" onClick={cancel}><X size={14} />İptal</button>}</div>
      <p id="planner-requirements" className="disabled-hint">{blockReason}</p>{kind==='boss'&&questPlanningWarning(boss)&&<div className="notice reading-warning" data-planner-map-warning>{questPlanningWarning(boss)}</div>}{outcome&&<div className="completion-status" role="status">{outcome}</div>}
      {state.box.length < 5 && <p className="muted">En az 5 karakter eklemelisin; otomatik tanıma ile kutunu içe aktarabilirsin.</p>}
      {!data && !error && <p className="muted">Evrim ve yetenek verileri yükleniyor…</p>}{busy && <p className="plan-progress" role="status">{progress} · {elapsed} sn</p>}
    </section>
    <div className="notice">Üç ayrı öneri: mevcut hâl, evrimsiz tam geliştirme, evrim seçenekleriyle tam geliştirme. Bu işlem kutundaki kayıtlı seviyeleri değiştirmez. Genel kadrolar ortak kıyas hedefindeki normal saldırı aralığına göre sıralanır. Sınırlı aday araması ve bilinmeyen tetikler nedeniyle kesin optimum veya kazanma garantisi değildir.</div>
    {error && <div className="error" role="alert">{error}</div>}
    {(groups || catalogue) && data && <div className="actions plan-export"><button className="secondary" onClick={() => download('nakama-kadro-onerileri.json', JSON.stringify({ generatedAt: new Date().toISOString(), kind, category, boss: kind === 'boss' ? boss : undefined, source: data.metadata, rumbleRules:kind==='rumble'?rumbleRules:undefined, groups, catalogue, evolutionMaterials: groups?.map(g=>({scenario:g.scenario,teams:g.teams.map(team=>teamMaterials(team,characters,data))})), categoryMaterials:catalogue?.map(row=>({category:row.category,groups:row.groups.map(g=>({scenario:g.scenario,teams:g.teams.map(team=>teamMaterials(team,characters,data))}))})) }, null, 2))}><Download size={15} />Önerileri kaydet</button></div>}
    {data && <TabBar prefix="plan" className="scenario-tabs" label="Geliştirme senaryosu" items={SCENARIO_TABS} value={activeScenario} onChange={selectScenario}/>}
    {(groups || catalogue) && SCENARIO_TABS.map(({id})=><div key={id} role="tabpanel" id={'plan-panel-'+id} aria-labelledby={'plan-tab-'+id} hidden={activeScenario!==id}>{groups&&data&&renderGroups(groups.filter(g=>g.scenario===id))}{catalogue&&data&&catalogue.map(row=><details className="category-result panel" key={row.category} open={row.category==='STR'}><summary>{row.category} team · {row.groups.filter(g=>g.teams.length).length} / 3 senaryoda kadro</summary>{renderGroups(row.groups.filter(g=>g.scenario===id))}</details>)}</div>)}
    {!groups && !catalogue && !busy && <div className="panel plan-intro"><Sparkles /><h3>Karakterlerini karşılaştıralım.</h3><p>Kaptan ve üyeler kutundan seçilir. PvE için ayrıca uygun bir arkadaş kaptan formu önerilir. Lv. bilgisi girmeden de geliştirme sonrası kadroları görebilirsin.</p></div>}
    {data && <p className="muted plan-source">Yetenek / evrim kaynağı: <SourceLink url={data.metadata.url} children="OPTC Database" /> · Veri: {data.metadata.builtAt.slice(0, 10)}</p>}
  </div>;
}
