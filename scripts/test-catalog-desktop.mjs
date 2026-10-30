import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=10000');const value=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return value;}
const original=read(actual),profile=path.resolve('.local/catalog-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const packaged=process.argv.includes('--packaged'),executablePath=path.resolve(packaged?'release/v0.5.21/win-unpacked/OPTC Nakama.exe':'node_modules/electron/dist/electron.exe');
const app=await electron.launch({executablePath,args:packaged?['--disable-gpu']:['.','--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}});
const report={version:'0.5.21',packaged,characters:original.box.length,errors:[],checks:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(error.message));
 await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor({timeout:90000});assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 await page.locator('nav').getByRole('button',{name:'Karakter kutum',exact:true}).click();
 await expect(page.getByLabel('Bölge filtresi',{exact:true})).toHaveValue('all');
 const search=page.getByLabel('Karakter ara',{exact:true});await search.fill('Sanji');
 const card=page.locator('.character-card').filter({has:page.getByRole('heading',{name:'Sanji - Jolly Halloween Party',exact:true})});await expect(card).toBeVisible();
 await expect(card).toContainText('#4654');await expect(card).toContainText('PSY');await expect(card).toContainText('Cerebral');await expect(card).toContainText('Powerhouse');
 await expect.poll(()=>card.locator('img').evaluate(img=>img.complete&&img.naturalWidth)).toBe(112);
 report.checks.push('default search includes new Sanji with its correct portrait, ID, PSY and classes');
 for(const id of ['4652','4653','4654','4655','4656']){await search.fill(id);await expect(page.locator('.character-card')).toHaveCount(1);await expect(page.locator('.character-card')).toContainText('#'+id);}
 await search.fill('4654');await page.locator('.character-card').click();
 const dialog=page.getByRole('dialog',{name:'Karakter düzenle',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByRole('tab',{name:'Kaynak yetenekler',exact:true}).click();await expect(dialog).toContainText('Reduces Despair duration by 6 turns');await expect(dialog).toContainText('Resilience duration by 6 turns');
 await dialog.getByRole('tab',{name:'Geliştirme durumu',exact:true}).click();await dialog.getByLabel('Mevcut seviye',{exact:true}).fill('99');
 await dialog.getByRole('button',{name:original.box.some(o=>o.id==='4654')?'Değişiklikleri kaydet':'Kutuma ekle',exact:true}).click();
 await expect(page.getByText('Kaydedildi',{exact:true})).toBeVisible();
 const saved=JSON.parse(await page.evaluate(()=>window.nakama.load()));assert.equal(saved.box.find(o=>o.id==='4654').level,99);
 assert.deepEqual(saved.box.filter(o=>o.id!=='4654'),original.box.filter(o=>o.id!=='4654'));assert.deepEqual(saved.bosses,original.bosses);assert.deepEqual(saved.settings,original.settings);
 await page.reload();await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
 assert.equal(JSON.parse(await page.evaluate(()=>window.nakama.load())).box.find(o=>o.id==='4654').level,99);
 await page.locator('nav').getByRole('button',{name:'Karakter kutum',exact:true}).click();await search.fill('4654');
 await expect(page.locator('.character-card')).toContainText('Kutumda');await expect(page.locator('.character-card')).toContainText('Lv. 99');
 await new Promise(resolve=>setTimeout(resolve,600));
 fs.writeFileSync('.local/catalog-0521-'+(packaged?'packaged':'source')+'-ui.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));
 assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);report.checks.push('all five cards searchable; Sanji skills available, level saved and restored; other records unchanged');report.statePreserved=true;report.success=true;
}catch(error){report.failure=error.message;throw error;}finally{fs.writeFileSync('.local/catalog-0521-'+(packaged?'packaged':'source')+'-desktop-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await app.close();}
