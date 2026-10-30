import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const profile = path.resolve('.local', 'c-install-test-' + Date.now());
const executablePath = path.resolve('release/win-unpacked/OPTC Nakama.exe');
let app;
try {
  app = await electron.launch({executablePath,args:['--disable-gpu'],env:{...process.env,OPTC_TEST_PROFILE:profile},timeout:60000});
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading',{name:'Rotanı belirle.'}).waitFor({timeout:30000});
  const adb = await page.evaluate(() => window.nakama.discoverAdb());
  assert.equal(adb, 'C:\\Program Files\\Netease\\MuMuPlayer\\nx_main\\adb.exe');
  const devices = await page.evaluate(exe => window.nakama.devices(exe),adb);
  assert.ok(devices.some(d => d.id === '127.0.0.1:16384' && d.status === 'device'));
  const screenshot = await page.evaluate(exe => window.nakama.screenshot(exe,'127.0.0.1:16384'),adb);
  assert.ok(screenshot.startsWith('data:image/png;base64,'));
  const fixture = 'data:image/png;base64,' + fs.readFileSync('.local/recognition-box.png').toString('base64');
  const scan = await page.evaluate(image => window.nakama.recognize(image),fixture);
  assert.deepEqual(scan.detections.filter(d => d.status === 'confident').map(d => d.candidates[0].id),['4068','4162','3592']);
  assert.equal(scan.totalTemplates,5042);
  const images = await page.evaluate(async () => Promise.all(['4068','4162','3592'].map(id => new Promise(resolve => {
    const image = new Image(); image.onload = () => resolve(image.naturalWidth); image.onerror = () => resolve(0); image.src = './portraits/'+id+'.webp';
  }))));
  assert.deepEqual(images,[112,112,112]);
  assert.deepEqual(errors,[]);
  const appInfo = await app.evaluate(({app}) => ({name:app.getName(),appData:app.getPath('appData')}));
  console.log(JSON.stringify({success:true,packagedApp:executablePath,appInfo,adb,devices,recognizedIds:['4068','4162','3592'],templates:scan.totalTemplates,referenceImages:'loaded',pageErrors:errors},null,2));
} finally { await app?.close(); }
