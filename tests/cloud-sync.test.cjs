'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('cloud-sync.js','utf8');
function fixture(remote=null){
  const els={};for(const id of [
    'cloudStatus','cloudSignIn','cloudAccountActions','cloudAccountName','cloudSyncNow',
    'cloudImportGuest','cloudSignOut','cloudSaveClient','googleClientId','cloudSetup',
    'sourceMode','showUnavailable','includeLive','providerArchive','providerAudius','providerJamendo'
  ])els[id]={textContent:'',value:'',checked:false,disabled:false,classList:{toggle(){}},open:false};
  els.sourceMode.value='both';
  els.providerArchive.checked=true;els.providerAudius.checked=true;els.includeLive.checked=true;
  const entries=new Map();
  const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,String(v)),removeItem:k=>entries.delete(k)};
  const requests=[];
  const guest={id:'archive:guest',artist:'Nita Strauss',title:'Guest Song',source:'ARCHIVE',url:'https://example.org/guest.mp3'};
  const cloud={id:'archive:cloud',artist:'Nita Strauss',title:'Cloud Song',source:'ARCHIVE',url:'https://example.org/cloud.mp3'};
  let favorites=[guest];
  let recent=[guest];
  const listeners={};
  let callback;
  const response=(body,status=200)=>({
    ok:status>=200&&status<300,status,headers:new Headers({'content-type':'application/json'}),
    json:async()=>body,text:async()=>typeof body==='string'?body:JSON.stringify(body)
  });
  const profile={sub:'google-user-123',email:'cloud@example.com'};
  const fakeFetch=async(url,options={})=>{
    requests.push({url,options});
    if(url.includes('/oauth2/v3/userinfo'))return response(profile);
    if(url.includes('uploadType=multipart'))return response({id:'new-file'});
    if(url.includes('uploadType=media'))return response({id:'drive-file'});
    if(url.includes('/drive/v3/files?')){
      const files=remote?[{id:'drive-file',name:'artistwave-library-v1.json',modifiedTime:remote.updatedAt}]:[];
      return response({files});
    }
    if(url.includes('alt=media'))return response(remote);
    throw Error('Unexpected request: '+url);
  };
  const window={google:{accounts:{oauth2:{
    initTokenClient:({callback:cb})=>{callback=cb;return {requestAccessToken(){queueMicrotask(()=>callback({access_token:'mock-token',expires_in:3600}))}};},
    revoke:(_token,done)=>done()
  }}} ,dispatchEvent(event){(listeners[event.type]||[]).forEach(handler=>handler(event))},addEventListener(type,listener){(listeners[type]??=[]).push(listener)}};
  listeners['artistwave:cloud-load']=[event=>{
    favorites=event.detail.favorites;
    recent=event.detail.recent||[];
    const prefs=event.detail.preferences;
    els.sourceMode.value=prefs.sourceMode;
    els.showUnavailable.checked=prefs.showUnavailable;
    els.includeLive.checked=prefs.includeLive;
    els.providerArchive.checked=prefs.providers.archive;
    els.providerAudius.checked=prefs.providers.audius;
    els.providerJamendo.checked=prefs.providers.jamendo;
  }];
  const CustomEvent=class{constructor(type,opts){this.type=type;this.detail=opts.detail}};
  const document={getElementById:id=>els[id],querySelector:()=>({content:'123456789-abcdef.apps.googleusercontent.com'}),createElement:()=>({})};
  const context={window,document,localStorage:storage,Headers,URLSearchParams,CustomEvent,fetch:fakeFetch,
    Date,Map,Set,Promise,JSON,clearTimeout,setTimeout,queueMicrotask};
  vm.runInNewContext(source,context);
  window.ArtistWaveCloud.init({getFavorites:()=>favorites,getRecent:()=>recent});
  return {els,requests,window,entries,getFavorites:()=>favorites,getRecent:()=>recent,guest,cloud};
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,12));
test('cloud backup excludes local blobs and malformed URLs',()=>{
  const f=fixture();
  const tracks=[f.guest,{id:'local:1',artist:'X',title:'Local',url:'blob:abc',source:'LOCAL'},
    {id:'bad',artist:'X',title:'Bad',url:'javascript:alert(1)',source:'ARCHIVE'}];
  const clean=f.window.ArtistWaveCloud.cleanFavorites(tracks);
  assert.equal(clean.length,1);
  const payload=f.window.ArtistWaveCloud.payload(tracks,{sourceMode:'online'});
  assert.equal(payload.schema,1);assert.equal(payload.favorites.length,1);
  assert.equal(payload.preferences.sourceMode,'online');
});
test('existing Drive account loads its own favorites and restores guest data at logout',async()=>{
  const f=fixture({schema:1,updatedAt:'2026-10-01T00:00:00Z',favorites:[{id:'archive:cloud',artist:'Nita Strauss',title:'Cloud Song',source:'ARCHIVE',url:'https://example.org/cloud.mp3'}],preferences:{sourceMode:'online',providers:{archive:false,audius:true,jamendo:false}}});
  f.els.cloudSignIn.onclick();await settle();
  assert.equal(f.window.ArtistWaveCloud.isSignedIn(),true);
  assert.deepEqual(Array.from(f.getFavorites(),t=>t.id),['archive:cloud']);
  assert.equal(f.els.sourceMode.value,'online');
  f.els.cloudSignOut.onclick();
  assert.deepEqual(Array.from(f.getFavorites(),t=>t.id),['archive:guest']);
  assert.equal(f.els.sourceMode.value,'both');
  assert.equal(f.window.ArtistWaveCloud.isSignedIn(),false);
});
test('first-time sign-in creates private Drive appDataFolder JSON backup',async()=>{
  const f=fixture();
  f.els.cloudSignIn.onclick();await settle();
  assert.equal(f.window.ArtistWaveCloud.isSignedIn(),true);
  const request=f.requests.find(x=>x.url.includes('uploadType=multipart'));
  assert.ok(request,'multipart create called');
  assert.match(request.options.body,/appDataFolder/);
  assert.match(request.options.body,/Guest Song/);
  assert.ok(!f.entries.has('artistwave:cloud-token'),'token not persisted');
});
test('guest mode persists favorites locally without account sign-in',()=>{
  const f=fixture();
  f.window.ArtistWaveCloud.persistGuestFavorites([f.guest]);
  assert.match(f.entries.get('artistwave:favorites'),/Guest Song/);
});

