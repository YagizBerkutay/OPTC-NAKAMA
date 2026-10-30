import type {Boss} from './model';
import type {PlanTeam} from './planning';

export default function KizunaBattlePlan({team,boss}:{team:PlanTeam;boss:Boss}){
 const unknown=team.skillAudit?.filter(a=>/^(VS special|Super|Switch|Last Tap|Rush)/.test(a.name)&&/belirsiz|bilinmiyor|sağlanmıyor|Sayaç/.test(a.status))||[];
 return <section className="panel kizuna-battle-plan" aria-label="Kizuna savaş planı">
  <h3>Aşama aşama savaş planı</h3>
  <p>Toplam tur 0, ilk aşamaya giriş anıdır. Her aşamada önce bossun giriş etkileri ve otomatik tetikler, ardından aşağıdaki yetenek sırası uygulanır. Eksik olarak işaretlenen aşama geçilmiş sayılmaz.</p>
  {!!team.synergy?.supports.length&&<div data-kizuna-supports><h4>Savaştan önce Supportları tak</h4><ul>{team.synergy.supports.map(s=><li key={s.member.character.id}>#{s.member.character.id} {s.member.character.name} → #{s.targetId} · Support Lv.{s.level}. Tetik geldiğinde otomatik çalışır.</li>)}</ul></div>}
  {team.schedule?.map((s,i)=>{
   const window=team.combat?.windows[i],source=boss.stages.find(b=>b.name===s.stage)||boss.stages.find(b=>s.stage.startsWith(b.name+' ·'));
   const automatic=s.used.filter(v=>/Support →|pasif/.test(v)),active=s.used.filter(v=>!automatic.includes(v));
   return <article className="kizuna-battle-step" key={i} data-kizuna-battle-step={i+1}>
    <h4>{s.stage} · toplam tur {s.turn}</h4>
    {window&&<p className={window.status==='blocked'?'error':'notice'}>{window.status==='blocked'?'Bu aşamada çözülmemiş engel var.':window.status==='unverified'?'Bu aşamanın geçişi koşullu; eksikler aşağıda.':'Modelde bu aşamanın koşulları karşılandı.'}</p>}
    {source&&<details><summary>Bossun rehberdeki davranışları ve koşulları</summary>{source.events?.length?source.events.map((e,n)=><p className="source-text" key={n}><strong>{e.label}</strong>{'\n'+e.text}</p>):<p className="source-text">{source.notes||'Bu aşamanın davranış metni kaydedilmedi.'}</p>}</details>}
    {!!automatic.length&&<><h5>Otomatik tetikler · düğmeye basılmaz</h5><ul>{automatic.map((v,n)=><li key={n}>{v}</li>)}</ul></>}
    <h5>Saldırıdan önce sırayla kullan</h5>
    {active.length?<ol>{active.map((v,n)=><li key={n}>{v}{v.includes(' · ')?'':' · Special'}</li>)}</ol>:<p>Bu tur için aktif yetenek ayrılmadı.</p>}
    {!!window?.instructions.length&&<><h5>Saldırı ve devam talimatları</h5><ul>{window.instructions.map((v,n)=><li key={n}>{v}</li>)}</ul></>}
    {!!window?.issues.length&&<details open={window.status==='blocked'}><summary>Doğrulanması gerekenler · {window.issues.length}</summary><ul>{window.issues.map((v,n)=><li key={n}>{v}</li>)}</ul></details>}
   </article>;
  })}
  {!!unknown.length&&<details data-kizuna-unplanned><summary>Zamanlanmayan ileri yetenekler · {unknown.length}</summary><p>Bu yeteneklerin sayaç, form veya tetik koşulu doğrulanmadı; kullanım sırasına ve garantili hasara eklenmedi.</p><ul>{unknown.map((a,i)=><li key={i}>#{a.id} · {a.name}: {a.status}. {a.condition}</li>)}</ul></details>}
 </section>;
}
