import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});const s=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return s;}
const original=read(actual),profile=path.resolve('.local/behavior-tracking-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const boss=JSON.parse(fs.readFileSync('.local/replay-0518-result.json','utf8'));
const app=await electron.launch({executablePath:path.resolve('release/v0.5.18/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}}),report={version:'0.5.18',characters:original.box.length,errors:[],results:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor({timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 await app.evaluate(({ipcMain},data)=>{ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>data);},boss);
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();await page.locator('[data-boss-observation]').waitFor({timeout:30000});
 await expect(page.locator('.behavior-title')).toContainText('Vs. Crocodile');assert.equal(await page.locator('.behavior-stage').count(),5);
 await expect(page.locator('[data-marquee-coverage]')).toContainText('satır');await expect(page.locator('.behavior-stage').last().locator('summary')).toContainText('Weakness Class · Cerebral');
 await page.locator('.behavior-stage').last().locator('summary').click();await expect(page.locator('.behavior-stage').last()).toContainText('Weakness Class: Cerebral');await page.locator('[data-marquee-coverage]').scrollIntoViewIfNeeded();
 fs.writeFileSync('.local/behavior-tracking-0518-ui.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));
 await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).click();await page.locator('[data-scenario="evolve"] .plan-result .boss-combat').first().waitFor({state:'attached',timeout:300000});assert.equal(await page.getByRole('alert').count(),0);
 const destination=path.resolve('.local/behavior-tracking-0518-export-'+Date.now()+'.json');
 await app.evaluate(({BrowserWindow},file)=>{BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>item.setSavePath(file));},destination);await page.getByRole('button',{name:'Önerileri kaydet',exact:true}).click();await expect.poll(()=>fs.existsSync(destination)&&fs.statSync(destination).size>0,{timeout:15000}).toBeTruthy();const output=JSON.parse(fs.readFileSync(destination,'utf8'));fs.writeFileSync('.local/behavior-tracking-0518-export.json',JSON.stringify(output,null,2));
 for(const group of output.groups){assert.ok(group.teams.length);for(const team of group.teams){assert.equal(team.combat.windows.length,5);const fifth=team.combat.windows[4];assert.ok(fifth.instructions.some(s=>s.includes('Weakness Class: Cerebral')));assert.ok(fifth.issues.some(s=>s.includes('katsayısı')));assert.notEqual(team.combat.status,'estimated');for(const stage of boss.stages.filter(s=>s.behaviorTextComplete===false)){const window=team.combat.windows.find(w=>w.stage===stage.name);assert.ok(window.issues.some(s=>s.includes('kayan davranış')));}}
  report.results.push({scenario:group.scenario,teams:group.teams.length,status:group.teams[0].combat.status,captains:group.teams[0].members.slice(0,2).map(m=>m.character.id)});
 }
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);report.statePreserved=true;report.success=true;report.marquee=boss.observation.marquee;
}catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync('.local/behavior-tracking-0518-desktop-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await app.close();}
