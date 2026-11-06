'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');

const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function libraryHelpers(){
  const a=app.indexOf('function dedupeRecent('),b=app.indexOf('function extractYear(',a);
  const c=app.indexOf('function albumArtwork('),d=app.indexOf('const MUSIC_EXT=',c);
  assert.ok(a>0&&b>a&&c>0&&d>c);
  const context={
    trackKey:t=>norm(t.artist)+'|'+norm(t.title),S:{recent:[],view:'discover'},window:{ArtistWaveCloud:{}},
    $:()=>({textContent:''}),Map,Set
  };
  return vm.runInNewContext(app.slice(a,b)+app.slice(c,d)+'\n;({dedupeRecent,safeRecentTracks,albumArtwork,rememberPlayedTrack})',context);
}
test('recent listening history dedupes by artist and title and caps at 30',()=>{
  const f=libraryHelpers();
  const rows=Array.from({length:35},(_,n)=>({id:String(n),artist:'Artist',title:'Song '+n,source:'ARCHIVE',url:'https://archive.org/'+n+'.mp3'}));
  rows.unshift({id:'copy',artist:'Artist',title:'Song 1',source:'AUDIUS',url:'https://api.audius.co/1'});
  const recent=f.dedupeRecent(rows);
  assert.equal(recent.length,30);
  assert.equal(recent[0].id,'copy');
  assert.equal(recent.filter(x=>x.title==='Song 1').length,1);
});
test('persistent history never includes device-local files',()=>{
  const f=libraryHelpers();
  const data=[
    {id:'local:one',title:'File',artist:'Artist',source:'LOCAL',url:'blob:one'},
    {id:'online',title:'File Two',artist:'Artist',source:'ARCHIVE',url:'https://archive.org/a.mp3'}
  ];
  const persisted=f.safeRecentTracks(data);
  assert.equal(persisted.length,1);
  assert.equal(persisted[0].id,'online');
});
test('album image normalizer accepts provider HTTPS artwork and rejects unsafe URLs',()=>{
  const f=libraryHelpers();
  assert.equal(f.albumArtwork({'480x480':'https://example.org/cover.jpg'}),'https://example.org/cover.jpg');
  assert.equal(f.albumArtwork('javascript:alert(1)'),'');
  assert.equal(f.albumArtwork(null),'');
});
test('HTML contains keyboard accessible album jump and recent nav',()=>{
  const html=fs.readFileSync('index.html','utf8');
  for(const id of ['recentNav','recentCount','albumJumpSelect','reopenFolderNav','forgetFolderNav'])
    assert.match(html,new RegExp('id="'+id+'"'));
});
