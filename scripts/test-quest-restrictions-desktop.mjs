import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {auditTextContrast} from './hci-audit.mjs';
const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=10000');const state=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return state;}
const original=read(actual),profile=path.resolve('.local/quest-desktop-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const app=await electron.launch({executablePath:path.resolve(process.env.OPTC_TEST_EXE||'release/v0.5.11/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}});
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/boss-behavior/bartolomeo-restricted.json','utf8')),characters=new Map(JSON.parse(fs.readFileSync('dist/data/catalog.json','utf8')).characters.map(c=>[c.id,c]));
const report={version:'0.5.11',live:process.argv.includes('--live'),characters:original.box.length,errors:[],scenarios:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.5.11');
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();
 if(!report.live)await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>fixture);},fixture);
 await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();await page.locator('[data-boss-observation]').waitFor({timeout:300000});
 await expect(page.locator('[data-quest-restrictions=verified]')).toContainText('Fighter / Slasher / Striker');
 assert.equal(await page.locator('.behavior-stage').count(),5);await expect(page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true})).toBeEnabled();
 await page.getByRole('combobox',{name:'Takım türü',exact:true}).selectOption('STR');
 await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).click();await page.locator('[data-scenario=evolve]').waitFor({state:'attached',timeout:240000});
 for(const scenario of ['current','power','evolve']){
  await page.locator(`[data-scenario-tab="${scenario}"]`).click();const result=page.locator(`[data-scenario="${scenario}"] .plan-result`).first();await expect(result).toBeVisible();
  const ids=await result.locator('.plan-crew .plan-slot .avatar small').allTextContents();assert.equal(ids.length,6);
  for(const value of ids){const c=characters.get(value.replace('#',''));assert.ok(c&&c.classes.some(t=>['Fighter','Slasher','Striker'].includes(t)),`Forbidden unit: ${value}`);assert.ok(!['4571','4612'].includes(c.id));}
  report.scenarios.push({scenario,ids});
 }
 assert.deepEqual(await auditTextContrast(page),[]);await page.screenshot({path:'.local/quest-restrictions-desktop-0511.png'});
 await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>({...fixture,restrictions:{...fixture.restrictions,status:'partial',warnings:['TEST · katılım koşulu yarım']}}));},fixture);
 await page.getByRole('button',{name:'Bossu yeniden oku',exact:true}).click();await expect(page.locator('[data-quest-restrictions=partial]')).toBeVisible();await expect(page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true})).toBeDisabled();assert.equal(await page.locator('.plan-result').count(),0);
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);report.pass=true;report.statePreserved=true;console.log(JSON.stringify(report));
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync('.local/quest-restrictions-desktop-0511-result.json',JSON.stringify(report,null,2));await app.close();}
