import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=10000');const state=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return state;}
const original=read(actual),profile=path.resolve('.local/merge-live-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const app=await electron.launch({executablePath:path.resolve(process.env.OPTC_TEST_EXE||'release/v0.5.15/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}});
const report={version:'0.5.15',characters:original.box.length,errors:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',msg=>{if(msg.text().startsWith('scan:'))console.log(msg.text());});
 await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 await page.evaluate(()=>window.nakama.onBossProgress(text=>console.log('scan:'+text)));
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();
 await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();
 await Promise.race([
  page.locator('[data-boss-observation]').waitFor({timeout:300000}),
  page.locator('.boss-source .error').waitFor({timeout:300000}).then(async()=>{throw Error(await page.locator('.boss-source .error').innerText());})
 ]);
 await expect(page.locator('.behavior-title')).toContainText('Clash!! Luffytaro: Subdued');
 await expect(page.locator('.behavior-title')).toContainText('10★');
 assert.equal(await page.locator('.behavior-stage').count(),5);
 assert.equal(await page.locator('[data-behavior-status=notListed]').count(),1);
 const fourth=page.locator('.behavior-stage').nth(3);await fourth.locator('summary').click();
 for(const text of ['5 turn(s) 5000 damage Burn','8 turn(s) Top-Row Despair','6 turn(s) Middle-Row Bind','30000 damage'])await expect(fourth).toContainText(text);
 assert.equal(await fourth.locator('[data-trigger=defeated]').count(),1);
 const fifth=page.locator('.behavior-stage').nth(4);await fifth.locator('summary').click();
 await expect(fifth).toContainText('INT type change');
 await expect(fifth).toContainText('INTERRUPTION Slot Change');
 assert.equal(await fifth.locator('[data-trigger=interrupt]').count(),1);
 await expect(fifth).toContainText('Reduce damage taken 80%');
 await expect(fifth).toContainText('Damage over 1000 99% Reduction');
 await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).click();
 await page.locator('[data-scenario="evolve"] .plan-result').first().waitFor({timeout:300000,state:'attached'});
 const destination=path.resolve('.local/combat-desktop-0515-export.json');
 await app.evaluate(({BrowserWindow},file)=>{BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>item.setSavePath(file));},destination);
 await page.getByRole('button',{name:'Önerileri kaydet',exact:true}).click();
 await expect.poll(()=>fs.existsSync(destination)&&fs.statSync(destination).size>0,{timeout:15000}).toBeTruthy();
 const output=JSON.parse(fs.readFileSync(destination,'utf8')),data=JSON.parse(fs.readFileSync('public/data/planner.json','utf8'));report.results=[];
 for(const group of output.groups){
  assert.ok(group.teams.length);
  for(const team of group.teams){
   assert.ok(team.combat.windows.length===5);assert.ok(team.combat.windows[3].instructions.some(s=>s.includes('30.000')));
   assert.ok(team.combat.windows[4].instructions.some(s=>s.includes('orb değiştirme')));
   assert.ok(team.combat.windows[4].issues.some(s=>s.includes('tek turda geçiş')));
   assert.ok(['blocked','unverified'].includes(team.combat.windows[4].status));
   const owned=team.members.filter(m=>!m.friend),supports=team.synergy.supports,roster=[...owned,...supports.map(s=>s.member)];
   assert.equal(new Set(roster.map(m=>m.sourceId)).size,roster.length);
   const identities=roster.flatMap(m=>[...new Set(data.units[m.character.id].families)]);assert.equal(new Set(identities).size,identities.length);
   const specialPattern=/\b(?:changes?|converts?|randomizes?|shuffles?)\b[^.;\n]{0,90}\b(?:orbs?|slots?)\b/i;
   const lastUsed=team.schedule[4].used;
   for(const m of team.members)if(lastUsed.some(s=>s.endsWith('#'+m.character.id+' '+m.character.name)))assert.ok(!specialPattern.test(m.specialText),'Orb-changing special scheduled into interrupt');
   for(const s of supports){assert.ok(s.targetScope);assert.ok(owned.some(m=>m.character.id===s.targetId));const scopes=[...(data.units[s.member.character.id].abilities?.support||[]),...data.units[s.member.character.id].llb.flatMap(t=>t?.support||[])].map(a=>a.Characters);assert.ok(scopes.includes(s.targetScope));}
  }
  await page.locator('[data-scenario-tab="'+group.scenario+'"]').click();
  const card=page.locator('[data-scenario="'+group.scenario+'"] .plan-result').first();
  await expect(card.locator('.boss-combat')).toContainText('30.000');
  await expect(card.locator('.boss-combat')).toContainText('orb değiştirme');
  assert.equal(await card.locator('[data-combat-window]').count(),5);
  report.results.push({scenario:group.scenario,teams:group.teams.length,status:group.teams[0].combat.status});
 }
 console.log('All three live boss combat scenarios verified.');
 await page.screenshot({path:'.local/boss-merge-live-0515.png'});
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);
 assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);
 report.pass=true;report.statePreserved=true;report.stages=5;
 console.log(JSON.stringify(report));
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync('.local/boss-merge-live-0515-result.json',JSON.stringify(report,null,2));await app.close();}
