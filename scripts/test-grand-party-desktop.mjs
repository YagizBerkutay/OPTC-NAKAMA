import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const packaged=process.argv.includes('--packaged');
const profile=path.resolve('.local/gp-test-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const original=JSON.parse(fs.readFileSync('.local/box-before-052.json','utf8'));
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const data=JSON.parse(fs.readFileSync('public/data/planner.json','utf8'));
const report={packaged,box:original.box.length,scenarios:[],errors:[]};let app;
try {
  app=await electron.launch({executablePath:path.resolve(packaged?'release/win-unpacked/OPTC Nakama.exe':'node_modules/electron/dist/electron.exe'),args:packaged?['--disable-gpu']:['.','--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile},timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));
  await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
  const before=JSON.parse(await page.evaluate(()=>window.nakama.load()));
  await page.locator('nav').getByRole('button',{name:'Grand Party',exact:true}).click();
  await page.getByRole('button',{name:'Grand Party kadrolarını kur'}).waitFor();
  assert.ok((await page.locator('.notice').innerText()).includes('Elbaph Arc / World Government'));
  await page.getByRole('button',{name:'Grand Party kadrolarını kur'}).click();
  await page.locator('[data-gp-scenario="evolve"] .gp-leader').waitFor({timeout:360000});
  await page.getByRole('button',{name:'Grand Party kadrolarını kur'}).waitFor({state:'visible'});
  for(const scenario of ['current','power','evolve']) {
    const section=page.locator(`[data-gp-scenario="${scenario}"]`);
    assert.equal(await section.locator('.plan-result').count(),3);
    const leaderText=await section.locator('.gp-leader-heading').innerText();
    if(scenario!=='current'){assert.ok((await section.locator('.scenario-heading').innerText()).includes('Lv.100'));const levels=await section.locator('.plan-slot').allTextContents();assert.ok(levels.every(v=>{const n=Number(v.match(/(\d+)\. seviye/)?.[1]);return !n||n<=100;}));assert.equal(await section.getByText('150. seviye',{exact:false}).count(),0);}
    const crews=await section.locator('.plan-result').evaluateAll(cards=>cards.map(card=>({
      ids:[...card.querySelectorAll('.plan-slot')].map(slot=>slot.querySelector('.avatar small').textContent.replace('#','')),
      sources:[...card.querySelectorAll('.plan-slot')].map(slot=>slot.querySelector('.evolution-label')?.textContent.match(/#(\d+)/)?.[1]||slot.querySelector('.avatar small').textContent.replace('#','').split('.')[0]),
      active:card.querySelectorAll('.plan-crew.five .plan-slot').length,
      reserves:card.querySelectorAll('.plan-crew.reserves .plan-slot').length,
      cost:Number(card.querySelector('.row .tag').textContent.match(/· (\d+) maliyet/)?.[1]),
      ex:card.textContent.includes('Rumble EX special')
    })));
    const sources=crews.flatMap(t=>t.sources);assert.equal(new Set(sources).size,sources.length,'Same owned source across GP crews');
    const ids=crews.flatMap(t=>t.ids);assert.equal(new Set(ids).size,ids.length);
    for(const crew of crews){assert.equal(crew.active,5);assert.ok(crew.reserves<=3);assert.ok(crew.cost<=300);const families=crew.ids.flatMap(id=>data.units[id].families);assert.equal(new Set(families).size,families.length);}
    assert.ok(crews.some(t=>t.ex),'EX skills not inspected');
    console.log(scenario,leaderText);
    const seasonal=leaderText.includes('Etkinlik lider bonusu karşılandı');
    assert.ok(leaderText.includes('ortak kullanım'));
    report.seasonal=seasonal;
    const leaderId=leaderText.match(/#([\d.]+)/)[1],baseUses=data.units[leaderId].rumble.gpspecial[0].uses;
    assert.ok(leaderText.includes((baseUses+(seasonal?1:0))+' ortak kullanım'));
    assert.equal(seasonal,true,'Current box should find a boosted leader');
    if(seasonal)assert.ok((await section.locator('.gp-leader').innerText()).includes('%40 azalır'));
    report.scenarios.push({scenario,leader:leaderText,crews});
  }
  await page.locator('[data-gp-scenario="power"] .gp-leader').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelector('[data-gp-scenario="power"] .gp-leader').querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0));
  const allImages=await page.locator('.plan-result img').evaluateAll(images=>images.map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
  report.imagesLoaded=allImages.filter(i=>i.loaded).length;
  fs.writeFileSync('.local/grand-party-052-ui.png',Buffer.from(await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),'base64'));
  const after=JSON.parse(await page.evaluate(()=>window.nakama.load()));assert.deepEqual(after,before);assert.deepEqual(report.errors,[]);
  await page.getByLabel('GP lideri',{exact:true}).selectOption('4571');assert.equal(await page.locator('.gp-leader').count(),0,'Changing input must clear stale plans');
  await page.getByRole('button',{name:'Grand Party kadrolarını kur'}).click();await page.getByRole('button',{name:'Durdur',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Durdur',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Grand Party kadrolarını kur'}).isEnabled(),true);
  await page.getByRole('button',{name:'Etkinlik bonuslarını ekle'}).click();assert.equal(await page.getByLabel('Bonus lider hedefleri').inputValue(),'Elbaph Arc, World Government');assert.equal(await page.getByLabel('Ek GP Burst hakkı').inputValue(),'1');
  await page.getByRole('button',{name:'Etkinlik bonuslarını sıfırla'}).click();assert.ok((await page.locator('.notice').innerText()).includes('Güncel kurallar doğrulanmadı'));
  for(const mode of ['rumble','fighter']){
    await page.locator('nav').getByRole('button',{name:mode==='rumble'?'Pirate Rumble':'Otomatik kadrolar',exact:true}).click();
    if(mode==='rumble')await page.getByLabel('MuMu kurallarını otomatik oku').uncheck();
    if(mode==='fighter')await page.getByLabel('Takım türü').selectOption('Fighter');
    await page.getByRole('button',{name:mode==='rumble'?'En güçlü Rumble kadrolarını kur':'En iyi kadroları oluştur',exact:true}).click();
    await page.locator('[data-scenario="evolve"] .plan-result').first().waitFor({timeout:120000});
    for(const scenario of ['power','evolve']){
      const section=page.locator(`[data-scenario="${scenario}"]`);
      assert.ok((await section.locator('.scenario-heading').innerText()).includes('Lv.100'));
      const levels=await section.locator('.plan-result').first().locator('.plan-slot').allTextContents();
      const values=levels.map(v=>Number(v.match(/(\d+)\. seviye/)?.[1])).filter(Number.isFinite);
      assert.ok(values.length>=5&&values.every(v=>v<=100),mode+' '+scenario+' level target');
      assert.equal(await section.getByText('150. seviye',{exact:false}).count(),0);
    }
    if(mode==='fighter')assert.equal(await page.locator('[data-scenario="power"] .evolution-recipes').count(),0);
    report[mode+'Level100']=true;
  }
  assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),before);assert.deepEqual(report.errors,[]);
  assert.equal(await page.locator('.version').innerText(),'OTOMATİK KADROLAR · v0.5.2');
  report.success=true;console.log(JSON.stringify(report,null,2));
}finally{fs.writeFileSync('.local/grand-party-desktop-result.json',JSON.stringify(report,null,2));await app?.close();}
