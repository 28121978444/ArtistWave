'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const start=app.indexOf('function addToSmartQueue(');
const end=app.indexOf('function playAt(',start);
assert.ok(start>0&&end>start);
const make=(title,collection='Album')=>({id:title,title,artist:'Band',collection,source:'ARCHIVE',url:'https://example.test/'+title+'.mp3'});
function setup(){
  const nodes=new Map(),played=[];
  function element(){
    return {className:'',textContent:'',children:[],disabled:false,hidden:false,
      classList:{toggle(){}},setAttribute(){},append(...items){this.children.push(...items)},
      replaceChildren(){this.children=[]}};
  }
  const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
  const S={tracks:[make('one'),make('two'),make('three')],selected:0,
    smartQueue:[],smartOrigin:null,smartOnDeck:false,albumQueue:[],repeat:0};
  const current=()=>S.tracks[S.selected]||null;
  const trackKey=t=>t.artist+'|'+t.title;
  const playAt=(index,opts={})=>{played.push({index,opts});S.selected=index};
  const sandbox={S,$,document:{createElement:element},trackKey,current,playAt,Number,Math};
  const functions=vm.runInNewContext(app.slice(start,end)+
    '\n;({addToSmartQueue,moveSmartQueue,playQueuedAt,resumeSmartQueue,renderSmartQueue})',sandbox);
  return {S,functions,played,nodes,$};
}
test('queue UI is present and tracks have Play Next and Add to Queue actions',()=>{
  for(const id of ['smartQueueToggle','smartQueuePanel','smartQueueClear','smartQueueClose','smartQueueList','smartQueueCount'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(app,/nextSong\.onclick=\(\)=>addToSmartQueue\(t,true\)/);
  assert.match(app,/addQueue\.onclick=\(\)=>addToSmartQueue\(t,false\)/);
});
test('Play Next puts songs ahead of ordinary additions without mutating saved objects',()=>{
  const {S,functions:f}=setup();
  const a=make('later'),b=make('soon');
  assert.equal(f.addToSmartQueue(a,false),true);
  assert.equal(f.addToSmartQueue(b,true),true);
  assert.deepEqual(Array.from(S.smartQueue,t=>t.title),['soon','later']);
  assert.notEqual(S.smartQueue[0],b);
  assert.equal(S.tracks.length,3);
});
test('move, play and remove queue items preserve playback position',()=>{
  const {S,functions:f,played}=setup();
  f.addToSmartQueue(make('first'));
  f.addToSmartQueue(make('second'));
  assert.equal(f.moveSmartQueue(1,-1),true);
  assert.deepEqual(Array.from(S.smartQueue,t=>t.title),['second','first']);
  assert.equal(f.playQueuedAt(0),true);
  assert.equal(S.smartOnDeck,true);
  assert.equal(S.smartOrigin.track.title,'one');
  assert.equal(S.smartQueue.length,1);
  assert.equal(S.tracks[S.selected].title,'second');
  assert.equal(f.playQueuedAt(0),true);
  assert.equal(S.smartQueue.length,0);
  assert.equal(f.resumeSmartQueue(),true);
  assert.equal(S.tracks[S.selected].title,'two');
  assert.equal(S.smartOnDeck,false);
  assert.equal(played[played.length-1].opts.queued,undefined);
});
test('when queue interrupts album playback it resumes inside the original album',()=>{
  const {S,functions:f}=setup();
  S.albumQueue=['Band|one','Band|three'];
  f.addToSmartQueue(make('interlude'));
  f.playQueuedAt(0);
  S.albumQueue=[]; // player clears the album queue while the interlude plays
  assert.equal(f.resumeSmartQueue(),true);
  assert.equal(S.tracks[S.selected].title,'three');
  assert.deepEqual(Array.from(S.albumQueue),['Band|one','Band|three']);
});
test('at the end of the original playlist queue does not replay injected tracks',()=>{
  const {S,functions:f}=setup();
  S.selected=2;
  f.addToSmartQueue(make('bonus'));
  f.playQueuedAt(0);
  assert.equal(f.resumeSmartQueue(),false);
  assert.equal(S.smartOnDeck,false);
});
test('queue remains ephemeral, not in persistent playlist payload',()=>{
  assert.doesNotMatch(app.slice(start,end),/localStorage\.setItem/);
  assert.doesNotMatch(app.slice(start,end),/ArtistWaveCloud/);
  assert.match(fs.readFileSync('styles.css','utf8'),/\[data-theme="day"\] \.smart-queue-panel/);
});
