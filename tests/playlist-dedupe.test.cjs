'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function cleanTrackTitle(');
const end=app.indexOf('const current=()',start);
assert.ok(start>=0 && end>start,'Song deduplication helpers are present');
const S={artist:'Nita Strauss',tracks:[],selected:-1};
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const functions=vm.runInNewContext(app.slice(start,end)+';({cleanTrackTitle,trackKey,trackPriority,dedupeTracks,mergePlaylistTracks})',{S,norm,Map});
const {dedupeTracks,mergePlaylistTracks,trackKey}=functions;
const item=(id,title,source,url,artist='Nita Strauss',collection='Album')=>({id,title,source,url,artist,collection});

test('one playable audio link wins over duplicate song title without audio',()=>{
  const rows=dedupeTracks([item('cat','The Wolf You Feed','CATALOG'),item('audio','The Wolf You Feed','ARCHIVE','https://example.org/wolf.mp3')]);
  assert.equal(rows.length,1);assert.equal(rows[0].id,'audio');
});
test('higher priority local audio replaces an archive copy',()=>{
  const rows=dedupeTracks([item('remote','The Wolf You Feed','ARCHIVE','https://example.org/wolf.mp3'),item('local','The Wolf You Feed','LOCAL','blob:local/file')]);
  assert.equal(rows.length,1);assert.equal(rows[0].id,'local');
});
test('duplicate archive copies with different file formats collapse',()=>{
  const rows=dedupeTracks([item('mp3','01 - The Wolf You Feed (MP3)','ARCHIVE','https://archive.org/download/id/01.mp3'),item('flac','The Wolf You Feed','ARCHIVE','https://archive.org/download/id/01.flac')]);
  assert.equal(rows.length,1);assert.equal(rows[0].id,'flac');
});
test('live and remix versions are distinct songs',()=>{
  const rows=dedupeTracks([item('studio','The Wolf You Feed','ARCHIVE','https://example.org/1.mp3'),item('live','The Wolf You Feed (Live)','ARCHIVE','https://example.org/2.mp3'),item('mix','The Wolf You Feed (Remix)','ARCHIVE','https://example.org/3.mp3')]);
  assert.equal(rows.length,3);
});
test('same title from different artists remains distinct',()=>{
  const rows=dedupeTracks([item('a','Fire','ARCHIVE','https://example.org/a.mp3','Artist One'),item('b','Fire','ARCHIVE','https://example.org/b.mp3','Artist Two')]);
  assert.equal(rows.length,2);
});
test('merging new pages replaces duplicates but preserves selection',()=>{
  S.tracks=[item('first','The Wolf You Feed','ARCHIVE','https://example.org/a.mp3'),item('other','Summer Storm','ARCHIVE','https://example.org/b.mp3')];
  S.selected=1;
  mergePlaylistTracks([item('better','The Wolf You Feed','LOCAL','blob:better'),item('new','Dead Inside','ARCHIVE','https://example.org/c.mp3')]);
  assert.equal(S.tracks.length,3);
  assert.equal(S.tracks[S.selected].id,'other');
  assert.equal(S.tracks.find(t=>t.title==='The Wolf You Feed').id,'better');
});
test('catalog and audio keys match even with filename decorations',()=>{
  const catalog=item('cat','The Wolf You Feed','CATALOG');
  const playable=item('aud','01 - Nita Strauss - The Wolf You Feed (MP3)','ARCHIVE','https://example.org/1.mp3');
  assert.equal(trackKey(catalog),trackKey(playable));
});
