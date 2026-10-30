import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const packaged=process.argv.includes('--packaged');
const actual=new DatabaseSync(path.join(process.env.APPDATA,'optc-nakama','nakama.sqlite'),{readOnly:true});
actual.exec('PRAGMA busy_timeout=10000');
const original=JSON.parse(actual.prepare('SELECT payload FROM state WHERE id=1').get().payload);actual.close();
const profile=path.resolve('.local/pve-ui-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const db=new DatabaseSync(path.join(profile,'nakama.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,payload TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify(original));db.close();
const encounter={id:'test-passives',name:'TEST · Pasif / Support karşılaşması',source:'https://onepiecetreasurecruise.fr/Arene/Mihawk.html',training:true,cached:true,difficulty:'Test fixture',reviewed:'',notes:'UI test fixture; gerçek karşılaşma değildir.',stages:[{id:'test-1',name:'Test aşama 1',turn:3,notes:'Test fixture',requirements:[{mechanic:'bind',turns:3},{mechanic:'despair',turns:3}]},{id:'test-2',name:'Test aşama 2',turn:5,notes:'Test fixture',requirements:[{mechanic:'specialBind',turns:3}]}]};
const report={packaged,box:original.box.length,errors:[],results:[]};let app;
try{
  app=await electron.launch({executablePath:path.resolve(packaged?'release/win-unpacked/OPTC Nakama.exe':'node_modules/electron/dist/electron.exe'),args:packaged?['--disable-gpu']:['.','--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile},timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
  const before=JSON.parse(await page.evaluate(()=>window.nakama.load()));
  await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('guides:index');ipcMain.handle('guides:index',()=>({guides:[]}));ipcMain.removeHandler('guides:encounter');ipcMain.handle('guides:encounter',()=>fixture);},encounter);
  async function exported(label){
    const destination=path.resolve('.local/pve-'+label+'-export.json');
    await app.evaluate(({app,BrowserWindow},file)=>{app.pveDownloadState='pending';BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>{item.setSavePath(file);item.once('done',(_event,state)=>{app.pveDownloadState=state;});});},destination);
    await page.getByRole('button',{name:'Önerileri kaydet',exact:true}).click();
    assert.equal(await app.evaluate(({app})=>new Promise((resolve,reject)=>{const until=Date.now()+15000;const check=()=>{if(app.pveDownloadState!=='pending')resolve(app.pveDownloadState);else if(Date.now()>until)reject(Error('Export timeout'));else setTimeout(check,100);};check();})),'completed');
    return JSON.parse(fs.readFileSync(destination,'utf8'));
  }
  for(const kind of process.argv.includes('--boss-only')?['boss']:['teams','boss']){
    await page.locator('nav').getByRole('button',{name:kind==='teams'?'Otomatik kadrolar':'Boss planı',exact:true}).click();
    if(kind==='boss'){await page.getByRole('tab',{name:'Rehber / kayıtlı profil'}).click();await app.evaluate(({ipcMain},fixture)=>{ipcMain.removeHandler('guides:index');ipcMain.handle('guides:index',()=>({guides:[{url:fixture.source,name:'Test',kind:'Arena'}]}));},encounter);await page.reload();await page.locator('nav').getByRole('button',{name:'Boss planı',exact:true}).click();await page.getByRole('tab',{name:'Rehber / kayıtlı profil'}).click();await page.getByRole('combobox',{name:'Online boss rehberi'}).selectOption(encounter.source);}
    await page.getByRole('combobox',{name:'Takım türü',exact:true}).selectOption('STR');
    const button=page.getByRole('button',{name:kind==='teams'?'En iyi kadroları oluştur':'Bu bossa göre otomatik kadro kur',exact:true});await button.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('kadroları oluştur')&&!b.disabled)||[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('bossa göre otomatik')&&!b.disabled));
    const start=Date.now();await button.click();await page.locator('[data-scenario="evolve"] .plan-result').first().waitFor({timeout:240000,state:'attached'});
    const output=await exported(kind);assert.equal(output.kind,kind);assert.equal(output.groups.length,3);
    if(kind==='boss')assert.equal(output.boss.id,encounter.id);
    for(const group of output.groups){
      const team=group.teams[0];assert.ok(team);assert.equal(team.members.length,6);assert.equal(team.members.filter(m=>m.friend).length,1);assert.ok(Number.isFinite(team.score));
      const supports=team.synergy.supports,physical=[...team.members.filter(m=>!m.friend),...supports.map(s=>s.member)];assert.equal(new Set(physical.map(m=>m.sourceId)).size,physical.length);assert.ok(supports.every(s=>team.members.some(m=>!m.friend&&m.character.id===s.targetId)));
      await page.locator(`[data-scenario-tab="${group.scenario}"]`).click();
      const card=page.locator(`[data-scenario="${group.scenario}"] .plan-result`).first();assert.equal(await card.locator('.plan-crew:not(.reserves) .plan-slot').count(),6);assert.ok(await card.locator('.pve-synergy').isVisible());assert.equal(await card.locator('.support-plan').count(),supports.length);
      if(group.scenario!=='current'){assert.ok(physical.every(m=>m.estimatedLevel<=100));assert.ok(supports.length>0);assert.ok(team.synergy.development.join(' ').includes('Lv.100'));}
      else assert.ok(supports.every(s=>s.member.owned.pveLevels?.support>0));
      if(kind==='boss'){assert.equal(team.schedule.length,2);assert.ok(Array.isArray(team.missing));assert.ok(!team.missing.some(text=>text.includes('undefined')));}
      report.results.push({kind,scenario:group.scenario,captains:team.members.slice(0,2).map(m=>m.character.id),supports:supports.length,missing:team.missing||[],ms:Date.now()-start});
    }
    if(kind==='teams'){
      await page.locator('[data-scenario-tab="power"]').click();await page.locator('[data-scenario="power"] .support-plans').first().locator('summary').first().click();
      const support=page.locator('[data-scenario="power"] .plan-result').first().locator('.support-portrait').first();await support.click();const modal=page.getByRole('dialog',{name:'Karakter düzenle'});await modal.locator('summary').filter({hasText:'Support ve ileri PvE yetenek seviyeleri'}).click();const field=modal.getByLabel('Support seviyesi (0–5)',{exact:true});await field.waitFor();assert.equal(await field.inputValue(),'');await field.fill('3');await modal.getByRole('button',{name:'Kapat',exact:true}).click();
      const data=JSON.parse(fs.readFileSync('public/data/planner.json','utf8')),power=output.groups.find(g=>g.scenario==='power').teams[0];const dual=power.members.find(m=>!m.friend&&data.units[m.sourceId]?.captain?.character1);
      if(dual){const slot=page.locator('[data-scenario="power"] .plan-result').first().locator('.plan-slot').filter({hasText:'#'+dual.character.id}).first();await slot.click();await modal.getByRole('combobox',{name:'Mevcut PvE dual form',exact:true}).waitFor();await modal.getByRole('combobox',{name:'Mevcut PvE dual form',exact:true}).selectOption('character2');await modal.getByRole('button',{name:'Kapat',exact:true}).click();report.dualEditorChecked=true;}
    }
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());await page.locator('[data-scenario-tab="power"]').click();await page.locator('[data-scenario="power"] .plan-result').first().scrollIntoViewIfNeeded();await page.waitForTimeout(250);await page.screenshot({path:'.local/pve-'+kind+'-058-ui.png'});
    assert.deepEqual(JSON.parse(await page.evaluate(()=>window.nakama.load())),before);console.log(JSON.stringify({completed:kind,ms:Date.now()-start,box:original.box.length}));
  }
  assert.ok((await page.locator('.version').innerText()).includes('v0.5.8'));assert.deepEqual(report.errors,[]);report.success=true;report.statePreserved=true;
}catch(e){report.failure=e.message;throw e;}finally{fs.writeFileSync(process.argv.includes('--boss-only')?'.local/pve-boss-desktop-result.json':'.local/pve-enhanced-desktop-result.json',JSON.stringify(report,null,2));await app?.close();}
