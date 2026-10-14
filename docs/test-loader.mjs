// SPDX-License-Identifier: GPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {pack7,unpack7,parseRequest,parseIdentity,response,crc16,validatePackage,FirmwareLoader,HANDSHAKE,UPGRADE} from '../installer/js/loader.js';
if (!process.env.STOCK_FIRMWARE) throw new Error('Set STOCK_FIRMWARE to your own external, unmodified stock V15 .fwsc file. No stock image is bundled.');
const root = fileURLToPath(new URL('../',import.meta.url));
const fixture = resolve(process.env.STOCK_FIRMWARE);
if (fixture.startsWith(root.endsWith(sep)?root:root+sep)) throw new Error('STOCK_FIRMWARE must be outside this source repository.');
const stock = new Uint8Array(await readFile(fixture));
const timing={handshake:8,tries:1,open:0,start:0,reply:0,poll:1,checkIdle:12,writeIdle:12,loaderDelay:0,loaderWait:25,rebootDelay:0,rebootWait:25,retry:1};
const frame = body => [0xf0,...pack7(body),0xf7];
function request(addr,length=512,flags=0){const d=[0,0x59,0x30,8,0,0,flags,addr&255,(addr>>>8)&255,(addr>>>16)&255,(addr>>>24)&255,length&255,(length>>>8)&255,(length>>>16)&255];d.push(~d.slice(6).reduce((a,b)=>a+b,0)&255);return frame(d);}
function identity(text){const d=new Array(34).fill(0);d[1]=0x59;d[2]=0x11;for(let i=0;i<text.length;i++)d[6+i]=text.charCodeAt(i);return frame(d);}
function rig({mode='normal',returned='FM-1_015',disconnectWrite=false,badRequest=false,noReturn=false,stop=false,initial='FM-1_015',portName='FM-1'}={}){
  const access={inputs:new Map(),outputs:new Map(),sysexEnabled:true,addEventListener(){},removeEventListener(){}};const commands=[];let phase=mode==='ota'?'ota':'normal';
  function expose(){
    const listeners=new Set();
    const input={id:'in',name:phase==='ota'?(portName==='IRONCLAD'?'IRONCLAD Update':'ota-FM-1'):portName,state:'connected',async open(){},async close(){},addEventListener(k,f){listeners.add(f);},removeEventListener(k,f){listeners.delete(f);}};
    const emit=bytes=>{for(const f of listeners)f({data:bytes});};
    const output={id:'out',name:input.name,state:'connected',async open(){},async close(){},send(bytes){
      commands.push(bytes);
      if(JSON.stringify(bytes)===JSON.stringify(HANDSHAKE)){emit(identity(phase==='ota'?'ota-FM-1_001':phase==='back'?returned:initial));return;}
      if(JSON.stringify(bytes)===JSON.stringify(UPGRADE)){
        if(stop)return;
        if(phase==='ota'&&disconnectWrite){input.state=output.state='disconnected';return;}
        if(badRequest){emit(request(0xffffff00,512));return;}
        emit(request(0,512));emit(request(256,256));emit(request(phase==='ota'?0xf0000000:0xe0000000,0));return;
      }
      const d=unpack7(bytes.slice(1,-1)),addr=(d[7]|d[8]<<8|d[9]<<16|d[10]<<24)>>>0;
      if(addr===0xe0000000){input.state=output.state='disconnected';phase='ota';expose();}
      if(addr===0xf0000000){input.state=output.state='disconnected';phase='back';if(noReturn){access.inputs.clear();access.outputs.clear();}else expose();}
    }};
    access.inputs.set('in',input);access.outputs.set('out',output);
  }
  expose();return {access,commands};
}
async function connected(options){const r=rig(options),events=[];const loader=new FirmwareLoader({access:r.access,timing,onStatus:e=>events.push(e)});await loader.connect();await loader.selectPorts('in','out');return {...r,loader,events};}

