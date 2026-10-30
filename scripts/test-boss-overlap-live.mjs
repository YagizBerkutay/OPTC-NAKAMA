import {_electron as electron} from 'playwright';
import {expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const actual=path.join(process.env.APPDATA,'optc-nakama/nakama.sqlite');
function read(file){const db=new DatabaseSync(file,{readOnly:true});db.exec('PRAGMA busy_timeout=10000');const state=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);db.close();return state;}
const original=read(actual),profile=path.resolve('.local/overlap-live-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const app=await electron.launch({executablePath:path.resolve('release/v0.5.10/win-unpacked/OPTC Nakama.exe'),args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile}});
const report={version:'0.5.10',characters:original.box.length,errors:[]};
try{
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
 await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.5.10');
 await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();
 await page.getByRole('button',{name:'MuMu’dan bossu oku',exact:true}).click();
 await page.locator('[data-boss-observation]').waitFor({timeout:300000});
 assert.equal(await page.locator('.behavior-stage').count(),5);
 assert.equal(await page.locator('[data-behavior-status=notListed]').count(),2);
 const phase=page.locator('.behavior-stage').nth(2);await phase.locator('summary').click();
 for(const section of ['Battle 3-1','Battle 3-2']){const event=phase.locator(`[data-source-battle="${section}"][data-trigger=preemptive]`);await expect(event).toBeVisible();assert.equal(await event.count(),1);}
 await expect(page.getByRole('button',{name:'Bu bossa göre otomatik kadro kur',exact:true})).toBeEnabled();
 await page.screenshot({path:'.local/boss-overlap-live-0510.png'});
 assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),original);
 assert.deepEqual(read(actual),original);assert.deepEqual(report.errors,[]);
 report.pass=true;report.statePreserved=true;report.stages=5;
 console.log(JSON.stringify(report));
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync('.local/boss-overlap-live-0510-result.json',JSON.stringify(report,null,2));await app.close();}
