import {_electron as electron} from 'playwright';import {expect} from '@playwright/test';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=10000');const state=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return state;}
const original=read(actual),profile=path.resolve('.local/support-ui-'+Date.now()),data=JSON.parse(fs.readFileSync('public/data/planner.json','utf8'));fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const app=await electron.launch({executablePath:path.resolve('release/v0.5.13/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile},timeout:60000});
const fixture={id:'test-support',name:'TEST · Support hedefleri',source:'https://onepiecetreasurecruise.fr/Arene/Mihawk.html',training:true,cached:true,difficulty:'Test fixture',reviewed:'',notes:'Test fixture, canlı rehber değildir.',stages:[{id:'test-1',name:'Test 1',turn:3,requirements:[{mechanic:'bind',turns:3}]},{id:'test-2',name:'Test 2',turn:5,requirements:[{mechanic:'despair',turns:3}]}]};
const report={version:'0.5.13',characters:original.box.length,errors:[],results:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
 assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('guides:index');ipcMain.handle('guides:index',()=>({guides:[{url:fixture.source,name:'TEST · Support',kind:'Arena'}]}));ipcMain.removeHandler('guides:encounter');ipcMain.handle('guides:encounter',()=>fixture);},fixture);
 for(const kind of ['teams','boss']){
  await page.locator('nav').getByRole('button',{name:kind==='teams'?'Otomatik kadrolar':'Boss planı',exact:true}).click();
  if(kind==='boss'){await page.getByRole('tab',{name:'Rehber / kayıtlı profil'}).click();await page.getByRole('combobox',{name:'Online boss rehberi'}).selectOption(fixture.source);}
  await page.getByRole('combobox',{name:'Takım türü',exact:true}).selectOption('STR');
  const button=page.getByRole('button',{name:kind==='teams'?'En iyi kadroları oluştur':'Bu bossa göre otomatik kadro kur',exact:true});await expect(button).toBeEnabled();await button.click();
  await page.locator('[data-scenario="evolve"] .plan-result').first().waitFor({timeout:240000,state:'attached'});
  const destination=path.resolve('.local/support-'+kind+'-0513.json');
  await app.evaluate(({BrowserWindow},file)=>{BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>item.setSavePath(file));},destination);
  await page.getByRole('button',{name:'Önerileri kaydet',exact:true}).click();
  await expect.poll(()=>fs.existsSync(destination)&&fs.statSync(destination).size>0,{timeout:15000}).toBeTruthy();
  const output=JSON.parse(fs.readFileSync(destination,'utf8'));assert.equal(output.groups.length,3);
  for(const group of output.groups){
   assert.ok(group.teams.length);
   for(const team of group.teams){
    const owned=team.members.filter(m=>!m.friend),supports=team.synergy.supports,roster=[...owned,...supports.map(s=>s.member)];
    assert.equal(new Set(roster.map(m=>m.sourceId)).size,roster.length);
    const identities=roster.flatMap(m=>[...new Set(data.units[m.character.id].families)]);assert.equal(new Set(identities).size,identities.length);
    for(const s of supports){
     assert.ok(s.targetScope);const target=owned.find(m=>m.character.id===s.targetId);assert.ok(target);
     const types=[...s.targetScope.matchAll(/\[(STR|DEX|QCK|PSY|INT)\]/g)].map(m=>m[1]);if(types.length)assert.ok(target.character.types.some(t=>types.includes(t)));
     const classes=['Fighter','Slasher','Striker','Shooter','Free Spirit','Cerebral','Powerhouse','Driven'].filter(c=>s.targetScope.includes(c));if(classes.length&&/characters/i.test(s.targetScope))assert.ok(target.character.classes.some(c=>classes.includes(c)));
     const scopes=[...(data.units[s.member.character.id].abilities?.support||[]),...data.units[s.member.character.id].llb.flatMap(t=>t?.support||[])].map(a=>a.Characters);assert.ok(scopes.includes(s.targetScope));
    }
   }
   await page.locator(`[data-scenario-tab="${group.scenario}"]`).click();const card=page.locator(`[data-scenario="${group.scenario}"] .plan-result`).first(),supports=group.teams[0].synergy.supports;
   assert.equal(await card.locator('.support-plan').count(),supports.length);
   if(supports.length){await card.locator('.support-plans>summary').click();for(const s of supports)await expect(card.locator(`[data-target-scope="${s.targetScope}"]`).first()).toContainText('Takılabildiği karakterler: '+s.targetScope);}
   report.results.push({kind,scenario:group.scenario,teams:group.teams.length,supports:supports.length});
  }
  await page.screenshot({path:'.local/support-'+kind+'-0513.png'});console.log(JSON.stringify({completed:kind}));
 }
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);report.pass=true;report.statePreserved=true;console.log(JSON.stringify(report));
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync('.local/support-desktop-0513-result.json',JSON.stringify(report,null,2));await app.close();}
