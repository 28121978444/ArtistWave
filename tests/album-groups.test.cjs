'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('function albumLabel(');
const end=app.indexOf('function render(){',start);
assert.ok(start>=0&&end>start,'album helpers exist');
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function setup(){
  const S={tracks:[],selected:-1,albumQueue:[],shuffle:true,repeat:0};
  const audio={src:'',paused:true,play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true}};
  const controls={shuffleButton:{classList:{remove(){}}}};
  let renderCount=0;
  const box={S,norm,audio,render(){renderCount++},updatePlayer(){},show(){},$:(id)=>controls[id],trackKey:t=>norm(t.artist)+'|'+norm(t.title),current:()=>S.tracks[S.selected],Map,Number};
  const code=app.slice(start,end)+'\n'+app.slice(app.indexOf('function playAt('),app.indexOf('const getJSON=',app.indexOf('function playAt(')))+
    '\n;({albumLabel,groupTracksByAlbum,playAlbum,nextAlbumTrack,clearAlbumQueue,playAt,next})';
  return {S,audio,functions:vm.runInNewContext(code,box),get renderCount(){return renderCount}};
}
const make=(title,collection,artist='Artist')=>({title,collection,artist,url:'https://example.org/'+title+'.mp3',id:title});
test('groups discontiguous tracks by album, preserving order and indices',()=>{
  const {functions:f}=setup();
  const groups=f.groupTracksByAlbum([make('A','One'),make('B','Two'),make('C','One')]);
  assert.equal(groups.length,2);
  assert.equal(groups[0].label,'One');
  assert.deepEqual(Array.from(groups[0].items,x=>x.index),[0,2]);
  assert.equal(groups[1].label,'Two');
});
test('unknown albums and singles share a distinct fallback heading',()=>{
  const {functions:f}=setup();
  const groups=f.groupTracksByAlbum([make('A','Audius release'),make('B',''),make('C','Jamendo single')]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].label,'Singles & unknown albums');
});
test('play album restricts next to that album then stops',()=>{
  const {S,audio,functions:f}=setup();
  S.tracks=[make('A','One'),make('B','Two'),make('C','One'),make('D','Two')];
  f.playAlbum([0,2]);
  assert.equal(S.selected,0);assert.equal(S.shuffle,false);
  assert.equal(audio.paused,false);
  assert.equal(f.next(1),true);
  assert.equal(S.selected,2);
  assert.equal(f.next(1),false);
  assert.equal(S.selected,2);
});
test('repeat all loops within the selected album',()=>{
  const {S,functions:f}=setup();
  S.tracks=[make('A','One'),make('B','Two'),make('C','One')];
  S.repeat=1;f.playAlbum([0,2]);f.next(1);f.next(1);
  assert.equal(S.selected,0);
});
test('manual track selection exits album-only mode',()=>{
  const {S,functions:f}=setup();
  S.tracks=[make('A','One'),make('B','Two'),make('C','One')];
  f.playAlbum([0,2]);f.playAt(1);
  assert.equal(S.albumQueue.length,0);
  assert.equal(S.selected,1);
});
