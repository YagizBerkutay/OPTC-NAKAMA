import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {auditTextContrast} from './hci-audit.mjs';

const db=new DatabaseSync(process.env.APPDATA+'/optc-nakama/nakama.sqlite',{readOnly:true});db.exec('PRAGMA busy_timeout=10000');
const original=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();
const profile=path.resolve('.local/boss-phase-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const testDb=new DatabaseSync(profile+'/nakama.sqlite');testDb.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');testDb.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));testDb.close();
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/boss-behavior/bartolomeo-10star.json','utf8'));assert.equal(fixture.difficulty,'10★');assert.equal(fixture.observation.complete,true);
const packaged=process.argv.includes('--packaged'),app=await electron.launch({executablePath:path.resolve(packaged?(process.env.OPTC_TEST_EXE||'release/v0.5.10/win-unpacked/OPTC Nakama.exe'):'node_modules/electron/dist/electron.exe'),args:packaged?['--disable-gpu']:['.','--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}});
const report={packaged,box:original.box.length,errors:[],scenarios:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();
 await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>fixture);ipcMain.removeHandler('adb:connect');ipcMain.handle('adb:connect',()=>true);},fixture);
 await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();await page.locator('[data-boss-observation]').waitFor();
 assert.equal(await page.locator('.behavior-stage').count(),5);assert.equal(await page.locator('[data-behavior-status=notListed]').count(),2);
 const phase=page.locator('.behavior-stage').nth(2);await phase.locator('summary').click();await expect(phase.locator('[data-source-battle="Battle 3-1"][data-trigger=preemptive]')).toBeVisible();await expect(phase.locator('[data-source-battle="Battle 3-2"][data-trigger=preemptive]')).toBeVisible();
 assert.deepEqual(await auditTextContrast(page),[]);await page.screenshot({path:'.local/boss-phases-059.png'});
 const timed=structuredClone(fixture);timed.name='TEST · Aynı aşamada TURN 2';timed.stages[2].events.push({trigger:'turn',label:'TURN 2',sourceBattle:'Battle 3-2',battleTurn:2,text:'3 turn(s) Paralysis',requirements:[{mechanic:'paralysis',turns:3}]});
 await app.evaluate(({ipcMain},timed)=>{ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>timed);},timed);
 await page.getByRole('button',{name:'Bossu yeniden oku',exact:true}).click();await expect(page.getByText(timed.name,{exact:true})).toBeVisible();await page.getByRole('combobox',{name:'Takım türü',exact:true}).selectOption('STR');
 await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).click();await page.locator('[data-scenario=evolve]').waitFor({state:'attached',timeout:240000});
 for(const scenario of ['current','power','evolve']){await page.locator(`[data-scenario-tab="${scenario}"]`).click();const result=page.locator(`[data-scenario="${scenario}"] .plan-result`).first();await expect(result).toBeVisible();await expect(result.locator('.schedule strong').filter({hasText:'Battle 3 · Tur 2 (kalırsan)'})).toBeVisible();report.scenarios.push(scenario);}
 const action=page.getByRole('button',{name:'Bossu yeniden oku',exact:true});await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>{throw Error('TEST · eksik başlık');});});await action.click();await expect(page.getByRole('alert')).toContainText('TEST · eksik başlık');await expect(page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true})).toBeDisabled();assert.equal(await page.locator('.plan-result').count(),0);
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);assert.deepEqual(report.errors,[]);report.pass=true;report.statePreserved=true;console.log(JSON.stringify(report));
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync('.local/boss-phase-desktop-result.json',JSON.stringify(report,null,2));await app.close();}


