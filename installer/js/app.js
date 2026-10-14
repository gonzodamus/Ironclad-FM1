// SPDX-License-Identifier: GPL-3.0-only
import {FirmwareLoader,validatePackage} from './loader.js';
const $=id=>document.getElementById(id);
let selected=null,identity=null,operation=false,packageEpoch=0;
const log=message=>{const time=new Date().toLocaleTimeString();$('log').textContent+=`[${time}] ${message}\n`;$('log').scrollTop=$('log').scrollHeight;};
const status=message=>{$('status').textContent=message;log(message);};
const isLocal=()=>true;
const loader=new FirmwareLoader({onStatus:event=>{
  $('stage').textContent=event.stage.toUpperCase();
  if(event.progress==null){$('progress').removeAttribute('value');$('percent').textContent='—';}
  else{$('progress').value=event.progress;$('percent').textContent=`${Math.round(event.progress*100)}%`;}
  status(event.message);
  document.documentElement.dataset.busy=String(loader.busy);
}});
function lockUI(){
  const busy=operation||loader.busy;
  $('connect').disabled=busy||!navigator.requestMIDIAccess;
  $('identify').disabled=busy;
  $('midi-in').disabled=busy;$('midi-out').disabled=busy;
  document.querySelectorAll('input[name=package]').forEach(el=>el.disabled=busy);
  $('firmware-file').disabled=busy||!isLocal();$('prepared').disabled=busy;
  const missing=[];
  if(!identity)missing.push('connect and verify your FM-1');
  if(!selected)missing.push('choose a valid firmware package');
  if(!$('prepared').checked)missing.push('check the preparation box');
  $('install').disabled=busy||missing.length>0;
  $('install-reason').textContent=busy?'Complete the current connection or transfer first.':missing.length?'To enable Install: '+missing.join('; ')+'.':'Ready to install. Your FM-1 and firmware have both been verified.';
  $('install').firstChild.textContent=busy?'WORKING… ':isLocal()?'INSTALL SELECTED FILE ':'INSTALL IRONCLAD ';
  $('backup').disabled=busy||!identity||identity.loader||identity.version<900;
  document.documentElement.dataset.busy=String(busy);
}
function error(e){status(`${e.message}${e.writingStarted?' Keep this file. If the synth remains in update mode, reconnect and retry the same package.':''}`);$('stage').textContent=e.transferComplete?'TRANSFERRED / UNVERIFIED':'ATTENTION';identity=null;$('identity').textContent='RECONNECT & IDENTIFY TO CONTINUE';$('identity').classList.remove('connected');}
function updatePorts(ports){
  const previousInput=$('midi-in').value,previousOutput=$('midi-out').value;
  for(const [key,list] of [['midi-in',ports.inputs],['midi-out',ports.outputs]]){
    const select=$(key),old=select.value;select.replaceChildren();
    const prompt=document.createElement('option');prompt.value='';prompt.textContent='Select the FM-1 port';select.append(prompt);
    for(const port of list){const option=document.createElement('option');option.value=port.id;option.textContent=port.name||'Unnamed MIDI port';select.append(option);}
    if(list.some(p=>p.id===old))select.value=old;
    else {const candidates=list.filter(p=>/fm[- ]?1|ironclad|felucca|ota/i.test(p.name));if(candidates.length===1)select.value=candidates[0].id;}
  }
  const pairChanged=previousInput!==$('midi-in').value||previousOutput!==$('midi-out').value;
  const pairLost=loader.link?.lost;
  if(identity&&!loader.busy&&(pairChanged||pairLost)){identity=null;$('identity').textContent='PORTS CHANGED / IDENTIFY AGAIN';$('identity').classList.remove('connected');}
  lockUI();
}
loader.onPortsChanged=updatePorts;
async function identifySelected(){
  identity=null;$('identity').textContent='CHECKING DEVICE…';$('identity').classList.remove('connected');
  identity=await loader.selectPorts($('midi-in').value,$('midi-out').value);
  $('identity').textContent=identity.text+(identity.loader?' / UPDATE MODE':' / CONNECTED');$('identity').classList.add('connected');
  status(identity.version===15?'Stock V15 verified. Device connection is ready.':identity.loader?'Update mode verified. Reuse the same package to finish an interrupted update.':'Device verified. Export your musical archive before installing.');
}
$('connect').addEventListener('click',async()=>{
  if(operation||loader.busy)return;
  identity=null;operation=true;lockUI();status('Allow MIDI SysEx access in the browser prompt. Open directly in desktop Chrome or Edge if the in-app browser does not show it.');
  try{
    const ports=await loader.connect();updatePorts(ports);$('ports').hidden=false;
    if($('midi-in').value&&$('midi-out').value)await identifySelected();
    else status(ports.inputs.length&&ports.outputs.length?'Choose the FM-1 input and output below. The selected device will be verified automatically.':'No MIDI pair is available. Connect the FM-1 with a USB data cable, then click Connect again.');
  }catch(e){error(e);}finally{operation=false;lockUI();}
});
async function verifySelectedPorts(){
  if(operation||loader.busy)return;
  if(!$('midi-in').value||!$('midi-out').value){status('Select both the MIDI input and output.');return;}
  operation=true;lockUI();
  try{await identifySelected();}catch(e){error(e);}finally{operation=false;lockUI();}
}
$('identify').addEventListener('click',verifySelectedPorts);
for(const id of ['midi-in','midi-out'])$(id).addEventListener('change',()=>{identity=null;$('identity').textContent='SELECT BOTH FM-1 PORTS';$('identity').classList.remove('connected');lockUI();return verifySelectedPorts();});
async function choosePackage(){
  const epoch=++packageEpoch,local=isLocal();
  const current=()=>epoch===packageEpoch&&local===isLocal();
  selected=null;lockUI();
  try{
    if(local){
      const file=$('firmware-file').files[0];
      if(!file){$('package-detail').textContent='Choose a .fwsc package. Files are validated locally.';return;}
      if(!/\.fwsc$/i.test(file.name))throw new Error('Select an FM-1 .fwsc package.');
      if(file.size>8*1024*1024)throw new Error('Firmware file exceeds the supported size.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(!current())return;
      const pkg=await validatePackage(bytes);
      if(!current())return;
      selected={bytes,pkg,options:{expectedSha256:pkg.sha256,expectedProduct:pkg.product}};
      $('package-detail').textContent=`${file.name} · ${pkg.product} · ${pkg.byteLength.toLocaleString()} bytes · CRCs and SHA-256 checked`;

    }
  }catch(e){if(current()){$('package-detail').textContent=e.message;log(e.message);}}finally{lockUI();}
}
document.querySelectorAll('input[name=package]').forEach(el=>el.addEventListener('change',()=>{choosePackage();}));
$('firmware-file').addEventListener('change',choosePackage);$('prepared').addEventListener('change',lockUI);
$('install').addEventListener('click',async()=>{
  if(operation||loader.busy||!selected||!identity||!$('prepared').checked)return;
  operation=true;lockUI();const artifact=selected;
  try{const result=await loader.flash(artifact.bytes,artifact.options);updatePorts(loader.listPorts());if(loader.link){$('midi-in').value=loader.link.input.id;$('midi-out').value=loader.link.output.id;}identity=result.identity;$('identity').textContent=`${identity.text} / VERIFIED`;$('identity').classList.add('connected');status(`${result.product} verified after reboot. Installation complete.`);}
  catch(e){error(e);}finally{operation=false;lockUI();}
});
function downloadObject(object,name){const url=URL.createObjectURL(new Blob([JSON.stringify(object,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('backup').addEventListener('click',async()=>{if(operation||loader.busy||!identity||identity.loader||identity.version<900)return;operation=true;lockUI();try{const archive=await loader.backup();downloadObject(archive,`fm1-musical-backup-${new Date().toISOString().slice(0,10)}.json`);status('Musical archive downloaded. Check that the file is saved before installing. This is a data backup, not a firmware image.');}catch(e){status(e.message);}finally{operation=false;lockUI();}});
window.addEventListener('beforeunload',e=>{if(loader.busy){e.preventDefault();e.returnValue='Firmware operation in progress.';}});
if(!navigator.requestMIDIAccess)$('browser-support').textContent='This browser cannot use MIDI SysEx. Open this page in Chrome or Edge on HTTPS or localhost.';
if(!window.isSecureContext)$('browser-support').textContent='Open the loader on HTTPS or localhost to allow MIDI SysEx.';
lockUI();
