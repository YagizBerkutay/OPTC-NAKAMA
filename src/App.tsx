import { version as appVersion } from '../package.json';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Anchor,
  ArrowRight,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Monitor,
  Plus,
  Search,
  Shield,
  Sparkles,
  Swords,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import {
  type AppState,
  type Boss,
  type Catalog,
  type Character,
  type Owned,
  emptyState,
  newOwned,
  validateState,
} from './model';
import { upgrades } from './engine';
import { download, loadState, saveState } from './storage';
import BoxScanner from './BoxScanner';
import PlannerPage from './PlannerPage';
import GrandPartyPage from './GrandPartyPage';
import RumblePage from './RumblePage';
import { useModalFocus } from './ui';
import { Avatar, Chips, Empty } from './components/CommonWidgets';
import { CharacterEditor } from './components/CharacterEditor';
import { BossEditor } from './components/BossEditor';
import { NAV_ITEMS, PAGE_CONFIG, type PageId } from './navigationConfig';

const KizunaPage = lazy(() => import('./KizunaPage'));
const PkaPage = lazy(() => import('./PkaPage'));
const CoopPage = lazy(() => import('./CoopPage'));

const TYPES = ['STR', 'DEX', 'QCK', 'PSY', 'INT'];

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [page, setPage] = useState<PageId>('home');
  const [message, setMessage] = useState('');
  const [fatal, setFatal] = useState('');
  const [saved, setSaved] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [region, setRegion] = useState('all');
  const [boxOnly, setBoxOnly] = useState(false);
  const [pageNo, setPageNo] = useState(0);
  const [edit, setEdit] = useState<Character | null>(null);
  const [bossEdit, setBossEdit] = useState<Boss | null>(null);
  const [bossId, setBossId] = useState('training');
  const [imported, setImported] = useState<AppState | null>(null);
  const [importMode, setImportMode] = useState('merge');
  const [devices, setDevices] = useState<{ id: string; status: string }[]>([]);
  const [shot, setShot] = useState('');
  const [adbBusy, setAdbBusy] = useState(false);
  const [dataPath, setDataPath] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const [undo, setUndo] = useState<{
    box: AppState['box'];
    bosses: AppState['bosses'];
    label: string;
  } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const latestState = useRef<AppState | null>(null);
  latestState.current = state;
  const savingRun = useRef(0);

  useModalFocus(
    edit ? 'character-' + edit.id : bossEdit ? 'boss-' + bossEdit.id : imported ? 'import' : '',
    () => {
      setEdit(null);
      setBossEdit(null);
      setImported(null);
    }
  );

  useEffect(() => {
    document.querySelector<HTMLElement>('.page-heading h1')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    setHelpOpen(false);
  }, [page]);

  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('./data/catalog.json');
        if (!response.ok) throw Error('Karakter kataloğu yüklenemedi.');
        const cat: Catalog = await response.json();
        let loaded = emptyState();
        const raw = await loadState();
        if (raw)
          try {
            loaded = validateState(JSON.parse(raw), new Set(cat.characters.map(c => c.id)));
          } catch {
            if (active) {
              setReadOnly(true);
              setMessage(
                'Kayıt okunamadı. Mevcut dosya korunuyor; bu oturum kaydetmez. Önce yedeğini kontrol et.'
              );
            }
          }
        if (active) {
          setCatalog(cat);
          setState(loaded);
          setBossId(loaded.bosses[0]?.id || '');
        }
        if (window.nakama) {
          const path = await window.nakama.dataPath();
          if (active) setDataPath(path);
        }
      } catch (e) {
        if (active) setFatal(String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state || readOnly) return;
    const generation = ++savingRun.current;
    setSaved(false);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveState(state))
      .then(() => {
        if (savingRun.current === generation) setSaved(true);
      })
      .catch(e => setMessage(`Kayıt başarısız: ${e}`));
  }, [state, readOnly]);

  useEffect(() => {
    setPageNo(0);
  }, [search, type, region, boxOnly]);

  const charMap = useMemo(() => new Map(catalog?.characters.map(c => [c.id, c]) || []), [catalog]);
  const ownedMap = useMemo(() => new Map(state?.box.map(o => [o.id, o]) || []), [state]);
  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase('en').trim().replace(/^#/, '');
    return (catalog?.characters || [])
      .filter(
        c =>
          (!boxOnly || ownedMap.has(c.id)) &&
          (!type || c.types.includes(type)) &&
          (region === 'all' || (region === 'global' ? c.global === true : c.global === null)) &&
          (!q || c.id === q || c.name.toLocaleLowerCase('en').includes(q))
      )
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [catalog, search, type, region, boxOnly, ownedMap]);

  if (fatal)
    return (
      <div className="boot">
        <h2>Uygulama yüklenemedi</h2>
        <p>{fatal}</p>
        <button className="primary" onClick={() => location.reload()}>
          Yeniden dene
        </button>
      </div>
    );
  if (!state || !catalog)
    return (
      <div className="boot">
        <Anchor size={36} />
        <h2>Tayfa hazırlanıyor…</h2>
      </div>
    );

  const boss = state.bosses.find(b => b.id === bossId) || state.bosses[0];

  const change = (update: (s: AppState) => AppState, undoLabel?: string) => {
    if (readOnly) {
      setMessage('Kayıt okunamadığı için bu oturum salt okunur.');
      return;
    }
    const before = latestState.current!;
    const next = update(before);
    validateState(next, new Set(charMap.keys()));
    if (undoLabel) setUndo({ box: before.box, bosses: before.bosses, label: undoLabel });
    latestState.current = next;
    setState(next);
  };

  const undoLast = () => {
    if (!undo) return;
    change(s => ({ ...s, box: undo.box, bosses: undo.bosses }));
    setMessage(undo.label + ' geri alındı.');
    setUndo(null);
  };

  const setting = (v: Partial<AppState['settings']>) =>
    change(s => ({ ...s, settings: { ...s.settings, ...v } }));

  const saveOwned = (o: Owned) => {
    change(s => ({ ...s, box: [...s.box.filter(x => x.id !== o.id), o] }), 'Karakter kaydı');
    setEdit(null);
    setMessage('Karakter kutuna kaydedildi.');
  };

  const adbTask = async (fn: () => Promise<void>) => {
    setAdbBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(`MuMu: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAdbBusy(false);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw Error('Dosya 8 MB sınırını aşıyor.');
      setImported(validateState(JSON.parse(await file.text()), new Set(charMap.keys())));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Dosya okunamadı.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const boxAction = (
    <button
      className="primary"
      onClick={() => {
        setPage('box');
        setBoxOnly(false);
      }}
    >
      Karakter ekle <ArrowRight size={17} />
    </button>
  );

  const currentPageMeta = PAGE_CONFIG[page];

  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main-content"
        onClick={e => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Ana içeriğe geç
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <svg width="34" height="30" viewBox="0 0 64 48" aria-hidden="true">
              <path d="M16 29c0-20 32-20 32 0" fill="#ffc75a" />
              <path d="M16 24h32v8H16z" fill="#ef6d60" />
              <ellipse cx="32" cy="34" rx="29" ry="9" fill="#ffc75a" />
              <path d="M10 36c15 5 29 5 44 0" fill="none" stroke="#83580f" strokeWidth="2" />
            </svg>
          </span>
          <div>
            NAKAMA<small>OPTC COMPANION</small>
          </div>
        </div>
        <div className="workspace">
          <span className="dot" />
          GLOBAL <span className="pill">PC</span>
        </div>
        <nav aria-label="Ana gezinme">
          {[
            ['TAYFAM', ['home', 'box', 'upgrades']],
            ['KADRO PLANLARI', ['teams', 'boss', 'pka', 'coop', 'kizuna', 'rumble', 'grand']],
            ['BAĞLANTI', ['mumu']],
          ].map(([group, ids]) => (
            <div className="nav-group" key={String(group)}>
              <span className="nav-group-label">{group}</span>
              {NAV_ITEMS.filter(([id]) => (ids as string[]).includes(id)).map(
                ([id, label, Icon]) => (
                  <button
                    aria-label={label}
                    title={label}
                    aria-current={page === id ? 'page' : undefined}
                    className={page === id ? 'active' : ''}
                    key={id}
                    onClick={() => setPage(id)}
                  >
                    <Icon size={19} />
                    {label}
                    {id === 'box' && <small>{state.box.length}</small>}
                  </button>
                )
              )}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local">
            <span className="dot" />
            <div>
              Yerel çalışma alanı
              <small role="status" aria-live="polite">
                {readOnly ? 'Salt okunur' : saved ? 'Kaydedildi' : 'Kaydediliyor…'}
              </small>
            </div>
          </div>
          <span className="version">OTOMATİK KADROLAR · v{appVersion}</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            ÇALIŞMA ALANI <ChevronRight size={14} />{' '}
            {NAV_ITEMS.find(n => n[0] === page)?.[1]}
          </span>
          <div>
            <span className="server">GLOBAL SERVER</span>
            <button
              className="icon"
              aria-label="Bu bölüm için yardım"
              title="Bu bölüm için yardım"
              aria-expanded={helpOpen}
              aria-controls="context-help"
              onClick={() => setHelpOpen(v => !v)}
            >
              <CircleHelp size={20} />
            </button>
            <span className="profile">K</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} aria-label="Çalışma alanı">
          <div className="page-heading">
            <div>
              <small className="eyebrow">
                {page === 'home'
                  ? 'KAPTANIN MASASI'
                  : 'NAKAMA / ' + NAV_ITEMS.find(n => n[0] === page)?.[1].toLocaleUpperCase('tr')}
              </small>
              <h1 tabIndex={-1}>{currentPageMeta.title}</h1>
              <p>{currentPageMeta.subtitle}</p>
            </div>
            {page === 'box' && (
              <div className="actions">
                <button className="secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} />
                  İçe aktar
                </button>
                <button
                  className="secondary"
                  onClick={() => download('nakama-kutu.json', JSON.stringify(state, null, 2))}
                >
                  <Download size={16} />
                  Yedekle
                </button>
              </div>
            )}
          </div>
          {helpOpen && (
            <section className="context-help" id="context-help" aria-label="Bölüm yardımı">
              <div className="row">
                <h3>{NAV_ITEMS.find(n => n[0] === page)?.[1]} · nasıl kullanılır?</h3>
                <button
                  className="icon"
                  aria-label="Yardımı kapat"
                  onClick={() => setHelpOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <p>{currentPageMeta.help}</p>
            </section>
          )}
          {undo && (
            <div className="undo-bar" role="status">
              <span>
                Son değişiklik: <strong>{undo.label}</strong>
              </span>
              <button className="secondary" disabled={readOnly} onClick={undoLast}>
                <Undo2 size={16} />
                Geri al
              </button>
            </div>
          )}
          {message && (
            <div className="message" role="status" aria-live="polite">
              <span>{message}</span>
              <button
                className="icon"
                aria-label="Bildirimi kapat"
                onClick={() => setMessage('')}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {page === 'home' && (
            <>
              <div className="dashboard-welcome">
                <div>
                  <span className="eyebrow">KUTUNDAN KADROYA</span>
                  <h2>Bir sonraki mücadeleyi seç.</h2>
                  <p>
                    {state.box.length
                      ? state.box.length +
                        ' karakterin hazır. Boss, Rumble veya tip / sınıf kadrolarını karşılaştır.'
                      : 'MuMu’dan kutunu tanıt, sonra sana uygun kadroları oluşturalım.'}
                  </p>
                  <div className="actions">
                    <button
                      className="primary"
                      onClick={() => setPage(state.box.length ? 'teams' : 'mumu')}
                    >
                      <Sparkles size={17} />
                      {state.box.length ? 'Kadrolarımı oluştur' : 'Kutumu otomatik tanıt'}
                      <ArrowRight size={16} />
                    </button>
                    <button className="secondary" onClick={() => setPage('boss')}>
                      <Swords size={16} />
                      Boss ekranını oku
                    </button>
                  </div>
                </div>
                <div className="dashboard-status">
                  <span className="dot" />
                  <div>
                    Global · yerel kutu
                    <small>{state.box.length} karakter / 3 geliştirme seçeneği</small>
                  </div>
                </div>
              </div>
              <div className="stats">
                {[
                  [state.box.length, 'KUTUMDAKİ KARAKTER', 'Kendi koleksiyonun'],
                  [
                    state.box.filter(o => charMap.get(o.id)?.captain).length,
                    'KAPTAN YETENEĞİ OLAN',
                    'Otomatik aday araması için',
                  ],
                  [state.bosses.filter(b => !b.training).length, 'BOSS PROFİLİ', 'Kendi hedeflerin'],
                  [
                    state.box.filter(o => charMap.get(o.id)?.rumble?.abilityLevels.length).length,
                    'RUMBLE YETENEĞİ OLAN',
                    'Seviye girmeden aday oluştur',
                  ],
                ].map(([n, label, sub]) => (
                  <div className="stat" key={String(label)}>
                    <span>{label}</span>
                    <strong>
                      {n}
                      <small>↗</small>
                    </strong>
                    <p>{sub}</p>
                  </div>
                ))}
              </div>
              <div className="section-heading">
                <h2>Rotanı seç</h2>
                <span>Her hedef için ayrı bir plan</span>
              </div>
              <div className="route-grid">
                {[
                  [
                    'teams',
                    Sparkles,
                    '00',
                    'Kutumdan en iyi kadrolar',
                    'STR, Fighter ve 13 takım türünü ayrı geliştirme senaryolarıyla öner.',
                  ],
                  [
                    'boss',
                    Swords,
                    '01',
                    'Boss için takım kur',
                    'Mekanikleri karşılayan adayları ve special kullanım sırasını bul.',
                  ],
                  [
                    'upgrades',
                    Sparkles,
                    '02',
                    'Kimi geliştireyim?',
                    'Mevcut seviyelerine ve hedefine göre işlerini sırala.',
                  ],
                  [
                    'rumble',
                    Shield,
                    '03',
                    'Rumble tayfanı kur',
                    'Karakterlerin buff ilişkilerini ve maliyet sınırını değerlendir.',
                  ],
                ].map(([id, Icon, num, title, desc]: any) => (
                  <button className="route" key={id} onClick={() => setPage(id)}>
                    <div>
                      <span className="route-icon">
                        <Icon size={22} />
                      </span>
                      <small>{num}</small>
                    </div>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                    <span className="route-link">
                      Planı aç <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="bottom-grid">
                <section className="panel">
                  <small className="eyebrow">İLK ADIMLAR</small>
                  <h3>Önce kutunu tanıtalım</h3>
                  {[
                    'Katalogdan karakterin tam versiyonunu seç.',
                    'Mevcut seviyelerini kaydet; bilinmeyenleri boş bırak.',
                    'Kadroları karşılaştır veya MuMu’dan boss davranışını oku.',
                  ].map((text, i) => (
                    <p className="step" key={text}>
                      <span>{i + 1}</span>
                      {text}
                    </p>
                  ))}
                </section>
                <section className="panel source-panel">
                  <span className="tag">VERİ KAYNAĞI</span>
                  <h3>{catalog.metadata.total.toLocaleString('tr')} karakter kaydı</h3>
                  <p>
                    {catalog.metadata.global.toLocaleString('tr')} kayıt kaynakta Global olarak
                    işaretli. Yeni kartlarda bölge etiketi eksik olabilir; katalog varsayılan olarak
                    bütün kartları gösterir.
                  </p>
                  <small>
                    2Shankz / OPTC Database · GPL-3.0
                    <br />
                    İçe aktarım: {new Date(catalog.metadata.importedAt).toLocaleDateString('tr-TR')}
                  </small>
                </section>
              </div>
            </>
          )}
          {page === 'box' && (
            <>
              <div className="filterbar">
                <label className="search">
                  <Search size={19} />
                  <input
                    aria-label="Karakter ara"
                    placeholder="İsim veya karakter ID’si ara…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="icon"
                      aria-label="Aramayı temizle"
                      onClick={() => setSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <select
                  aria-label="Tip filtresi"
                  value={type}
                  onChange={e => setType(e.target.value)}
                >
                  <option value="">Tüm tipler</option>
                  {TYPES.map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  aria-label="Bölge filtresi"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                >
                  <option value="global">Global işaretli</option>
                  <option value="unknown">Global bilgisi belirsiz</option>
                  <option value="all">Tüm katalog</option>
                </select>
                <button
                  className={`secondary ${boxOnly ? 'selected' : ''}`}
                  aria-pressed={boxOnly}
                  onClick={() => setBoxOnly(!boxOnly)}
                >
                  <Boxes size={16} />
                  {boxOnly ? 'Yalnızca kutum' : 'Kutumu filtrele'}
                </button>
              </div>
              <div className="section-heading">
                <h3>
                  {boxOnly ? 'Koleksiyonun' : 'Karakter kataloğu'}{' '}
                  <span className="count">{filtered.length}</span>
                </h3>
                <span>Versiyonlar karakter ID’si ile ayrılır</span>
              </div>
              {!filtered.length ? (
                <Empty
                  title={boxOnly ? 'Kutunda eşleşen karakter yok' : 'Karakter bulunamadı'}
                >
                  Bölge filtresini tüm kataloğa alabilir veya aramanı değiştirebilirsin.
                </Empty>
              ) : (
                <div className="character-grid">
                  {filtered.slice(pageNo * 24, pageNo * 24 + 24).map(c => {
                    const o = ownedMap.get(c.id);
                    return (
                      <button
                        className={`character-card ${o ? 'owned' : ''}`}
                        key={c.id}
                        onClick={() => setEdit(c)}
                      >
                        <div className="row">
                          <Avatar c={c} />
                          <span className={o ? 'owned-label' : 'add-label'}>
                            {o ? (
                              <>
                                <Check size={13} />
                                Kutumda
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                Ekle
                              </>
                            )}
                          </span>
                        </div>
                        <h3>{c.name}</h3>
                        <Chips c={c} />
                        <div className="card-footer">
                          <span>{o ? `Lv. ${o.level ?? '?'}` : `ATK ${c.atk.toLocaleString('tr')}`}</span>
                          <span>
                            {o?.ability.verified
                              ? 'PvE doğrulandı'
                              : c.rumble?.abilityLevels.length
                              ? 'Rumble verisi var'
                              : 'Karakter detayı'}
                            <ChevronRight size={13} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="pagination">
                <span>
                  {filtered.length
                    ? `${pageNo * 24 + 1}–${Math.min((pageNo + 1) * 24, filtered.length)} / ${
                        filtered.length
                      }`
                    : '0 sonuç'}
                </span>
                <div>
                  <button
                    className="icon"
                    aria-label="Önceki sayfa"
                    disabled={pageNo === 0}
                    onClick={() => setPageNo(n => n - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span>{pageNo + 1}</span>
                  <button
                    className="icon"
                    aria-label="Sonraki sayfa"
                    disabled={(pageNo + 1) * 24 >= filtered.length}
                    onClick={() => setPageNo(n => n + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
          {['teams', 'boss', 'kizuna', 'pka', 'coop'].includes(page) && (
            <section className="panel" aria-label="Hesabının cost sınırı">
              <label className="field">
                PvE toplam cost sınırın
                <input
                  aria-label="PvE toplam cost sınırın"
                  type="number"
                  min={1}
                  max={9999}
                  value={state.settings.crewCostLimit ?? ''}
                  placeholder="Oyundaki Edit Crew ekranındaki üst sınır"
                  onChange={e => {
                    const n = Number(e.target.value);
                    if (e.target.value === '') setting({ crewCostLimit: undefined });
                    else if (Number.isInteger(n) && n >= 1 && n <= 9999) setting({ crewCostLimit: n });
                  }}
                />
              </label>
              <p className="muted">
                Bir kez yaz; Co-Op, Kizuna, PKA bossları ve normal kadrolarda saklanır. Kendi
                karakterlerin ve Support toplamı bu sınırı aşamaz; arkadaş kaptan sayılmaz. Hesap
                seviyenle sınırın arttığında burayı güncelle. Rumble ayrı cost kullanır.
              </p>
            </section>
          )}
          {page === 'kizuna' && (
            <Suspense fallback={<p role="status">Kizuna hazırlanıyor…</p>}>
              <KizunaPage
                state={state}
                catalog={catalog}
                onSave={(kizuna, boss) =>
                  change(s => ({
                    ...s,
                    kizuna,
                    bosses: boss ? [...s.bosses.filter(b => b.id !== boss.id), boss] : s.bosses,
                  }))
                }
                onEdit={setEdit}
                onCustomBoss={profile =>
                  setBossEdit(
                    profile
                      ? {
                          ...profile,
                          id: crypto.randomUUID(),
                          source: profile.source.slice(0, 1000),
                        }
                      : null
                  )
                }
              />
            </Suspense>
          )}
          {page === 'pka' && (
            <Suspense fallback={<p role="status">PKA hazırlanıyor…</p>}>
              <PkaPage state={state} catalog={catalog} onEdit={setEdit} />
            </Suspense>
          )}
          {page === 'grand' && <GrandPartyPage state={state} catalog={catalog} onEdit={setEdit} />}
          {page === 'coop' && (
            <Suspense fallback={<p role="status">Co-Op hazırlanıyor…</p>}>
              <CoopPage
                state={state}
                catalog={catalog}
                onEdit={setEdit}
                onSaveOwned={o =>
                  change(s => ({
                    ...s,
                    box: s.box.map(old => (old.id === o.id ? o : old)),
                  }))
                }
              />
            </Suspense>
          )}
          {page === 'rumble' && (
            <RumblePage
              state={state}
              catalog={catalog}
              setting={setting}
              onEdit={setEdit}
              onCustomBoss={profile =>
                setBossEdit(
                  profile
                    ? {
                        ...profile,
                        id: crypto.randomUUID(),
                        source: profile.source.slice(0, 1000),
                      }
                    : null
                )
              }
            />
          )}
          {(page === 'boss' || page === 'teams') && (
            <PlannerPage
              key={page}
              kind={page}
              state={state}
              catalog={catalog}
              setting={setting}
              onEdit={setEdit}
              onCustomBoss={profile =>
                setBossEdit(
                  profile
                    ? {
                        ...profile,
                        id: crypto.randomUUID(),
                        source: profile.source.slice(0, 1000),
                      }
                    : {
                        id: crypto.randomUUID(),
                        name: '',
                        source: '',
                        training: false,
                        stages: [
                          {
                            id: crypto.randomUUID(),
                            name: 'Boss',
                            turn: 4,
                            requirements: [],
                          },
                        ],
                      }
                )
              }
            />
          )}
          {page === 'upgrades' && (
            <>
              <section className="panel row">
                <div>
                  <h3>Geliştirme hedefi</h3>
                  <p className="muted">
                    Hedefte mekanik karşılayan karakterlerin işleri öncelik kazanır.
                  </p>
                </div>
                <select
                  aria-label="Geliştirme hedefi"
                  value={boss?.id || ''}
                  onChange={e => setBossId(e.target.value)}
                >
                  {state.bosses.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </section>
              <div className="notice">
                Materyal maliyeti ve hasar artışı hesaplanmıyor. Listede bilgi tamamlama işleri de
                var; bunlar kaynak harcama önerisi değildir.
              </div>
              {!state.box.length ? (
                <Empty title="Önce tayfanı ekle" action={boxAction}>
                  Geliştirme işleri kendi kutundan oluşturulur.
                </Empty>
              ) : (
                <div className="upgrade-list">
                  {upgrades(state.box, catalog.characters, boss).map((u, i) => (
                    <button
                      className="upgrade panel"
                      key={`${u.character.id}-${u.title}`}
                      onClick={() => setEdit(u.character)}
                    >
                      <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                      <Avatar c={u.character} />
                      <div>
                        <small>{u.character.name}</small>
                        <h3>{u.title}</h3>
                        <p>{u.reason}</p>
                      </div>
                      <ChevronRight size={19} />
                    </button>
                  ))}
                  {!upgrades(state.box, catalog.characters, boss).length && (
                    <Empty title="Kayıtlı bir geliştirme işi yok">
                      Hedefin veya karakter seviyelerin değiştiğinde liste güncellenir.
                    </Empty>
                  )}
                </div>
              )}
            </>
          )}

          {page === 'mumu' && (
            <>
              <div className="mumu-layout">
                <section className="panel">
                  <span className="tag">YEREL EMÜLATÖR</span>
                  <h3>MuMu bağlantısı</h3>
                  <label className="field">
                    MuMu bağlantı dosyası (ADB)
                    <input
                      value={state.settings.adbPath}
                      onChange={e => setting({ adbPath: e.target.value })}
                    />
                  </label>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={!window.nakama || adbBusy}
                      onClick={() =>
                        adbTask(async () => {
                          const path = await window.nakama!.discoverAdb();
                          if (path) {
                            setting({ adbPath: path });
                            setMessage('MuMu ADB bulundu.');
                          } else setMessage('ADB bulunamadı; dosyayı elle seç.');
                        })
                      }
                    >
                      Otomatik bul
                    </button>
                    <button
                      className="secondary"
                      disabled={!window.nakama || adbBusy}
                      onClick={() =>
                        adbTask(async () => {
                          const path = await window.nakama!.pickAdb();
                          if (path) setting({ adbPath: path });
                        })
                      }
                    >
                      Dosya seç
                    </button>
                  </div>
                  <label className="field">
                    Cihaz adresi
                    <input
                      placeholder="127.0.0.1:port"
                      value={state.settings.device}
                      onChange={e => setting({ device: e.target.value })}
                    />
                  </label>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={!window.nakama || adbBusy}
                      onClick={() =>
                        adbTask(async () => {
                          setMessage(
                            await window.nakama!.connect(
                              state.settings.adbPath,
                              state.settings.device
                            )
                          );
                          setDevices(await window.nakama!.devices(state.settings.adbPath));
                        })
                      }
                    >
                      Bağlan
                    </button>
                    <button
                      className="secondary"
                      disabled={!window.nakama || adbBusy}
                      onClick={() =>
                        adbTask(async () => {
                          const d = await window.nakama!.devices(state.settings.adbPath);
                          setDevices(d);
                          if (!d.length)
                            setMessage(
                              'Açık yerel cihaz bulunamadı. MuMu Android cihazını aç ve ADB adresini gir.'
                            );
                        })
                      }
                    >
                      Cihazları listele
                    </button>
                  </div>
                  {devices.map(d => (
                    <button
                      className="device"
                      key={d.id}
                      onClick={() => setting({ device: d.id })}
                    >
                      <span className={d.status === 'device' ? 'dot' : 'dot off'} />
                      {d.id}
                      <small>{d.status}</small>
                    </button>
                  ))}
                  <button
                    className="primary full"
                    disabled={!window.nakama || adbBusy || !state.settings.device}
                    onClick={() =>
                      adbTask(async () =>
                        setShot(
                          await window.nakama!.screenshot(
                            state.settings.adbPath,
                            state.settings.device
                          )
                        )
                      )
                    }
                  >
                    <Monitor size={17} />
                    {adbBusy ? 'İşlem sürüyor…' : 'Ekran görüntüsü al'}
                  </button>
                  <p className="muted">
                    Alınan görüntü otomatik tanınır. Tüm kutu için aşağıdaki tarama düğmesini kullan.
                  </p>
                </section>
                <section className="panel screenshot-panel">
                  <div className="row">
                    <h3>Kutu ekranı</h3>
                    <button className="secondary" onClick={() => imageRef.current?.click()}>
                      <Upload size={15} />
                      Görsel yükle
                    </button>
                  </div>
                  {shot ? (
                    <>
                      <img
                        className="screenshot"
                        src={shot}
                        alt="İçe aktarılan MuMu ekran görüntüsü"
                      />
                      <div className="actions">
                        <button
                          className="secondary"
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = shot;
                            a.download = 'mumu-kutu.png';
                            a.click();
                          }}
                        >
                          Görseli kaydet
                        </button>
                        <button className="secondary" onClick={() => setShot('')}>
                          Kaldır
                        </button>
                      </div>
                    </>
                  ) : (
                    <Empty title="Kutunu otomatik tanıtalım">
                      MuMu’da Character Box açıkken bir görüntü al veya birden fazla kutu görseli
                      yükle.
                    </Empty>
                  )}
                </section>
              </div>
              <BoxScanner
                image={shot}
                characters={catalog.characters}
                ownedIds={new Set(state.box.map(o => o.id))}
                adbPath={state.settings.adbPath}
                device={state.settings.device}
                onPreview={setShot}
                onAdd={ids => {
                  change(
                    s => ({
                      ...s,
                      box: [
                        ...s.box,
                        ...ids.filter(id => !s.box.some(o => o.id === id)).map(newOwned),
                      ],
                    }),
                    'Tanınan karakterleri ekleme'
                  );
                  setMessage(
                    'Tanınan karakterler kutuna eklendi. Mevcut geliştirme kayıtların korundu.'
                  );
                }}
              />
            </>
          )}
          <footer className="app-footer">
            <span>
              OPTC NAKAMA · Global · v{appVersion}
            </span>
            <span>
              {dataPath ? `Yerel kayıt: ${dataPath}` : 'Tarayıcı önizlemesi · yerel kayıt'} · 2Shankz
              verileri
            </span>
          </footer>
        </main>
      </div>
      <input
        hidden
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        onChange={e => importFile(e.target.files?.[0])}
      />
      <input
        hidden
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.size > 16 * 1024 * 1024) {
              setMessage('Görsel en fazla 16 MB olabilir.');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => setShot(String(reader.result));
            reader.readAsDataURL(file);
          }
          e.target.value = '';
        }}
      />
      {edit && (
        <CharacterEditor
          key={edit.id}
          c={edit}
          owned={ownedMap.get(edit.id)}
          onClose={() => setEdit(null)}
          onSave={saveOwned}
          onRemove={() => {
            change(
              s => ({ ...s, box: s.box.filter(o => o.id !== edit.id) }),
              'Karakteri kutudan çıkarma'
            );
            setEdit(null);
            setMessage('Karakter kutudan çıkarıldı.');
          }}
        />
      )}
      {bossEdit && (
        <BossEditor
          boss={bossEdit}
          onClose={() => setBossEdit(null)}
          onSave={b => {
            change(
              s => ({ ...s, bosses: [...s.bosses.filter(x => x.id !== b.id), b] }),
              'Boss profili kaydı'
            );
            setBossId(b.id);
            setBossEdit(null);
          }}
        />
      )}
      {imported && (
        <div className="overlay">
          <section
            className="modal compact"
            role="dialog"
            aria-modal="true"
            aria-label="Kutu içe aktar"
          >
            <h2>Kutu yedeğini içe aktar</h2>
            <p>
              {imported.box.length} karakter ve {imported.bosses.length} boss profili doğrulandı.
            </p>
            <label className="check">
              <input
                type="radio"
                checked={importMode === 'merge'}
                onChange={() => setImportMode('merge')}
              />
              Birleştir: aynı ID’deki kayıtları güncelle, diğerlerini koru.
            </label>
            <label className="check">
              <input
                type="radio"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
              />
              Değiştir: mevcut kutu, bosslar ve ayarları bu yedekle değiştir.
            </label>
            <footer className="modal-footer">
              <button className="secondary" onClick={() => setImported(null)}>
                İptal
              </button>
              <button
                className="primary"
                onClick={() => {
                  download('nakama-import-oncesi.json', JSON.stringify(state, null, 2));
                  change(
                    s =>
                      importMode === 'replace'
                        ? imported
                        : {
                            ...s,
                            box: [
                              ...s.box.filter(o => !imported.box.some(x => x.id === o.id)),
                              ...imported.box,
                            ],
                            bosses: [
                              ...s.bosses.filter(b => !imported.bosses.some(x => x.id === b.id)),
                              ...imported.bosses,
                            ],
                          },
                    'Kutu içe aktarımı'
                  );
                  setImported(null);
                  setMessage('Yedek içe aktarıldı. Önceki kutunun yedeği de indirildi.');
                }}
              >
                İçe aktar
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
