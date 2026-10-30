import { useEffect, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { type Character, type Owned, newOwned } from '../model';
import { getData } from '../PlannerPage';
import { TabBar } from '../ui';
import { Avatar, Chips, EffectsEditor, Num } from './CommonWidgets';

const TYPES = ['STR', 'DEX', 'QCK', 'PSY', 'INT'];
const CLASSES = [
  'Fighter',
  'Slasher',
  'Striker',
  'Shooter',
  'Free Spirit',
  'Cerebral',
  'Powerhouse',
  'Driven',
];

interface CharacterEditorProps {
  c: Character;
  owned?: Owned;
  onClose: () => void;
  onSave: (o: Owned) => void;
  onRemove: () => void;
}

export function CharacterEditor({ c, owned, onClose, onSave, onRemove }: CharacterEditorProps) {
  const [draft, setDraft] = useState<Owned>(structuredClone(owned || newOwned(c.id)));
  const [tab, setTab] = useState<'state' | 'rules' | 'source'>('state');
  const update = (v: Partial<Owned>) => setDraft(d => ({ ...d, ...v }));
  const ability = (v: Partial<Owned['ability']>) =>
    setDraft(d => ({ ...d, ability: { ...d.ability, ...v } }));
  const [error, setError] = useState('');
  const [pveSkills, setPveSkills] = useState<{ key: string; label: string }[]>([]);
  const [dualForm, setDualForm] = useState(false);

  useEffect(() => {
    let active = true;
    void getData()
      .then(data => {
        if (!active) return;
        const unit = data.units[c.id],
          a = unit?.abilities || {};
        setDualForm(
          !!unit?.captain &&
            typeof unit.captain === 'object' &&
            !Array.isArray(unit.captain) &&
            'character1' in unit.captain
        );
        const labels: Record<string, string> = {
          support: 'Support',
          lastTap: 'Last Tap',
          superTandem: 'Super Tandem',
          superTandemBoost: 'Super Tandem Boost',
          rush: 'Rush',
        };
        setPveSkills([
          ...Object.entries(labels)
            .filter(([k]) => a[k])
            .map(([key, label]) => ({ key, label })),
          ...(Array.isArray(a.potential)
            ? a.potential.map((p: { Name: string }) => ({
                key: 'potential:' + p.Name,
                label: 'Potential · ' + p.Name,
              }))
            : []),
        ]);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [c.id]);

  const pveLevel = (key: string, value: number | null) => {
    const levels = { ...draft.pveLevels };
    if (value === null) delete levels[key];
    else levels[key] = value;
    update({ pveLevels: levels });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="modal character-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Karakter düzenle"
        onClick={e => e.stopPropagation()}
      >
        <button className="icon close" aria-label="Kapat" onClick={onClose}>
          <X />
        </button>
        <div className="character-title">
          <Avatar c={c} large />
          <div>
            <small className="eyebrow">KARAKTER #{c.id}</small>
            <h2>{c.name}</h2>
            <Chips c={c} />
          </div>
        </div>
        <TabBar
          prefix="character"
          label="Karakter bilgileri"
          value={tab}
          onChange={id => setTab(id as typeof tab)}
          items={[
            { id: 'state', label: 'Geliştirme durumu' },
            { id: 'rules', label: 'PvE kuralları' },
            { id: 'source', label: 'Kaynak yetenekler' },
          ]}
        />
        {['state', 'rules', 'source']
          .filter(id => id !== tab)
          .map(id => (
            <div hidden role="tabpanel" id={'character-panel-' + id} aria-labelledby={'character-tab-' + id} key={id} />
          ))}
        <div
          className="modal-body"
          role="tabpanel"
          id={'character-panel-' + tab}
          aria-labelledby={'character-tab-' + tab}
        >
          {tab === 'state' && (
            <>
              <div className="notice">
                Ekranda gördüğün değerleri gir. Boş alanlar bilinmiyor olarak saklanır.
              </div>
              <div className="form-grid">
                <Num
                  label="Mevcut seviye"
                  value={draft.level}
                  max={150}
                  min={1}
                  onChange={level => update({ level })}
                />
                <Num
                  label="Mevcut special cooldown"
                  value={draft.cooldown}
                  max={99}
                  onChange={cooldown => update({ cooldown })}
                />
                <Num
                  label="Special ilk hazır tur"
                  value={draft.readyTurn}
                  onChange={readyTurn => update({ readyTurn })}
                />
                <Num
                  label="Level Limit Break (0–5)"
                  value={draft.llb}
                  max={5}
                  onChange={llb => update({ llb: llb ?? 0 })}
                />
                <Num
                  label="Rumble ability (1–5)"
                  value={draft.rumbleAbility}
                  min={1}
                  max={5}
                  onChange={rumbleAbility => update({ rumbleAbility })}
                />
                <Num
                  label="Rumble special (1–10)"
                  value={draft.rumbleSpecial}
                  min={1}
                  max={10}
                  onChange={rumbleSpecial => update({ rumbleSpecial })}
                />
                <Num
                  label="GP leader skill (1–5)"
                  value={draft.gpAbility ?? null}
                  min={1}
                  max={5}
                  onChange={gpAbility => update({ gpAbility })}
                />
                <Num
                  label="GP Burst (1–5)"
                  value={draft.gpSpecial ?? null}
                  min={1}
                  max={5}
                  onChange={gpSpecial => update({ gpSpecial })}
                />
              </div>
              {dualForm && (
                <label className="field">
                  Mevcut PvE dual form
                  <select
                    aria-label="Mevcut PvE dual form"
                    value={draft.pveForm || 'character1'}
                    onChange={e => update({ pveForm: e.target.value as Owned['pveForm'] })}
                  >
                    <option value="character1">Birinci karakter</option>
                    <option value="character2">İkinci karakter</option>
                    <option value="combined">Birleşik form · süre sınırı geçerli</option>
                  </select>
                </label>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.lb}
                  onChange={e => update({ lb: e.target.checked })}
                />
                Limit Break tamamlandı
              </label>
              {pveSkills.length > 0 && (
                <details>
                  <summary>Support ve ileri PvE yetenek seviyeleri</summary>
                  <p className="muted">
                    Mevcut hâl önerisi kayıtlı seviyeleri kullanır. Boş alan bilinmiyor, 0
                    geliştirilmemiş demektir. Maksimum öneride erişilebilir yeteneklerin en yüksek
                    seviyesi hedeflenir.
                  </p>
                  <div className="form-grid">
                    {pveSkills.map(skill => (
                      <Num
                        key={skill.key}
                        label={skill.label + ' seviyesi (0–5)'}
                        value={draft.pveLevels?.[skill.key] ?? null}
                        max={5}
                        onChange={value => pveLevel(skill.key, value)}
                      />
                    ))}
                  </div>
                </details>
              )}
              <p className="muted">
                İlk hazır tur: adventure başlangıcından itibaren; gemi / sockets dahil bilinen
                başlangıç turunu yaz; boşsa kaptanın başlangıç cooldown azaltması otomatik
                hesaplanır. Normal seviye üst sınırı: {c.maxLevel}.
              </p>
            </>
          )}
          {tab === 'rules' && (
            <>
              <div className="notice">
                Yalnızca bu karakterin mevcut geliştirmelerinde çalışan, koşullarını kontrol ettiğin
                special etkilerini kaydet. Bu alan yalnız special içindir; Captain, sailor ve seçilen
                Support etkileri otomatik değerlendirilir.
              </div>
              <h3>Special hangi etkileri kaldırıyor?</h3>
              <EffectsEditor
                value={draft.ability.effects}
                onChange={effects => ability({ effects, verified: false })}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.ability.verified}
                  onChange={e => ability({ verified: e.target.checked })}
                />
                Bu etkileri ve gereken koşulları kaynak metni / oyundan doğruladım.
              </label>
              <Num
                label="Geliştirme sonrası hedef cooldown (isteğe bağlı)"
                value={draft.ability.maxCooldown}
                max={99}
                onChange={maxCooldown => ability({ maxCooldown })}
              />
              <h3>Kaptanın güçlendirdiği üyeler</h3>
              <p className="muted">
                Seçili tiplerden veya sınıflardan birine uyan üyeler kabul edilir. Hiç seçim
                yapmazsan tüm üyeler kabul edilir. Karmaşık takım koşullarını ayrıca kontrol et.
              </p>
              <div className="selector">
                {[...TYPES, ...CLASSES].map(s => {
                  const key = TYPES.includes(s) ? 'captainTypes' : 'captainClasses';
                  return (
                    <button
                      className={draft.ability[key].includes(s) ? 'selected' : ''}
                      key={s}
                      onClick={() =>
                        ability({
                          [key]: draft.ability[key].includes(s)
                            ? draft.ability[key].filter(x => x !== s)
                            : [...draft.ability[key], s],
                          captainVerified: false,
                        })
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.ability.captainVerified}
                  onChange={e => ability({ captainVerified: e.target.checked })}
                />
                Bu kaptan kapsamını doğruladım.
              </label>
            </>
          )}
          {tab === 'source' && (
            <>
              {[
                ['Captain', c.captain],
                ['Special', c.special],
                ['Sailor', c.sailor],
                ['Support', c.support],
                ['Limit Break', c.limit],
                ['Level Limit Break', c.llb],
                ['Rumble ability', c.rumble?.ability],
                ['Rumble special', c.rumble?.special],
              ].map(([label, text]) => (
                <details key={label} open={label === 'Captain' || label === 'Special'}>
                  <summary>{label}</summary>
                  <p className="source-text">{text || 'Kaynakta bilgi yok.'}</p>
                </details>
              ))}
              <p className="muted">
                Kaynak: 2Shankz / OPTC Database. İngilizce yetenek metinleri korunmuştur.
              </p>
            </>
          )}
        </div>
        {error && <div className="error">{error}</div>}
        <footer className="modal-footer">
          {owned && (
            <button className="danger" onClick={onRemove}>
              <Trash2 size={16} />
              Kutudan çıkar
            </button>
          )}
          <button
            className="primary"
            onClick={() => {
              if (
                draft.ability.maxCooldown !== null &&
                draft.cooldown !== null &&
                draft.ability.maxCooldown > draft.cooldown
              ) {
                setError('Hedef cooldown mevcut cooldown’dan yüksek olamaz.');
                return;
              }
              onSave(draft);
            }}
          >
            <Check size={17} />
            {owned ? 'Değişiklikleri kaydet' : 'Kutuma ekle'}
          </button>
        </footer>
      </section>
    </div>
  );
}
