// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
// Modified for IRONCLAD FM-1: validation, explicit ports, progress and error handling.
// Derived from Felucca web/fm1ota.js, web/fm1pkg.js and tools/fm1_install.py.
// The device pulls requested byte ranges; this is not a MIDI preset dump.

import {BackupConnection,captureBackup} from './backup.js';

export const STOCK_V15_SHA256 = 'db1642b2b6fa5c2cccb11ffd13878068bb28601678d3644049f99dc40e7edb8a';
export const HANDSHAKE = [0xf0,0,0x32,0x45,0,0,0,0x40,0x7f,0xf7];
export const UPGRADE = [0xf0,0x22,0x24,0x35,0x7f,0xf7];
const FINISH_CHECK = 0xe0000000, FINISH_WRITE = 0xf0000000;
const PORT_RE = /fm[- ]?1|ironclad|felucca|ota|composite|sinco|usb[- ]?midi/i;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const defaults = {permission:15000,handshake:1000, tries:3, open:300, start:2000, reply:10, poll:250, checkIdle:8000, writeIdle:180000, loaderDelay:3000, loaderWait:30000, rebootDelay:3000, rebootWait:40000, retry:1000};
const u16 = (b,o) => b[o] | b[o+1] << 8;
const u32 = (b,o) => (b[o] | b[o+1] << 8 | b[o+2] << 16 | b[o+3] << 24) >>> 0;
const ascii = bytes => String.fromCharCode(...bytes);
const bytesOf = value => value instanceof Uint8Array ? new Uint8Array(value) : value instanceof ArrayBuffer ? new Uint8Array(value.slice(0)) : (() => {throw error('badpkg','Provide firmware bytes as Uint8Array or ArrayBuffer.');})();
function error(code, message, details = {}) { return Object.assign(new Error(message), {code, ...details}); }

