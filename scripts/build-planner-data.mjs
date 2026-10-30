import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import JSON5 from 'json5';
import { collectMaterialSources } from './material-sources.mjs';

// Parse the first data assignment as a literal. Never execute upstream JavaScript.
function readData(name) {
  const text = fs.readFileSync(path.join('.local/planner-source', name + '.js'), 'utf8');
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const expression = source.statements[0]?.expression;
  if (!expression || !ts.isBinaryExpression(expression) || expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) throw Error('Data assignment missing: ' + name);
  return JSON5.parse(expression.right.getText(source).replace(/^(\s*)(\d+):/gm, '$1"$2":'));
}
const sourceUnits=readData('units');
const catalog = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8'));
const details = readData('details'), cooldowns = readData('cooldowns'), evolutions = readData('evolutions'), drops = readData('drops'), tags = readData('tags');
const rumble = new Map(JSON.parse(fs.readFileSync('.local/planner-source/rumble.json', 'utf8')).units.map(u => [String(u.id), u]));
function resolveRumble(id, seen = new Set()) {
  const value = rumble.get(String(id));
  if (!value) return null;
  if (seen.has(String(id))) throw Error('Circular rumble reference: ' + id);
  seen.add(String(id));
  const inherited = value.basedOn ? resolveRumble(value.basedOn, seen) : {};
  if (value.basedOn && !inherited) throw Error('Missing rumble reference: ' + id);
  return { ...inherited, ...value, ...(value.global || {}) };
}
// Family spreads name canonical identities, unlike ambiguous aliases such as "BB".
const familyKeys = {};
const familySource = ts.createSourceFile('families', fs.readFileSync('.local/planner-source/families.js', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
function visitFamilies(node) {
  if (ts.isBinaryExpression(node) && node.left.getText(familySource) === 'window.families' && ts.isObjectLiteralExpression(node.right)) {
    for (const property of node.right.properties) {
      if (!ts.isPropertyAssignment(property) || !ts.isArrayLiteralExpression(property.initializer)) throw Error('Unexpected family literal');
      const id = property.name.getText(familySource).replace(/["']/g, '');
      familyKeys[id] = property.initializer.elements.map(element => {
        if (ts.isSpreadElement(element) && ts.isIdentifier(element.expression)) return element.expression.text;
        if (ts.isStringLiteral(element)) return 'literal:' + element.text;
        throw Error('Unexpected family identity');
      });
    }
  }
  ts.forEachChild(node, visitFamilies);
}
visitFamilies(familySource);
const ids = new Set(catalog.characters.map(c => c.id));
const locations = {};
for (const [group, islands] of Object.entries(drops)) for (const island of islands) {
  if (island.global === false) continue;
  for (const [stage, materials] of Object.entries(island)) if (/^\d+$/.test(stage) && Array.isArray(materials)) for (const id of materials) {
    if (typeof id !== 'number') continue;
    const key = String(id), label = `${group} / ${island.name} / ${stage}`;
    (locations[key] ??= []).push(label);
  }
}
for (const key of Object.keys(locations)) locations[key] = [...new Set(locations[key])].slice(0, 8);
const serializeRumble=r=>r?{ ability: r.ability || [], special: r.special || [], llbability: r.llbability || [], llbspecial: r.llbspecial || [], stats: r.stats || {}, cost: r.cost, resilience: r.resilience || [], llbresilience:r.llbresilience || [], superspecial:r.superspecial || [], llbsuperspecial:r.llbsuperspecial || [], gpability:r.gpability || [], gpspecial:r.gpspecial || [], gpcondition:r.gpcondition || [], llbgpability:r.llbgpability || [], llbgpspecial:r.llbgpspecial || [], llbgpcondition:r.llbgpcondition || [], pattern:r.pattern || [] }:null;
const units = {};
const vsForms=[];
for (const c of catalog.characters) {
  const d = details[c.id] || {};
  const e = evolutions[c.id];
  const destinations = e ? (Array.isArray(e.evolution) ? e.evolution : [e.evolution]) : [];
  const edges = destinations.flatMap((destination, i) => {
    if (!ids.has(String(destination))) return [];
    const materials = (Array.isArray(e.evolution) ? e.evolvers[i] : e.evolvers) || [];
    return [{ to: String(destination), materials: materials.map(String) }];
  });
  const r = resolveRumble(c.id);
  const forms=[];
  for(let index=1;index<=2;index++){
    const key=c.id+'.'+index,form=sourceUnits[c.id+'-'+index];
    if(!form||!resolveRumble(key))continue;
    forms.push({id:key,name:form.name+' · VS '+index,types:[form.type],classes:Array.isArray(form.class)?form.class:[form.class],hp:form.maxHP,atk:form.maxATK,rcv:form.maxRCV});
    vsForms.push({base:c.id,key,index});
  }
  units[c.id] = {
    families: familyKeys[c.id] || [],
    tags: (tags[c.id] || []).filter(t => typeof t === 'string').concat(Array.isArray(tags[c.id]?.[0]) ? tags[c.id][0].filter(t => tags[c.id].every(form => Array.isArray(form) && form.includes(t))) : []),
    abilities: Object.fromEntries(['swap','superSpecial','superSpecialCriteria','superSpecialNotes','VSCondition','VSSpecial','lastTap','superTandem','superTandemBoost','rush','sailor','potential','support'].filter(key => d[key]).map(key => [key, d[key]])),
    captain: d.captain || c.captain, special: d.special || c.special,
    cooldown: cooldowns[c.id] || null, limit: d.limit || [],
    llb: (d.lLimit || []).map(t => t ? { captain: t.captain, special: t.special,sailor:t.sailor,support:t.support, rAbility: t.rAbility, rSpecial: t.rSpecial, rResilience:t.rResilience, rSuperSpecial:t.rSuperSpecial, gpAbility:t.gpAbility, gpSpecial:t.gpSpecial } : null),
    evolutions: edges,
    ...(forms.length?{rumbleForms:forms}:{}),
    rumble: serializeRumble(r),
  };
}
for(const {base,key,index} of vsForms){
  const unit=units[base],form=unit.rumbleForms.find(f=>f.id===key);
  const formTags=tags[base];
  units[key]={...unit,rumbleForms:undefined,evolutions:[],families:familyKeys[base+'-'+index]|| (unit.families.length===2?[unit.families[index-1]]:unit.families),tags:Array.isArray(formTags?.[0])?formTags[index-1]:unit.tags,rumble:serializeRumble(resolveRumble(key))};
}
const commit = JSON.parse(fs.readFileSync('.local/planner-source/commit.json', 'utf8'));
const materialIds = new Set(Object.values(units).flatMap(u => u.evolutions.flatMap(e => e.materials)));
const materialSources = collectMaterialSources(drops, readData('shops'), materialIds);
if (fs.existsSync('public/data/material-images.json')) {
  const images = JSON.parse(fs.readFileSync('public/data/material-images.json', 'utf8')).images;
  for (const [id, record] of Object.entries(materialSources)) if (images[id]) record.image = images[id];
}
const output = { metadata: { source: '2Shankz/optc-db.github.io', url: 'https://github.com/2Shankz/optc-db.github.io', ...commit, builtAt: new Date().toISOString(), materialShopSource: 'https://github.com/2Shankz/optc-db.github.io/blob/master/common/data/shops.js' }, units, locations, materialSources };
fs.writeFileSync('public/data/planner.json', JSON.stringify(output));
console.log(JSON.stringify({ units: Object.keys(units).length, evolutionEdges: Object.values(units).reduce((n, u) => n + u.evolutions.length, 0), materialLocations: Object.keys(locations).length, bytes: fs.statSync('public/data/planner.json').size, commit: commit.sha }));
