import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=10000');const state=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return state;}
const original=read(actual),profile=path.resolve('.local/merge-live-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const app=await electron.launch({executablePath:path.resolve(process.env.OPTC_TEST_EXE||'release/v0.5.14/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}});
const report={version:'0.5.14',characters:original.box.length,errors:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',msg=>{if(msg.text().startsWith('scan:'))console.log(msg.text());});
 await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 assert.equal(await app.evaluate(({app})=>app.getVersion()),report.version);
 await page.evaluate(()=>window.nakama.onBossProgress(text=>console.log('scan:'+text)));
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();
 await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();
 await Promise.race([
  page.locator('[data-boss-observation]').waitFor({timeout:300000}),
  page.locator('.boss-source .error').waitFor({timeout:300000}).then(async()=>{throw Error(await page.locator('.boss-source .error').innerText());})
 ]);
 await expect(page.locator('.behavior-title')).toContainText('Clash!! Luffytaro: Subdued');
 await expect(page.locator('.behavior-title')).toContainText('10★');
 assert.equal(await page.locator('.behavior-stage').count(),5);
 assert.equal(await page.locator('[data-behavior-status=notListed]').count(),1);
 const fourth=page.locator('.behavior-stage').nth(3);await fourth.locator('summary').click();
 for(const text of ['5 turn(s) 5000 damage Burn','8 turn(s) Top-Row Despair','6 turn(s) Middle-Row Bind','30000 damage'])await expect(fourth).toContainText(text);
 assert.equal(await fourth.locator('[data-trigger=defeated]').count(),1);
 const fifth=page.locator('.behavior-stage').nth(4);await fifth.locator('summary').click();
 await expect(fifth).toContainText('INT type change');
 await page.screenshot({path:'.local/boss-merge-live-0514.png'});
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);
 assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);
 report.pass=true;report.statePreserved=true;report.stages=5;
 console.log(JSON.stringify(report));
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync('.local/boss-merge-live-0514-result.json',JSON.stringify(report,null,2));await app.close();}
