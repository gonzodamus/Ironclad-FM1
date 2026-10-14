import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../installer/js/app.js',import.meta.url),'utf8')).replace("import {FirmwareLoader,validatePackage} from './loader.js';",'');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup(validate=async bytes=>({product:'FM-1_990',sha256:'a'.repeat(64),byteLength:bytes.length})){
  const elements=new Map(),events={};let local=true;
  function element(id){if(elements.has(id))return elements.get(id);const el={id,value:'',checked:true,disabled:false,hidden:true,textContent:'',files:[],children:[],firstChild:{textContent:''},dataset:{},classList:{add(){},remove(){}},listeners:{},addEventListener(k,f){this.listeners[k]=f;},removeAttribute(){},append(child){this.children.push(child);},replaceChildren(){this.children=[];this.value='';},scrollIntoView(){}};elements.set(id,el);return el;}
  const radio={listeners:{},addEventListener(k,f){this.listeners[k]=f;}};
  const document={getElementById:element,documentElement:{dataset:{}},querySelector(q){if(q.includes('input[name=package]'))return {value:local?'file':'bundled'};return element(q);},querySelectorAll(q){return q==='input[name=package]'?[radio]:[];},createElement:()=>element('generated'+Math.random())};
  class FirmwareLoader{constructor({onStatus}){this.onStatus=onStatus;this.busy=false;this.link={input:{id:'in'},output:{id:'out'},lost:false};}listPorts(){return {inputs:[{id:'in',name:'FM-1'}],outputs:[{id:'out',name:'FM-1'}]};}}
  const initialFetch=deferred();
  const context=vm.createContext({document,FirmwareLoader,validatePackage:validate,navigator:{requestMIDIAccess(){}},window:{isSecureContext:true,addEventListener:(k,f)=>events[k]=f},fetch:()=>initialFetch.promise,console,Date,URL,Blob,Uint8Array,setTimeout:()=>0,Audio:class{},matchMedia:()=>({matches:true})});
  vm.runInContext(source+`\nglobalThis.harness={choosePackage,updatePorts,loader,get selected(){return selected;},get identity(){return identity;},set identity(v){identity=v;}};`,context);
  return {h:context.harness,element,setLocal:v=>local=v,events,initialFetch};
}
test('older file reads cannot overwrite a more recent file selection',async()=>{const {h,element}=setup();const old=deferred();element('firmware-file').files=[{name:'old.fwsc',size:1,arrayBuffer:()=>old.promise}];const pending=h.choosePackage();element('firmware-file').files=[{name:'new.fwsc',size:2,arrayBuffer:async()=>new Uint8Array([2,3]).buffer}];await h.choosePackage();old.resolve(new Uint8Array([1]).buffer);await pending;assert.deepEqual(Array.from(h.selected.bytes),[2,3]);assert.match(element('package-detail').textContent,/new\.fwsc/);});
test('unrelated MIDI state events preserve identified pair',()=>{const {h,element}=setup();element('midi-in').value='in';element('midi-out').value='out';h.identity={text:'FM-1_015',version:15};h.updatePorts(h.loader.listPorts());assert.equal(h.identity.text,'FM-1_015');});
test('missing selected MIDI pair clears identity',()=>{const {h,element}=setup();element('midi-in').value='in';element('midi-out').value='out';h.identity={text:'FM-1_015',version:15};h.updatePorts({inputs:[],outputs:[]});assert.equal(h.identity,null);});
test('beforeunload blocks navigation throughout updater busy state',()=>{const {h,events}=setup();h.loader.busy=true;let blocked=false;const event={preventDefault(){blocked=true;}};events.beforeunload(event);assert.equal(blocked,true);assert.ok(event.returnValue);});
test('Connect automatically verifies a single FM-1 and enables Install when prepared',async()=>{
 const {h,element,setLocal}=setup();element('firmware-file').files=[{name:'local.fwsc',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer}];await h.choosePackage();
 let queries=0;h.loader.connect=async()=>h.loader.listPorts();h.loader.selectPorts=async(i,o)=>{assert.equal(i,'in');assert.equal(o,'out');queries++;return {text:'FM-1_015',version:15,loader:false};};
 await element('connect').listeners.click();assert.equal(queries,1);assert.equal(h.identity.text,'FM-1_015');assert.equal(element('install').disabled,false);assert.match(element('install-reason').textContent,/Ready to install/);
});
test('auto-verification still requires the preparation acknowledgement',async()=>{
 const {h,element,setLocal}=setup();element('firmware-file').files=[{name:'local.fwsc',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer}];await h.choosePackage();element('prepared').checked=false;
 h.loader.connect=async()=>h.loader.listPorts();h.loader.selectPorts=async()=>({text:'FM-1_015',version:15});await element('connect').listeners.click();assert.equal(element('install').disabled,true);assert.match(element('install-reason').textContent,/preparation box/);
});
test('ambiguous FM-1 ports require selection and verify automatically after choosing both',async()=>{
 const {h,element,setLocal}=setup();element('firmware-file').files=[{name:'local.fwsc',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer}];await h.choosePackage();let queries=0;
 h.loader.connect=async()=>({inputs:[{id:'i1',name:'FM-1'},{id:'i2',name:'FM-1 2'}],outputs:[{id:'o1',name:'FM-1'},{id:'o2',name:'FM-1 2'}]});h.loader.selectPorts=async()=>{queries++;return {text:'FM-1_015',version:15};};
 await element('connect').listeners.click();assert.equal(queries,0);assert.equal(element('install').disabled,true);element('midi-in').value='i1';element('midi-out').value='o1';await element('midi-out').listeners.change();assert.equal(queries,1);assert.equal(element('install').disabled,false);
});
test('failed device verification leaves Install disabled and explains the missing step',async()=>{
 const {h,element}=setup();h.loader.connect=async()=>h.loader.listPorts();h.loader.selectPorts=async()=>{throw new Error('Identity query timed out.');};await element('connect').listeners.click();assert.equal(element('install').disabled,true);assert.match(element('status').textContent,/Identity query timed out/);assert.match(element('install-reason').textContent,/verify your FM-1/);
});
