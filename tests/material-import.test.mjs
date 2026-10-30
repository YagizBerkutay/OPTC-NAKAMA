import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMaterialSources } from '../scripts/material-sources.mjs';
test('Global material import keeps named rewards and skull IDs while excluding manuals, boosts and JP data', () => {
  const result = collectMaterialSources({ Special: [
    { global: true, name: 'Skulls', 'All Difficulties': ['3519-skull', -78, 78, 'bad-id'], boosters: [78], Japan: [79], gamewith: [79] },
    { global: false, name: 'JP only', '1': [79] },
    { name: 'Unconfirmed region', '1': [79] },
  ] }, { Kizuna: [3519], Ray: [78] }, new Set(['3519-skull', '78', '79']));
  assert.equal(result['3519-skull'].rewards.length, 1);
  assert.equal(result['78'].rewards.length, 1);
  assert.deepEqual(result['79'].rewards, []);
  assert.deepEqual(result['3519-skull'].shops, []);
  assert.deepEqual(result['78'].shops, ['Ray']);
});
