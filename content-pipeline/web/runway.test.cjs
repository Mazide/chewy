const test = require('node:test');
const assert = require('node:assert/strict');
class Element {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.value=''; this.textContent=''; this.dataset={}; this.events={}; }
  addEventListener(name, fn) { this.events[name]=fn; }
  setAttribute(name, value) { this[name]=value; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children=items; }
  querySelectorAll(tag) { return this.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  pause() {}
}
function setup(apiHandler) {
  const elements=new Map();
  global.document={ getElementById(id) { if(!elements.has(id)) elements.set(id,new Element()); return elements.get(id); }, createElement(tag) { return new Element(tag); }, addEventListener() {} };
  global.window={location:{origin:'http://127.0.0.1:8766'}};
  global.crypto=require('node:crypto').webcrypto;
  require('./runway.js');
  const calls=[];
  const status={configured:true, source:'local', duration:5, models:[{id:'gen4.5',label:'Gen-4.5',estimatedCostUsd:.6}]};
  const panel=new ChewyRunway.RunwayPanel({ api: async (url,body) => { calls.push({url,body}); if(apiHandler) { const result=await apiHandler(url,body); if(result!==undefined) return result; } if(url==='/api/runway/status'||url==='/api/runway/key') return status; if(url.startsWith('/api/runway/generations?')) return {generations:[]}; throw new Error('unexpected route '+url); }, run: fn=>fn(), announce() {}, formatDate:value=>value });
  panel.status=status; panel.statusStarted=true; panel.packetId='p'; panel.context={animation:true,jobId:'j',packetId:'p',references:[{id:'r',title:'Ref'}],busy:false,promptChanged:false}; panel.generations.set('p',[]); panel.render();
  return {panel,calls,e:id=>elements.get('runway-'+id)};
}
test('missing key and unsaved prompt cannot submit',async()=>{const h=setup(); h.panel.status.configured=false; await h.panel.generate(); assert.equal(h.calls.length,0); h.panel.status.configured=true;h.panel.context.promptChanged=true;await h.panel.generate();assert.equal(h.calls.length,0);assert.match(h.panel.generationReason(),/Промпт изменён/);});
test('one double-click submits one billed request and pending blocks next',async()=>{let resolve;const h=setup((url,body)=>url==='/api/runway/generate'?new Promise(r=>resolve=r):undefined);const first=h.panel.generate();await h.panel.generate();assert.equal(h.calls.filter(c=>c.url==='/api/runway/generate').length,1);resolve({generation:{id:'g',packetId:'p',model:'gen4.5',status:'PENDING',createdAt:'today'}});await first;await h.panel.generate();assert.equal(h.calls.filter(c=>c.url==='/api/runway/generate').length,1);assert.match(h.panel.generationReason(),/активная генерация/);});
test('network uncertainty does not unlock from old completed history',async()=>{const old={id:'old',packetId:'p',model:'gen4.5',status:'SUCCEEDED',createdAt:'today'};const h=setup((url)=>{if(url==='/api/runway/generate')throw new Error('network failed');if(url.startsWith('/api/runway/generations?'))return {generations:[old]};});h.panel.generations.set('p',[old]);await h.panel.generate();assert.equal(h.panel.canGenerate(),false);assert.match(h.panel.generationReason(),/Ответ на запуск потерян/);await h.panel.generate();assert.equal(h.calls.filter(c=>c.url==='/api/runway/generate').length,1);});
test('UNKNOWN stays blocked and manual refresh never calls generate',async()=>{const g={id:'g',packetId:'p',model:'gen4.5',status:'UNKNOWN',createdAt:'today'};const h=setup(url=>url==='/api/runway/refresh'?{generation:g}:undefined);h.panel.generations.set('p',[g]);h.panel.render();assert.equal(h.panel.canGenerate(),false);await h.panel.refreshGeneration(g);assert.equal(h.calls.filter(c=>c.url==='/api/runway/generate').length,0);assert.equal(h.calls.filter(c=>c.url==='/api/runway/refresh').length,1);await h.panel.refreshGeneration(g);assert.equal(h.calls.filter(c=>c.url==='/api/runway/refresh').length,1);});
test('successful key save clears password input and makes no generation',async()=>{const h=setup();h.e('key').value='fake-test-key';await h.panel.saveKey();assert.equal(h.e('key').value,'');assert.equal(h.e('key-details').open,false);assert.equal(h.calls.filter(c=>c.url==='/api/runway/key').length,1);assert.equal(h.calls.filter(c=>c.url==='/api/runway/generate').length,0);assert.match(h.e('connection').textContent,/Ключ сохранён локально/);});
test('completed result only embeds same-origin video, with native controls',()=>{const h=setup();h.panel.generations.set('p',[{id:'g',packetId:'p',model:'gen4.5',status:'SUCCEEDED',createdAt:'today',videoUrl:'/media/g/source.mp4',downloadUrl:'/media/g/download.mp4'}]);h.panel.render();const video=h.e('generations').querySelectorAll('video')[0];assert.equal(video.controls,true);assert.equal(video.src,'/media/g/source.mp4');assert.equal(video.autoplay,undefined);h.panel.generations.set('p',[{id:'evil',packetId:'p',model:'gen4.5',status:'SUCCEEDED',createdAt:'today',videoUrl:'https://other.example/file.mp4'}]);h.panel.render();assert.equal(h.e('generations').querySelectorAll('video').length,0);});
test('reloaded backend UNKNOWN history prevents a new paid submission',async()=>{const g={id:'uncertain',packetId:'p',model:'gen4.5',status:'UNKNOWN',createdAt:'today'};const h=setup(url=>url.startsWith('/api/runway/generations?')?{generations:[g]}:undefined);assert.equal(h.panel.uncertainPackets.size,0);await h.panel.loadGenerations('p');assert.equal(h.panel.canGenerate(),false);assert.match(h.panel.generationReason(),/Результат отправки неизвестен/);await h.panel.generate();assert.equal(h.calls.filter(c=>c.url==='/api/runway/generate').length,0);});
