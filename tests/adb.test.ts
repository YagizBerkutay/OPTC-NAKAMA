import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validateDevice,validateAdb}=require('../electron/adb.cjs');
test('ADB accepts only bounded loopback serials',()=>{assert.equal(validateDevice('127.0.0.1:16384'),'127.0.0.1:16384');for(const v of ['192.168.1.1:5555','127.0.0.1:65536','127.0.0.1:0','127.0.0.1:5555 && calc','-s','localhost:12\n'])assert.throws(()=>validateDevice(v));});
test('ADB rejects arbitrary executables',()=>{assert.throws(()=>validateAdb('C:\\Windows\\System32\\cmd.exe'));assert.throws(()=>validateAdb('adb.exe'));});
