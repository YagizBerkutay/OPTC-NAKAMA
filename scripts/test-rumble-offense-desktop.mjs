import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const packaged=process.argv.includes('--packaged');
const actual=new DatabaseSync(path.join(process.env.APPDATA,'optc-nakama','nakama.sqlite'),{readOnly:true});
actual.exec('PRAGMA busy_timeout=10000');
const original=JSON.parse(actual.prepare('SELECT payload FROM state WHERE id=1').get().payload);actual.close();
const profile=path.resolve('.local/offense-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const rules=JSON.parse(fs.readFileSync('.local/rumble-live-rules.json','utf8'));
const report={packaged,box:original.box.length,scenarios:[],errors:[]};let app;
try{
  app=await electron.launch({executablePath:path.resolve(packaged?'release/win-unpacked/OPTC Nakama.exe':'node_modules/electron/dist/electron.exe'),args:packaged?['--disable-gpu']:['.','--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile},timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
  const before=JSON.parse(await page.evaluate(()=>window.nakama.load()));
  await page.locator('nav').getByRole('button',{name:'Pirate Rumble',exact:true}).click();
  // Exercise the full UI/worker path with the saved live Block C rules, without moving the game.
  await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('adb:connect');ipcMain.handle('adb:connect',()=>true);ipcMain.removeHandler('rumble:readRules');ipcMain.handle('rumble:readRules',()=>fixture);},rules);
  await page.getByRole('button',{name:'En güçlü Rumble kadrolarını kur',exact:true}).click();
  await page.locator('[data-scenario="evolve"] .plan-result').first().waitFor({timeout:180000,state:'attached'});
  assert.ok((await page.locator('[data-rumble-rules]').innerText()).includes('Block C'));
  for(const scenario of ['current','power','evolve']){
    await page.locator(`[data-scenario-tab="${scenario}"]`).click();
    const card=page.locator(`[data-scenario="${scenario}"] .plan-result`).first(),panel=card.locator('.rumble-offense');
    const text=await panel.innerText(),direct=Number(text.match(/(\d+) \/ 5 doğrudan hasar kaynağı/)?.[1]);
    assert.ok(direct>=2);assert.equal(await card.locator('.plan-crew.five .plan-slot').count(),5);assert.ok(await card.locator('.plan-crew.reserves .plan-slot').count()<=3);
    assert.equal(await panel.locator('li').count(),5);assert.ok(text.includes('temel CT'));assert.ok(text.includes('yedekler sahaya girince'));
    const cost=Number((await card.locator(':scope > .row .tag').innerText()).match(/· (\d+) maliyet/)?.[1]);assert.ok(cost<=original.settings.costLimit);
    if(scenario==='power')assert.equal(await card.locator('.evolution-label').count(),0);
    if(scenario!=='current')assert.ok((await card.locator('.plan-crew.five .plan-slot').allTextContents()).every(s=>Number(s.match(/(\d+)\. seviye/)?.[1])<=100));
    report.scenarios.push({scenario,direct,cost,risk:await panel.getAttribute('data-offense-risk'),text});
  }
  const exportedPath=path.resolve('.local/rumble-offense-export-'+Date.now()+'.json');
  // Electron download events are exposed on Session, not Playwright's Page.
  await app.evaluate(({app,BrowserWindow},destination)=>{app.offenseDownloadState='pending';BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>{item.setSavePath(destination);item.once('done',(_event,state)=>{app.offenseDownloadState=state;});});},exportedPath);
  await page.getByRole('button',{name:'Önerileri kaydet',exact:true}).click();
  const downloadState=await app.evaluate(({app})=>new Promise((resolve,reject)=>{const until=Date.now()+15000;const check=()=>{if(app.offenseDownloadState!=='pending')resolve(app.offenseDownloadState);else if(Date.now()>until)reject(Error('Electron export did not complete'));else setTimeout(check,100);};check();}));
  assert.equal(downloadState,'completed');fs.copyFileSync(exportedPath,'.local/rumble-offense-export.json');
  const exported=JSON.parse(fs.readFileSync('.local/rumble-offense-export.json','utf8'));assert.equal(exported.groups.length,3);assert.ok(exported.groups.every(g=>g.teams[0].offense.directSources>=2));assert.equal(exported.rumbleRules.phase,'Block C');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
  await page.locator('[data-scenario="evolve"] .rumble-offense').first().scrollIntoViewIfNeeded();await page.waitForTimeout(250);await page.screenshot({path:'.local/rumble-offense-058-ui.png'});
  assert.ok((await page.locator('.version').innerText()).includes('v0.5.8'));assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),before);assert.deepEqual(report.errors,[]);
  report.success=true;report.statePreserved=true;report.exportIncludesOffense=true;console.log(JSON.stringify(report,null,2));
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync('.local/rumble-offense-desktop-result.json',JSON.stringify(report,null,2));await app?.close();}
