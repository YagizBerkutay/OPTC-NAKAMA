import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { materialInfo, teamMaterials } from '../src/evolution-materials';
import type { PlannerData, PlanMember } from '../src/planning';
import type { Character } from '../src/model';
const data: PlannerData = JSON.parse(fs.readFileSync('public/data/planner.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8'));
const characters = new Map<string, Character>(catalog.characters.map((c: Character) => [c.id, c]));
test('Oden recipe matches the five identical portrait skulls and distinguishes tickets from insignia', () => {
  const edge = data.units['3175'].evolutions.find(e => e.to === '3519')!;
  assert.deepEqual(edge.materials, Array(5).fill('3519-skull'));
  const record = data.materialSources!['3519-skull'];
  assert.ok(record.rewards.some(r => r.group === 'Kizuna Clash' && r.island === 'Blackbeard'));
  const info = materialInfo('3519-skull', '', '3519', [], record, characters.get('3519')!.name);
  assert.ok(info.name.includes('Oden'));
  assert.equal(info.image, './materials/3519-skull.webp');
  assert.ok(info.routes.some(r => r.status === 'shop-check' && r.currency === 'Kizuna Insignia' && r.note.includes('Tickets farklıdır')));
  assert.ok(info.routes.some(r => r.status === 'recorded-reward' && r.path.includes('Blackbeard')));
  assert.ok(!info.text.includes('50'));
});
test('exact skull identity separates story, TM, Germa and Kizuna routes', () => {
  const info = (id: string) => materialInfo(id, '', '3519', [], data.materialSources![id]);
  assert.ok(info('1446-skull').routes.some(r => r.path.includes('Story → 3D2Y → Bölüm 6')));
  assert.ok(!info('1446-skull').routes.some(r => r.currency === 'Kizuna Insignia'));
  assert.ok(info('2444-skull').routes.some(r => r.path.includes('Treasure Map Exchange') && r.currency === 'Treasure Tickets'));
  assert.ok(info('2138-skull').routes.some(r => r.path.includes('Unlockable Quests → Germa Resurrection Plan!')));
  assert.ok(info('2232-skull').routes.some(r => r.path.includes('Kami Rises Again!')));
  assert.ok(info('2245-skull').routes.some(r => r.url.endsWith('/Sanji%20Vinsmoke.html')));
  assert.ok(info('2300-skull').routes.some(r => r.url.endsWith('/Franky.html')));
  assert.ok(info('2454-skull').routes.some(r => r.path.includes('Germa 66 Counterattack')));
  const unknown = info('99999-skull');
  assert.ok(unknown.name.includes('#99999')); // Never rename material to target #3519.
  assert.deepEqual(unknown.routes.map(r => r.status), ['unknown']);
});
test('named difficulties and actual material shop IDs are imported', () => {
  assert.ok(data.materialSources!['2232-skull'].rewards.some(r => r.stage === 'All Difficulties'));
  assert.ok(data.materialSources!['78'].shops.includes('Ray'));
  assert.ok(data.materialSources!['78'].rewards.some(r => r.group === 'Story Island'));
  assert.ok(!data.materialSources!['3620-skull'].shops.includes('Kizuna'), 'Selling Oden #3620 is not evidence that its skull is sold');
});
test('total recipe includes reserves, every evolution step and shared materials; friends excluded', () => {
  const member = (sourceId: string, path: PlanMember['path'], friend = false) => ({ sourceId, path, friend } as PlanMember);
  const team = { members: [member('3175', [{ from: '3175', to: '3519', materials: Array(5).fill('3519-skull') }]), member('x', [{ from: 'x', to: 'y', materials: ['78', '78'] }, { from: 'y', to: 'z', materials: ['78'] }]), member('friend', [{ from: 'x', to: '3519', materials: ['3519-skull'] }], true)], reserves: [member('reserve', [{ from: 'a', to: 'b', materials: ['78'] }])] };
  const rows = teamMaterials(team, characters, data);
  assert.equal(rows.find(r => r.id === '3519-skull')!.count, 5);
  assert.equal(rows.find(r => r.id === '78')!.count, 4);
  assert.equal(rows.find(r => r.id === '78')!.uses.length, 3);
  assert.equal(JSON.parse(JSON.stringify(rows))[0].info.routes[0].currency, 'Kizuna Insignia');
});
test('all generated material images are present and only valid local paths', () => {
  for (const r of Object.values(data.materialSources!)) if (r.image) {
    assert.match(r.image, /^\.\/(?:materials|portraits)\/[\dA-Za-z-]+\.webp$/);
    assert.ok(fs.existsSync('public/' + r.image.slice(2)));
  }
});