test('cloud favorites retain playable online fallbacks but exclude device URLs',()=>{
  const f=fixture();
  const track={...f.guest,alternates:[
    {id:'aud',title:'Guest Song',artist:'Nita Strauss',source:'AUDIUS',url:'https://api.audius.co/v1/tracks/1/stream'},
    {id:'local',title:'Guest Song',artist:'Nita Strauss',source:'LOCAL',url:'blob:device-only'},
    {id:'unsafe',title:'Guest Song',artist:'Nita Strauss',source:'ARCHIVE',url:'javascript:bad'}
  ]};
  const clean=f.window.ArtistWaveCloud.cleanFavorites([track]);
  assert.equal(clean.length,1);
  assert.deepEqual(Array.from(clean[0].alternates,t=>t.source),['AUDIUS']);
  assert.doesNotMatch(JSON.stringify(clean),/blob:device-only/);
});

test('account cloud payload includes only online listening history',()=>{
  const f=fixture();
  const data=f.window.ArtistWaveCloud.payload([f.guest],{sourceMode:'both'},[
    f.guest,{id:'local:1',artist:'X',title:'Private',source:'LOCAL',url:'blob:secret'}
  ]);
  assert.deepEqual(Array.from(data.recent,t=>t.id),['archive:guest']);
  assert.doesNotMatch(JSON.stringify(data),/blob:secret/);
});
test('existing account without history loads safely and logout restores guest history',async()=>{
  const f=fixture({schema:1,updatedAt:'2026-10-01T00:00:00Z',favorites:[{id:'archive:cloud',artist:'Nita Strauss',title:'Cloud Song',source:'ARCHIVE',url:'https://example.org/cloud.mp3'}],preferences:{sourceMode:'both'}});
  f.els.cloudSignIn.onclick();await settle();
  assert.equal(f.window.ArtistWaveCloud.isSignedIn(),true);
  assert.equal(f.getRecent().length,0);
  f.els.cloudSignOut.onclick();
  assert.deepEqual(Array.from(f.getRecent(),t=>t.id),['archive:guest']);
});
