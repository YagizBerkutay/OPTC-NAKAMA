import fs from 'node:fs';
import ts from 'typescript';
import JSON5 from 'json5';
const source=ts.createSourceFile('units',fs.readFileSync('.local/planner-source/units.js','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const expression=source.statements[0]?.expression;
if(!expression||!ts.isBinaryExpression(expression)||expression.left.getText(source)!=='window.units')throw Error('Unexpected unit source.');
const units=JSON5.parse(expression.right.getText(source));
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8'));
if(!fs.existsSync('.local/catalog-before-040.json'))fs.writeFileSync('.local/catalog-before-040.json',JSON.stringify(catalog));
let repaired=0;
for(const c of catalog.characters){
 const variants=[units[c.id+'-1'],units[c.id+'-2']].filter(u=>u&&typeof u.type==='string');
 if(!units[c.id]?.type&&variants.length){
  c.types=[...new Set(variants.map(u=>u.type))];
  c.forms=variants.map(u=>({id:u.id,name:u.name,type:u.type,classes:Array.isArray(u.class)?u.class:[u.class]}));
  repaired++;
 }
}
catalog.metadata.dualTypesSource='https://github.com/2Shankz/optc-db.github.io/tree/9db4cfd0c0542b61fb3dbec7a411f54a4b1f212e';
fs.writeFileSync('public/data/catalog.json',JSON.stringify(catalog));console.log({repaired});
