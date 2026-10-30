import type { Character } from './model';
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function searchCharacters(characters: Character[], query: string, type = '') {
  const terms = normalize(query).split(' ').filter(Boolean);
  return characters.filter(c => (!type || c.types.includes(type)) && terms.every(term => normalize(`${c.id} ${c.name}`).includes(term))).sort((a, b) => Number(b.id) - Number(a.id));
}
