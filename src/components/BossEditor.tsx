import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { type Boss, type Stage } from '../model';
import { EffectsEditor, Num } from './CommonWidgets';

interface BossEditorProps {
  boss: Boss;
  onSave: (b: Boss) => void;
  onClose: () => void;
}

export function BossEditor({ boss, onSave, onClose }: BossEditorProps) {
  const [d, setD] = useState(structuredClone(boss));
  const [error, setError] = useState('');

  const stage = (id: string, v: Partial<Stage>) =>
    setD(b => ({
      ...b,
      stages: b.stages.map(s => (s.id === id ? { ...s, ...v } : s)),
    }));

  return (
    <div className="overlay">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Boss düzenle">
        <button className="icon close" aria-label="Kapat" onClick={onClose}>
          <X />
        </button>
        <small className="eyebrow">AŞAMA AŞAMA</small>
        <h2>Boss profili</h2>
        <div className="modal-body">
          <label className="field">
            Boss adı
            <input
              value={d.name}
              maxLength={160}
              onChange={e => setD({ ...d, name: e.target.value })}
            />
          </label>
          <label className="field">
            Kaynak / mekanik notları
            <textarea
              value={d.source}
              maxLength={1000}
              onChange={e => setD({ ...d, source: e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={d.training}
              onChange={e => setD({ ...d, training: e.target.checked })}
            />
            Eğitim / örnek senaryo
          </label>
          {d.stages.map((s, i) => (
            <div className="stage-editor" key={s.id}>
              <div className="row">
                <h3>{i + 1}. aşama</h3>
                <button
                  className="icon"
                  aria-label="Aşamayı sil"
                  disabled={d.stages.length === 1}
                  onClick={() =>
                    setD({ ...d, stages: d.stages.filter(x => x.id !== s.id) })
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="form-grid">
                <label className="field">
                  Aşama adı
                  <input
                    value={s.name}
                    maxLength={100}
                    onChange={e => stage(s.id, { name: e.target.value })}
                  />
                </label>
                <Num
                  label="Adventure başlangıcından itibaren tur"
                  value={s.turn}
                  onChange={turn => stage(s.id, { turn: turn ?? 0 })}
                />
              </div>
              <EffectsEditor
                value={s.requirements}
                onChange={requirements => stage(s.id, { requirements })}
              />
            </div>
          ))}
          <button
            className="secondary"
            disabled={d.stages.length >= 10}
            onClick={() =>
              setD({
                ...d,
                stages: [
                  ...d.stages,
                  {
                    id: crypto.randomUUID(),
                    name: `Aşama ${d.stages.length + 1}`,
                    turn: (d.stages.at(-1)?.turn || 0) + 3,
                    requirements: [],
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            Aşama ekle
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <footer className="modal-footer">
          <button
            className="primary"
            onClick={() => {
              if (!d.name.trim() || !d.source.trim()) {
                setError('Boss adı ve kaynak/not alanını doldur.');
                return;
              }
              if (d.stages.some((s, i) => i > 0 && s.turn < d.stages[i - 1].turn)) {
                setError('Aşamalar artan tur sırasıyla olmalı.');
                return;
              }
              onSave(d);
            }}
          >
            Profili kaydet
          </button>
        </footer>
      </section>
    </div>
  );
}
