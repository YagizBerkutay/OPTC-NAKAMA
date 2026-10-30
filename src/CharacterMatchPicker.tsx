import { useMemo, useState } from 'react';
import type { Character } from './model';
import { searchCharacters } from './character-search';

export default function CharacterMatchPicker({ characters, busy, itemKey, onChoose }: { characters: Character[]; busy: boolean; itemKey: string; onChoose: (id: string) => void }) {
  const [query, setQuery] = useState(''), [type, setType] = useState('');
  const results = useMemo(() => searchCharacters(characters, query, type), [characters, query, type]);
  return <details className="match-picker"><summary>İsim / tip ile elle eşleştir</summary>
    <input aria-label={`Karakter adı ara ${itemKey}`} placeholder="Luffy, Vivi, Rebecca veya ID…" value={query} disabled={busy} onChange={e => setQuery(e.target.value)} />
    <select aria-label={`Karakter tipi ${itemKey}`} value={type} disabled={busy} onChange={e => setType(e.target.value)}><option value="">Tüm tipler</option>{['STR', 'DEX', 'QCK', 'PSY', 'INT'].map(t => <option key={t}>{t}</option>)}</select>
    {(query.trim() || type) && <><small>{results.length} versiyon bulundu · ilk 30 gösteriliyor</small><div className="match-options">{results.slice(0, 30).map(c => <button key={c.id} disabled={busy} onClick={() => onChoose(c.id)}><img src={`./portraits/${c.id.padStart(4, '0')}.webp`} alt="" loading="lazy" /><span><strong>{c.name}</strong><small>#{c.id} · {c.types.join(' / ')} · {c.stars}★</small><small>{c.classes.join(' · ')}</small></span></button>)}</div></>}
  </details>;
}
