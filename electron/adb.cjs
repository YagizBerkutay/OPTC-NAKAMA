const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const execute = promisify(execFile);
function validateAdb(exe) {
  if (typeof exe !== 'string' || !path.isAbsolute(exe) || !['adb.exe', 'adb_server.exe'].includes(path.basename(exe).toLowerCase()) || !fs.statSync(exe).isFile()) throw Error('Geçerli adb.exe dosyasını seç.');
  return exe;
}
function validateDevice(device) {
  if(typeof device !== 'string' || !/^(127\.0\.0\.1:\d{1,5}|localhost:\d{1,5}|emulator-\d{1,5})$/.test(device)) throw Error('Yerel MuMu cihazı seç (127.0.0.1:port).');
  const port = Number(device.split(/[:-]/).at(-1));
  if(port<1 || port>65535) throw Error('Port 1–65535 arasında olmalı.');
  return device;
}
async function devices(exe) {
  const { stdout } = await execute(validateAdb(exe), ['devices'], { windowsHide: true, timeout: 10000, maxBuffer: 1024*1024 });
  return stdout.split(/\r?\n/).slice(1).filter(Boolean).map(line=>{const [id,status]=line.trim().split(/\s+/);return {id,status};}).filter(d=>/^(127\.0\.0\.1:|localhost:|emulator-)/.test(d.id));
}
async function connect(exe, device) {
  const target = validateDevice(device);
  if(target.startsWith('emulator-')) throw Error('Bağlanmak için 127.0.0.1:port adresini gir.');
  const { stdout } = await execute(validateAdb(exe), ['connect',target], { windowsHide:true,timeout:10000,maxBuffer:1024*1024 });
  if(/failed|cannot|refused|unable/i.test(stdout)) throw Error(stdout.trim());
  return stdout.trim();
}
async function screenshot(exe, device) {
  const { stdout }=await execute(validateAdb(exe),['-s',validateDevice(device),'exec-out','screencap','-p'],{windowsHide:true,timeout:15000,encoding:'buffer',maxBuffer:16*1024*1024});
  if(!stdout.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('MuMu geçerli bir ekran görüntüsü döndürmedi. Cihazın açık olduğundan emin ol.');
  return `data:image/png;base64,${stdout.toString('base64')}`;
}
async function boxScroll(exe,device,geometry){
  if(!geometry||!['width','height'].every(k=>Number.isInteger(geometry[k])&&geometry[k]>=200&&geometry[k]<=4096))throw Error('Geçersiz ekran boyutu.');
  const {width:w,height:h}=geometry;
  const {verifyBoxImage}=require('./recognition-core.cjs');
  const current=await verifyBoxImage(await screenshot(exe,device),path.join(__dirname,'../dist/data'));
  if(!current.isCharacterBox)throw Error('MuMu artık Character Box ekranında değil. Tarama durduruldu.');
  if(current.width!==w||current.height!==h)throw Error('Ekran boyutu değişti. Taramayı yeniden başlat.');
  // Only a bounded vertical swipe inside Character Box; no arbitrary input IPC.
  // Keep at least two tile rows overlapping; partial top/bottom rows are not
  // scanned, so a large swipe could otherwise leave characters between pages.
  const end=Math.max(Math.round(h*.37),Math.round(h*.72-w*.35));
  const args=['-s',validateDevice(device),'shell','input','swipe',String(Math.round(w*.48)),String(Math.round(h*.72)),String(Math.round(w*.48)),String(end),'650'];
  await execute(validateAdb(exe),args,{windowsHide:true,timeout:10000,maxBuffer:1024*1024});return true;
}
module.exports={validateAdb,validateDevice,devices,connect,screenshot,boxScroll};
