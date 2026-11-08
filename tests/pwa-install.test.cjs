'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const html=fs.readFileSync('index.html','utf8');
const mini=fs.readFileSync('mini-player.html','utf8');
const installer=fs.readFileSync('install.js','utf8');
const worker=fs.readFileSync('sw.js','utf8');
test('manifest defines installed ArtistWave app scoped to GitHub Pages subpath',()=>{
  assert.equal(manifest.id,'/ArtistWave/');
  assert.equal(manifest.start_url,'/ArtistWave/');
  assert.equal(manifest.scope,'/ArtistWave/');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.prefer_related_applications,false);
  const miniShortcut=manifest.shortcuts.find(x=>x.name==='Mini Player');
  assert.equal(miniShortcut.url,'/ArtistWave/?mini=1');
  for(const filename of ['icon-192.png','icon-512.png']){
    const entry=manifest.icons.find(x=>x.src===filename);
    assert.ok(entry,filename);
    assert.equal(entry.type,'image/png');
    const raw=fs.readFileSync(filename);
    assert.equal(raw.toString('hex',0,8),'89504e470d0a1a0a');
    const dimension=Number(filename.match(/\d+/)[0]);
    assert.equal(raw.readUInt32BE(16),dimension);
    assert.equal(raw.readUInt32BE(20),dimension);
  }
});
test('website and standalone mini player advertise the install manifest',()=>{
  for(const value of [html,mini])assert.match(value,/rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html,/id="installAppButton"/);
  assert.match(html,/id="installAppStatus"/);
  assert.match(html,/src="install\.js" defer/);
});
test('installer saves native prompt for a user action and uses browser fallback',()=>{
  assert.match(installer,/beforeinstallprompt/);
  assert.match(installer,/event\.preventDefault\(\)/);
  assert.match(installer,/await prompt\.prompt\(\)/);
  assert.match(installer,/appinstalled/);
  assert.match(installer,/navigator\.serviceWorker\.register\('\.\/sw\.js',\{scope:'\.\/'\}\)/);
  assert.match(installer,/Install this site as an app/);
  const listeners={};
  const button={textContent:'',disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){listeners[k]=fn}};
  const message={hidden:true,textContent:''};
  const win={matchMedia:()=>({matches:false}),isSecureContext:false,addEventListener(k,fn){listeners[k]=fn}};
  const doc={getElementById:id=>id==='installAppButton'?button:message};
  vm.runInNewContext(installer,{window:win,document:doc,navigator:{}});
  assert.equal(button.textContent,'⬇ Install');
  assert.equal(button.disabled,false);
  return listeners.click().then(()=>{
    assert.equal(message.hidden,false);
    assert.match(message.textContent,/Chrome or Edge menu/);
  });
});
test('service worker caches only same-origin app shell, not streams or cloud APIs',()=>{
  assert.match(worker,/artistwave-shell-v1/);
  assert.match(worker,/url\.origin!==SCOPE\.origin/);
  assert.match(worker,/paths\.has\(url\.pathname\)/);
  assert.match(worker,/request\.method!=='GET'/);
  assert.match(worker,/fetch\(request\)/);
  assert.match(worker,/ignoreSearch:true/);
  assert.doesNotMatch(worker,/archive\.org|googleapis\.com|audius\.co|jamendo\.com/);
  const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
  for(const asset of ['sw.js','install.js','manifest.webmanifest','icon-192.png','icon-512.png']){
    assert.ok(workflow.includes(asset),asset);
  }
});
