'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
const start=app.indexOf('const onlineProviderIds='),end=app.indexOf('const current=()',start);
assert.ok(start>=0&&end>start,'provider functions exist');

function harness(mode='both'){
  const widgets={
    sourceMode:{value:mode},providerArchive:{checked:true},providerAudius:{checked:true},
    providerJamendo:{checked:false},jamendoClientId:{value:''}
  };
  const S={artist:'Nita Strauss',tracks:[],onlineTracks:[],local:[],selected:-1,providerChecked:{},providerBusy:{},providerErrors:{},matchRequest:1,page:0,loading:false,archiveItemView:false};
  const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  let getJSON=async()=>({data:[]});
  const context={S,norm,$:id=>widgets[id],sourceMode:()=>widgets.sourceMode.value,URLSearchParams,encodeURIComponent,
    dedupeTracks:rows=>[...new Map(rows.map(row=>[norm(row.artist)+'|'+norm(row.title),row])).values()],
    getJSON:url=>getJSON(url),show(){},render(){},updatePlayer(){},loadMore:async()=>{},audio:{pause(){},removeAttribute(){}},
    Promise,Map,Object};
  const api=vm.runInNewContext(app.slice(start,end)+'\n;({providerArtistMatches,normalizeAudiusTracks,normalizeJamendoTracks,fetchAudiusTracks,fetchJamendoTracks,searchOnlineProvider,providerEnabled,loadOnlineProviders})',context);
  return {widgets,S,api,setFetch:fn=>{getJSON=fn}};
}
test('Audius normalizer rejects impostor artist names and gated streams',()=>{
  const {api}=harness();
  const list=api.normalizeAudiusTracks([
    {id:'1',title:'Summer Storm',user:{name:'Nita Strauss',handle:'nitastrauss'}},
    {id:'2',title:'Summer Storm (cover)',user:{name:'Cover Band',handle:'coverband'}},
    {id:'3',title:'Summer Storm (remix)',user:{name:'Nita Strauss'},is_stream_gated:true},
    {id:'4',title:'Summer Storm (unlisted)',user:{name:'Nita Strauss'},is_unlisted:true}
  ],'Nita Strauss');
  assert.equal(list.length,1);
  assert.equal(list[0].source,'AUDIUS');
  assert.equal(list[0].url,'https://api.audius.co/v1/tracks/1/stream');
});
test('Jamendo only returns HTTPS audio for the selected artist',()=>{
  const {api}=harness();
  const list=api.normalizeJamendoTracks([
    {id:77,name:'Fire',artist_name:'Nita Strauss',audio:'https://audio.jamendo.com/77',shareurl:'https://www.jamendo.com/track/77'},
    {id:78,name:'Fire',artist_name:'Not Nita',audio:'https://audio.jamendo.com/78'},
    {id:79,name:'Bad',artist_name:'Nita Strauss',audio:'http://notsecure.com/79'}
  ],'Nita Strauss');
  assert.equal(list.length,1);assert.equal(list[0].source,'JAMENDO');
  assert.equal(list[0].sourceUrl,'https://www.jamendo.com/track/77');
});
test('Audius fetch finds an exact user and only fetches that user tracks',async()=>{
  const {api,setFetch}=harness();
  const calls=[];
  setFetch(async url=>{
    calls.push(url);
    if(url.includes('users/search'))return {data:[{id:'11',name:'Nita Strauss',handle:'nitastrauss'},{id:'22',name:'Nita Tribute',handle:'nita_tribute'}]};
    if(url.includes('/users/11/tracks'))return {data:[{id:'abc',title:'Our Song'}]};
    throw Error('Unexpected url '+url);
  });
  const items=await api.fetchAudiusTracks('Nita Strauss');
  assert.equal(items.length,1);assert.equal(items[0].source,'AUDIUS');assert.equal(items[0].artist,'Nita Strauss');
  assert.equal(calls.length,2);
});
test('Jamendo requires a client ID, then checks API status',async()=>{
  const {api,widgets,setFetch}=harness();
  await assert.rejects(api.fetchJamendoTracks('Nita Strauss'),/client ID/);
  widgets.jamendoClientId.value='a123456b';
  setFetch(async url=>{
    assert.match(url,/client_id=a123456b/);
    assert.match(url,/artist_name=Nita\+Strauss/);
    return {headers:{status:'success'},results:[{id:1,name:'Song',artist_name:'Nita Strauss',audio:'https://cdn.example/1.mp3'}]};
  });
  const rows=await api.fetchJamendoTracks('Nita Strauss');
  assert.equal(rows.length,1);
});
test('failed Audius does not block Jamendo playback results',async()=>{
  const {api,widgets,S,setFetch}=harness();
  widgets.providerJamendo.checked=true;
  widgets.jamendoClientId.value='a123456b';
  setFetch(async url=>{
    if(url.includes('api.audius.co'))throw Error('Audius temporary outage');
    return {headers:{status:'success'},results:[{id:3,name:'Track',artist_name:'Nita Strauss',audio:'https://cdn.example/3.mp3'}]};
  });
  await Promise.all([api.searchOnlineProvider('audius','Nita Strauss',1),api.searchOnlineProvider('jamendo','Nita Strauss',1)]);
  assert.equal(S.onlineTracks.length,1);
  assert.equal(S.onlineTracks[0].source,'JAMENDO');
  assert.match(S.providerErrors.audius,/outage/);
});
