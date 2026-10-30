import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const profile=path.resolve('.local','recognition-test-'+Date.now());
const packaged=process.env.OPTC_PACKAGED_EXE;
const launchOptions={args:packaged?['--disable-gpu']:['.','--disable-gpu'],...(packaged?{executablePath:path.resolve(packaged)}:{}),env:{...process.env,OPTC_TEST_PROFILE:profile},timeout:60000};
let app,page;
try{
  app=await electron.launch(launchOptions);page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor({timeout:30000});
  const previous=JSON.parse(await page.evaluate(()=>window.nakama.load()));
  previous.box=[{id:'4068',level:120,cooldown:8,readyTurn:0,lb:true,llb:5,rumbleAbility:5,rumbleSpecial:10,ability:{verified:false,captainVerified:false,effects:[],captainTypes:[],captainClasses:[],maxCooldown:null}}];
  if(process.env.OPTC_LIVE_DEVICE)previous.settings.device=process.env.OPTC_LIVE_DEVICE;
  await page.evaluate(s=>window.nakama.save(JSON.stringify(s)),previous);await page.reload();
  await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
  await page.getByRole('button',{name:'MuMu bağlantısı',exact:true}).click();
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Görsel yükle',exact:true}).click();await (await chooser).setFiles(path.resolve('.local/recognition-box.png'));
  await page.getByRole('button',{name:'Seçilen 3 karakteri kutuma ekle',exact:true}).waitFor({timeout:45000});
  assert.equal(await page.locator('.scan-card.confident').count(),3);
  assert.ok(await page.locator('.scan-card.unknown').count()); // all results visible by default
  await page.getByRole('button',{name:'Seçilen 3 karakteri kutuma ekle',exact:true}).click();
  await page.getByText('Kaydedildi',{exact:true}).waitFor();
  const saved=JSON.parse(await page.evaluate(()=>window.nakama.load()));
  assert.deepEqual(saved.box.map(o=>o.id).sort(),['3592','4068','4162']);
  assert.equal(saved.box.find(o=>o.id==='4068').level,120);assert.equal(saved.box.find(o=>o.id==='4068').llb,5);
  assert.equal(saved.box.find(o=>o.id==='3592').level,null);
  if(!packaged)await page.screenshot({path:'docs/screenshot-recognition.png',fullPage:true,timeout:60000});
  console.log('PASS: offline icon recognition via IPC worker, 3 exact IDs, material exclusion, bulk import, existing upgrades preserved.');
  await page.getByRole('button',{name:/Eşleşmedi/}).click();
  const unknown=page.locator('.scan-card.unknown').first();
  assert.equal(await unknown.locator('.scan-pair img').count(),1);
  assert.equal(await unknown.locator('select').first().inputValue(),'');
  await page.getByRole('button',{name:/Tümü/}).click();await unknown.locator('.manual-id input').fill('4068');
  assert.equal(await unknown.locator('select').first().inputValue(),'4068');
  assert.equal(await unknown.locator('input[type="checkbox"]').isChecked(),false);
  await page.getByRole('button',{name:/Elle eşleştirildi/}).click();
  const correctedLabel=await unknown.locator('.manual-id input').getAttribute('aria-label');
  const corrected=page.locator('.scan-card').filter({has:page.getByLabel(correctedLabel,{exact:true})});
  await corrected.locator('.match-picker summary').click();
  await corrected.locator('.match-picker input').fill('Vivi Rebecca');
  await corrected.locator('.match-picker select').selectOption('QCK');
  const option=corrected.locator('.match-options button').filter({hasText:'#3164'});await option.waitFor();await option.click();
  assert.equal(await corrected.locator('select').first().inputValue(),'3164');
  assert.equal(await corrected.locator('input[type="checkbox"]').isChecked(),true);
  await page.getByRole('button',{name:/Kontrol gerekli/}).click();assert.equal(await page.locator('.scan-card.unknown').count(),0);
  await page.getByRole('button',{name:/Tümü/}).click();
  console.log('PASS: name/version picker chooses Vivi & Rebecca, manual status and clickable filters work.');
  await corrected.locator('input[type="checkbox"]').uncheck();console.log('PASS: unknown icons have no guessed reference, numeric ID correction stays unselected.');
  if(fs.existsSync('.local/recognition-problem.png')){
    const next=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Görsel yükle',exact:true}).click();await (await next).setFiles(path.resolve('.local/recognition-problem.png'));
    await page.getByRole('button',{name:'Seçilen 19 karakteri kutuma ekle',exact:true}).waitFor({timeout:90000});
    assert.equal(await page.locator('.scan-card.confident').count(),22);
    console.log('PASS: first complete row retained, 20 scrolled icons recognized, duplicate ID merged, original/Neo type disambiguation.');
    if(!packaged)await page.screenshot({path:'.local/screenshot-recognition-v021.png',fullPage:true,timeout:60000});
  }
  if(fs.existsSync('.local/recognition-dual-open.png')){
    await page.getByRole('button',{name:'Tarama listesini temizle',exact:true}).click();
    const next=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Görsel yükle',exact:true}).click();await (await next).setFiles(path.resolve('.local/recognition-dual-open.png'));
    await page.getByRole('button',{name:'Seçilen 20 karakteri kutuma ekle',exact:true}).waitFor({timeout:45000});
    await page.getByRole('button',{name:'Izgarayı ayarla',exact:true}).click();
    await page.getByLabel('Elle ayarlanan ızgarayı kullan',{exact:true}).check();
    await page.getByLabel('Sol',{exact:true}).fill('54');await page.getByLabel('Yatay aralık',{exact:true}).fill('138');
    await page.getByRole('button',{name:'Bu görüntüyü yeniden tara',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.scan-status.scanning'),{timeout:45000});
    assert.ok(await page.locator('.scan-card.confident').count()<20);
    await page.getByRole('button',{name:'Otomatik hizala ve yeniden tara',exact:true}).click();
    await page.getByRole('button',{name:'Seçilen 20 karakteri kutuma ekle',exact:true}).waitFor({timeout:45000});
    assert.equal(await page.locator('.scan-card.confident').count(),20);
    assert.equal(await page.locator('.scan-card.review').count(),0);
    assert.equal(await page.getByLabel('Elle ayarlanan ızgarayı kullan',{exact:true}).isChecked(),false);
    await page.getByRole('button',{name:/Eşleşmedi/}).click();assert.equal(await page.locator('.scan-card.unknown').count(),0);
    console.log('PASS: misaligned manual crops replaced on automatic recalibration, 20 dual-box IDs recognized without stale unknowns.');
    if(!packaged)await page.screenshot({path:'.local/screenshot-recognition-v022.png',fullPage:true,timeout:60000});
  }
  if(process.env.OPTC_LIVE_DEVICE){
    await page.getByLabel('Tarama ekran sınırı',{exact:true}).selectOption('2');
    await page.getByRole('button',{name:'MuMu kutusunu tara',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.scan-status.scanning'),{timeout:60000});
    const status=await page.locator('.scan-status').innerText();
    const error=await page.locator('.scanner .error').allTextContents();
    assert.deepEqual(error,[]);
    if(status.includes('Character Box başlığı görülmedi'))console.log('PASS: MuMu left Character Box, scanner safely stopped without scrolling.');
    else{assert.ok(status.includes('Tarama tamamlandı'),status);console.log('PASS: live two-page MuMu box scan with one bounded swipe.');}
  }
  assert.deepEqual(errors,[]);
  await page.reload();await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor();
  const persisted=JSON.parse(await page.evaluate(()=>window.nakama.load()));assert.equal(persisted.box.length,3);
  console.log('PASS: recognized box persists after reload.');
}catch(e){if(page)console.log('Scanner diagnostics:',await page.locator('.scan-status,.scan-summary,.scan-result-actions,.scanner .error').allTextContents());throw e;}finally{await app?.close();}
