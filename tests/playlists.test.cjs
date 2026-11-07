'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const source=fs.readFileSync('playlists.js','utf8');
const cloud=fs.readFileSync('cloud-sync.js','utf8');
const start=source.indexOf('  const norm=');
const end=source.indexOf('  const load=',start);
assert.ok(start>0&&end>start);
function cleaners(){
  return vm.runInNewContext(source.slice(start,end)+'\n;({cleanTrack,cleanPlaylists,identity})',
    {Array,String,Number});
}
test('playlist workspace and save buttons are present and accessible',()=>{
  for(const id of ['myPlaylistsNav','myPlaylistsCount','myPlaylistsWorkspace','myPlaylistsCreate','myPlaylistsCards','myPlaylistsDetail','myPlaylistsTracks','myPlaylistsPlay','myPlaylistsShuffle','myPlaylistsRename','myPlaylistsDelete','playlistDialog','playlistPickerDialog','playlistSaveCurrent','myPlaylistsNotice']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(html,/script src="playlists\.js" defer/);
  assert.match(fs.readFileSync('app.js','utf8'),/window\.ArtistWavePlaylists\?\.addTrack\(t\)/);
});
test('track sanitization preserves HTTPS music but removes local paths and blobs',()=>{
  const {cleanTrack,cleanPlaylists}=cleaners();
  const local=cleanTrack({title:'Local Song',artist:'Local Artist',id:'local:/Users/private/song.mp3',url:'blob:secret',source:'LOCAL'});
  assert.equal(local.url,'');
  assert.equal(local.id,'');
  const online=cleanTrack({title:'Song',artist:'Singer',source:'ARCHIVE',url:'https://archive.org/file.mp3',artwork:'javascript:bad'});
  assert.equal(online.url,'https://archive.org/file.mp3');
  assert.equal(Object.hasOwn(online,'artwork'),false);
  assert.equal(cleanTrack({title:'Bad',artist:'Singer',source:'ARCHIVE',url:'javascript:bad'}),null);
  const playlists=cleanPlaylists([{id:'a',name:'Music',tracks:[local,online]}]);
  assert.equal(playlists[0].tracks.length,2);
  assert.ok(!JSON.stringify(playlists).includes('blob:'));
});
test('Google Drive playlist payload excludes device files and preserves playlist order',()=>{
  const start=cloud.indexOf('  const cleanOnlineTrack=');
  const end=cloud.indexOf('  function accountKey()',start);
  assert.ok(start>0&&end>start);
  const code=cloud.slice(start,end)+'\n;({cleanPlaylists,payload})';
  const functions=vm.runInNewContext(code,{Array,String,Boolean,Number,Map,Object,Date,Set,
    cleanPrefs:value=>value,dedupeFavorites:value=>value,cleanRecent:value=>value,cleanRoutines:value=>value});
  const playlists=[{id:'road',name:'Road Trip',tracks:[
    {id:'local:private',title:'Local',artist:'Band',source:'LOCAL',url:'blob:private'},
    {id:'online1',title:'Online',artist:'Band',source:'ARCHIVE',url:'https://archive.org/example.mp3'}
  ]}];
  const cleaned=functions.cleanPlaylists(playlists);
  assert.equal(cleaned[0].tracks[0].url,'');
  assert.equal(cleaned[0].tracks[0].id,'');
  assert.equal(cleaned[0].tracks[1].url,'https://archive.org/example.mp3');
  const file=functions.payload([],{sourceMode:'both'},[],[],playlists);
  assert.equal(file.customPlaylists.length,1);
  assert.equal(file.customPlaylists[0].tracks.length,2);
  assert.ok(!JSON.stringify(file).includes('blob:'));
});
test('workspace is hidden outside entertainment playlist mode',()=>{
  const css=fs.readFileSync('styles.css','utf8');
  assert.match(css,/body\[data-library-view="playlists"\]\[data-mode="audio"\] \.search-section/);
  assert.match(css,/\.my-playlists-workspace\[hidden\]/);
  assert.match(source,/artistwave:cloud-load/);
});
