import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchCharacters} from '../src/character-search';
import type {Character} from '../src/model';
test('manual matching searches versions and both dual types without selecting a guess',()=>{
 const chars=[{id:'1',name:'Vivi & Rebecca - Christmas',types:['DEX','STR']},{id:'2',name:'Vivi & Rebecca - Reunion',types:['PSY']},{id:'3',name:'Luffy',types:['STR']}] as Character[];
 assert.equal(searchCharacters(chars,'vivi rebecca').length,2);assert.deepEqual(searchCharacters(chars,'Rebecca','STR').map(c=>c.id),['1']);assert.deepEqual(searchCharacters(chars,'2').map(c=>c.id),['2']);assert.equal(searchCharacters(chars,'missing').length,0);
});
