import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});const s=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return s;}
const original=read(actual),profile=path.resolve('.local/boss-worker-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const packaged=process.argv.includes('--packaged'),executablePath=path.resolve(packaged?'release/v0.5.20/win-unpacked/OPTC Nakama.exe':'node_modules/electron/dist/electron.exe');
const app=await electron.launch({executablePath,args:packaged?['--disable-gpu']:['.','--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}}),report={version:'0.5.20',packaged,characters:original.box.length,errors:[],checks:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor({timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 // Exercise the actual Electron worker and its native modules without moving the game.
 const workerError=await page.evaluate(async settings=>{try{await window.nakama.bossBehavior(settings.adbPath,'127.0.0.1:65534');return '';}catch(error){return error.message;}},original.settings);
 assert.match(workerError,/device.*not found/i);report.checks.push('native worker loads; missing device rejects cleanly');
 await app.evaluate(({ipcMain})=>{
  globalThis.testReads=[];globalThis.testCancels=0;
  ipcMain.removeHandler('adb:connect');ipcMain.handle('adb:connect',()=>true);
  ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>new Promise(resolve=>globalThis.testReads.push(resolve)));
  ipcMain.removeHandler('boss:cancelBehavior');ipcMain.handle('boss:cancelBehavior',()=>{globalThis.testCancels++;return true;});
 });
 await page.clock.install();
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();
 const readButton=page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true});
 await readButton.click();await expect(page.locator('.scan-progress')).toContainText('okuma sınırı 4 dk');
 await expect.poll(()=>app.evaluate(()=>globalThis.testReads.length)).toBe(1);
 await page.clock.fastForward(31000);await expect(page.locator('.scan-progress')).toContainText('0:31');
 await page.getByRole('button',{name:'İptal',exact:true}).click();await expect(readButton).toBeEnabled();await expect(page.locator('.scan-progress')).toHaveCount(0);
 await expect.poll(()=>app.evaluate(()=>globalThis.testCancels)).toBe(1);report.checks.push('timer updates; cancellation immediately frees the UI');
 await readButton.click();await expect.poll(()=>app.evaluate(()=>globalThis.testReads.length)).toBe(2);
 await page.clock.fastForward(256000);await expect(page.getByRole('alert')).toContainText('süre sınırını aştı');await expect(readButton).toBeEnabled();await expect(page.locator('.scan-progress')).toHaveCount(0);
 await expect.poll(()=>app.evaluate(()=>globalThis.testCancels)).toBe(2);report.checks.push('frontend watchdog cancels an unresolved IPC request');
 const bossFile=fs.existsSync('.local/live-0520-result.json')?'.local/live-0520-result.json':'.local/replay-0518-result.json';
 const boss=JSON.parse(fs.readFileSync(bossFile,'utf8'));report.bossFixture=bossFile;
 await readButton.click();await expect.poll(()=>app.evaluate(()=>globalThis.testReads.length)).toBe(3);
 await app.evaluate((_electron,data)=>{globalThis.testReads[0]({...data,name:'Stale cancelled result'});globalThis.testReads[1]({...data,name:'Stale timed-out result'});},boss);
 await expect(page.locator('.scan-progress')).toHaveCount(1);await expect(page.locator('[data-boss-observation]')).toHaveCount(0);
 await app.evaluate((_electron,data)=>globalThis.testReads[2](data),boss);
 await expect(page.locator('[data-boss-observation]')).toBeVisible();await expect(page.locator('.behavior-title')).toContainText('Vs. Crocodile');await expect(page.locator('.scan-progress')).toHaveCount(0);
 assert.equal(await page.locator('.behavior-stage').count(),5);await expect(page.locator('.behavior-stage').last().locator('summary')).toContainText('Weakness Class · Cerebral');
 report.checks.push('late results ignored; next read loads five battles and Weakness Class');
 await page.locator('[data-marquee-coverage]').scrollIntoViewIfNeeded();await page.clock.resume();await new Promise(r=>setTimeout(r,600));
 fs.writeFileSync('.local/boss-worker-0520-'+(packaged?'packaged':'source')+'-ui.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);report.statePreserved=true;report.success=true;
}catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync('.local/boss-worker-0520-'+(packaged?'packaged':'source')+'-desktop-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await app.close();}
