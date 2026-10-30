import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {parseGuide,parseIndex,safeUrl}=createRequire(import.meta.url)('../electron/guides.cjs');
const url='https://onepiecetreasurecruise.fr/Arene/Test.html';
const fixture=(rows:string)=>`<h1>Test</h1><p>Captain: Lien 99 tours</p><h2>Guide de l'Arène</h2><table>${rows}</table><h2>Souhaits de Chopper Man</h2>`;
const row=(label:string,body:string)=>`<tr><td>${label}</td><td><b>Boss</b><ul><u>HP :</u> 5 000 000 HP.<br><u>Actions préventives :</u><ul>${body}</ul></ul></td></tr>`;
test('guide parser separates preemptive duration effects from later turns and special counters',()=>{
 const r=parseGuide(fixture(row('Stage 3',`Il mettra le "Lien" pendant 5 tours.<br><u>1er tour :</u>Il mettra la Paralysie pendant 9 tours.<br><u>Si un coup spécial qui bloque le multiplicateur de combos est utilisé :</u>Il mettra le "Lien des coups spéciaux" pendant 10 tours.`)+row('Boss',`Il réduira les dégâts subis pendant 6 tours.<br>Il augmentera sa défense pendant 10 tours.<br>Il se mettra une immunité aux poisons pendant 99 tours.`)),url);
 assert.deepEqual(r.stages[0].requirements,[{mechanic:'bind',turns:5}]);assert.equal(r.stages[1].turn,3);assert.deepEqual(r.stages[1].requirements,[{mechanic:'damageReduction',turns:6},{mechanic:'defenseUp',turns:10}]);assert.match(r.stages[0].notes,/Paralysie/);assert.ok(r.blockedSpecialPatterns.length);
});
test('guide parser refuses empty draft and absent battle section',()=>{assert.throws(()=>parseGuide('<h1>Test</h1>',url));assert.throws(()=>parseGuide(fixture(row('Boss','')),url));});
test('guide joins HTML formatting line breaks and extracts immediate special limits and rewind',()=>{
 const r=parseGuide(fixture(row('Stage 4',`Il mettra le "Lien"\n sur les personnages pendant 5 tours.<br>Il inversera le temps\n de chargement des coups spéciaux de tous les personnages d'un tour.<br>Il limitera l'utilisation des coups spéciaux à 2 pendant 10 tours.<br>`)),url);
 assert.deepEqual(r.stages[0].requirements,[{mechanic:'bind',turns:5}]);assert.equal(r.stages[0].cooldownRewind,1);assert.equal(r.stages[0].specialLimit,2);
});
test('guide network accepts only bounded https provider paths and deduplicates index links',()=>{for(const bad of ['file:///C:/Windows','https://localhost/Arene/a.html','https://onepiecetreasurecruise.fr:8443/Arene/a.html','https://onepiecetreasurecruise.fr/Arene/../../other.html','http://onepiecetreasurecruise.fr/Arene/a.html'])assert.throws(()=>safeUrl(bad));assert.equal(parseIndex('<a href="Arene/Mihawk.html">x</a><a href="Arene/Mihawk.html">x</a><a href="https://evil.com/a.html">x</a>','https://onepiecetreasurecruise.fr/Arene.html').length,1);});
