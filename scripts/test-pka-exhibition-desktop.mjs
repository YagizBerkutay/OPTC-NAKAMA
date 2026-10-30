import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});const s=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return s;}
const original=read(actual),profile=path.resolve('.local/pka-exhibition-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const observed=JSON.parse(fs.readFileSync('.local/exhibition-live-0516.json','utf8')),rules=require('../electron/rumble-rules-core.cjs').parseRules(observed.text,observed.phase);rules.observedAt=observed.observedAt;
const boss=JSON.parse(fs.readFileSync('.local/pka-live-0516.json','utf8'));
const app=await electron.launch({executablePath:path.resolve('release/v0.5.16/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}}),report={version:'0.5.16',characters:original.box.length,errors:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor({timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 await app.evaluate(({ipcMain},data)=>{ipcMain.removeHandler('rumble:readRules');ipcMain.handle('rumble:readRules',()=>data.rules);ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>data.boss);},{rules,boss});
 await page.locator('nav').getByRole('button',{name:'Pirate Rumble',exact:true}).click();await page.getByRole('button',{name:'En güçlü Rumble kadrolarını kur',exact:true}).click();
 await page.locator('[data-scenario="evolve"] .plan-result').first().waitFor({state:'attached',timeout:180000});await expect(page.locator('[data-rumble-rules]')).toContainText('Exhibition');
 for(const text of ['DEX · DEF +5','PSY · ATK +5','Powerhouse · HP +5','Striker · Special CT +3'])await expect(page.locator('[data-rumble-rules]')).toContainText(text);
 for(const scenario of ['current','power','evolve']){const card=page.locator(`[data-scenario="${scenario}"] .plan-result`).first();assert.equal(await card.locator('.plan-crew.five .plan-slot').count(),5);assert.ok(await card.locator('.plan-crew.reserves .plan-slot').count()<=3);}
 report.exhibition=true;
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();await page.locator('[data-boss-observation]').waitFor({timeout:30000});
 await expect(page.locator('.behavior-title')).toContainText('Vs. Crocodile');await expect(page.locator('.behavior-title')).toContainText('PKA · Lv.80–99');assert.equal(await page.locator('.behavior-stage').count(),5);
 for(let i=0;i<5;i++)await expect(page.locator('.behavior-stage').nth(i).locator('summary')).toContainText('Battle '+(i+1));
 await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).click();await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).waitFor({state:'visible',timeout:180000});await page.locator('[data-scenario="evolve"] .plan-result .boss-combat').first().waitFor({state:'attached',timeout:180000});assert.equal(await page.getByRole('alert').count(),0);report.pka=true;report.stages=5;report.range=boss.observation.levelRange;
 fs.writeFileSync('.local/pka-exhibition-0516-ui.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);report.statePreserved=true;report.success=true;
}catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync('.local/pka-exhibition-0516-desktop-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await app.close();}
