import ts from 'typescript';
import JSON5 from 'json5';
import {createHash} from 'node:crypto';

// Upstream files are data assignments, never executable code in this importer.
export function readAssignment(text, name) {
  const source=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const expression=source.statements[0]?.expression;
  if(!expression||!ts.isBinaryExpression(expression)||expression.operatorToken.kind!==ts.SyntaxKind.EqualsToken||expression.left.getText(source)!=='window.'+name)throw Error('Unexpected data assignment: '+name);
  const right=expression.right,offset=right.getStart(source),edits=[];
  function visit(node){
    if(ts.isPropertyAssignment(node)&&ts.isNumericLiteral(node.name))edits.push({start:node.name.getStart(source)-offset,end:node.name.end-offset,text:JSON.stringify(node.name.text)});
    ts.forEachChild(node,visit);
  }
  visit(right);
  let literal=right.getText(source);
  for(const edit of edits.sort((a,b)=>b.start-a.start))literal=literal.slice(0,edit.start)+edit.text+literal.slice(edit.end);
  return JSON5.parse(literal);
}
export function textOf(value) {
  if(value===undefined||value===null)return '';
  if(typeof value!=='object')return String(value);
  if(Array.isArray(value))return value.map(textOf).filter(Boolean).join('\n');
  return Object.entries(value).map(([key,item])=>key+': '+textOf(item)).join('\n');
}
// Support-slot-exclusive cards have no sockets, Captain Ability or Special.
// Cost is not a role marker: ordinary playable support recruits also cost 1.
export function supportOnlyFromSource(unit,details){return unit.sockets===0&&!!textOf(details.support).trim()&&!textOf(details.captain).trim()&&!textOf(details.special).trim();}
export function buildCatalog({units,details,flags,rumble,previous,revision,now=new Date().toISOString()}) {
  const byId=new Map(rumble.units.map(unit=>[String(unit.id),unit]));
  const resolved=new Map();
  function resolve(id,seen=new Set()) {
    if(resolved.has(id))return resolved.get(id);
    const value=byId.get(id);if(!value)return null;
    if(seen.has(id))throw Error('Circular rumble reference: '+id);seen.add(id);
    const inherited=value.basedOn?resolve(String(value.basedOn),seen):{};
    if(value.basedOn&&!inherited)throw Error('Missing rumble reference: '+id);
    const result={...inherited,...value,...value.global};resolved.set(id,result);return result;
  }
  const characters=Object.values(units).map(unit=>{
    if(!unit||typeof unit.id!=='string'||!/^\d+(?:-[12])?$/.test(unit.id)||typeof unit.name!=='string')throw Error('Invalid upstream character');
    const d=details[unit.id]||{},r=resolve(unit.id);
    const forms=[units[unit.id+'-1'],units[unit.id+'-2']].filter(Boolean);
    const types=unit.type?[unit.type]:[...new Set(forms.map(form=>form.type).filter(Boolean))];
    const flag=flags[unit.id];
    return {id:unit.id,name:unit.name,types,classes:Array.isArray(unit.class)?unit.class:unit.class?[unit.class]:[],stars:String(unit.stars),cost:unit.cost??0,maxLevel:unit.maxLevel??99,hp:unit.maxHP??0,atk:unit.maxATK??0,rcv:unit.maxRCV??0,
      global:flag?.global===1?true:flag?.global===0?false:null,
      ...(supportOnlyFromSource(unit,d)?{supportOnly:true}:{}),
      captain:textOf(d.captain),special:textOf(d.special),specialName:textOf(d.specialName),support:textOf(d.support),sailor:textOf(d.sailor),limit:textOf(d.limit),llb:textOf(d.lLimit),
      rumble:r?{cost:r.cost??unit.cost??0,stats:r.stats||{},special:textOf(r.special),ability:textOf(r.ability),raw:textOf(r),abilityLevels:r.ability||[],specialLevels:r.special||[]}:null,
      ...(forms.length?{forms:forms.map(form=>({id:form.id,name:form.name,type:form.type,classes:Array.isArray(form.class)?form.class:[form.class]}))}:{})};
  });
  const ids=new Set(characters.map(c=>c.id));
  // A removed upstream entry must not invalidate a user's previously saved box.
  for(const old of previous?.characters||[])if(!ids.has(old.id)){characters.push(old);ids.add(old.id);}
  const hash=createHash('sha256').update(JSON.stringify(characters)).digest('hex');
  return {metadata:{source:'2Shankz/optc-db.github.io',url:'https://github.com/2Shankz/optc-db.github.io',license:'GPL-3.0',importedAt:now,hash,total:characters.length,global:characters.filter(c=>c.global===true).length,...revision},characters};
}