export function pack7(data) {
  const out = []; let acc = 0, n = 0;
  for (const b of data) { acc |= b << n; n += 8; while (n >= 7) {out.push(acc & 127); acc >>>= 7; n -= 7;} }
  if (n) out.push(acc & 127);
  return out;
}
export function unpack7(data) {
  const out = []; let acc = 0, n = 0;
  for (const b of data) {acc |= (b & 127) << n; n += 7; while (n >= 8) {out.push(acc & 255); acc >>>= 8; n -= 8;} }
  return out;
}
const framed = pkt => pkt?.length >= 2 && pkt[0] === 0xf0 && pkt[pkt.length-1] === 0xf7 && Array.from(pkt).slice(1,-1).every(b => b < 128);
export function parseRequest(pkt) {
  if (!framed(pkt)) return null;
  const d = unpack7(pkt.slice(1,-1));
  if (d.length !== 15 || d[0] !== 0 || d[1] !== 0x59 || d[2] !== 0x30) return null;
  if ((~d.slice(6,14).reduce((a,b)=>a+b,0) & 255) !== d[14]) return null;
  return {flags:d[6], addr:u32(d,7), length:d[11] | d[12]<<8 | d[13]<<16};
}
export function response(addr, data, flags = 0) {
  const n = data.length;
  const d = [0,0x59,0x30,(n+8)&255,(n+8)>>8,0,flags,addr&255,(addr>>>8)&255,(addr>>>16)&255,(addr>>>24)&255,n&255,n>>8,0,...data];
  d.push(~d.slice(6).reduce((a,b)=>a+b,0)&255);
  return [0xf0,...pack7(d),0xf7];
}
export function parseIdentity(pkt) {
  if (!framed(pkt)) return null;
  const d = unpack7(pkt.slice(1,-1));
  if (d.length !== 34 || d[0] !== 0 || d[1] !== 0x59 || d[2] !== 0x11) return null;
  const text = ascii(d.slice(6,33)).replace(/\0+$/,'');
  const m = /^([\x20-\x7e]+)_(\d+)$/.exec(text);
  return m ? {text,model:m[1],version:Number(m[2]),loader:/^ota-/i.test(m[1])} : null;
}
export function crc16(data, crc = 0) {
  for (const b of data) {crc ^= b << 8; for(let j=0;j<8;j++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;}
  return crc;
}
function decrypt(data) {
  const out = data.slice(); let key = 0xffff;
  for(let i=0;i<out.length;i++){out[i] ^= key&255; key=((key<<1)^(key&0x8000?0x1021:0))&0xffff;}
  return out;
}
export async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw error('unsupported','Secure SHA-256 is unavailable. Open this app on HTTPS or localhost.');
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)), x=>x.toString(16).padStart(2,'0')).join('');
}
export async function validatePackage(value, {expectedSha256, expectedProduct} = {}) {
  const raw = bytesOf(value);
  if(raw.length < 1044 || raw.length > 8*1024*1024) throw error('badpkg','Not a supported FM-1 .fwsc package size.');
  let product = '';
  const image = new Uint8Array(raw.length-20);
  for(let i=0;i<20;i++) {const m=raw[i*48+47]; if(m!==0x7d) product+=String.fromCharCode((m-i-1)&255); image.set(raw.subarray(i*48,i*48+47),i*47);}
  image.set(raw.subarray(960),940);
  const p = /^FM-1_(\d{1,10})$/.exec(product);
  if(!p) throw error('badpkg','The package identity is not for an FM-1.');
  if(expectedProduct && product!==expectedProduct) throw error('badpkg',`Expected ${expectedProduct}; package reports ${product}.`);
  const digest = await sha256(raw);
  if(expectedSha256 && digest !== expectedSha256.toLowerCase()) throw error('digest','Firmware SHA-256 does not match the release manifest.');
  const header = image.slice(0,940);
  header.set(decrypt(header.slice(0,64)),0);
  if(crc16(header.subarray(2,64))!==u16(header,0)) throw error('badpkg','Firmware header checksum failed.');
  const count = u16(header,8), end = 64+count*80;
  if(!count || end>header.length) throw error('badpkg','Firmware entry table is out of bounds.');
  if(crc16(header.subarray(64,end))!==u16(header,2)) throw error('badpkg','Firmware entry table checksum failed.');
  const entries=[];
  for(let off=64;off<end;off+=80){
    const e=decrypt(header.slice(off,off+80));
    const start=u32(e,8), size=u32(e,12), type=u16(e,0);
    if(start<end || start+size>image.length) throw error('badpkg','Firmware contains an invalid data range.');
    // Stock auxiliary entries can be encrypted; flash and OTA use direct CRCs.
    if((type===0 || type===100 || type===255) && crc16(image.subarray(start,start+size))!==u16(e,4)) throw error('badpkg','Firmware flash or loader checksum failed.');
    entries.push({type,start,size,name:ascii(e.subarray(64,80)).replace(/\0.*$/,'')});
  }
  if(!entries.some(e=>e.type===0&&e.name==='flash.bin') || !entries.some(e=>e.type===100&&e.name==='ota.bin')) throw error('badpkg','Firmware is missing its flash image or update loader.');
  const marker = new TextEncoder().encode('FELUCCA-LOADER-1');
  const hasMarker = raw.some((b,i)=>b===marker[0]&&marker.every((v,j)=>raw[i+j]===v));
  // A pinned bundled stock-derived patch is accepted only after UFW header, flash and loader CRCs pass.
  if(!hasMarker && digest!==STOCK_V15_SHA256 && !expectedSha256) throw error('badpkg','Unrecognized update loader. Use the bundled release or an unmodified official V15 package.');
  return {product,model:'FM-1',version:Number(p[1]),sha256:digest,byteLength:raw.length,image};
}

export class MidiLink {
  constructor(input,output) {
    this.input=input;this.output=output;this.queue=[];this.wake=null;
    this.listener=ev=>{if(ev.data?.[0]!==0xf0)return; if(this.queue.length>2048)this.queue.shift();this.queue.push(Array.from(ev.data));this.wake?.();};
    if(input.addEventListener) input.addEventListener('midimessage',this.listener); else {this.previous=input.onmidimessage; input.onmidimessage=this.listener;}
  }
  get lost(){return this.input.state==='disconnected'||this.output.state==='disconnected';}
  send(data){if(this.lost)return false;try{this.output.send(data);return true;}catch{return false;}}
  drain(){this.queue.length=0;}
  async read(ms){
    if(!this.queue.length&&!this.lost){let timer;await new Promise(resolve=>{this.wake=resolve;timer=setTimeout(resolve,Math.max(0,ms));});clearTimeout(timer);this.wake=null;}
    return this.queue.shift()||null;
  }
  close(){if(this.input.removeEventListener)this.input.removeEventListener('midimessage',this.listener);else if(this.input.onmidimessage===this.listener)this.input.onmidimessage=this.previous||null;this.wake?.();}
}

