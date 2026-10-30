import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});const s=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return s;}
const original=read(actual),profile=path.resolve('.local/pka-hazards-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const boss=JSON.parse(fs.readFileSync('.local/pka-live-0516.json','utf8'));
const app=await electron.launch({executablePath:path.resolve('release/v0.5.17/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}}),report={version:'0.5.17',characters:original.box.length,errors:[],results:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor({timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 await app.evaluate(({ipcMain},data)=>{ipcMain.removeHandler('boss:readBehavior');ipcMain.handle('boss:readBehavior',()=>data);},boss);
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();await page.locator('[data-boss-observation]').waitFor({timeout:30000});
 await expect(page.locator('.behavior-title')).toContainText('Vs. Crocodile');assert.equal(await page.locator('.behavior-stage').count(),5);
 await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).click();await page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true}).waitFor({state:'visible',timeout:300000});await page.locator('[data-scenario="evolve"] .plan-result .boss-combat').first().waitFor({state:'attached',timeout:300000});assert.equal(await page.getByRole('alert').count(),0);
 const destination=path.resolve('.local/pka-hazards-0517-export-'+Date.now()+'.json');
 await app.evaluate(({BrowserWindow},file)=>{BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>item.setSavePath(file));},destination);await page.getByRole('button',{name:'Önerileri kaydet',exact:true}).click();
 await expect.poll(()=>fs.existsSync(destination)&&fs.statSync(destination).size>0,{timeout:15000}).toBeTruthy();const output=JSON.parse(fs.readFileSync(destination,'utf8'));fs.writeFileSync('.local/pka-hazards-0517-export.json',JSON.stringify(output,null,2));
 for(const group of output.groups){assert.ok(group.teams.length);for(const team of group.teams){
  assert.equal(team.combat.windows.length,5);assert.ok(team.combat.initialHP<=team.combat.maxHP);const fourth=team.combat.windows[3];assert.ok(Number.isFinite(fourth.hpAttack));assert.ok(fourth.completedPerfects<=6);
  assert.ok(fourth.issues.some(s=>/Burn|PERFECT/.test(s))||team.members.slice(0,2).some(m=>/removes?[^.;]*Burn[^.;]*completely|replaces that debuff/i.test(m.captainText))||fourth.instructions.some(s=>/kaldır|temiz/.test(s)),'Burn must remain a hazard or have an explicit complete remover: '+JSON.stringify({captains:team.members.slice(0,2).map(m=>m.character.id),fourth}));
  if(fourth.poisonSlotCount>0)assert.ok(fourth.instructions.some(s=>s.includes('Zehir slotu başına')));else assert.ok(fourth.instructions.some(s=>/Poison iyileştirme/.test(s)),'Poison slots cannot silently disappear');
  assert.notEqual(team.combat.status,'estimated','Unknown enemy stats cannot certify this scan');
 }
 await page.locator('[data-scenario-tab="'+group.scenario+'"]').click();await expect(page.locator('[data-scenario="'+group.scenario+'"] .boss-combat').first()).toContainText('başlangıç HP');report.results.push({scenario:group.scenario,teams:group.teams.length,status:group.teams[0].combat.status,captains:group.teams[0].members.slice(0,2).map(m=>m.character.id),initialHP:group.teams[0].combat.initialHP});}
 fs.writeFileSync('.local/pka-hazards-0517-ui.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);report.statePreserved=true;report.export=destination;report.success=true;
}catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync('.local/pka-hazards-0517-desktop-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await app.close();}
