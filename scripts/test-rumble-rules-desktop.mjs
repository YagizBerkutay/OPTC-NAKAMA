import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const packaged=process.argv.includes('--packaged'),live=process.argv.includes('--live');
const original=JSON.parse(fs.readFileSync('.local/box-before-054.json','utf8')),profile=path.resolve('.local/rumble-rules-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const rules=JSON.parse(fs.readFileSync('.local/rumble-live-rules.json','utf8'));
const report={packaged,live,box:original.box.length,errors:[]};let app;
try{
 app=await electron.launch({executablePath:path.resolve(packaged?'release/win-unpacked/OPTC Nakama.exe':'node_modules/electron/dist/electron.exe'),args:packaged?['--disable-gpu']:['.','--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile},timeout:60000});
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();const before=JSON.parse(await page.evaluate(()=>window.nakama.load()));
 await page.locator('nav').getByRole('button',{name:'Pirate Rumble',exact:true}).click();
 assert.equal(await page.getByLabel('MuMu kurallarını otomatik oku').isChecked(),true);
 if(live){const diagnostic=await app.evaluate(async({app},settings)=>{
   const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json'),path=require('node:path'),root=app.getAppPath(),adb=require(path.join(root,'electron/adb.cjs')),ocr=require(path.join(root,'electron/rule-ocr.cjs')),core=require(path.join(root,'electron/rumble-rules-core.cjs'));
   const image=Buffer.from((await adb.screenshot(settings.adbPath,settings.device)).split(',')[1],'base64'),raw=await ocr.ocrBuffer(image),crop=await ocr.ocrBuffer(image,{crop:{left:639,top:256,width:252,height:336},scale:3});
   return {text:raw.text,button:core.rulesButton(raw),phaseText:crop.text,phase:core.homePhase(raw,crop)};
 },original.settings);report.diagnostic=diagnostic;console.log(JSON.stringify(diagnostic));}
 if(!live)await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('rumble:readRules');ipcMain.handle('rumble:readRules',()=>fixture);},rules);
 await page.getByRole('button',{name:'En güçlü Rumble kadrolarını kur',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-scenario="evolve"] .plan-result')||document.querySelector('[role="alert"]'),undefined,{timeout:180000});
 if(await page.getByRole('alert').count())throw Error(await page.getByRole('alert').innerText());
 const ruleText=await page.locator('[data-rumble-rules]').innerText();assert.ok(ruleText.includes('Block C'));assert.ok(ruleText.includes('PSY · HP +4'));assert.ok(ruleText.includes('Slasher · ATK +4'));assert.ok(ruleText.includes('Striker · SPD +4'));assert.ok(ruleText.includes('yalnızca Combat Power'));
 for(const scenario of ['current','power','evolve']){
   const result=page.locator(`[data-scenario="${scenario}"] .plan-result`).first();assert.equal(await result.locator('.plan-crew.five .plan-slot').count(),5);assert.ok(await result.locator('.plan-crew.reserves .plan-slot').count()<=3);assert.ok((await result.innerText()).includes('Block C'));
 }
 await page.locator('[data-rumble-rules]').scrollIntoViewIfNeeded();fs.writeFileSync('.local/rumble-rules-054-ui.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('rumble:readRules');ipcMain.handle('rumble:readRules',()=>{throw Error('Aktif Rumble bölümü tanınamadı.');});});
 await page.getByRole('button',{name:'En güçlü Rumble kadrolarını kur',exact:true}).click();await page.getByRole('alert').filter({hasText:'Aktif Rumble bölümü tanınamadı'}).waitFor();assert.equal(await page.locator('.plan-result').count(),0);assert.equal(await page.locator('[data-rumble-rules]').count(),0);
 await page.getByLabel('MuMu kurallarını otomatik oku').uncheck();await page.getByRole('button',{name:'En güçlü Rumble kadrolarını kur',exact:true}).click();await page.locator('[data-scenario="evolve"] .plan-result').first().waitFor({timeout:120000});assert.equal(await page.locator('[data-rumble-rules]').count(),0);
 await page.getByLabel('MuMu kurallarını otomatik oku').check();await page.waitForFunction(()=>!document.querySelector('.plan-result'));assert.equal(await page.locator('.plan-result').count(),0);
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('rumble:readRules');ipcMain.handle('rumble:readRules',()=>new Promise(resolve=>setTimeout(()=>resolve(null),2500)));});
 await page.getByRole('button',{name:'En güçlü Rumble kadrolarını kur',exact:true}).click();await page.getByRole('button',{name:'İptal',exact:true}).click();assert.equal(await page.getByRole('button',{name:'En güçlü Rumble kadrolarını kur',exact:true}).isEnabled(),true);assert.equal(await page.locator('.plan-result').count(),0);
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),before);assert.deepEqual(report.errors,[]);assert.ok((await page.locator('.version').innerText()).includes('v0.5.4'));
 report.success=true;report.phase='Block C';report.bonuses=3;report.statePreserved=true;report.failedReadClearsPlans=true;report.optionalNoRules=true;report.cancellation=true;console.log(JSON.stringify(report,null,2));
}catch(e){report.failure=e.message;if(app){try{const p=await app.firstWindow();report.screen=(await p.locator('.planner-page').innerText()).slice(0,5000);fs.writeFileSync('.local/rumble-rules-054-error.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));}catch{}}console.log(JSON.stringify(report,null,2));throw e;}finally{fs.writeFileSync('.local/rumble-rules-desktop-result.json',JSON.stringify(report,null,2));await app?.close();}
