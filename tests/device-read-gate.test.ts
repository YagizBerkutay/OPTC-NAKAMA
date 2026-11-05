import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createDeviceReadGate}=require('../electron/device-read-gate.cjs'),{registerScreenRead,registerScreenshot}=require('../electron/screen-read-ipc.cjs');

test('main IPC registration gates native screen readers, leaves screenshot free, and scopes by device',async()=>{
 const withDeviceRead=createDeviceReadGate((device:string)=>device);let entered!:()=>void,release!:()=>void,readerStarts=0;
 const started=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
 const handlers=new Map<string,(...args:any[])=>Promise<unknown>>(),handle=(channel:string,fn:(...args:any[])=>unknown)=>handlers.set(channel,async(...args)=>fn(...args));
 const boxScroll=async()=>{readerStarts++;entered();await gate;return 'scrolled';};let coopReadCalls=0,coopTargetCalls=0,screenshotCalls=0;
 registerScreenRead(handle,withDeviceRead,'adb:boxScroll',(_exe:string,device:string)=>device,boxScroll);
 registerScreenRead(handle,withDeviceRead,'coop:read',(input:{device:string})=>input.device,async()=>{coopReadCalls++;return 'coop';});
 registerScreenRead(handle,withDeviceRead,'coop:target',(input:{device:string})=>input.device,async()=>{coopTargetCalls++;return 'target';});
 registerScreenshot(handle,'adb:screenshot',async()=>{screenshotCalls++;return 'screenshot';});
 const pending=handlers.get('adb:boxScroll')!('adb.exe','device-a',{});await started;
 await assert.rejects(handlers.get('coop:read')!({device:'device-a'}),/başka bir ekran okuması sürüyor/);
 await assert.rejects(handlers.get('coop:target')!({device:'device-a'}),/başka bir ekran okuması sürüyor/);
 assert.equal(coopReadCalls,0);assert.equal(coopTargetCalls,0);assert.equal(readerStarts,1);
 assert.equal(await handlers.get('adb:screenshot')!('adb.exe','device-a'),'screenshot');assert.equal(screenshotCalls,1,'registered screenshot IPC remains outside the input lease');
 assert.equal(await handlers.get('coop:read')!({device:'device-b'}),'coop');assert.equal(coopReadCalls,1,'a different device is not blocked');
 release();assert.equal(await pending,'scrolled');
 assert.equal(await handlers.get('coop:target')!({device:'device-a'}),'target');assert.equal(coopTargetCalls,1);
});

test('a failed screen read releases only its own device reservation',async()=>{
 const withDeviceRead=createDeviceReadGate((device:string)=>device);await assert.rejects(withDeviceRead('device-a',async()=>{throw Error('read failed');}),/read failed/);
 assert.equal(await withDeviceRead('device-a',async()=>'retry'),'retry');
});

test('an explicitly undrained native job fails closed for that device',async()=>{
 const withDeviceRead=createDeviceReadGate((device:string)=>device),error=Object.assign(Error('worker not drained'),{code:'SCREEN_READ_UNDRAINED'});
 await assert.rejects(withDeviceRead('device-a',async()=>{throw error;}),/worker not drained/);
 await assert.rejects(withDeviceRead('device-a',async()=>'unsafe'),/güvenli biçimde sonlanmadı/);
 assert.equal(await withDeviceRead('device-b',async()=>'independent'),'independent');
});

test('device keys are validated and localhost aliases share one lease',async()=>{
 const {validateDevice}=require('../electron/adb.cjs'),withDeviceRead=createDeviceReadGate(validateDevice);let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r),active=withDeviceRead('127.0.0.1:5555',async()=>{entered();await gate;});await started;
 await assert.rejects(withDeviceRead('localhost:5555',async()=>true),/başka bir ekran okuması sürüyor/);
 await assert.rejects(withDeviceRead('attacker:5555',async()=>true),/Yerel MuMu cihazı/);release();await active;
});
