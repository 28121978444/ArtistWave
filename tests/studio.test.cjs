'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const studio=fs.readFileSync('studio.js','utf8');
const cloud=fs.readFileSync('cloud-sync.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const source=studio.slice(studio.indexOf('  const makeId='),studio.indexOf('  const state='));
assert.ok(source.includes('const cleanRoutines='));
const api=vm.runInNewContext(source+'\n({cleanRoutines,safeTrack,cleanSegment})',{Math,Number,String,Array});
const sample=(source='ARCHIVE')=>({
  id:'routine-one',name:'Junior floor final',athlete:'Junior A',discipline:'Artistic gymnastics',target:90,
  segments:[{id:'section1',track:{
    id:source==='LOCAL'?'local:/Users/private/Music/song.mp3':'archive/song',
    title:'Opening',artist:'Artist',source,url:source==='LOCAL'?'blob:private':'https://archive.org/opening.mp3'
  },start:4,end:36,cue:'Entry and first tumbling pass'}]
});
test('gym routine model keeps discipline, athlete, target and cues',()=>{
  const rows=api.cleanRoutines([sample()]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].target,90);
  assert.equal(rows[0].athlete,'Junior A');
  assert.equal(rows[0].segments[0].cue,'Entry and first tumbling pass');
  assert.equal(rows[0].segments[0].end-rows[0].segments[0].start,32);
});
test('studio protects local file paths and blob sources when saving routine',()=>{
  const rows=api.cleanRoutines([sample('LOCAL')]);
  const str=JSON.stringify(rows);
  assert.equal(rows[0].segments[0].track.url,'');
  assert.equal(rows[0].segments[0].track.id,'');
  assert.doesNotMatch(str,/Users\/private|blob:private/);
});
test('invalid section times and gym routine counts are bounded',()=>{
  const r=sample();r.target=9000;r.segments=Array.from({length:50},(_,i)=>({
    id:'cue'+i,track:sample().segments[0].track,start:-10,end:0,cue:'cue'
  }));
  const item=api.cleanRoutines([r])[0];
  assert.equal(item.target,900);
  assert.equal(item.segments.length,30);
  assert.equal(item.segments[0].start,0);
  assert.equal(item.segments[0].end,30);
});
test('the Google cloud sanitizer excludes local paths and audio blobs too',()=>{
  const start=cloud.indexOf('  const cleanRoutines=');
  const end=cloud.indexOf('  const payload=',start);
  assert.ok(start>0&&end>start);
  const cloudClean=vm.runInNewContext(cloud.slice(start,end)+'\ncleanRoutines',{Array,Number,String,Math});
  const data=cloudClean([sample('LOCAL')]);
  assert.equal(data[0].segments[0].track.id,'');
  assert.equal(data[0].segments[0].track.url,'');
});
test('studio has its own accessible workspace and shared account header',()=>{
  for(const id of ['studioNav','studioWorkspace','studioRoutineSelect','studioAddTrack','studioPlay','studioStop','studioAudio','studioSegments'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.ok(html.indexOf('id="genreTree"')>html.indexOf('<aside class="sidebar">'));
  assert.ok(html.indexOf('class="cloud-account"')<html.indexOf('</header>'));
  assert.ok(html.indexOf('</header>')<html.indexOf('<aside class="sidebar">'));
  assert.ok(html.indexOf('</aside>')<html.indexOf('<main class="main">'));
  assert.ok(html.indexOf('<header class="topbar">')<html.indexOf('<main class="main">'));
  assert.match(html,/script src="studio\.js" defer/);
  assert.ok(html.indexOf('class="topbar-account-menu"')>html.indexOf('<header class="topbar"'));
  assert.ok(html.indexOf('class="topbar-account-menu"')<html.indexOf('</header>'));
  assert.equal((html.match(/id="cloudSignIn"/g)||[]).length,1);
  assert.ok(html.indexOf('id="genreTree"')<html.indexOf('<main class="main">'));
  assert.ok(html.indexOf('<header class="topbar">')<html.indexOf('<aside class="sidebar">'));

});

test('Showdance navigation is in top-level modes, with genre-first sidebar',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.equal((html.match(/id="studioNav"/g)||[]).length,1);
  assert.ok(html.indexOf('id="studioNav"')>html.indexOf('<nav class="mode-tabs"'));
  assert.ok(html.indexOf('id="studioNav"')<html.indexOf('</nav>',html.indexOf('<nav class="mode-tabs"')));
  const sidebar=html.slice(html.indexOf('<aside class="sidebar">'),html.indexOf('</aside>'));
  assert.ok(sidebar.includes('id="genreTree"'));
  assert.ok(sidebar.includes('class="sidebar-local-tools"'));
  assert.ok(!sidebar.includes('id="studioNav"'));
});
