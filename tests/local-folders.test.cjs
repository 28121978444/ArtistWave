'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const dedupeStart=app.indexOf('function cleanTrackTitle(');
const dedupeEnd=app.indexOf('const current=()',dedupeStart);
const folderStart=app.indexOf('const MUSIC_EXT=');
const folderEnd=app.indexOf('function updatePlayer()',folderStart);
assert.ok(dedupeStart>=0&&dedupeEnd>dedupeStart,'dedupe helpers found');
assert.ok(folderStart>=0&&folderEnd>folderStart,'local folder helpers found');

function setup(mode='both'){
  const S={artist:'Nita Strauss',tracks:[],selected:-1,local:[],onlineTracks:[],localFiles:new Set(),importingFolder:false};
  const folderSummary={textContent:''};
  let selectedMode=mode;
  const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const box={S,norm,Map,Set,Uint8Array,TextDecoder,URL:{createObjectURL:()=> 'blob:mock'},audio:{pause(){},removeAttribute(){}},render(){},updatePlayer(){},show(){},window:{},$:(id)=>id==='sourceMode'?{value:selectedMode}:id==='providerArchive'?{checked:true}:id==='providerAudius'||id==='providerJamendo'?{checked:false}:folderSummary};
  const f=vm.runInNewContext(app.slice(dedupeStart,dedupeEnd)+'\n'+app.slice(folderStart,folderEnd)+'\n;({parseLocalFilename,localMatchesArtist,rebuildPlaylist,importLocalFiles,readLocalTags})',box);
  return {S,f,folderSummary,setMode(value){selectedMode=value}};
}
const track=(id,title,artist,source,url)=>({id,title,artist,source,url,collection:'Album'});

test('folder path / Artist / Album / song.mp3 resolves performer and title',()=>{
  const {f}=setup();
  const meta=f.parseLocalFilename({name:'01 - Summer Storm.mp3'},'Music/Nita Strauss/Controlled Chaos/01 - Summer Storm.mp3');
  assert.equal(meta.artist,'Nita Strauss');
  assert.equal(meta.title,'Summer Storm');
  assert.equal(meta.collection,'Controlled Chaos');
});
test('Artist - Track filename works without folders',()=>{
  const {f}=setup();
  const meta=f.parseLocalFilename({name:'Nita Strauss - The Wolf You Feed.m4a'},'');
  assert.equal(meta.artist,'Nita Strauss');
  assert.equal(meta.title,'The Wolf You Feed');
});
test('partial artist search matches local Nita Strauss but not unrelated musicians',()=>{
  const {f}=setup();
  assert.equal(f.localMatchesArtist({artist:'Nita Strauss'},'Nita'),true);
  assert.equal(f.localMatchesArtist({artist:'The Rolling Stones'},'Nita'),false);
});
test('mode controls playlist while local files win duplicate tracks',()=>{
  const {S,f,setMode}=setup('both');
  S.onlineTracks=[track('online','Summer Storm','Nita Strauss','ARCHIVE','https://archive.org/summer.mp3'),track('online2','The Wolf You Feed','Nita Strauss','ARCHIVE','https://archive.org/wolf.mp3')];
  S.local=[track('local','Summer Storm','Nita Strauss','LOCAL','blob:local')];
  f.rebuildPlaylist();
  assert.equal(S.tracks.length,2);
  assert.equal(S.tracks.find(t=>t.title==='Summer Storm').source,'LOCAL');
  setMode('local');f.rebuildPlaylist();
  assert.equal(S.tracks.length,1);assert.equal(S.tracks[0].source,'LOCAL');
  setMode('online');f.rebuildPlaylist();
  assert.equal(S.tracks.length,2);
  assert.ok(S.tracks.every(t=>t.source==='ARCHIVE'));
});
test('folder importer accepts async recursive iterables and deduplicates repeated selection',async()=>{
  const {S,f,folderSummary,setMode}=setup('local');
  setMode('local');
  const first={name:'Nita Strauss - Summer Storm.m4a',size:150,lastModified:123};
  const second={name:'Nita Strauss - The Wolf You Feed.m4a',size:150,lastModified:124};
  async function* entries(){yield {file:first,path:'Folder/Nita Strauss/01.m4a'};yield {file:second,path:'Folder/Nita Strauss/02.m4a'};}
  await f.importLocalFiles(entries(),{folder:true});
  assert.equal(S.local.length,2);
  assert.equal(S.tracks.length,2);
  assert.match(folderSummary.textContent,/2 local tracks/);
  await f.importLocalFiles(entries(),{folder:true});
  assert.equal(S.local.length,2);
});
