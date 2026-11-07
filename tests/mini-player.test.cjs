'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const page=fs.readFileSync('index.html','utf8');
const popup=fs.readFileSync('mini-player.html','utf8');
const hostScript=fs.readFileSync('mini-player-host.js','utf8');
const compactScript=fs.readFileSync('mini-player.js','utf8');
test('mini player has a real full-height pop-out entry and self-contained controls',()=>{
  assert.match(page,/id="openMiniPlayer"/);
  assert.match(page,/id="miniPlayerFallback"/);
  assert.match(page,/src="mini-player-host\.js" defer/);
  assert.match(popup,/src="mini-player\.js" defer/);
  assert.match(popup,/href="mini-player\.css"/);
  for(const id of ['miniClose','miniCover','miniCoverImage','miniTitle','miniArtist','miniPlay',
    'miniPrevious','miniNext','miniShuffle','miniRepeat','miniSeek','miniFavorite','miniSave',
    'miniVolume','miniQueueList','miniOpenMain','miniConnection']){
    assert.ok(popup.includes('id="'+id+'"'),id);
  }
  const workflow=fs.readFileSync('.github/workflows/pages.yml','utf8');
  for(const asset of ['mini-player.html','mini-player.css','mini-player-host.js','mini-player.js'])
    assert.ok(workflow.includes(asset),asset);
  assert.match(hostScript,/width=380/);
  assert.match(hostScript,/availHeight/);
  assert.match(hostScript,/window\.open\('mini-player\.html'/);
  assert.match(hostScript,/else showFallback\(\)/);
});
function makeHost(openPopup=null){
  const nodes=new Map(),calls=[],events=[];
  function node(id){
    if(nodes.has(id))return nodes.get(id);
    const handlers={};
    const n={id,textContent:'',title:'Repeat: off',value:'0',disabled:false,hidden:false,src:'',
      classList:{contains:()=>false},addEventListener:(ev,fn)=>{handlers[ev]=fn},
      click(){calls.push(id);if(handlers.click)handlers.click()},dispatchEvent(event){events.push([id,event.type]);if(handlers[event.type])handlers[event.type](event)},
      removeAttribute(name){if(name==='src')this.src=''}
    };
    if(id==='audio'){n.paused=false;n.currentTime=44;n.duration=200;n.volume=.6;n.src='https://example.test/song.mp3'}
    if(id==='playingSource')n.textContent='ARCHIVE';
    if(id==='favoriteCurrent')n.textContent='♥';
    nodes.set(id,n);return n;
  }
  const window={screen:{availWidth:1200,availHeight:900},innerHeight:900,open:(...args)=>{calls.push(['window.open',...args]);return openPopup},
    ArtistWaveLibrary:{getCurrent:()=>({title:'Test Song',artist:'Test Artist',artwork:'https://example.test/cover.jpg'}),getQueue:()=>[{index:0,title:'Test Song',artist:'Test Artist'}],getSelectedIndex:()=>0,playIndex:i=>calls.push(['playIndex',i])}};
  const document={getElementById:node,body:{classList:{add:x=>calls.push(['addClass',x]),remove:x=>calls.push(['removeClass',x])}}};
  vm.runInNewContext(hostScript,{window,document,Event:class{constructor(type){this.type=type}},Math,Number});
  return {window,node,calls,events};
}
test('mini player mirrors playback without creating a second audio element',()=>{
  const f=makeHost();
  const snapshot=f.window.ArtistWaveMiniHost.state();
  assert.equal(snapshot.title,'Test Song');
  assert.equal(snapshot.artist,'Test Artist');
  assert.equal(snapshot.playing,true);
  assert.equal(snapshot.volume,.6);
  assert.equal(snapshot.currentTime,44);
  assert.equal(snapshot.duration,200);
  assert.equal(snapshot.queue.length,1);
  assert.equal(snapshot.selected,0);
  f.window.ArtistWaveMiniHost.command('next');
  f.window.ArtistWaveMiniHost.command('previous');
  f.window.ArtistWaveMiniHost.command('play');
  f.window.ArtistWaveMiniHost.command('favorite');
  f.window.ArtistWaveMiniHost.command('track',0);
  f.window.ArtistWaveMiniHost.command('seek',.5);
  f.window.ArtistWaveMiniHost.command('volume',40);
  assert.ok(f.calls.includes('nextButton'));
  assert.ok(f.calls.includes('previousButton'));
  assert.ok(f.calls.includes('playButton'));
  assert.ok(f.calls.includes('favoriteCurrent'));
  assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='playIndex'&&x[1]===0));
  assert.equal(f.node('seekBar').value,'500');
  assert.equal(f.node('volumeBar').value,'40');
  assert.ok(f.events.some(([id,event])=>id==='seekBar'&&event==='input'));
  assert.ok(f.events.some(([id,event])=>id==='volumeBar'&&event==='input'));
  assert.ok(!hostScript.includes('document.createElement(\'audio\')'));
});
test('popup-blocked browsers get an accessible full-height in-page mini player',()=>{
  const f=makeHost(null);
  f.node('openMiniPlayer').click();
  assert.equal(f.node('miniPlayerFallback').hidden,false);
  assert.equal(f.node('miniPlayerFallbackFrame').src,'mini-player.html?embedded=1');
  assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='window.open'&&x[3].includes('width=380')));
  f.window.ArtistWaveMiniHost.closeFallback();
  assert.equal(f.node('miniPlayerFallback').hidden,true);
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(css,/\.mini-player-fallback\{position:fixed;inset:0/);
});
test('mini script uses existing main window engine through opener or embedded parent',()=>{
  assert.match(compactScript,/window\.opener/);
  assert.match(compactScript,/window\.parent/);
  assert.match(compactScript,/target\.command\(action,value\)/);
  assert.match(compactScript,/setInterval\(refresh,500\)/);
  assert.ok(!compactScript.includes('new Audio('));
});
