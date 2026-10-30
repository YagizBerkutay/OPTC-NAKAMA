import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveCrewText} from '../src/crew-conditions';
import {parseEffects} from '../src/planning';
import type {Character} from '../src/model';
test('known captain and class count unlock conditional effects; HP and ambiguous dual captain stay uncertain',()=>{
 const c={types:['STR'],classes:['Fighter']} as Character;
 assert.deepEqual(parseEffects(resolveCrewText('If your Captain is STR, reduces Bind duration by 5 turns.',c,[c])),[{mechanic:'bind',turns:5}]);
 assert.deepEqual(parseEffects(resolveCrewText('If your crew contains at least 3 Fighter characters, reduces Paralysis duration by 6 turns.',c,[c,c,c])),[{mechanic:'paralysis',turns:6}]);
 assert.deepEqual(parseEffects(resolveCrewText('If HP is below 50%, reduces Bind duration by 9 turns.',c,[c])),[]);
 assert.deepEqual(parseEffects(resolveCrewText('If your Captain is STR, reduces Bind duration by 5 turns.',{...c,types:['STR','DEX']},[c])),[]);
});
