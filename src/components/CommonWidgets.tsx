import { useState, type ReactNode } from 'react';
import { Anchor } from 'lucide-react';
import { type Character, type Effect, MECHANICS } from '../model';

export function Avatar({ c, large = false }: { c: Character; large?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const key = c.id.padStart(4, '0') + (attempt === 1 ? '-1' : '');
  return (
    <div className={`avatar ${c.types[0] || 'INT'} ${large ? 'large' : ''}`}>
      {attempt < 2 ? (
        <img
          src={`./portraits/${key}.webp`}
          alt={c.name}
          loading="lazy"
          onError={() => setAttempt(n => n + 1)}
        />
      ) : (
        <Anchor size={large ? 30 : 20} />
      )}
      <small>#{c.id}</small>
    </div>
  );
}

export function Chips({ c }: { c: Character }) {
  return (
    <div className="chips">
      {c.types.map(t => (
        <span className={`type ${t}`} key={t}>
          {t}
        </span>
      ))}
      <span>{c.stars}★</span>
      {c.supportOnly && <span className="tag">Yalnız Support</span>}
      {c.classes.map(t => (
        <span key={t}>{t}</span>
      ))}
      {c.global !== true && (
        <span className="unknown">
          Global bilgisi {c.global === false ? 'yok' : 'belirsiz'}
        </span>
      )}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Anchor size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        placeholder="Bilinmiyor"
        value={value ?? ''}
        onChange={e => {
          const v = e.target.value;
          if (v === '') onChange(null);
          else if (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max)
            onChange(Number(v));
        }}
      />
    </label>
  );
}

export function EffectsEditor({
  value,
  onChange,
}: {
  value: Effect[];
  onChange: (e: Effect[]) => void;
}) {
  return (
    <div className="effects">
      {Object.entries(MECHANICS).map(([key, label]) => {
        const effect = value.find(e => e.mechanic === key);
        return (
          <label key={key}>
            <input
              type="checkbox"
              checked={!!effect}
              onChange={e =>
                onChange(
                  e.target.checked
                    ? [...value, { mechanic: key as Effect['mechanic'], turns: 3 }]
                    : value.filter(v => v.mechanic !== key)
                )
              }
            />
            <span>{label}</span>
            {effect && (
              <input
                aria-label={`${label} tur`}
                type="number"
                min={1}
                max={99}
                value={effect.turns}
                onChange={e => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= 99)
                    onChange(value.map(v => (v.mechanic === key ? { ...v, turns: n } : v)));
                }}
              />
            )}
            {effect && <small>tur</small>}
          </label>
        );
      })}
    </div>
  );
}