test('7-bit MIDI packing round trips every byte and variable lengths',()=>{for(let n=0;n<1030;n++){const b=Array.from({length:n},(_,i)=>(i*71+n)&255),p=pack7(b);assert.ok(p.every(v=>v<128));assert.deepEqual(unpack7(p),b);}});
test('CRC16 matches standard XMODEM vector',()=>assert.equal(crc16(new TextEncoder().encode('123456789')),0x31c3));
test('request parser validates framing, command, checksum and unsigned addresses',()=>{assert.deepEqual(parseRequest(request(0xe0000000,0,7)),{flags:7,addr:0xe0000000,length:0});const bad=request(7,512);bad[12]^=1;assert.equal(parseRequest(bad),null);assert.equal(parseRequest([0xf0,128,0xf7]),null);assert.equal(parseRequest([]),null);});
test('response checksum and flags conform to protocol',()=>{const d=unpack7(response(0x12345678,[0,127,128,255],9).slice(1,-1));assert.deepEqual(d.slice(6,-1),[9,0x78,0x56,0x34,0x12,4,0,0,0,127,128,255]);assert.equal(d.at(-1),~d.slice(6,-1).reduce((a,b)=>a+b,0)&255);});
test('identity parser rejects malformed packets and distinguishes OTA',()=>{assert.equal(parseIdentity(identity('FM-1_015')).version,15);assert.equal(parseIdentity(identity('ota-FM-1_001')).loader,true);assert.equal(parseIdentity(identity('FM-1_bad')),null);assert.equal(parseIdentity([0,1,2]),null);});
test('real official V15 validates with known digest and image length',async()=>{const p=await validatePackage(stock);assert.equal(p.product,'FM-1_015');assert.equal(p.image.length,stock.length-20);assert.equal(p.sha256,'db1642b2b6fa5c2cccb11ffd13878068bb28601678d3644049f99dc40e7edb8a');});
test('validation rejects corruption, bad identities, truncation and mismatched SHA before transfer',async()=>{await assert.rejects(validatePackage(stock,{expectedSha256:'0'.repeat(64)}),{code:'digest'});await assert.rejects(validatePackage(stock,{expectedProduct:'FM-1_999'}),{code:'badpkg'});for(const off of [0,64,1044,679700]){const b=stock.slice();b[off]^=1;await assert.rejects(validatePackage(b),{code:'badpkg'});}await assert.rejects(validatePackage(stock.slice(0,100)),{code:'badpkg'});});
test('explicit selection sends only read-only identity query',async()=>{const {loader,commands}=await connected();assert.equal(loader.identity.text,'FM-1_015');assert.ok(commands.every(c=>JSON.stringify(c)===JSON.stringify(HANDSHAKE)));});
test('full two-stage update reports verified only after reboot identity',async()=>{const {loader,events,commands}=await connected();const result=await loader.flash(stock);assert.equal(result.status,'verified');assert.equal(commands.filter(c=>JSON.stringify(c)===JSON.stringify(UPGRADE)).length,2);assert.deepEqual(events.filter(e=>['loader','reboot','done'].includes(e.stage)).map(e=>e.stage),['loader','reboot','done']);assert.equal(events.at(-1).progress,1);assert.equal(loader.busy,false);});
test('resume update starts directly in existing OTA loader',async()=>{const {loader,commands}=await connected({mode:'ota'});const result=await loader.flash(stock);assert.equal(result.status,'verified');assert.equal(commands.filter(c=>JSON.stringify(c)===JSON.stringify(UPGRADE)).length,1);});
test('cancel during local validation sends no upgrade command',async()=>{const {loader,commands}=await connected();const pending=loader.flash(stock);assert.equal(loader.cancel(),true);await assert.rejects(pending,{code:'cancelled',writingStarted:false});assert.ok(!commands.some(c=>JSON.stringify(c)===JSON.stringify(UPGRADE)));});
test('cancellation is locked after entering upgrade mode',async()=>{const r=await connected();r.loader.onStatus=e=>{if(e.stage==='writing')assert.equal(r.loader.cancel(),false);};await r.loader.flash(stock);});
test('bad package emits no upgrade',async()=>{const {loader,commands}=await connected();const bad=stock.slice();bad[1044]^=1;await assert.rejects(loader.flash(bad),{code:'badpkg'});assert.ok(!commands.some(c=>JSON.stringify(c)===JSON.stringify(UPGRADE)));});
test('out of range device read aborts with a protocol error',async()=>{const {loader}=await connected({badRequest:true});await assert.rejects(loader.flash(stock),{code:'badreq',transferComplete:false});});
test('write disconnect reports recovery state and never claims completion',async()=>{const {loader,events}=await connected({mode:'ota',disconnectWrite:true});await assert.rejects(loader.flash(stock),{code:'lost',writingStarted:true,transferComplete:false});assert.ok(!events.some(e=>e.stage==='done'));});
test('request timeout is explicit',async()=>{const {loader}=await connected({stop:true});await assert.rejects(loader.flash(stock),{code:'timeout',transferComplete:false});});
test('transfer without returned identity is not installation verified',async()=>{const {loader,events}=await connected({noReturn:true});await assert.rejects(loader.flash(stock),{code:'noreturn',transferComplete:true});assert.ok(!events.some(e=>e.stage==='done'));});
test('wrong returned version remains unverified',async()=>{const {loader,events}=await connected({returned:'FM-1_014'});await assert.rejects(loader.flash(stock),{code:'mismatch',transferComplete:true});assert.ok(!events.some(e=>e.stage==='done'));});

test('stock backup explicitly rejects and sends no backup or upgrade command',async()=>{const {loader,commands}=await connected();await assert.rejects(loader.backup(),{code:'backupUnsupported'});assert.ok(commands.every(c=>JSON.stringify(c)===JSON.stringify(HANDSHAKE)));});
test('a broken UI status callback cannot interrupt a firmware write',async()=>{const {loader}=await connected();const old=console.error;console.error=()=>{};try{loader.onStatus=()=>{throw new Error('UI bug');};assert.equal((await loader.flash(stock)).status,'verified');}finally{console.error=old;}});

test('unsupported official firmware versions are rejected before upgrade',async()=>{const {loader,commands}=await connected({initial:'FM-1_014'});await assert.rejects(loader.flash(stock),{code:'version',writingStarted:false});assert.ok(!commands.some(c=>JSON.stringify(c)===JSON.stringify(UPGRADE)));});
test('a pending browser MIDI permission times out without opening or writing a device',async()=>{
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'),oldSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');let calls=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{requestMIDIAccess(){calls++;return new Promise(()=>{});}}});Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:true});
 try{const loader=new FirmwareLoader({timing:{permission:5}});await assert.rejects(loader.connect(),{code:'permissionTimeout'});assert.equal(calls,1);assert.equal(loader.access,null);assert.equal(loader.link,null);assert.equal(loader.busy,false);}
 finally{if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;if(oldSecure)Object.defineProperty(globalThis,'isSecureContext',oldSecure);else delete globalThis.isSecureContext;}
});

test('IRONCLAD USB names reconnect through normal, update and reboot phases',async()=>{const {loader}=await connected({portName:'IRONCLAD'});const result=await loader.flash(stock);assert.equal(result.status,'verified');assert.equal(loader.link.input.name,'IRONCLAD');});