export class FirmwareLoader {
  constructor({onStatus=()=>{},access=null,timing={}}={}) {
    this.onStatus=onStatus;this.access=access;this.timing={...defaults,...timing};this.link=null;this.identity=null;this.busy=false;this.writing=false;this.locked=false;this.cancelled=false;this.transferComplete=false;this.onPortsChanged=null;
    this.stateListener=()=>this.onPortsChanged?.(this.listPorts());
  }
  get cancellable(){return this.busy&&!this.locked;}
  emit(stage,message,progress=null,extra={}){try{this.onStatus({stage,message,progress,writing:this.writing,cancellable:this.cancellable,...extra});}catch(e){console.error('Firmware status callback failed',e);}}
  async connect(){
    if(this.busy)throw error('busy','Wait for the current operation to finish.');
    if(!this.access){
      if(!globalThis.isSecureContext)throw error('unsupported','Open this app on HTTPS or localhost.');
      if(!globalThis.navigator?.requestMIDIAccess)throw error('unsupported','Web MIDI is unavailable. Use Chrome or Edge on a computer.');
      let timer;
      try{
        this.access=await Promise.race([
          navigator.requestMIDIAccess({sysex:true}),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(error('permissionTimeout','MIDI permission did not complete. Open this page directly in desktop Chrome or Edge, allow MIDI SysEx, then click Connect again.')),this.timing.permission);})
        ]);
      }catch(e){if(e.code==='permissionTimeout')throw e;throw error('permission','Allow MIDI SysEx in the browser site settings, then click Connect again. If you are using an embedded browser, open this page directly in desktop Chrome or Edge.',{cause:e});}
      finally{clearTimeout(timer);}
    }
    if(this.access.sysexEnabled===false)throw error('permission','MIDI SysEx permission is required.');
    this.access.removeEventListener?.('statechange',this.stateListener);
    this.access.addEventListener?.('statechange',this.stateListener);
    const ports=this.listPorts();this.emit('connect','MIDI access enabled. Select the FM-1 input and output.');return ports;
  }
  listPorts(){const ports=map=>[...(map?.values()||[])].filter(p=>p.state!=='disconnected').map(p=>({id:p.id,name:p.name||'Unnamed MIDI port',manufacturer:p.manufacturer||''}));return {inputs:ports(this.access?.inputs),outputs:ports(this.access?.outputs)};}
  async selectPorts(inputId,outputId){
    if(this.busy)throw error('busy','Wait for the current operation to finish.');
    this.link?.close();this.link=null;this.identity=null;
    const input=this.access?.inputs.get(inputId),output=this.access?.outputs.get(outputId);
    if(!input||!output)throw error('notfound','Select an available MIDI input and output.');
    if(!PORT_RE.test(input.name||'')||!PORT_RE.test(output.name||''))throw error('model','Select the FM-1 MIDI ports. Other instruments are not probed.');
    try{await input.open();await output.open();}catch(e){throw error('notfound','Cannot open the MIDI ports. Close other apps using the synth.',{cause:e});}
    this.link=new MidiLink(input,output);await wait(this.timing.open);
    try{return await this.readIdentity();}catch(e){this.link.close();this.link=null;throw e;}
  }
  async handshake(link){
    link.drain();
    for(let t=0;t<this.timing.tries;t++){
      if(!link.send(HANDSHAKE))throw error('lost','The MIDI connection was lost.');
      const end=Date.now()+this.timing.handshake;
      while(Date.now()<end){const pkt=await link.read(end-Date.now());if(!pkt)break;const id=parseIdentity(pkt);if(id)return id;}
    }
    if(link.lost)throw error('lost','The MIDI connection was lost.');
    return null;
  }
  async readIdentity(){
    if(this.busy)throw error('busy','Wait for the firmware operation to finish.');
    if(!this.link)throw error('notfound','Select the FM-1 MIDI ports first.');
    const id=await this.handshake(this.link);
    if(!id)throw error('notfound','The selected MIDI ports did not answer the FM-1 identity query.');
    if(!['FM-1','ota-FM-1'].includes(id.model))throw error('model',`Unsupported device identity: ${id.text}.`);
    this.identity=id;this.emit('identity',`Connected: ${id.text}${id.loader?' (update loader)':''}`,null,{identity:id});return id;
  }
  cancel(){if(!this.cancellable)return false;this.cancelled=true;return true;}
  checkCancelled(){if(this.cancelled)throw error('cancelled','Update cancelled before entering update mode.');}
  async candidates(){
    const outs=[...this.access.outputs.values()].filter(p=>p.state!=='disconnected'&&PORT_RE.test(p.name||''));const found=[];
    for(const input of this.access.inputs.values()){
      if(input.state==='disconnected'||!PORT_RE.test(input.name||''))continue;
      const base=n=>(n||'').replace(/\s+\d+$/,'');
      const matches=outs.filter(o=>base(o.name)===base(input.name));
      const output=matches.length===1?matches[0]:outs.length===1?outs[0]:null;
      if(output)found.push({input,output});
    }
    return found;
  }
  async waitFor(model,ms){
    const end=Date.now()+ms;
    while(Date.now()<end){
      const candidates=await this.candidates();
      // Never spray update or handshake messages across several synths.
      if(candidates.length>1)throw error('ambiguous','Several matching MIDI devices appeared. Keep only this FM-1 connected and retry.');
      for(const {input,output} of candidates){
        let link;
        try{await input.open();await output.open();link=new MidiLink(input,output);await wait(this.timing.open);const id=await this.handshake(link);if(id?.model===model)return {link,id};}catch(e){if(e.code==='ambiguous')throw e;}
        link?.close();
      }
      await wait(Math.min(this.timing.retry,Math.max(0,end-Date.now())));
    }
    return null;
  }
  async serve(link,image,finish,idle,stage){
    const coverage=new Uint8Array(image.length);let unique=0,requests=0,last=Date.now();
    while(true){
      const pkt=await link.read(this.timing.poll);
      if(!pkt){if(link.lost)throw error('lost',this.writing?'USB disconnected during writing. Reconnect and load the same package to finish.':'USB disconnected while checking the package.');if(Date.now()-last>idle)throw error('timeout',this.writing?'Update loader stopped requesting data. Reconnect and load the same package to finish.':'The synth stopped requesting package data.');continue;}
      const r=parseRequest(pkt);if(!r)continue;last=Date.now();
      if(r.addr===FINISH_CHECK||r.addr===FINISH_WRITE){
        if(!link.send(response(r.addr,[...new TextEncoder().encode('success'),0])))throw error('lost','USB disconnected before the completion response.');
        if(r.addr===finish)return {requests,unique};
        continue;
      }
      if(r.length<1||r.length>512||r.addr+r.length>image.length)throw error('badreq',`Device requested an invalid firmware range (${r.addr}+${r.length}).`);
      await wait(this.timing.reply);
      if(!link.send(response(r.addr,image.subarray(r.addr,r.addr+r.length),r.flags)))throw error('lost','USB connection lost while sending firmware data.');
      requests++;
      for(let i=r.addr;i<r.addr+r.length;i++)if(!coverage[i]){coverage[i]=1;unique++;}
      this.emit(stage,stage==='writing'?'Writing firmware. Keep USB and power connected.':'Synth is checking the package.',stage==='writing'?Math.min(.99,unique/image.length):null,{requests,bytesServed:unique,totalBytes:image.length});
    }
  }
  async flash(value,options={}){
    if(this.busy)throw error('busy','An update is already running.');
    if(!this.link)throw error('notfound','Connect and select the FM-1 first.');
    this.busy=true;this.locked=false;this.cancelled=false;this.writing=false;this.transferComplete=false;let active=this.link;
    try{
      this.emit('checking','Validating firmware file and checksums.');
      const pkg=await validatePackage(value,options);this.checkCancelled();
      const id=await this.handshake(active);this.checkCancelled();
      if(!id)throw error('notfound','The selected FM-1 did not answer.');
      if(id.model!==pkg.model&&id.model!==`ota-${pkg.model}`)throw error('model',`The connected device (${id.text}) does not match ${pkg.product}.`);
      if(!id.loader && id.version!==15 && id.version<900)throw error('version',`Firmware ${id.text} is outside the supported baseline. This loader supports official V15 and IRONCLAD and compatible firmware (900+).`);
      this.identity=id;
      // Lock cancellation before the first command which changes device state.
      this.locked=true;
      if(!id.loader){
        this.emit('checking',`Entering update mode from ${id.text}.`);
        if(!active.send(UPGRADE))throw error('lost','Cannot start the updater: USB disconnected.');
        await wait(this.timing.start);await this.serve(active,pkg.image,FINISH_CHECK,this.timing.checkIdle,'checking');active.close();this.link=null;
        this.emit('loader','Waiting for the FM-1 update loader.');await wait(this.timing.loaderDelay);
        const ota=await this.waitFor(`ota-${pkg.model}`,this.timing.loaderWait);
        if(!ota)throw error('noloader','Update loader did not appear. Reconnect USB, select the FM-1 loader ports, and load the same package again.');
        active=ota.link;
      }
      this.writing=true;this.emit('writing','Writing firmware. Keep USB and power connected.',0);
      if(!active.send(UPGRADE))throw error('lost','Cannot start writing: USB disconnected.');
      await wait(this.timing.start);await this.serve(active,pkg.image,FINISH_WRITE,this.timing.writeIdle,'writing');
      this.transferComplete=true;active.close();this.writing=false;this.link=null;
      this.emit('reboot','Transfer complete. Waiting for the synth to restart and verify its identity.',1);await wait(this.timing.rebootDelay);
      const back=await this.waitFor(pkg.model,this.timing.rebootWait);
      if(!back)throw error('noreturn','Transfer completed, but the restarted synth could not be verified. Reconnect and read its identity before assuming installation succeeded.');
      active=back.link;this.link=active;this.identity=back.id;
      if(back.id.text!==pkg.product)throw error('mismatch',`Transfer completed, but synth reports ${back.id.text}; expected ${pkg.product}.`,{identity:back.id});
      this.busy=false;this.locked=false;
      const result={status:'verified',identity:back.id,sha256:pkg.sha256,product:pkg.product};this.emit('done',`Verified: ${back.id.text}.`,1,result);return result;
    }catch(e){
      Object.assign(e,{writingStarted:this.writing||this.transferComplete,transferComplete:this.transferComplete});
      active?.close();this.link=null;this.emit('error',e.message,null,{code:e.code||'unknown',transferComplete:e.transferComplete});throw e;
    }finally{this.busy=false;this.writing=false;this.locked=false;}
  }
  async backup(){
    if(this.busy)throw error('busy','Wait for the current operation to finish.');
    if(!this.link||!this.identity)throw error('notfound','Connect and select the FM-1 first.');
    if(this.identity.loader||this.identity.version<900)throw error('backupUnsupported','Complete browser backup is available for IRONCLAD and compatible firmware only. Official FM-1 firmware requires its manufacturer preset tools; this app cannot preserve stock presets.');
    this.busy=true;this.locked=true;
    const connection=new BackupConnection(this.link.input,this.link.output);
    try{
      this.emit('backup','Reading the musical archive. Stop playback and keep USB connected.',0);
      const file=await captureBackup(connection.request.bind(connection),this.identity.text,(done,total)=>this.emit('backup','Reading the musical archive.',total?done/total:0));
      this.emit('backup','Archive captured. Save the downloaded file before installing.',1);
      return file;
    }catch(e){throw error('backup',`Backup failed: ${e.message}. No firmware was changed.`,{cause:e});}
    finally{connection.close();this.busy=false;this.locked=false;}
  }
  async disconnect(){if(this.busy)throw error('busy','Keep the connection open until the firmware operation finishes.');const ports=this.link?[this.link.input,this.link.output]:[];this.link?.close();this.link=null;this.identity=null;this.access?.removeEventListener?.('statechange',this.stateListener);await Promise.allSettled(ports.map(p=>p.close?.()));}
}
