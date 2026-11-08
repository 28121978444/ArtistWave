'use strict';
const $=id=>document.getElementById(id),audio=$('audio');
const S={artist:'',tracks:[],local:[],favorites:[],selected:-1,matches:[],view:'discover',shuffle:false,repeat:0,page:0,loading:false,artistMbid:null,unavailable:[],catalogLoading:false,catalogResolved:false,catalogRequest:0,requestId:0,matchRequest:0,onlineTracks:[],localFiles:new Set(),importingFolder:false,providerChecked:{},providerBusy:{},providerErrors:{},archiveItemView:false,albumQueue:[],smartQueue:[],smartOrigin:null,smartOnDeck:false,activeSource:null,playbackToken:0,playCandidates:[],playCandidateIndex:0,bufferTimer:null,recent:[],folderHandleAvailable:false};
try{S.favorites=JSON.parse(localStorage.getItem('artistwave:favorites')||'[]')}catch{}if(!Array.isArray(S.favorites))S.favorites=[];
try{S.recent=JSON.parse(localStorage.getItem('artistwave:recent')||'[]')}catch{}if(!Array.isArray(S.recent))S.recent=[];
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const time=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const show=(msg,error=false)=>{$('statusMessage').textContent=msg;$('statusMessage').classList.toggle('error',error)};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const creatorMatches=(value,name)=>{let list=Array.isArray(value)?value:[value];return list.some(v=>String(v||'').split(/\s*(?:;|\||,|\bfeat\.?\b|\bfeaturing\b)\s*/i).some(a=>norm(a)===norm(name)))};
// Track identity is based on artist + song title, not Internet Archive URL.
// Technical filename decorations can differ across files for the same recording;
// live/acoustic/remix variants retain their own keys.
function cleanTrackTitle(title,artist=''){
  let cleaned=String(title||'').replace(/\.(?:mp3|flac|wav|m4a|aac|ogg|oga|opus)$/i,'').replace(/_/g,' ').trim();
  cleaned=cleaned.replace(/^\s*(?:disc|cd)\s*\d+\s*[-._ ]\s*/i,'').replace(/^\s*\d{1,3}\s*[-._ ]+\s*/,'');
  const prefix=String(artist||'').trim();
  if(prefix&&norm(cleaned.slice(0,prefix.length))===norm(prefix)&&/^\s*[-–—:]\s*/.test(cleaned.slice(prefix.length))){
    cleaned=cleaned.slice(prefix.length).replace(/^\s*[-–—:]\s*/,'');
  }
  cleaned=cleaned.replace(/\s*[\[(](?:\d{2,3}\s?kbps|(?:vbr|mp3|flac|wav|lossless|audio|stereo|mono))\s*[\])]\s*$/i,'').trim();
  return cleaned||String(title||'').trim();
}
function trackKey(track){
  const artist=norm(track.artist||S.artist);
  const title=norm(cleanTrackTitle(track.title,track.artist));
  // Keep generic item titles from different collections separate.
  const generic=/^(?:track|audio|song|untitled|unknown|part|file|recording|side)\s*\d*$/i.test(title);
  const collection=generic?'|'+norm(track.collection||''): '';
  return artist+'|'+title+collection;
}
function trackPriority(track){
  if(!track?.url)return 0;
  const source=({LOCAL:160,ARCHIVE:120,AUDIUS:90,JAMENDO:60})[track.source]||30;
  const ext=(track.url.split('?')[0].match(/\.(flac|wav|aiff|alac|m4a|mp3|ogg|oga|opus|aac)$/i)||[])[1]?.toLowerCase();
  const format={flac:12,wav:11,aiff:11,alac:11,m4a:9,mp3:8,opus:8,ogg:7,oga:7,aac:7}[ext]||0;
  const title=cleanTrackTitle(track.title,track.artist);
  return source+format+(title.length>2?1:0);
}
// One visible track per artist/title, but keep independent playable sources
// behind it so the player can recover from a failed URL without extra rows.
function trackSources(track){
  return track?[track,...(Array.isArray(track.alternates)?track.alternates:[])]
    .filter(t=>t&&t.url).map(({alternates,...t})=>t):[];
}
function dedupeTracks(tracks){
  const buckets=new Map();
  for(const original of tracks){
    if(!original?.title)continue;
    const key=trackKey(original);
    if(!buckets.has(key))buckets.set(key,[]);
    const bucket=buckets.get(key);
    for(const source of trackSources(original)){
      // Identical URLs/files have no value as alternate playback attempts.
      if(!bucket.some(t=>t.url===source.url))bucket.push(source);
    }
    if(!original.url&&!bucket.length)bucket.push({...original,alternates:undefined});
  }
  return [...buckets.values()].map(bucket=>{
    bucket.sort((a,b)=>trackPriority(b)-trackPriority(a));
    const [preferred,...alternates]=bucket;
    const albumSource=bucket.find(t=>t.albumKind==='album'&&t.collection);
    const result={...preferred};
    const artwork=bucket.find(t=>/^https:\/\//i.test(t.artwork||''));
    if(artwork&&!result.artwork)result.artwork=artwork.artwork;
    if(albumSource&&result.albumKind!=='album'){
      result.collection=albumSource.collection;
      result.albumKind='album';
      result.year=albumSource.year||result.year;
    }
    if(alternates.length)result.alternates=alternates;
    else delete result.alternates;
    return result;
  });
}
function mergePlaylistTracks(incoming){
  const previouslySelected=S.tracks[S.selected]||null;
  const merged=dedupeTracks([...S.tracks,...incoming]);
  S.tracks=merged;
  if(previouslySelected){
    // Preserve the selected song even if a better-quality source replaces its URL.
    const sameId=merged.findIndex(t=>t.id===previouslySelected.id);
    S.selected=sameId>=0?sameId:merged.findIndex(t=>trackKey(t)===trackKey(previouslySelected));
  }else S.selected=-1;
}

const onlineProviderIds={archive:'providerArchive',audius:'providerAudius',jamendo:'providerJamendo'};
function providerEnabled(name){
  const element=$(onlineProviderIds[name]);
  return Boolean(element?.checked)&&sourceMode()!=='local';
}
function jamendoClientId(){
  return ($('jamendoClientId')?.value||'').trim();
}
function providerArtistMatches(display,handle,target){
  const desired=norm(target);
  return !!desired&&(norm(display)===desired||norm(String(handle||'').replace(/^@/,''))===desired);
}
function normalizeAudiusTracks(records,artist){
  return (Array.isArray(records)?records:[]).filter(t=>
    t&&t.id&&t.title&&!t.is_stream_gated&&!t.is_unlisted&&!t.is_delete&&
    t.is_streamable!==false&&t.access?.stream?.is_streamable!==false&&
    providerArtistMatches(t.user?.name,t.user?.handle,artist)
  ).map(t=>({
    id:'audius:'+t.id,title:String(t.title),artist,
    collection:t.album_name||t.album?.name||'Audius release',artwork:albumArtwork(t.artwork),albumKind:(t.album_name||t.album?.name)?'album':'single',year:extractYear(t.release_date),source:'AUDIUS',
    url:'https://api.audius.co/v1/tracks/'+encodeURIComponent(t.id)+'/stream',
    sourceUrl:typeof t.permalink==='string'&&t.permalink.startsWith('https://audius.co/')?t.permalink:
      'https://audius.co/search?query='+encodeURIComponent(artist+' '+t.title)
  }));
}
function normalizeJamendoTracks(records,artist){
  return (Array.isArray(records)?records:[]).filter(t=>
    t&&t.id&&t.name&&typeof t.audio==='string'&&
    /^https:\/\//i.test(t.audio)&&norm(t.artist_name)===norm(artist)
  ).map(t=>({
    id:'jamendo:'+t.id,title:String(t.name),artist,
    collection:t.album_name||'Jamendo single',artwork:albumArtwork(t.album_image||t.image),albumKind:t.album_name?'album':'single',year:extractYear(t.releasedate),source:'JAMENDO',
    url:t.audio,
    sourceUrl:typeof t.shareurl==='string'&&t.shareurl.startsWith('https://')?t.shareurl:
      'https://www.jamendo.com/track/'+encodeURIComponent(t.id),
    licenseUrl:typeof t.license_ccurl==='string'?t.license_ccurl:''
  }));
}
function refreshProviderStatus(){
  if(sourceMode()==='local')return;
  const count=S.tracks.length;
  const enabled=Object.keys(onlineProviderIds).filter(providerEnabled);
  const failures=Object.entries(S.providerErrors).filter(([provider])=>enabled.includes(provider)).map(([provider,message])=>provider+': '+message);
  const pending=Object.keys(S.providerBusy).filter(provider=>S.providerBusy[provider]&&enabled.includes(provider));
  let msg=count+' unique playable track'+(count===1?'':'s')+' available for '+S.artist+'.';
  if(pending.length)msg+=' Searching '+pending.join(', ')+'…';
  if(failures.length)msg+=' Source issues: '+failures.join(' · ')+'.';
  if(!enabled.length)msg='Select at least one online provider, or use local music.';
  show(msg,Boolean(failures.length)&&!count);
}
async function fetchAudiusTracks(artist){
  const base='https://api.audius.co/v1';
  const users=await getJSON(base+'/users/search?'+new URLSearchParams({query:artist,limit:'18'}));
  const candidates=(users.data||[]).filter(user=>providerArtistMatches(user.name,user.handle,artist)).slice(0,3);
  const queries=await Promise.allSettled(candidates.map(user=>
    getJSON(base+'/users/'+encodeURIComponent(user.id)+'/tracks?'+new URLSearchParams({limit:'75',offset:'0'}))
  ));
  if(candidates.length&&queries.every(item=>item.status==='rejected'))throw Error('Artist tracks could not be loaded');
  return dedupeTracks(queries.flatMap((item,index)=>{
    if(item.status!=='fulfilled')return [];
    // User-track response may omit the embedded owner record.
    const owner=candidates[index];
    return normalizeAudiusTracks((item.value.data||[]).map(t=>({...t,user:t.user||owner})),artist);
  }));
}
async function fetchJamendoTracks(artist){
  const clientId=jamendoClientId();
  if(!/^[a-z0-9_-]{6,80}$/i.test(clientId))throw Error('Add a Jamendo client ID to enable this source');
  const params=new URLSearchParams({
    client_id:clientId,format:'json',artist_name:artist,limit:'100',
    type:'single albumtrack',audioformat:'mp31'
  });
  const result=await getJSON('https://api.jamendo.com/v3.0/tracks/?'+params);
  if(result.headers?.status!=='success')throw Error(result.headers?.error_message||'Provider rejected the request');
  return dedupeTracks(normalizeJamendoTracks(result.results,artist));
}
async function searchOnlineProvider(provider,artist,selection){
  if(!providerEnabled(provider)||S.providerBusy[provider]||S.providerChecked[provider])return;
  S.providerBusy[provider]=true;delete S.providerErrors[provider];
  refreshProviderStatus();
  try{
    const tracks=provider==='audius'?await fetchAudiusTracks(artist):await fetchJamendoTracks(artist);
    if(selection!==S.matchRequest||S.artist!==artist)return;
    S.onlineTracks=dedupeTracks([...S.onlineTracks,...tracks]);
    S.providerChecked[provider]=true;
    rebuildPlaylist();
  }catch(error){
    if(selection===S.matchRequest&&S.artist===artist)S.providerErrors[provider]=error.message||'Unavailable';
  }finally{
    if(selection===S.matchRequest&&S.artist===artist){
      S.providerBusy[provider]=false;
      refreshProviderStatus();
    }
  }
}
async function loadOnlineProviders(artist,selection){
  if(sourceMode()==='local'||S.archiveItemView)return;
  const pending=[];
  if(providerEnabled('archive')&&S.page===0&&!S.loading){
    pending.push((async()=>{
      S.providerBusy.archive=true;
      try{await loadMore()}
      finally{S.providerBusy.archive=false;refreshProviderStatus()}
    })());
  }
  for(const name of ['audius','jamendo']){
    if(providerEnabled(name))pending.push(searchOnlineProvider(name,artist,selection));
  }
  if(!pending.length){refreshProviderStatus();return}
  await Promise.allSettled(pending);
  if(selection===S.matchRequest&&artist===S.artist)refreshProviderStatus();
}
function handleOnlineProviderChange(){
  rebuildPlaylist();
  if(!S.artist||sourceMode()==='local')return;
  loadOnlineProviders(S.artist,S.matchRequest);
  refreshProviderStatus();
}

const current=()=>S.tracks[S.selected];
function albumArtwork(value){
  const candidate=typeof value==='string'?value:value&&typeof value==='object'?(value['480x480']||value['150x150']||value['1000x1000']||value.url):'';
  return typeof candidate==='string'&&/^https:\/\//i.test(candidate)?candidate:'';
}

const MUSIC_EXT=/\.(?:mp3|m4a|aac|ogg|oga|flac|wav|opus)$/i;
const sourceMode=()=>$('sourceMode')?.value||'both';
function localMatchesArtist(track,name){
  const target=norm(name);
  if(!target)return true;
  const artist=norm(track.artist);
  return artist===target||artist.startsWith(target+' ');
}
function rebuildPlaylist(){
  const previous=S.tracks[S.selected];
  const candidates=[
     ...(sourceMode()==='local'?[]:S.onlineTracks.flatMap(trackSources).filter(t=>providerEnabled(t.source.toLowerCase()))),
    ...(sourceMode()==='online'?[]:S.local.filter(t=>localMatchesArtist(t,S.artist)))
  ];
  S.tracks=dedupeTracks(candidates);
  S.albumQueue=S.albumQueue.filter(key=>S.tracks.some(t=>trackKey(t)===key));
  S.selected=previous?S.tracks.findIndex(t=>trackKey(t)===trackKey(previous)):-1;
  if(previous&&S.selected<0){
    audio.pause();audio.removeAttribute('src');clearPlaybackRecovery();
  }else if(previous&&S.selected>=0&&S.activeSource){
    const stillAllowed=trackSources(S.tracks[S.selected]).some(t=>t.url===S.activeSource.url);
    if(!stillAllowed){
      audio.pause();audio.removeAttribute('src');clearPlaybackRecovery();
    }
  }
  render();updatePlayer();
}
function parseLocalFilename(file,path=''){
  const filename=file.name.replace(MUSIC_EXT,'').replace(/_/g,' ').replace(/^\s*\d{1,3}\s*[-._ ]+\s*/,'').trim();
  const parts=filename.split(/\s+[-–—]\s+/);
  let title=filename,artist='';
  const folders=String(path||file.webkitRelativePath||'').split('/').filter(Boolean);
  if(parts.length>=2){artist=parts.shift().trim();title=parts.join(' - ').trim();}
  else if(folders.length>=4)artist=folders[folders.length-3];
  else if(folders.length===3)artist=folders[folders.length-2];
  return {artist:artist||'Unknown artist',title:title||filename,collection:folders.length>=4?folders[folders.length-2]:'Your device'};
}
// Read common MP3 ID3v2 text frames without loading a full audio file.
// Other audio formats use folder and filename information as a fallback.
async function readLocalTags(file){
  if(!/\.mp3$/i.test(file.name))return {};
  try{
    const bytes=new Uint8Array(await file.slice(0,131072).arrayBuffer());
    if(bytes.length<10||String.fromCharCode(...bytes.subarray(0,3))!=='ID3')return {};
    const version=bytes[3];if(version!==3&&version!==4)return {};
    const size=(bytes[6]<<21)|(bytes[7]<<14)|(bytes[8]<<7)|bytes[9];
    const limit=Math.min(bytes.length,10+size);
    let p=10;const tags={};
    while(p+10<=limit){
      const frame=String.fromCharCode(...bytes.subarray(p,p+4));
      if(!/^[A-Z0-9]{4}$/.test(frame))break;
      const length=version===4?((bytes[p+4]<<21)|(bytes[p+5]<<14)|(bytes[p+6]<<7)|bytes[p+7]):(((bytes[p+4]<<24)>>>0)+(bytes[p+5]<<16)+(bytes[p+6]<<8)+bytes[p+7]);
      if(length<=0||p+10+length>limit)break;
      if(['TIT2','TPE1','TALB'].includes(frame)){
        const data=bytes.subarray(p+11,p+10+length);
        const encoding=bytes[p+10];
        let value='';
        try{value=new TextDecoder(encoding===1||encoding===2?'utf-16':encoding===3?'utf-8':'iso-8859-1').decode(data).replace(/\0/g,'').replace(/^\uFEFF/,'').trim()}catch{}
        if(value)tags[frame]=value;
      }
      p+=10+length;
    }
    return {title:tags.TIT2,artist:tags.TPE1,collection:tags.TALB};
  }catch{return {}}
}
function localPathId(file,path){return (path||file.webkitRelativePath||file.name)+'|'+file.size+'|'+file.lastModified}
async function importLocalFiles(entries,{folder=false}={}){
  if(S.importingFolder){show('A folder scan is already running.');return}
  S.importingFolder=true;
  let added=0,ignored=0;let scanned=0;
  $('folderSummary').textContent='Scanning your music…';
  try{
    for await(const entry of entries){
      if(scanned++>=6000){show('Scan limited to 6,000 files. Choose a smaller folder to import more.',true);break}
      const file=entry.file||entry;
      const path=entry.path||file.webkitRelativePath||file.name;
      if(!MUSIC_EXT.test(file.name)||!file.size){ignored++;continue}
      const id=localPathId(file,path);
      if(S.localFiles.has(id)){ignored++;continue}
      const fallback=parseLocalFilename(file,path);
      const tags=await readLocalTags(file);
      const artist=(tags.artist||fallback.artist).replace(/\0/g,' / ').trim();
      const title=tags.title||fallback.title;
      const url=URL.createObjectURL(file);
      const track={id:'local:'+id,title,artist,collection:tags.collection||fallback.collection,albumKind:tags.collection||fallback.collection!=='Your device'?'album':'single',source:'LOCAL',url,path};
      S.local.push(track);
      S.localFiles.add(id);added++;
    }
    rebuildPlaylist();
    const total=S.local.length;
    $('folderSummary').textContent=total+' local track'+(total===1?'':'s')+' indexed this session';
    show(added+' local file'+(added===1?'':'s')+' added; '+ignored+' skipped. Music stays on your device.');
  }catch(error){
    show('Could not read all files: '+error.message,true);
  }finally{S.importingFolder=false}
}
async function importFolderHandle(handle){
  async function* visit(directory,prefix){
    for await(const entry of directory.values()){
      const path=prefix+'/'+entry.name;
      if(entry.kind==='directory')yield* visit(entry,path);
      else if(entry.kind==='file'&&MUSIC_EXT.test(entry.name))yield {file:await entry.getFile(),path};
    }
  }
  await importLocalFiles(visit(handle,handle.name),{folder:true});
}
// File System Access handles can be stored in IndexedDB in supported browsers.
// Never auto-scan a remembered folder: permission may have expired.
const FOLDER_DB='artistwave-local-folders';
let cachedFolderHandle=null;
function folderStore(){
  if(typeof indexedDB==='undefined')return Promise.resolve(null);
  return new Promise(resolve=>{
    try{
      const request=indexedDB.open(FOLDER_DB,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('handles');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>resolve(null);
      request.onblocked=()=>resolve(null);
    }catch{resolve(null)}
  });
}
async function savedFolderHandle(value){
  const db=await folderStore();
  if(!db)return null;
  return new Promise(resolve=>{
    try{
      const tx=db.transaction('handles',arguments.length?'readwrite':'readonly');
      const op=arguments.length?value===null?tx.objectStore('handles').delete('last'):
        tx.objectStore('handles').put(value,'last'):tx.objectStore('handles').get('last');
      op.onsuccess=()=>resolve(arguments.length?true:op.result||null);
      op.onerror=()=>resolve(null);
      tx.oncomplete=()=>db.close();
      tx.onerror=()=>{db.close();resolve(null)};
    }catch{db.close();resolve(null)}
  });
}
function updateSavedFolderUI(){
  $('reopenFolderNav').hidden=!cachedFolderHandle;
  $('forgetFolderNav').hidden=!cachedFolderHandle;
}
async function restoreFolderHandle(){
  cachedFolderHandle=await savedFolderHandle();
  updateSavedFolderUI();
  if(cachedFolderHandle)$('folderSummary').textContent='Saved folder: '+cachedFolderHandle.name+' · click Reopen to scan';
}
async function reopenSavedFolder(){
  if(!cachedFolderHandle||S.importingFolder)return;
  try{
    let permission=await cachedFolderHandle.queryPermission({mode:'read'});
    if(permission!=='granted')permission=await cachedFolderHandle.requestPermission({mode:'read'});
    if(permission!=='granted'){show('Folder permission not granted. Choose Add Music Folder to select a new folder.',true);return}
    await importFolderHandle(cachedFolderHandle);
  }catch(error){show('Could not reopen saved folder: '+error.message,true)}
}

async function chooseLocalFolder(){
  if(S.importingFolder)return;
  if(typeof window.showDirectoryPicker==='function'){
    try{
      const handle=await window.showDirectoryPicker({mode:'read'});
      await importFolderHandle(handle);
      cachedFolderHandle=handle;
      if(await savedFolderHandle(handle)){updateSavedFolderUI()}else show('Folder imported. This browser cannot remember the folder after reload.');
      return;
    }catch(err){
      if(err?.name==='AbortError')return;
      // Some browsers advertise the picker but block it in this context.
      if(!['SecurityError','NotAllowedError','NotSupportedError'].includes(err?.name)){
        show('Unable to open folder: '+err.message,true);return;
      }
    }
  }
  $('folderInput').click();
}

function updatePlayer(){const t=current();$('playlistSaveCurrent').disabled=!t;$('nowTitle').textContent=t?.title||'Nothing playing yet';$('nowArtist').textContent=t?.artist||'Find your next favorite';$('playingSource').textContent=(S.activeSource||t)?.source||'READY';$('playButton').textContent=audio.paused?'▶':'Ⅱ';$('favoriteCurrent').disabled=!t;$('favoriteCurrent').textContent=t&&S.favorites.some(x=>x.id===t.id)?'♥':'♡'}
function makeLyricsActions(track){
  const actions=document.createElement('div');actions.className='lyrics-actions';
  const query=encodeURIComponent(track.artist+' '+track.title);
  const sources=[
    {name:'AZLyrics',href:'https://search.azlyrics.com/search.php?q='+query+'&w=songs'},
    {name:'Genius',href:'https://genius.com/search?q='+query}
  ];
  for(const source of sources){
    const a=document.createElement('a');a.className='lyrics-link';
    a.href=source.href;a.target='_blank';a.rel='noopener noreferrer';
    a.textContent=source.name+' ↗';
    a.title='Search for '+track.title+' on '+source.name+' in a new tab; lyrics page not verified';
    a.setAttribute('aria-label','Search '+source.name+' for lyrics to '+track.title+' by '+track.artist);
    actions.append(a);
  }
  const caption=document.createElement('span');caption.className='lyrics-credit';
  caption.textContent='External lyrics searches · AZLyrics / Genius';
  actions.append(caption);
  return actions;
}

function dedupeRecent(entries){
  const seen=new Set(),out=[];
  for(const track of Array.isArray(entries)?entries:[]){
    if(!track?.id||!track?.artist||!track?.title)continue;
    const key=trackKey(track);
    if(seen.has(key))continue;
    seen.add(key);out.push(track);
  }
  return out.slice(0,30);
}
function safeRecentTracks(entries){
  return dedupeRecent(entries).filter(t=>t.source!=='LOCAL'&&/^https:\/\//.test(t.url||''));
}
function rememberPlayedTrack(track){
  if(!track?.url)return;
  const copy={...track};
  S.recent=dedupeRecent([copy,...S.recent]);
  window.ArtistWaveCloud?.persistGuestRecent(safeRecentTracks(S.recent));
  window.ArtistWaveCloud?.changed();
  $('recentCount').textContent=S.recent.length;
  if(S.view==='recent')render();
}

function extractYear(input){
  const match=String(input||'').match(/\b(18\d\d|19\d\d|20\d\d)\b/);
  return match?match[1]:'';
}
function albumLabel(track){
  const name=String(track?.collection||'').trim();
  if(!name||/^(?:audio|your device|unknown|unknown album|untitled|single|singles|audius release|jamendo single)$/i.test(name))
    return 'Singles & unknown albums';
  // Internet Archive item titles are not necessarily official albums.
  return track?.albumKind==='collection'?'Archive collection · '+name:name;
}
function groupTracksByAlbum(tracks){
  const groups=new Map();
  tracks.forEach((track,index)=>{
    const label=albumLabel(track),key=norm(track.artist||'')+'|'+norm(label);
    if(!groups.has(key))groups.set(key,{label,artist:track.artist||'',key,items:[]});
    groups.get(key).items.push({track,index});
  });
  return [...groups.values()];
}
function clearAlbumQueue(){S.albumQueue=[]}
function playAlbum(indices){
  const order=indices.filter(index=>Number.isInteger(index)&&index>=0&&index<S.tracks.length);
  if(!order.length)return;
  S.albumQueue=order.map(index=>trackKey(S.tracks[index]));
  S.shuffle=false;$('shuffleButton').classList.remove('active');
  playAt(order[0],{keepAlbum:true});
}
function nextAlbumTrack(direction=1){
  if(!S.albumQueue.length)return false;
  const pos=S.albumQueue.indexOf(current()?trackKey(current()):'');
  const nextPos=pos+(direction>=0?1:-1);
  if((nextPos<0||nextPos>=S.albumQueue.length)&&S.repeat!==1)return false;
  const key=S.albumQueue[(nextPos+S.albumQueue.length)%S.albumQueue.length];
  const i=S.tracks.findIndex(t=>trackKey(t)===key);
  if(i<0)return false;
  playAt(i,{keepAlbum:true});return true;
}

// Browsing compactness is independent of playback and survives re-renders.
const ALBUM_FOLD_KEY='artistwave:collapsed-albums:v1';
let collapsedAlbums=new Set();
try{
  const stored=JSON.parse(localStorage.getItem(ALBUM_FOLD_KEY)||'[]');
  if(Array.isArray(stored))collapsedAlbums=new Set(stored.filter(x=>typeof x==='string').slice(-300));
}catch{}
const albumFoldKey=(view,group)=>view+'|'+group.key;
function saveCollapsedAlbums(){
  try{localStorage.setItem(ALBUM_FOLD_KEY,JSON.stringify([...collapsedAlbums].slice(-300)))}catch{}
}
function updateAlbumFold(section,rows,button,collapsed){
  section.classList.toggle('album-collapsed',collapsed);
  rows.hidden=collapsed;
  button.setAttribute('aria-expanded',String(!collapsed));
  button.textContent=collapsed?'▾ Show tracks':'▴ Hide tracks';
  button.setAttribute('aria-label',(collapsed?'Expand ':'Collapse ')+section.dataset.albumLabel);
  button.title=(collapsed?'Expand':'Collapse')+' album tracks';
}
function updateAlbumFoldAll(){
  const sections=[...$('trackList').querySelectorAll('.album-group')];
  const allCollapsed=sections.length>0&&sections.every(el=>el.classList.contains('album-collapsed'));
  const button=$('albumFoldAll');
  button.textContent=allCollapsed?'▾ Expand all':'▴ Collapse all';
  button.setAttribute('aria-label',allCollapsed?'Expand all albums':'Collapse all albums');
  button.disabled=!sections.length;
}
function toggleAllAlbums(){
  const sections=[...$('trackList').querySelectorAll('.album-group')];
  const collapse=sections.some(el=>!el.classList.contains('album-collapsed'));
  for(const section of sections){
    const key=section.dataset.albumKey;
    if(collapse)collapsedAlbums.add(key);else collapsedAlbums.delete(key);
    updateAlbumFold(section,section.querySelector('.album-tracks'),section.querySelector('.album-fold-button'),collapse);
  }
  saveCollapsedAlbums();
  updateAlbumFoldAll();
}

function render(){
  const list=$('trackList');list.replaceChildren();
  $('favoriteCount').textContent=S.favorites.length;
  $('recentCount').textContent=S.recent.length;
  const songs=S.view==='favorites'?dedupeTracks(S.favorites):S.view==='recent'?dedupeTracks(S.recent):S.tracks;
  const unplayable=S.view==='discover'&&sourceMode()!=='local'&&$('showUnavailable').checked?dedupeTracks(S.unavailable).filter(t=>!S.tracks.some(p=>trackKey(p)===trackKey(t))):[];
  $('shuffleAll').disabled=!songs.length;
  $('clearList').disabled=!songs.length&&!unplayable.length;
  $('albumJump').hidden=!songs.length;
  const jump=$('albumJumpSelect');jump.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose an album';jump.append(placeholder);
  if(!songs.length&&!unplayable.length){
    const el=document.createElement('div');el.className='empty-state';
    el.textContent=S.catalogLoading?'Looking up song titles…':S.view==='favorites'?'No favorites yet.':S.view==='recent'?'Nothing played yet. Start a song to build your listening history.':S.artist?'No playable recordings found in the selected sources. Enable “Show titles without audio” to browse catalog entries.':'No playable recordings yet. Search for an artist or add local tracks.';
    list.append(el);updateAlbumFoldAll();return;
  }
  const playableGroups=groupTracksByAlbum(songs);
  const catalogGroups=groupTracksByAlbum(unplayable);
  const catalogByAlbum=new Map(catalogGroups.map(group=>[group.key,group.items]));
  function appendPlayable(t,i,parent){
    const el=document.createElement('div');el.className='track-row'+(S.view!=='favorites'&&i===S.selected?' active':'');
    const play=document.createElement('button');play.className='track-play';play.textContent='▶';play.setAttribute('aria-label','Play '+t.title);
    play.onclick=()=>{
      if(S.view==='favorites'||S.view==='recent'){S.tracks=dedupeTracks(songs);S.view='discover';clearAlbumQueue()}
      playAt(i);
    };
    const info=document.createElement('div');info.className='track-info';const title=document.createElement('strong');title.textContent=t.title;
    const artist=document.createElement('small');artist.textContent=t.artist;info.append(title,artist);
    const collection=document.createElement('span');collection.className='recording-name';collection.textContent=t.collection||'Audio';
    const source=document.createElement('span');source.className='track-source';
    if(t.sourceUrl&&/^https:\/\//.test(t.sourceUrl)){
      const link=document.createElement('a');link.className='provider-link';link.href=t.sourceUrl;
      link.target='_blank';link.rel='noopener noreferrer';link.textContent=t.source+' ↗';
      link.setAttribute('aria-label','View '+t.title+' on '+t.source);source.append(link);
    }else source.textContent=t.source;
    const fav=document.createElement('button');fav.className='heart-button';fav.textContent=S.favorites.some(x=>x.id===t.id)?'♥':'♡';
    fav.setAttribute('aria-label','Toggle favorite');fav.onclick=()=>favorite(t);
    const add=document.createElement('button');add.type='button';add.className='track-add-playlist';add.textContent='＋';
    add.title='Add '+t.title+' to a playlist';add.setAttribute('aria-label','Add '+t.title+' to a playlist');
    add.onclick=()=>window.ArtistWavePlaylists?.addTrack(t);
    const nextSong=document.createElement('button');nextSong.type='button';nextSong.className='track-queue-next';nextSong.textContent='↳ Next';
    nextSong.title='Play '+t.title+' next';nextSong.setAttribute('aria-label','Play '+t.title+' next');
    nextSong.onclick=()=>addToSmartQueue(t,true);
    const addQueue=document.createElement('button');addQueue.type='button';addQueue.className='track-queue-add';addQueue.textContent='☷';
    addQueue.title='Add '+t.title+' to queue';addQueue.setAttribute('aria-label','Add '+t.title+' to queue');
    addQueue.onclick=()=>addToSmartQueue(t,false);
    const controls=document.createElement('div');controls.className='track-actions';controls.append(fav,add,nextSong,addQueue,makeLyricsActions(t));
    el.append(play,info,collection,source,controls);parent.append(el);
  }
  function appendUnavailable(t,parent){
    const el=document.createElement('div');el.className='track-row unavailable-row';
    const symbol=document.createElement('span');symbol.className='unavailable-mark';symbol.textContent='—';symbol.title='No playable audio in ArtistWave';
    const info=document.createElement('div');info.className='track-info';
    const title=document.createElement('strong');title.textContent=t.title;
    const artist=document.createElement('small');artist.textContent=t.artist;info.append(title,artist);
    const status=document.createElement('span');status.className='recording-name';status.textContent='No playable audio found';
    const badge=document.createElement('span');badge.className='track-source';badge.textContent='LYRICS';
    el.append(symbol,info,status,badge,makeLyricsActions(t));parent.append(el);
  }
  const visited=new Set();
  for(const group of [...playableGroups,...catalogGroups]){
    const key=group.key;
    if(visited.has(key))continue;
    visited.add(key);
    const playable=playableGroups.find(g=>g.key===key)?.items||[];
    const catalog=catalogByAlbum.get(key)||[];
    const section=document.createElement('section');section.className='album-group';
    const groupId='album-section-'+visited.size;section.id=groupId;
    const jumpOption=document.createElement('option');jumpOption.value=groupId;
    jumpOption.textContent=group.label+(group.artist?' · '+group.artist:'');jump.append(jumpOption);
    section.setAttribute('aria-label','Album: '+group.label);
    const foldKey=albumFoldKey(S.view,group);
    section.dataset.albumKey=foldKey;
    section.dataset.albumLabel=group.label;
    const collapsed=collapsedAlbums.has(foldKey);
    const header=document.createElement('div');header.className='album-header';
    const coverTrack=playable.concat(catalog).map(item=>item.track).find(t=>albumArtwork(t.artwork));
    const cover=document.createElement('div');cover.className='album-cover';
    const coverPlaceholder=document.createElement('span');coverPlaceholder.textContent='♫';cover.append(coverPlaceholder);
    if(coverTrack){
      const image=document.createElement('img');image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';
      image.onerror=()=>{image.remove();coverPlaceholder.hidden=false};
      image.onload=()=>{coverPlaceholder.hidden=true};
      image.src=albumArtwork(coverTrack.artwork);cover.append(image);
    }
    header.append(cover);
    const heading=document.createElement('h3');heading.className='album-heading';heading.textContent=group.label;
    const count=document.createElement('span');count.className='album-count';
    const year=playable.concat(catalog).map(item=>extractYear(item.track.year)).find(Boolean);
    const total=playable.length+catalog.length;
    count.textContent=total+' track'+(total===1?'':'s');
    header.append(heading);
    if(year){const date=document.createElement('span');date.className='album-year';date.textContent=year;header.append(date)}
    header.append(count);
    if(playable.length){
      const button=document.createElement('button');button.type='button';button.className='album-play-button';
      button.textContent='▶ Play album';button.setAttribute('aria-label','Play '+group.label+' album');
      button.onclick=()=>{
        if(S.view==='favorites'||S.view==='recent'){S.tracks=dedupeTracks(songs);S.view='discover'}
        playAlbum(playable.map(item=>item.index));
      };
      header.append(button);
    }
    const foldButton=document.createElement('button');
    foldButton.type='button';foldButton.className='album-fold-button';
    const rowsId='album-tracks-'+visited.size;
    foldButton.setAttribute('aria-controls',rowsId);
    header.append(foldButton);
    section.append(header);
    const rows=document.createElement('div');rows.className='album-tracks';rows.id=rowsId;
    updateAlbumFold(section,rows,foldButton,collapsed);
    foldButton.onclick=()=>{
      const next=!section.classList.contains('album-collapsed');
      if(next)collapsedAlbums.add(foldKey);else collapsedAlbums.delete(foldKey);
      saveCollapsedAlbums();
      updateAlbumFold(section,rows,foldButton,next);
      updateAlbumFoldAll();
    };
    playable.forEach(item=>appendPlayable(item.track,item.index,rows));
    catalog.forEach(item=>appendUnavailable(item.track,rows));
    section.append(rows);list.append(section);
  }
  updateAlbumFoldAll();
}
function favorite(t){if(!t)return;if(t.source==='LOCAL'){show('Local files cannot be saved as persistent favorites.');return}S.favorites=S.favorites.some(x=>x.id===t.id)?S.favorites.filter(x=>x.id!==t.id):[...S.favorites,t];window.ArtistWaveCloud?.persistGuestFavorites(S.favorites);window.ArtistWaveCloud?.changed();render();updatePlayer()}
function clearPlaybackRecovery(){
  clearTimeout(S.bufferTimer);S.bufferTimer=null;
  S.playbackToken=(S.playbackToken||0)+1;
  S.activeSource=null;S.playCandidates=[];S.playCandidateIndex=0;
}
function permittedTrackSources(track){
  return trackSources(track).filter(t=>
    t.source==='LOCAL'?sourceMode()!=='online':sourceMode()!=='local'&&providerEnabled(t.source.toLowerCase())
  );
}
function queueBufferCheck(token){
  clearTimeout(S.bufferTimer);
  S.bufferTimer=setTimeout(()=>{
    if(token===S.playbackToken&&!audio.paused&&audio.readyState<3)tryNextSource(token);
  },14000);
}
function startPlaybackSource(token){
  if(token!==S.playbackToken)return;
  const source=S.playCandidates[S.playCandidateIndex];
  if(!source)return;
  S.activeSource=source;
  audio.src=source.url;
  updatePlayer();
  queueBufferCheck(token);
  try{
    const result=audio.play();
    if(result&&typeof result.catch==='function')
      result.catch(()=>{if(token===S.playbackToken)tryNextSource(token)});
  }catch{tryNextSource(token)}
}
function tryNextSource(token=S.playbackToken){
  if(token!==S.playbackToken)return false;
  clearTimeout(S.bufferTimer);S.bufferTimer=null;
  if(S.playCandidateIndex+1<S.playCandidates.length){
    const previous=S.activeSource;
    S.playCandidateIndex++;
    const nextSource=S.playCandidates[S.playCandidateIndex];
    show('Audio unavailable from '+(previous?.source||'this provider')+
      '. Trying '+nextSource.source+' for '+current().title+'…');
    startPlaybackSource(token);
    return true;
  }
  // Avoid endless loops when no online provider can play this recording.
  const track=current();S.activeSource=null;
  audio.pause();audio.removeAttribute('src');clearPlaybackRecovery();
  show('Could not play '+(track?.title||'this track')+' from the available sources. Select another track.',true);
  updatePlayer();
  return false;
}
// Temporary queue: references only, never written to saved playlists or Drive.
function addToSmartQueue(track,front=false){
  if(!track?.title||!track?.url)return false;
  if(S.smartQueue.length>=100){$('smartQueueStatus').textContent='The queue is full (100 tracks).';return false}
  const item={...track};
  if(front)S.smartQueue.unshift(item);else S.smartQueue.push(item);
  $('smartQueueStatus').textContent=(front?'Playing next: ':'Added to queue: ')+item.title;
  renderSmartQueue();
  return true;
}
function renderSmartQueue(){
  const list=$('smartQueueList');list.replaceChildren();
  $('smartQueueCount').textContent=String(S.smartQueue.length);
  $('smartQueueClear').disabled=!S.smartQueue.length;
  if(!S.smartQueue.length){
    const empty=document.createElement('p');empty.className='smart-queue-empty';
    empty.textContent='Your queue is empty. Use ↳ Next or ☷ beside any track to add songs without changing your playlists.';
    list.append(empty);return;
  }
  S.smartQueue.forEach((t,i)=>{
    const row=document.createElement('div');row.className='smart-queue-track';
    const order=document.createElement('span');order.className='smart-queue-order';order.textContent=String(i+1).padStart(2,'0');
    const info=document.createElement('div');info.className='smart-queue-track-info';
    const title=document.createElement('strong');title.textContent=t.title;
    const artist=document.createElement('span');artist.textContent=t.artist||'Unknown artist';
    info.append(title,artist);
    const controls=document.createElement('div');controls.className='smart-queue-actions';
    function action(label,description,fn,disabled=false){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.setAttribute('aria-label',description+' '+t.title);button.title=description;button.disabled=disabled;
      button.onclick=fn;controls.append(button);
    }
    action('▶','Play now',()=>playQueuedAt(i));
    action('↑','Move up',()=>moveSmartQueue(i,-1),i===0);
    action('↓','Move down',()=>moveSmartQueue(i,1),i===S.smartQueue.length-1);
    action('×','Remove',()=>{S.smartQueue.splice(i,1);renderSmartQueue()});
    row.append(order,info,controls);list.append(row);
  });
}
function moveSmartQueue(i,direction){
  const nextIndex=i+direction;
  if(i<0||nextIndex<0||nextIndex>=S.smartQueue.length)return false;
  [S.smartQueue[i],S.smartQueue[nextIndex]]=[S.smartQueue[nextIndex],S.smartQueue[i]];
  renderSmartQueue();return true;
}
function playQueuedAt(index=0){
  if(index<0||index>=S.smartQueue.length)return false;
  if(!S.smartOnDeck)S.smartOrigin={track:current(),index:S.selected};
  const [track]=S.smartQueue.splice(index,1);
  let i=S.tracks.findIndex(t=>trackKey(t)===trackKey(track)&&t.url===track.url);
  if(i<0){S.tracks.push(track);i=S.tracks.length-1}
  S.smartOnDeck=true;
  playAt(i,{queued:true});
  renderSmartQueue();
  return true;
}
function resumeSmartQueue(){
  if(!S.smartOnDeck)return false;
  S.smartOnDeck=false;
  const origin=S.smartOrigin;S.smartOrigin=null;
  if(!origin)return false;
  let index=S.tracks.findIndex(t=>t===origin.track);
  if(index<0)index=S.tracks.findIndex(t=>origin.track&&trackKey(t)===trackKey(origin.track));
  if(index<0)index=origin.index;
  if(index<0||index>=S.tracks.length-1)return false;
  playAt(index+1);
  return true;
}
function setSmartQueueOpen(open){
  $('smartQueuePanel').hidden=!open;
  $('smartQueueToggle').setAttribute('aria-expanded',String(open));
  $('smartQueueToggle').classList.toggle('active',open);
}
function playAt(i,{keepAlbum=false,queued=false}={}){
  if(i<0||i>=S.tracks.length)return;
  if(!keepAlbum)clearAlbumQueue();
  if(!queued){S.smartOnDeck=false;S.smartOrigin=null}
  clearPlaybackRecovery();
  S.selected=i;
  S.playCandidates=permittedTrackSources(current());
  S.playCandidateIndex=0;
  if(!S.playCandidates.length){
    show('No enabled playable source for '+current().title+'. Check source settings.',true);
    updatePlayer();render();return;
  }
  const token=S.playbackToken;
  startPlaybackSource(token);
  render();updatePlayer();
}
function next(direction=1){
  if(direction>0&&S.smartQueue.length)return playQueuedAt(0);
  if(direction>0&&S.smartOnDeck)return resumeSmartQueue();
  if(!S.tracks.length)return;
  if(S.albumQueue.length)return nextAlbumTrack(direction);
  const i=S.shuffle?Math.floor(Math.random()*S.tracks.length):(S.selected+direction+S.tracks.length)%S.tracks.length;
  playAt(i);
}
const getJSON=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Service returned '+r.status);return r.json()};
// Match artwork stays pinned to the MusicBrainz artist ID or Archive identifier.
// Successful choices are remembered in this browser across searches and reloads.
const ART_KEY='artistwave:match-art:v1';
let pinnedArt={};
try{pinnedArt=JSON.parse(localStorage.getItem(ART_KEY)||'{}')||{}}catch{pinnedArt={}}
const artIdentity=(kind,id)=>kind+':'+id;
const pinArt=(key,url)=>{if(!key||!url)return;pinnedArt[key]=url;try{localStorage.setItem(ART_KEY,JSON.stringify(pinnedArt))}catch{}};
const imageValid=url=>new Promise(resolve=>{
  const test=new Image();let finished=false;
  const finish=ok=>{if(finished)return;finished=true;clearTimeout(timer);test.onload=null;test.onerror=null;resolve(ok)};
  const timer=setTimeout(()=>finish(false),6500);
  test.onload=()=>finish(test.naturalWidth>1&&test.naturalHeight>1);
  test.onerror=()=>finish(false);test.referrerPolicy='no-referrer';test.src=url;
});
async function lookupArtistArt(mbid){
  if(!mbid)return null;
  // A photo/logo linked to this exact MusicBrainz ID is preferable.
  try{
    const artist=await getJSON('https://musicbrainz.org/ws/2/artist/'+encodeURIComponent(mbid)+'?inc=url-rels&fmt=json');
    const link=(artist.relations||[]).find(r=>r.type==='wikidata'&&/Q\d+/.test(r.url?.resource||''));
    const qid=link?.url?.resource?.match(/Q\d+/)?.[0];
    if(qid){
      const data=await getJSON('https://www.wikidata.org/w/api.php?action=wbgetentities&ids='+qid+'&props=claims&format=json&origin=*');
      const claims=data.entities?.[qid]?.claims||{};
      for(const prop of ['P18','P154']){
        const filename=claims[prop]?.[0]?.mainsnak?.datavalue?.value;
        if(typeof filename==='string'){
          const url='https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(filename)+'?width=400';
          if(await imageValid(url))return url;
        }
      }
    }
  }catch{}
  // An actual release by the same artist is a useful visual fallback.
  try{
    const result=await getJSON('https://musicbrainz.org/ws/2/release-group/?artist='+encodeURIComponent(mbid)+'&type=album&limit=8&fmt=json');
    for(const item of (result['release-groups']||[]).slice(0,6)){
      if(!item.id)continue;
      const url='https://coverartarchive.org/release-group/'+encodeURIComponent(item.id)+'/front-250';
      if(await imageValid(url))return url;
    }
  }catch{}
  return null;
}
// Serializes artist lookups to avoid hammering the public MusicBrainz API.
let artistArtQueue=Promise.resolve();
function queueArtistArt(key,mbid,showImage){
  artistArtQueue=artistArtQueue.catch(()=>{}).then(async()=>{
    if(pinnedArt[key]){showImage(pinnedArt[key]);return}
    const url=await lookupArtistArt(mbid);
    if(url){pinArt(key,url);showImage(url)}
    await new Promise(resolve=>setTimeout(resolve,1100));
  });
}
function sourceChoice(label,sub,onClick,kind='artist',id=''){
  // The entire selection card is one button. Artwork editing is a sibling,
  // never a clickable element nested inside the selection button.
  const holder=document.createElement('div');holder.className='match-item';
  const b=document.createElement('button');b.type='button';b.className='match-card';
  b.setAttribute('aria-label','Select '+label+' and search recordings');
  const art=document.createElement('span');art.className='match-art';
  const placeholder=document.createElement('span');placeholder.className='match-art-fallback';
  placeholder.textContent=kind==='item'?'♫':String(label||'?').trim().slice(0,1).toUpperCase();
  art.append(placeholder);
  const words=document.createElement('span');words.className='match-copy';
  const name=document.createElement('strong');name.textContent=label;
  const detail=document.createElement('small');detail.textContent=sub;
  words.append(name,detail);b.append(art,words);
  const key=artIdentity(kind,id||label);
  const showImage=url=>{
    if(!holder.isConnected)return;
    const img=document.createElement('img');
    img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
    img.onload=()=>{if(img.naturalWidth>1){placeholder.hidden=true;art.classList.add('has-image')}else{img.remove()}};
    img.onerror=()=>{img.remove();placeholder.hidden=false;art.classList.remove('has-image')};
    art.querySelector('img')?.remove();img.src=url;art.append(img);
  };
  art.dataset.artKey=key;
  const edit=document.createElement('button');edit.type='button';edit.className='match-edit';
  edit.textContent='✎';edit.title='Change picture for '+label;
  edit.setAttribute('aria-label','Change picture for '+label);
  edit.onclick=()=>openArtworkEditor({key,label,kind,id,showImage});
  b.onclick=()=>{
    document.querySelectorAll('.match-card.selected').forEach(card=>card.classList.remove('selected'));
    b.classList.add('selected');
    onClick();
    $('playlistSection').scrollIntoView({behavior:'smooth',block:'start'});
  };
  holder.append(b,edit);
  if(pinnedArt[key])showImage(pinnedArt[key]);
  else if(kind==='item'&&id){
    const url='https://archive.org/services/img/'+encodeURIComponent(id);
    imageValid(url).then(ok=>{if(ok&&!pinnedArt[key]){pinArt(key,url);showImage(url)}});
  }else if(kind==='artist'&&id&&/^[0-9a-f-]{36}$/i.test(id)){
    queueArtistArt(key,id,showImage);
  }
  return holder;
}
async function searchMatches(term){if(sourceMode()==='local'){await chooseArtist(term,null);return}const matchRequest=++S.matchRequest;S.requestId++;S.loading=false;S.unavailable=[];S.catalogRequest++;S.catalogResolved=false;S.catalogLoading=false;S.artistMbid=null;clearAlbumQueue();S.artist=term;S.archiveItemView=false;S.onlineTracks=[];S.page=0;S.tracks=[];S.selected=-1;S.view='discover';audio.pause();audio.removeAttribute('src');clearPlaybackRecovery();$('matchPanel').hidden=false;$('matchHeading').textContent='Matches for “'+term+'”';$('matchSummary').textContent='Choose the artist or recording you meant';$('matchList').replaceChildren();show('Finding artists and other matching recordings…');render();let list=$('matchList');let count=0;
try{const data=await getJSON('https://musicbrainz.org/ws/2/artist/?query='+encodeURIComponent('artist:"'+term+'"')+'&fmt=json&limit=15');if(matchRequest!==S.matchRequest)return;for(const artist of (data.artists||[])){const name=artist.name||'';let detail=[artist.type,artist.country,artist.disambiguation].filter(Boolean).join(' · ')||'MusicBrainz artist';list.append(sourceChoice(name,detail,()=>chooseArtist(name,artist.id),'artist',artist.id));count++}}catch(e){if(matchRequest!==S.matchRequest)return;show('MusicBrainz artist lookup was unavailable; showing Archive matches where possible.',true)}
try{const query='mediatype:audio AND ('+'title:('+term+') OR creator:('+term+'))';const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(query)+'&fl[]=identifier&fl[]=title&fl[]=creator&rows=12&page=1&output=json';const data=await getJSON(url);if(matchRequest!==S.matchRequest)return;for(const d of data.response?.docs||[]){const name=Array.isArray(d.title)?d.title[0]:d.title;const creator=Array.isArray(d.creator)?d.creator.join(', '):d.creator||'Unknown creator';list.append(sourceChoice(name||d.identifier,'Internet Archive recording · '+creator,()=>chooseArchiveItem(d),'item',d.identifier));count++}}catch(e){if(matchRequest!==S.matchRequest)return;if(!count)show('The online search services are unavailable. You can still add local audio files.',true)}
if(!count){list.append(sourceChoice('Search Internet Archive for '+term,'Try an exact creator search',()=>chooseArtist(term,null)))}else show('Choose a matching artist or recording above to build your playlist.')}
async function chooseArtist(name,mbid){window.ArtistWaveStudio?.close();const selection=++S.matchRequest;S.requestId++;S.loading=false;audio.pause();audio.removeAttribute('src');clearAlbumQueue();S.artist=name;S.archiveItemView=false;S.providerChecked={};S.providerBusy={};S.providerErrors={};S.artistMbid=mbid||null;S.unavailable=[];S.catalogResolved=false;S.catalogLoading=false;S.catalogRequest++;S.page=0;S.tracks=[];S.onlineTracks=[];S.selected=-1;S.view='discover';$('matchList').querySelectorAll('button').forEach(x=>x.classList.remove('selected'));$('playlistHeading').textContent=name;$('externalSearch').hidden=false;$('externalSearch').href='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' music');$('externalSearch').textContent='Search '+name+' on YouTube ↗';show(sourceMode()==='local'?'Searching your local music for '+name+'…':'Searching publicly available recordings attributed to '+name+'…');rebuildPlaylist();if(sourceMode()!=='local')await loadOnlineProviders(name,selection);else show(S.tracks.length+' local track(s) found for '+name+'.');if(selection===S.matchRequest&&sourceMode()!=='local'&&$('showUnavailable').checked)await loadUnavailable()}
async function chooseArchiveItem(d){S.matchRequest++;const request=++S.requestId;S.loading=false;audio.pause();audio.removeAttribute('src');clearPlaybackRecovery();S.catalogRequest++;S.catalogResolved=false;S.catalogLoading=false;S.unavailable=[];clearAlbumQueue();S.archiveItemView=true;S.artistMbid=null;const name=Array.isArray(d.title)?d.title[0]:d.title||d.identifier;S.artist=Array.isArray(d.creator)?d.creator[0]:d.creator||name;S.page=0;S.selected=-1;S.tracks=[];S.onlineTracks=[];updatePlayer();$('playlistHeading').textContent=name;$('externalSearch').hidden=true;show('Loading recording: '+name);try{const tracks=await tracksFromItem(d.identifier,S.artist);if(request!==S.requestId)return;S.onlineTracks=dedupeTracks(tracks);rebuildPlaylist();show(S.tracks.length+' unique playable tracks found in this item.')}catch(e){if(request===S.requestId)show('Unable to load the selected recording: '+e.message,true)}if(request===S.requestId)$('loadMore').hidden=true}
async function tracksFromItem(id,artist){
  const m=await getJSON('https://archive.org/metadata/'+encodeURIComponent(id));
  const files=(m.files||[]).filter(f=>/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i.test(f.name||'')&&!/(_meta|__ia_thumb|spectrogram)/i.test(f.name||''));
  const val=x=>Array.isArray(x)?String(x[0]||'').trim():String(x||'').trim();
  const itemAlbum=val(m.metadata?.album);
  const itemTitle=val(m.metadata?.title)||id;
  const itemYear=extractYear(m.metadata?.year||m.metadata?.date);
  return files.slice(0,70).map(f=>{
    const album=val(f.album)||itemAlbum;
    return {
      id:id+'/'+f.name,
      title:(val(f.title)||f.name.split('/').pop()).replace(/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i,'').replace(/^\d+[-._ ]+/,'').replace(/_/g,' '),
      artist,collection:album||itemTitle,albumKind:album?'album':'collection',artwork:'https://archive.org/services/img/'+encodeURIComponent(id),
      year:extractYear(f.year||f.date)||itemYear,source:'ARCHIVE',
      url:'https://archive.org/download/'+encodeURIComponent(id)+'/'+f.name.split('/').map(encodeURIComponent).join('/')
    };
  });
}
async function loadMore(){
  if(S.loading||!S.artist||sourceMode()==='local'||!providerEnabled('archive'))return;
  const request=++S.requestId,artist=S.artist;
  delete S.providerErrors.archive;
  S.loading=true;$('loadMore').hidden=true;
  const page=++S.page;
  try{
    let q='mediatype:audio AND creator:("'+artist.replace(/"/g,'')+'")';
    if(!$('includeLive').checked)q+=' AND NOT collection:etree';
    const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(q)+'&fl[]=identifier&fl[]=title&fl[]=creator&rows=30&page='+page+'&output=json';
    const result=await getJSON(url);
    if(request!==S.requestId)return;
    const docs=(result.response?.docs||[]).filter(d=>creatorMatches(d.creator,artist));
    const found=[];
    for(const d of docs.slice(0,15)){
      if(request!==S.requestId)return;
      try{found.push(...await tracksFromItem(d.identifier,artist))}catch{}
    }
    if(request!==S.requestId)return;
    S.onlineTracks=dedupeTracks([...S.onlineTracks,...found]);
    S.providerChecked.archive=true;
    rebuildPlaylist();
    $('loadMore').hidden=page*30>=(result.response?.numFound||0);
    refreshProviderStatus();
    render();
  }catch(e){if(request===S.requestId){S.page=Math.max(0,S.page-1);S.providerErrors.archive=e.message;refreshProviderStatus()}}
  finally{if(request===S.requestId)S.loading=false}
}

// Browse the MusicBrainz recording catalog only when requested. These are title
// references, NOT audio files, and cannot establish absence from every service.
async function loadUnavailable(){
  if(!$('showUnavailable').checked||sourceMode()==='local'||!S.artist||S.catalogLoading||S.catalogResolved||S.view==='favorites')return;
  const request=++S.catalogRequest,artistName=S.artist;
  S.catalogLoading=true;
  show('Looking up credited song titles for '+artistName+'…');render();
  try{
    let artistId=S.artistMbid;
    if(!artistId){
      const result=await getJSON('https://musicbrainz.org/ws/2/artist/?'+new URLSearchParams({query:'artist:"'+artistName.replace(/"/g,'')+'"',fmt:'json',limit:'12'}));
      if(request!==S.catalogRequest)return;
      // No false artist match: only use a unique exact-name identity.
      const candidates=(result.artists||[]).filter(a=>norm(a.name)===norm(artistName));
      if(candidates.length!==1){
        show('Choose a specific artist from search results to see catalog-only titles. Multiple artists share this name.',true);
        S.catalogResolved=true;return;
      }
      artistId=candidates[0].id;
      S.artistMbid=artistId;
    }
    // MusicBrainz browse: 100 recordings from this exact artist identity.
    const uri='https://musicbrainz.org/ws/2/recording/?'+new URLSearchParams({artist:artistId,fmt:'json',limit:'100',inc:'artist-credits'});
    const data=await getJSON(uri);
    if(request!==S.catalogRequest)return;
    const used=new Set();
    S.unavailable=(data.recordings||[]).filter(recording=>{
      const credit=(recording['artist-credit']||[]).filter(x=>x&&typeof x==='object').map(x=>x.artist?.id);
      // Do not add recordings solely credited to another performer.
      return Boolean(recording.title)&&(!credit.length||credit.includes(artistId));
    }).map(rec=>({
      id:'catalog:'+rec.id,title:rec.title,artist:artistName,source:'CATALOG'
    })).filter(t=>{
      const key=norm(t.title);if(!key||used.has(key))return false;used.add(key);
      return !S.tracks.some(p=>trackKey(p)===trackKey(t));
    });
    S.catalogResolved=true;
    show(S.tracks.length+' playable file(s) found; '+S.unavailable.length+' additional catalog title(s) without a matching playable file. Lyrics links open external search results.');
  }catch(err){
    if(request===S.catalogRequest)show('Could not load catalog-only titles: '+err.message,true);
  }finally{if(request===S.catalogRequest){S.catalogLoading=false;render()}}
}
$('showUnavailable').addEventListener('change',()=>{
  window.ArtistWaveCloud?.changed();
  if($('showUnavailable').checked)loadUnavailable();else{S.catalogRequest++;S.catalogLoading=false;render();}
});

$('searchForm').addEventListener('submit',e=>{e.preventDefault();const term=$('artistInput').value.trim();if(term)searchMatches(term)});
$('loadMore').onclick=loadMore;
$('playButton').onclick=()=>{if(!audio.src&&S.tracks.length){playAt(0);return}audio.paused?audio.play().catch(()=>{}):audio.pause()};
$('nextButton').onclick=()=>next(1);$('previousButton').onclick=()=>next(-1);
$('smartQueueToggle').addEventListener('click',()=>setSmartQueueOpen($('smartQueuePanel').hidden));
$('smartQueueClose').addEventListener('click',()=>setSmartQueueOpen(false));
$('smartQueueClear').addEventListener('click',()=>{
  S.smartQueue=[];renderSmartQueue();
  $('smartQueueStatus').textContent='Upcoming queue cleared. The current song keeps playing.';
});
$('albumFoldAll').addEventListener('click',toggleAllAlbums);
$('shuffleButton').onclick=()=>{clearAlbumQueue();S.shuffle=!S.shuffle;$('shuffleButton').classList.toggle('active',S.shuffle)};
$('shuffleAll').onclick=()=>{clearAlbumQueue();S.shuffle=true;$('shuffleButton').classList.add('active');next(1)};
$('repeatButton').onclick=()=>{S.repeat=(S.repeat+1)%3;$('repeatButton').title=['Repeat: off','Repeat: all','Repeat: one'][S.repeat];$('repeatButton').classList.toggle('active',S.repeat>0)};
$('favoriteCurrent').onclick=()=>favorite(current());
$('volumeBar').oninput=e=>audio.volume=Number(e.target.value)/100;audio.volume=.75;
$('seekBar').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(e.target.value)/1000};
audio.ontimeupdate=()=>{$('currentTime').textContent=time(audio.currentTime);$('duration').textContent=time(audio.duration);$('seekBar').value=Number.isFinite(audio.duration)&&audio.duration?Math.round(audio.currentTime/audio.duration*1000):0};
$('includeLive').addEventListener('change',()=>window.ArtistWaveCloud?.changed());
audio.onplay=updatePlayer;
audio.onplaying=()=>{clearTimeout(S.bufferTimer);S.bufferTimer=null;if(current())rememberPlayedTrack(current());updatePlayer()};
audio.onpause=()=>{clearTimeout(S.bufferTimer);S.bufferTimer=null;updatePlayer()};
audio.onerror=()=>{if(S.playCandidates.length)tryNextSource()};
audio.onwaiting=()=>{if(S.playCandidates.length&&!audio.paused)queueBufferCheck(S.playbackToken)};
audio.onstalled=()=>{if(S.playCandidates.length&&!audio.paused)queueBufferCheck(S.playbackToken)};audio.onended=()=>{if(S.repeat===2){audio.currentTime=0;audio.play().catch(()=>{})}else if(S.smartQueue.length||S.smartOnDeck){if(!next(1))updatePlayer()}else if(S.albumQueue.length){if(!nextAlbumTrack(1))updatePlayer()}else if(S.repeat===1||S.selected<S.tracks.length-1)next(1);else updatePlayer()};
$('albumJumpSelect').addEventListener('change',event=>{
  const target=document.getElementById(event.target.value);
  if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
});
$('recentNav').onclick=()=>{
  window.ArtistWaveStudio?.close();clearAlbumQueue();S.view='recent';
  $('locationName').textContent='Recently Played';
  $('playlistHeading').textContent='Recently played';
  render();$('playlistSection').scrollIntoView({behavior:'smooth',block:'start'});
};
$('discoverNav').onclick=()=>{window.ArtistWaveStudio?.close();clearAlbumQueue();S.view='discover';$('locationName').textContent='Discover';render()};
$('favoritesNav').onclick=()=>{window.ArtistWaveStudio?.close();clearAlbumQueue();S.view='favorites';$('locationName').textContent='Favorites';$('playlistHeading').textContent='Your favorites';render()};
$('clearList').onclick=()=>{clearAlbumQueue();if(S.view==='recent'){S.recent=[];window.ArtistWaveCloud?.persistGuestRecent([]);window.ArtistWaveCloud?.changed()}else if(S.view==='favorites'){S.favorites=[];window.ArtistWaveCloud?.persistGuestFavorites(S.favorites);window.ArtistWaveCloud?.changed()}else{clearPlaybackRecovery();S.tracks=[];S.onlineTracks=[];S.unavailable=[];S.catalogResolved=false;S.catalogLoading=false;S.catalogRequest++;S.selected=-1;audio.pause();audio.removeAttribute('src')}render();updatePlayer()};
$('addFolderNav').onclick=chooseLocalFolder;
$('reopenFolderNav').onclick=reopenSavedFolder;
$('forgetFolderNav').onclick=async()=>{
  await savedFolderHandle(null);cachedFolderHandle=null;updateSavedFolderUI();
  $('folderSummary').textContent=S.local.length+' local track(s) indexed this session';
  show('Saved folder access forgotten. Existing indexed files remain until you reload.');
};
$('folderInput').addEventListener('change',async event=>{const files=Array.from(event.target.files||[]);event.target.value='';await importLocalFiles(files,{folder:true})});
$('sourceMode').addEventListener('change',()=>{
  window.ArtistWaveCloud?.changed();
  rebuildPlaylist();
  if(sourceMode()==='local'){$('loadMore').hidden=true;show(S.tracks.length+' local track(s) available for '+(S.artist||'your collection')+'.');return}
  if(S.artist&&!S.archiveItemView)loadOnlineProviders(S.artist,S.matchRequest);
  else show('Showing '+(sourceMode()==='online'?'online':'local and online')+' music.');
});

// Provider selection is saved locally per browser; Jamendo needs the user's own
// read-only application client ID. No API secret is stored or shipped with the site.
try{
  for(const provider of ['archive','audius','jamendo']){
    const saved=localStorage.getItem('artistwave:provider:'+provider);
    if(saved!==null)$(onlineProviderIds[provider]).checked=saved==='true';
  }
  $('jamendoClientId').value=localStorage.getItem('artistwave:jamendo-client-id')||'';
}catch{}
for(const provider of ['archive','audius','jamendo']){
  $(onlineProviderIds[provider]).addEventListener('change',()=>{
    window.ArtistWaveCloud?.persistGuestSetting('artistwave:provider:'+provider,String($(onlineProviderIds[provider]).checked));window.ArtistWaveCloud?.changed();
    if(provider==='archive'&&$('providerArchive').checked&&S.artist&&S.page===0)S.providerChecked.archive=false;
    handleOnlineProviderChange();
  });
}
$('saveJamendoId').addEventListener('click',()=>{
  const id=jamendoClientId();
  if(id&&!/^[a-z0-9_-]{6,80}$/i.test(id)){
    show('Jamendo client ID has an invalid format. Check the ID from Jamendo Developer Portal.',true);
    return;
  }
  try{if(id)localStorage.setItem('artistwave:jamendo-client-id',id);else localStorage.removeItem('artistwave:jamendo-client-id')}catch{}
  $('providerJamendo').checked=Boolean(id);
  window.ArtistWaveCloud?.persistGuestSetting('artistwave:provider:jamendo',String(Boolean(id)));window.ArtistWaveCloud?.changed();
  S.providerChecked.jamendo=false;
  delete S.providerErrors.jamendo;
  show(id?'Jamendo client ID saved in this browser.':'Jamendo client ID cleared.');
  handleOnlineProviderChange();
});

$('fileDrop').onclick=()=>$('fileInput').click();$('fileDrop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}};
$('fileDrop').ondragover=e=>{e.preventDefault();$('fileDrop').classList.add('dragover')};$('fileDrop').ondragleave=()=>$('fileDrop').classList.remove('dragover');
$('fileDrop').ondrop=async e=>{e.preventDefault();$('fileDrop').classList.remove('dragover');await importLocalFiles(e.dataTransfer.files)};
$('fileInput').onchange=async e=>{const files=Array.from(e.target.files||[]);e.target.value='';await importLocalFiles(files)};


// Curated decade guide. Ordering is editorial, not a claim of exact chart rank.
// The same artist may appear in more than one era when their career spans decades.
const RAP_ERAS={
  "80s":[
    ["Run-D.M.C.","Pioneers of mainstream hip-hop"],
    ["Public Enemy","Political hip-hop"],
    ["LL Cool J","Solo rap breakthrough"],
    ["Eric B. & Rakim","Lyricism and golden-age production"],
    ["N.W.A","West Coast gangsta rap"],
    ["Salt-N-Pepa","Rap trio"],
    ["Boogie Down Productions","Bronx hip-hop"],
    ["Slick Rick","Storytelling rap"],
    ["EPMD","East Coast duo"],
    ["MC Lyte","Golden-age MC"],
    ["Too $hort","Oakland rap"],
    ["Geto Boys","Houston rap"]
  ],
  "90s":[
    ["2Pac","West Coast icon · 1990s"],
    ["The Notorious B.I.G.","Biggie Smalls · East Coast icon"],
    ["Dr. Dre","G-funk producer and MC"],
    ["Snoop Dogg","West Coast G-funk"],
    ["Nas","New York lyricist"],
    ["Wu-Tang Clan","Staten Island collective"],
    ["Ice Cube","West Coast solo career"],
    ["A Tribe Called Quest","Jazz rap"],
    ["OutKast","Southern hip-hop"],
    ["Mobb Deep","Queensbridge duo"],
    ["Compton's Most Wanted","West Coast underground"],
    ["South Central Cartel","Los Angeles rap collective"],
    ["Above the Law","Pomona G-funk"],
    ["DJ Quik","Compton producer and MC"],
    ["Gang Starr","East Coast jazz rap"],
    ["Bone Thugs-n-Harmony","Cleveland melodic rap"],
    ["Scarface","Southern rap"],
    ["Geto Boys","Houston group"],
    ["The Pharcyde","Alternative hip-hop"],
    ["Jeru the Damaja","Brooklyn underground"]
  ],
  "2000s":[
    ["Eminem","Major-label breakout"],
    ["Jay-Z","East Coast rap"],
    ["50 Cent","New York rap"],
    ["Kanye West","Chicago producer and rapper"],
    ["Lil Wayne","New Orleans rap"],
    ["OutKast","Southern hip-hop"],
    ["Missy Elliott","Virginia rap"],
    ["Ludacris","Atlanta rap"],
    ["The Game","West Coast rap"],
    ["MF DOOM","Underground alternative rap"],
    ["Talib Kweli","Conscious hip-hop"],
    ["Clipse","Virginia duo"],
    ["Tech N9ne","Independent rap"]
  ],
  "2010s":[
    ["Kendrick Lamar","Compton lyricist"],
    ["J. Cole","North Carolina rapper"],
    ["Drake","Toronto rap"],
    ["Nicki Minaj","New York rapper"],
    ["Future","Atlanta trap"],
    ["Travis Scott","Houston rapper"],
    ["Tyler, the Creator","Alternative hip-hop"],
    ["A$AP Rocky","Harlem rapper"],
    ["Run the Jewels","Rap duo"],
    ["Denzel Curry","Florida rapper"],
    ["Little Simz","UK hip-hop"]
  ],
  "2020s":[
    ["Kendrick Lamar","Continued prominence"],
    ["J. Cole","Continued prominence"],
    ["Little Simz","UK hip-hop"],
    ["JID","Atlanta lyricist"],
    ["Denzel Curry","Florida rapper"],
    ["Doechii","Tampa rapper"],
    ["Tyler, the Creator","Alternative hip-hop"],
    ["GloRilla","Memphis rapper"],
    ["Baby Keem","Contemporary hip-hop"],
    ["Central Cee","UK rap"]
  ]
};

const artistRows=s=>s.split(';').map(row=>row.trim()).filter(Boolean).map(row=>{const [name,note='Explore this artist']=row.split('|');return[name.trim(),note.trim()]});
// A curated introduction, not a claim about chart rankings or musical exclusivity.
// Periods follow each genre's history. Artists intentionally recur across eras.
const MUSIC_GENRES=[
{name:'Jazz',icon:'🎷',flat:true,sections:[{name:'Jazz movements',eras:{
'Early Jazz / New Orleans':artistRows("Louis Armstrong|Early jazz and New Orleans;Jelly Roll Morton|Pianist and composer;Sidney Bechet|Soprano saxophone pioneer;King Oliver|Early jazz bandleader;Bessie Smith|Blues and early jazz;Kid Ory|New Orleans trombone"),
'Swing & Big Band':artistRows("Duke Ellington|Composer and big band;Count Basie|Kansas City swing;Benny Goodman|Swing-era clarinet;Ella Fitzgerald|Jazz and swing vocals;Billie Holiday|Swing-era jazz singer;Artie Shaw|Swing clarinet;Mary Lou Williams|Pianist and arranger;Chick Webb|Harlem big band"),
'Bebop':artistRows("Charlie Parker|Bebop saxophone;Dizzy Gillespie|Bebop and Afro-Cuban jazz;Thelonious Monk|Modern jazz piano;Bud Powell|Bebop piano;Max Roach|Bebop drumming;Fats Navarro|Bebop trumpet"),
'Cool Jazz & West Coast':artistRows("Miles Davis|Birth of the Cool;Chet Baker|Cool trumpet and vocals;Gerry Mulligan|Baritone saxophone;Dave Brubeck|Cool jazz quartet;Paul Desmond|Alto saxophone;Lee Konitz|Cool-school saxophone"),
'Hard Bop & Soul Jazz':artistRows("Art Blakey|Hard-bop drumming;Horace Silver|Gospel-influenced jazz;Sonny Rollins|Hard-bop saxophone;Clifford Brown|Hard-bop trumpet;Cannonball Adderley|Soul jazz;Lee Morgan|Hard-bop trumpet;Grant Green|Jazz guitar"),
'Modal & Spiritual Jazz':artistRows("Miles Davis|Modal jazz;John Coltrane|Modal and spiritual jazz;McCoy Tyner|Modal-era piano;Pharoah Sanders|Spiritual jazz;Alice Coltrane|Spiritual harp and piano;Yusef Lateef|Global musical influences;Sun Ra|Afrofuturist jazz"),
'Fusion & Jazz-Funk':artistRows("Miles Davis|Electric jazz;Herbie Hancock|Jazz-funk and fusion;Weather Report|Fusion ensemble;Chick Corea|Return to Forever;Mahavishnu Orchestra|Jazz-rock;Billy Cobham|Fusion drums;George Duke|Jazz-funk"),
'Contemporary & Nu-Jazz':artistRows("Robert Glasper|Jazz and hip-hop crossover;Kamasi Washington|Contemporary spiritual jazz;Esperanza Spalding|Jazz bass and vocals;Nubya Garcia|UK jazz;Yussef Dayes|UK jazz drumming;BADBADNOTGOOD|Contemporary jazz;Hiromi|Jazz piano;Snarky Puppy|Jazz-funk"),
}}]},
{name:'Rock',icon:'🎸',flat:false,sections:[
{name:'Classic & Hard Rock',eras:{
'1960s Foundations':artistRows("The Rolling Stones|Blues rock;The Who|British rock;Jimi Hendrix|Electric guitar innovation;Led Zeppelin|Late-1960s heavy rock;Deep Purple|Hard-rock roots;Cream|Blues-rock trio"),
'1970s Arena & Shock Rock':artistRows("Led Zeppelin|Heavy blues rock;Queen|Theatrical rock;AC/DC|Hard rock;Aerosmith|American hard rock;Alice Cooper|Shock-rock performances;Kiss|Arena rock;Deep Purple|Hard rock;UFO|British hard rock"),
'1980s Hard Rock & Glam':artistRows("Guns N' Roses|Hard rock;Bon Jovi|Arena rock;Def Leppard|Melodic hard rock;Mötley Crüe|Glam metal;Alice Cooper|1980s solo career;Whitesnake|Hard rock;Scorpions|German hard rock;Europe|Melodic hard rock"),
'1990s Alternative & Revival':artistRows("Nirvana|Grunge;Pearl Jam|Alternative rock;Soundgarden|Grunge;Alice in Chains|Heavy grunge;Foo Fighters|Modern rock;Alice Cooper|1990s albums and touring;The Black Crowes|Roots rock"),
'2000s–Present':artistRows("Foo Fighters|Modern rock;Muse|Alternative rock;The White Stripes|Garage rock;Royal Blood|Modern hard rock;Greta Van Fleet|Classic rock influences;Alice Cooper|Continuing recordings and tours;Halestorm|Modern hard rock"),
}},
{name:'Heavy Metal',eras:{
'1970s Origins':artistRows("Black Sabbath|Foundational metal;Judas Priest|Early metal;Deep Purple|Hard rock and metal roots;Motörhead|Fast heavy rock;Rainbow|Hard rock and early metal;Blue Öyster Cult|Metal influence"),
'NWOBHM & 1980s':artistRows("Iron Maiden|New Wave of British Heavy Metal;Saxon|British heavy metal;Diamond Head|NWOBHM;Angel Witch|NWOBHM;Judas Priest|Classic heavy metal;Dio|Traditional metal;Accept|German heavy metal;Mercyful Fate|Dark heavy metal"),
'1990s–2000s':artistRows("Iron Maiden|Long-running heavy metal;Judas Priest|Continued releases;Pantera|Groove-metal crossover;Primal Fear|Traditional metal revival;Nevermore|Progressive heavy metal;HammerFall|Heavy and power metal"),
'2010s–Present':artistRows("Iron Maiden|Modern recordings;Judas Priest|Contemporary recordings;Enforcer|Traditional metal revival;Night Demon|US traditional metal;Haunt|Traditional metal;Eternal Champion|Epic metal"),
}},
{name:'Power Metal',eras:{
'1980s Roots':artistRows("Helloween|European power-metal origins;Manowar|Epic heavy metal;Savatage|US power metal roots;Jag Panzer|US power metal;Virgin Steele|Epic metal;Blind Guardian|Early power and speed metal"),
'1990s European Wave':artistRows("Blind Guardian|Fantasy-inspired power metal;Gamma Ray|European power metal;Stratovarius|Melodic power metal;Helloween|Power metal;Rhapsody of Fire|Symphonic power metal;Running Wild|Pirate-themed metal;Angra|Brazilian power metal"),
'2000s Symphonic & Epic':artistRows("Rhapsody of Fire|Symphonic power metal;DragonForce|Fast melodic metal;Nightwish|Symphonic crossover;Sonata Arctica|Melodic power metal;Kamelot|Symphonic metal;Sabaton|Historical power metal;Avantasia|Metal opera"),
'2010s–Present':artistRows("Sabaton|Modern power metal;Powerwolf|Theatrical power metal;Gloryhammer|Fantasy power metal;Beast in Black|Melodic power metal;Unleash the Archers|Canadian power metal;Brothers of Metal|Nordic-themed power metal;Blind Guardian|Continued power metal"),
}},
{name:'Death Metal',eras:{
'1980s Origins':artistRows("Death|Florida death metal;Possessed|Early death metal;Morbid Angel|Florida death metal;Obituary|Florida death metal;Autopsy|Early US death metal;Bolt Thrower|British death metal"),
'1990s Classic':artistRows("Death|Progressive death metal;Cannibal Corpse|American death metal;Deicide|Florida death metal;Entombed|Swedish death metal;Dismember|Swedish death metal;Suffocation|Brutal death metal;Immolation|New York death metal"),
'Melodic Death Metal':artistRows("At the Gates|Gothenburg melodic death;In Flames|Swedish melodic death;Dark Tranquillity|Melodic death;Carcass|Melodic death evolution;Arch Enemy|Melodic death;Amon Amarth|Melodic death;Insomnium|Finnish melodic death"),
'Technical & Progressive':artistRows("Death|Later technical albums;Cynic|Progressive death metal;Atheist|Technical death metal;Necrophagist|Technical death metal;Obscura|Technical death metal;Gorguts|Dissonant metal;Beyond Creation|Modern technical death"),
'Modern & Underground':artistRows("Blood Incantation|Progressive death metal;Tomb Mold|Canadian death metal;Gatecreeper|US death metal;Frozen Soul|Texas death metal;200 Stab Wounds|US death metal;Undeath|New York death metal;Horrendous|Progressive death metal"),
}},
]},
{name:'Rap',icon:'🎤',flat:true,sections:[{name:'Decades',eras:RAP_ERAS}]},
{name:'Reggae',icon:'🌴',flat:true,sections:[{name:'Styles & movements',eras:{
'Ska & Blue Beat':artistRows("The Skatalites|Jamaican ska pioneers;Prince Buster|Early Jamaican ska;Desmond Dekker|Ska and reggae;Toots and the Maytals|Ska and reggae;The Wailers|Early ska recordings;Derrick Morgan|Early Jamaican popular music"),
'Rocksteady':artistRows("Alton Ellis|Rocksteady pioneer;The Paragons|Rocksteady vocal group;The Techniques|Rocksteady harmonies;The Melodians|Early reggae;The Heptones|Harmony trio;Phyllis Dillon|Rocksteady vocals"),
'Roots Reggae':artistRows("Bob Marley & The Wailers|Roots reggae;Peter Tosh|Roots and social commentary;Bunny Wailer|Foundational roots reggae;Burning Spear|Rastafari roots;Culture|Conscious roots;Black Uhuru|Roots group;Third World|Reggae fusion;The Abyssinians|Spiritual roots"),
'Dub & Sound Systems':artistRows("King Tubby|Dub mixing pioneer;Lee 'Scratch' Perry|Producer and dub innovator;Scientist|Dub mixing;Augustus Pablo|Melodica dub;Mad Professor|UK dub producer;Prince Jammy|Digital and dub;Sly & Robbie|Reggae production"),
'Dancehall & Digital':artistRows("Yellowman|Early dancehall;Shabba Ranks|Dancehall deejay;Super Cat|Dancehall;Buju Banton|Dancehall and roots;Beenie Man|Dancehall;Bounty Killer|Dancehall;Sean Paul|Dancehall crossover;Shaggy|Reggae pop;Sister Nancy|Dancehall pioneer"),
'Reggae Revival & Global':artistRows("Chronixx|Reggae revival;Protoje|Contemporary reggae;Koffee|Contemporary reggae;Jesse Royal|Modern roots;Kabaka Pyramid|Reggae/hip-hop crossover;Lila Iké|Contemporary roots;Steel Pulse|UK reggae;UB40|British reggae pop"),
}}]},
{name:'Pop',icon:'🎶',flat:true,sections:[{name:'Pop generations',eras:{
'Classic Pop & Vocal':artistRows("ABBA|Swedish melodic pop;Elton John|Piano pop and songwriting;Billy Joel|Pop-rock ballads;Carpenters|Soft pop harmonies;Fleetwood Mac|Melodic pop rock;Stevie Wonder|Soulful pop;Cyndi Lauper|80s pop"),
'1980s–90s Pop':artistRows("Michael Jackson|Pop and dance;Madonna|Dance pop;Whitney Houston|Pop and soul;George Michael|Pop vocals;Mariah Carey|Pop and R&B;Janet Jackson|Dance pop;Spice Girls|90s pop group"),
'2000s–2010s Pop':artistRows("Beyoncé|Pop and R&B;Rihanna|Dance pop and R&B;Lady Gaga|Electronic pop;Katy Perry|Mainstream pop;Bruno Mars|Retro pop;Adele|Soulful pop ballads;P!nk|Pop rock"),
'Modern Pop':artistRows("Taylor Swift|Singer-songwriter pop;Dua Lipa|Dance pop;Billie Eilish|Alternative pop;Olivia Rodrigo|Pop rock;Sabrina Carpenter|Contemporary pop;Chappell Roan|Theatrical pop;Harry Styles|Soft rock pop;Lorde|Art pop"),
}}]},
{name:'R&B & Soul',icon:'💜',flat:true,sections:[{name:'Soulful sounds',eras:{
'Classic Soul & Motown':artistRows("Aretha Franklin|Soul vocalist;Marvin Gaye|Motown soul;The Supremes|Motown girl group;Otis Redding|Southern soul;Sam Cooke|Soul pioneer;Al Green|Memphis soul;Gladys Knight & The Pips|Motown and soul"),
'Neo-Soul':artistRows("Erykah Badu|Neo-soul;D'Angelo|Neo-soul and funk;Lauryn Hill|Hip-hop soul;Jill Scott|Neo-soul vocals;Maxwell|Modern soul;India.Arie|Acoustic soul;Musiq Soulchild|Neo-soul"),
'Contemporary R&B':artistRows("SZA|Alternative R&B;H.E.R.|R&B songwriting;Frank Ocean|Alternative R&B;The Weeknd|Dark pop R&B;Summer Walker|Modern R&B;Daniel Caesar|Soulful R&B;Victoria Monét|R&B and funk"),
'Quiet Storm & Slow Jams':artistRows("Sade|Smooth soul;Anita Baker|Quiet storm R&B;Luther Vandross|Romantic soul;Toni Braxton|R&B ballads;Babyface|Soul ballads;Brian McKnight|R&B vocals"),
}}]},
{name:'Blues',icon:'🎸',flat:true,sections:[{name:'Blues traditions',eras:{
'Delta & Country Blues':artistRows("Robert Johnson|Delta blues;Son House|Delta blues singer;Charley Patton|Early Delta blues;Mississippi John Hurt|Country blues guitar;Skip James|Acoustic Delta blues;Big Bill Broonzy|Country and urban blues"),
'Chicago Electric Blues':artistRows("Muddy Waters|Chicago blues;Howlin' Wolf|Electric blues;Willie Dixon|Chicago blues songwriting;Buddy Guy|Blues guitar;Little Walter|Blues harmonica;Koko Taylor|Chicago blues vocals"),
'Blues Rock & Revival':artistRows("B.B. King|Electric blues;Stevie Ray Vaughan|Texas blues guitar;Gary Clark Jr.|Modern blues rock;Joe Bonamassa|Blues rock;Susan Tedeschi|Blues soul;Christone Kingfish Ingram|Contemporary electric blues"),
}}]},
{name:'Country & Americana',icon:'🤠',flat:true,sections:[{name:'Roots & country',eras:{
'Classic Country':artistRows("Johnny Cash|Country storytelling;Patsy Cline|Classic country vocals;Dolly Parton|Country songwriting;Willie Nelson|Outlaw country;Loretta Lynn|Honky-tonk;George Jones|Country ballads;Merle Haggard|Bakersfield country"),
'Bluegrass & Roots':artistRows("Bill Monroe|Bluegrass founder;Alison Krauss|Bluegrass and country;Ricky Skaggs|Bluegrass virtuoso;The Stanley Brothers|Traditional bluegrass;Emmylou Harris|Americana;The Avett Brothers|Folk roots"),
'Modern Country':artistRows("Chris Stapleton|Country soul;Kacey Musgraves|Modern country;Zach Bryan|Country songwriting;Maren Morris|Pop country;Luke Combs|Contemporary country;Tyler Childers|Appalachian country"),
'Americana & Alt-Country':artistRows("Jason Isbell|Americana storytelling;Brandi Carlile|Americana vocals;Wilco|Alt-country rock;Lucinda Williams|Roots rock;Sturgill Simpson|Outlaw-influenced country;Margo Price|Americana country"),
}}]},
{name:'Folk & Acoustic',icon:'🪕',flat:true,sections:[{name:'Acoustic traditions',eras:{
'Folk Revival':artistRows("Bob Dylan|Folk songwriting;Joan Baez|Folk vocals;Pete Seeger|Folk tradition;Joni Mitchell|Folk singer-songwriter;Simon & Garfunkel|Folk harmonies;Nick Drake|Acoustic folk"),
'Indie Folk':artistRows("Bon Iver|Indie folk;Fleet Foxes|Folk harmonies;Sufjan Stevens|Indie folk;The Lumineers|Folk pop;First Aid Kit|Modern folk duo;Iron & Wine|Intimate folk"),
'Singer-Songwriter':artistRows("Tracy Chapman|Acoustic songwriting;Damien Rice|Acoustic ballads;Phoebe Bridgers|Indie songwriting;Fiona Apple|Artful songwriting;Ben Howard|Contemporary folk;Laura Marling|British folk"),
}}]},
{name:'Indie & Alternative',icon:'🌈',flat:true,sections:[{name:'Alternative listening',eras:{
'College & Alternative Rock':artistRows("R.E.M.|College rock;The Smiths|Indie guitar pop;The Cure|Post-punk alternative;Pixies|Alternative rock;Sonic Youth|Noise rock;Radiohead|Alternative rock"),
'Indie Rock':artistRows("Arctic Monkeys|Indie rock;The Strokes|Garage revival;The National|Indie rock;Vampire Weekend|Indie pop rock;Tame Impala|Psychedelic indie;Franz Ferdinand|Dance rock;Yeah Yeah Yeahs|Indie art rock"),
'Dream Pop & Shoegaze':artistRows("Cocteau Twins|Dream pop;Slowdive|Shoegaze;My Bloody Valentine|Shoegaze;Beach House|Dream pop;Alvvays|Indie dream pop;Mazzy Star|Dreamy alternative"),
'Indie Pop & Bedroom Pop':artistRows("Clairo|Bedroom pop;beabadoobee|Indie pop rock;Men I Trust|Dreamy indie pop;Rex Orange County|Indie pop;The Japanese House|Indie electronic pop;girl in red|Indie pop"),
}}]},
{name:'Punk, Emo & Ska',icon:'⚡',flat:true,sections:[{name:'Guitar subcultures',eras:{
'Classic Punk':artistRows("Ramones|New York punk;The Clash|UK punk;Sex Pistols|UK punk;Patti Smith|Poetic punk;Buzzcocks|Pop punk roots;Dead Kennedys|Hardcore punk"),
'Pop Punk & Skate Punk':artistRows("Green Day|Pop punk;blink-182|Pop punk;The Offspring|Skate punk;Sum 41|Pop punk;New Found Glory|Pop punk;Paramore|Pop punk and alternative rock"),
'Emo & Post-Hardcore':artistRows("My Chemical Romance|Emo rock;Fall Out Boy|Emo pop;Jimmy Eat World|Emo alternative;Taking Back Sunday|Emo rock;Pierce the Veil|Post-hardcore;Dashboard Confessional|Acoustic emo"),
'Ska & Ska Punk':artistRows("The Specials|Two-tone ska;Madness|Ska revival;Toots and the Maytals|Jamaican ska;Reel Big Fish|Ska punk;Less Than Jake|Ska punk;No Doubt|Ska pop"),
}}]},
{name:'Electronic & Chill',icon:'🎛️',flat:true,sections:[{name:'Electronic listening',eras:{
'Trip-Hop & Downtempo':artistRows("Massive Attack|Trip-hop;Portishead|Bristol trip-hop;Morcheeba|Downtempo;Zero 7|Chill electronic;Thievery Corporation|Downtempo;Bonobo|Organic electronic"),
'Chillwave & Synthpop':artistRows("Washed Out|Chillwave;Toro y Moi|Chillwave;M83|Dreamy synthpop;CHVRCHES|Synthpop;The Postal Service|Indietronica;Empire of the Sun|Electronic pop"),
'UK Garage & Future Beats':artistRows("Burial|Ambient UK garage;Jamie xx|Electronic beats;Fred again..|Emotive electronic;Overmono|UK electronic;Four Tet|Electronic experimentation;Bicep|Melodic breaks"),
'Drum & Bass':artistRows("Goldie|Atmospheric drum and bass;Roni Size|Drum and bass;LTJ Bukem|Liquid drum and bass;Chase & Status|Modern drum and bass;Pendulum|Drum and bass rock;Netsky|Liquid drum and bass"),
}}]},
{name:'Ambient & Lo-fi',icon:'🌙',flat:true,sections:[{name:'Relax & focus',eras:{
'Ambient Pioneers':artistRows("Brian Eno|Ambient composition;Harold Budd|Ambient piano;Steve Roach|Space ambient;Tangerine Dream|Electronic ambient;Aphex Twin|Selected ambient works;Stars of the Lid|Drone ambient"),
'Lo-fi & Jazz-Hop':artistRows("Nujabes|Jazz hip-hop;J Dilla|Instrumental hip-hop;DJ Shadow|Sample-based beats;Emancipator|Downtempo beats;idealism|Lo-fi instrumental;Jinsang|Lo-fi beats"),
'Modern Ambient & Minimal':artistRows("Tycho|Melodic ambient electronic;Helios|Warm ambient;Hammock|Ambient post-rock;Ólafur Arnalds|Neoclassical ambient;Nils Frahm|Minimalist piano;Hania Rani|Contemporary minimalist"),
}}]},
{name:'Classical & Piano',icon:'🎻',flat:true,sections:[{name:'Concert & piano music',eras:{
'Baroque & Classical':artistRows("Johann Sebastian Bach|Baroque music;Antonio Vivaldi|Baroque concertos;Wolfgang Amadeus Mozart|Classical compositions;Joseph Haydn|Classical symphonies;George Frideric Handel|Baroque orchestral"),
'Romantic Era':artistRows("Frédéric Chopin|Romantic piano;Ludwig van Beethoven|Romantic symphonies;Johannes Brahms|Romantic orchestral;Franz Liszt|Virtuoso piano;Clara Schumann|Piano and chamber music;Pyotr Ilyich Tchaikovsky|Romantic orchestral"),
'Modern Classical & Piano':artistRows("Philip Glass|Minimalist composition;Steve Reich|Minimalism;Ludovico Einaudi|Contemporary piano;Yiruma|Melodic piano;Max Richter|Contemporary classical;Alexis Ffrench|Contemporary piano"),
}}]},
{name:'Global & World',icon:'🌍',flat:true,sections:[{name:'Sounds worldwide',eras:{
'Afrobeats & African Pop':artistRows("Burna Boy|Afrofusion;Wizkid|Afrobeats;Tems|Alternative Afrobeats;Yemi Alade|African pop;Fela Kuti|Afrobeat pioneer;Angélique Kidjo|West African popular music"),
'K-pop & Korean R&B':artistRows("BTS|K-pop;BLACKPINK|K-pop;TWICE|K-pop girl group;NewJeans|K-pop;IU|Korean pop;DEAN|Korean R&B;SEVENTEEN|K-pop"),
'Flamenco & Iberian':artistRows("Paco de Lucía|Flamenco guitar;Camarón de la Isla|Flamenco vocals;Rosalía|Contemporary flamenco crossover;Vicente Amigo|Flamenco guitar;Mariza|Portuguese fado;Ana Moura|Fado"),
'Balkan & Eastern Europe':artistRows("Goran Bregović|Balkan folk rock;Fanfare Ciocărlia|Romanian brass ensemble;Taraf de Haïdouks|Romanian folk ensemble;Balkan Beat Box|Balkan electronic;Shantel|Balkan club;Gogol Bordello|Gypsy punk"),
'Middle Eastern & Arabic':artistRows("Fairuz|Lebanese singing;Umm Kulthum|Egyptian classical singing;Amr Diab|Egyptian pop;Nancy Ajram|Lebanese pop;Omar Souleyman|Syrian dabke;Anouar Brahem|Oud and jazz"),
}}]},
{name:'Latin & Caribbean',icon:'🌴',flat:true,sections:[{name:'Latin listening',eras:{
'Bossa Nova & MPB':artistRows("João Gilberto|Bossa nova;Astrud Gilberto|Bossa nova vocals;Antônio Carlos Jobim|Bossa nova songwriter;Caetano Veloso|Brazilian MPB;Gilberto Gil|Brazilian popular music;Elis Regina|Brazilian vocals"),
'Latin Rock & Alternative':artistRows("Santana|Latin rock;Maná|Spanish-language rock;Café Tacvba|Mexican alternative;Juanes|Latin pop rock;Natalia Lafourcade|Latin indie;Mon Laferte|Latin alternative"),
'Bachata & Merengue':artistRows("Juan Luis Guerra|Merengue and bachata;Romeo Santos|Modern bachata;Aventura|Bachata group;Prince Royce|Modern bachata;Elvis Crespo|Merengue;Olga Tañón|Merengue pop"),
'Caribbean & Dancehall':artistRows("Sean Paul|Dancehall;Shaggy|Reggae fusion;Buju Banton|Dancehall reggae;Beenie Man|Dancehall;Koffee|Modern reggae;Sister Nancy|Dancehall pioneer"),
}}]},
{name:'Dance Pop',icon:'✨',flat:true,training:true,sections:[{name:'Performance eras',eras:{
'Disco-to-Pop Stage Classics':artistRows("Donna Summer|Disco stage energy;ABBA|Pop stage classics;Michael Jackson|Dance-pop performance;Madonna|Dance-pop choreography;Kylie Minogue|Dance floor pop;Boney M.|Disco showdance"),
'1990s Eurodance':artistRows("2 Unlimited|High-energy Eurodance;Snap!|Dance-rap crossover;La Bouche|Eurodance vocals;Culture Beat|Eurodance;Haddaway|Eurodance;Corona|Italian Eurodance;Vengaboys|Party-dance shows;Ace of Base|Dance-pop"),
'2000s Stage Pop':artistRows("Britney Spears|Choreography-driven pop;Beyoncé|Stage-performance pop;Lady Gaga|Theatrical dance-pop;Rihanna|Pop and dance;The Pussycat Dolls|Dance choreography;Justin Timberlake|Rhythmic pop;Shakira|Latin dance pop"),
'2010s–Present Showdance':artistRows("Dua Lipa|Dance-pop choreography;Beyoncé|Stage productions;Lady Gaga|Theatrical pop;Ariana Grande|Pop choreography;Doja Cat|Pop and rap performance;Sia|Contemporary dance;Lizzo|Performance pop;Tate McRae|Dance-oriented pop"),
}}]},
{name:'Electronic Dance',icon:'⚡',flat:false,training:true,sections:[
{name:'House & Club',eras:{
'House Origins':artistRows("Frankie Knuckles|Chicago house;Marshall Jefferson|Early house;Larry Heard|Deep house;Inner City|Detroit house;Robin S.|Vocal house;Crystal Waters|House vocals"),
'French & Filter House':artistRows("Daft Punk|French house;Cassius|French touch;Stardust|Filter house;Modjo|French house;Bob Sinclar|French house;David Guetta|Dance crossover"),
'Modern House':artistRows("Disclosure|UK dance;Duke Dumont|Modern house;Purple Disco Machine|Disco house;John Summit|Tech house;Peggy Gou|Modern dance;FISHER|Tech house"),
}},
{name:'Trance & Festival',eras:{
'1990s Classic Trance':artistRows("Paul van Dyk|Classic trance;Tiësto|Trance era;Armin van Buuren|Trance;Ferry Corsten|Uplifting trance;ATB|Melodic trance;Binary Finary|Classic trance"),
'2000s Uplifting Trance':artistRows("Above & Beyond|Progressive trance;Armin van Buuren|Uplifting trance;Aly & Fila|Egyptian trance duo;Gareth Emery|Vocal trance;Cosmic Gate|Trance;Dash Berlin|Vocal trance"),
'2010s–Present EDM':artistRows("Martin Garrix|Festival EDM;Swedish House Mafia|Progressive house;Avicii|Melodic EDM;Hardwell|Big-room EDM;Calvin Harris|Dance pop;Zedd|Dance crossover;Alesso|Progressive house"),
}},
]},
{name:'Funk & Disco',icon:'🪩',flat:true,training:true,sections:[{name:'Groove eras',eras:{
'1960s–70s Funk':artistRows("James Brown|Funk rhythms;Sly & The Family Stone|Psychedelic funk;Parliament-Funkadelic|P-Funk;Earth, Wind & Fire|Funk soul;The Meters|New Orleans funk;Kool & The Gang|Funk disco"),
'1970s–80s Disco':artistRows("Chic|Disco funk;Donna Summer|Disco classics;Bee Gees|Disco pop;Gloria Gaynor|Disco vocals;The Trammps|Disco;The Jacksons|Disco funk;Sister Sledge|Disco vocals"),
'1980s Electro-Funk':artistRows("Prince|Funk pop performance;The Gap Band|Electro-funk;Zapp|Talk-box funk;Rick James|Funk shows;Cameo|Funk R&B;Midnight Star|Electro-funk;The Time|Minneapolis funk"),
'Nu-Disco & Modern Funk':artistRows("Jamiroquai|Acid jazz and funk;Chromeo|Electro-funk;Daft Punk|Disco-inspired electronic;Purple Disco Machine|Nu-disco;Parcels|Modern funk;Jungle|Dance choreography;Bruno Mars|Funk pop"),
}}]},
{name:'Latin Dance',icon:'💃',flat:true,training:true,sections:[{name:'Dance styles',eras:{
'Salsa & Mambo':artistRows("Celia Cruz|Salsa vocals;Tito Puente|Mambo and Latin jazz;Héctor Lavoe|Salsa;Willie Colón|Salsa trombone;Rubén Blades|Salsa songwriting;Marc Anthony|Contemporary salsa"),
'Samba & Latin Pop':artistRows("Sérgio Mendes|Brazilian jazz crossover;Carlinhos Brown|Bahian rhythms;Ivete Sangalo|Brazilian pop;Shakira|Latin dance pop;Ricky Martin|Latin pop;Gloria Estefan|Latin pop"),
'Reggaeton & Urban Latin':artistRows("Daddy Yankee|Reggaeton pioneer;Don Omar|Reggaeton;Wisin & Yandel|Reggaeton duo;J Balvin|Modern reggaeton;Bad Bunny|Latin urban;Karol G|Latin urban pop;Rauw Alejandro|Dance reggaeton"),
'Contemporary Latin Stage':artistRows("Rosalía|Flamenco crossover;Jennifer Lopez|Stage dance pop;Shakira|Latin dance performances;Becky G|Latin pop;Anitta|Brazilian funk pop;Nathy Peluso|Latin performance"),
}}]},
{name:'Cinematic & Orchestral',icon:'🎬',flat:true,training:true,sections:[{name:'Routine moods',eras:{
'Classical & Ballet Drama':artistRows("Pyotr Ilyich Tchaikovsky|Ballet music;Igor Stravinsky|Rhythmic ballet;Sergei Prokofiev|Dramatic ballet;Camille Saint-Saëns|Character pieces;Aram Khachaturian|Dramatic ballet;Maurice Ravel|Orchestral dance"),
'Film Score Classics':artistRows("John Williams|Symphonic film music;Ennio Morricone|Film score themes;Howard Shore|Epic orchestral music;James Horner|Cinematic themes;Danny Elfman|Theatrical film music;Rachel Portman|Melodic film scores"),
'Modern Epic & Emotional':artistRows("Hans Zimmer|Percussive scores;Ludovico Einaudi|Minimalist piano;Max Richter|Contemporary classical;Ólafur Arnalds|Atmospheric classical;Two Steps From Hell|Epic trailer music;Audiomachine|Cinematic production music;Ramin Djawadi|TV and cinematic scores"),
}}]},
{name:'Breakbeat & Street',icon:'🔥',flat:true,training:true,sections:[{name:'Movement styles',eras:{
'Breakdance Foundations':artistRows("Afrika Bambaataa|Electro and hip-hop;Grandmaster Flash & The Furious Five|Early hip-hop;Kurtis Blow|Old-school rap;Run-D.M.C.|Old-school hip-hop;The Sugarhill Gang|Early hip-hop;Mantronix|Electro hip-hop"),
'1990s Big Beat & Breaks':artistRows("The Prodigy|High-impact breakbeat;The Chemical Brothers|Big beat;Fatboy Slim|Big beat;Propellerheads|Breakbeat;Basement Jaxx|House and breaks;Freestylers|UK breaks"),
'Street & Modern Rhythms':artistRows("Missy Elliott|Dance-focused hip-hop;Timbaland|Rhythmic hip-hop production;Busta Rhymes|High-energy rap;Anderson .Paak|Funk hip-hop crossover;Kaytranada|Dance beats;Skrillex|Bass music;Jungle|Rhythmic performance music"),
}}]},
];
const expandedGenre={name:null,section:null,era:null};
const browsePath=(genre,section,era)=>[genre.name,genre.flat?null:section.name,era].filter(Boolean).join(' → ');
function chooseCatalogArtist(genre,section,era,name){
  $('artistInput').value=name;
  $('matchPanel').hidden=true;
  chooseArtist(name,null);
  $('locationName').textContent=browsePath(genre,section,era)+' / '+name;
  $('playlistSection').scrollIntoView({behavior:'smooth',block:'start'});
}
function toggleBrowseGenre(genre){
  expandedGenre.name=expandedGenre.name===genre.name?null:genre.name;
  expandedGenre.section=null;expandedGenre.era=null;
  renderGenreTree();
  $('genreResults').hidden=true;
}
function toggleBrowseSection(genre,section){
  expandedGenre.section=expandedGenre.section===section.name?null:section.name;
  expandedGenre.era=null;
  renderGenreTree();
  $('genreResults').hidden=true;
}
function showBrowseEra(genre,section,era){
  expandedGenre.name=genre.name;expandedGenre.section=section.name;
  expandedGenre.era=expandedGenre.era===era?null:era;
  renderGenreTree();
  const panel=$('genreResults');
  if(!expandedGenre.era){panel.hidden=true;return}
  const artists=section.eras[era],path=browsePath(genre,section,era);
  panel.hidden=false;
  $('genreResultsHeading').textContent=path;
  $('genreResultsCount').textContent=artists.length+' ARTISTS';
  $('genreResultsDescription').textContent=genre.training
    ?'Showdance and gymnastics inspiration. Preview tracks, check tempo and suitability, and ensure you have any required music-use rights.'
    :'Featured and less-famous artists. Performers may appear in several eras. Choose an artist to explore recordings.';
  const list=$('genreArtistList');list.replaceChildren();
  for(const [name,note] of artists){
    const card=document.createElement('button');card.type='button';card.className='genre-artist-card';
    const title=document.createElement('strong');title.textContent=name;
    const detail=document.createElement('small');detail.textContent=note;
    const arrow=document.createElement('span');arrow.textContent='↗';
    card.append(title,detail,arrow);
    card.onclick=()=>chooseCatalogArtist(genre,section,era,name);
    list.append(card);
  }
  $('locationName').textContent=path;
  requestAnimationFrame(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}));
}
function genreSearchMatches(genre,query){
  if(!query)return true;
  if(norm(genre.name).includes(query))return true;
  return genre.sections.some(section=>
    norm(section.name).includes(query)||
    Object.entries(section.eras).some(([style,artists])=>
      norm(style).includes(query)||
      artists.some(([artist,description])=>norm(artist).includes(query)||norm(description).includes(query))
    )
  );
}
function matchingGenreEras(genre,section,query){
  if(!query||norm(genre.name).includes(query)||norm(section.name).includes(query))return Object.entries(section.eras);
  return Object.entries(section.eras).filter(([style,artists])=>
    norm(style).includes(query)||
    artists.some(([artist,description])=>norm(artist).includes(query)||norm(description).includes(query)));
}
// Random artist discovery uses only the curated directory, never auto-plays a recording.
const discoveryHistory=[];
function discoverableArtists(genres,query){
  const picks=[],seen=new Set();
  for(const genre of genres){
    if(!genreSearchMatches(genre,query))continue;
    for(const section of genre.sections){
      for(const [style,artists] of matchingGenreEras(genre,section,query)){
        for(const [name,note] of artists){
          const key=norm(name);
          if(seen.has(key))continue;
          // A search for an exact artist or descriptor should narrow the pool,
          // while genre and substyle terms can return the broader style roster.
          const broad=!query||norm(genre.name).includes(query)||
            norm(section.name).includes(query)||norm(style).includes(query);
          if(!broad&&!norm(name).includes(query)&&!norm(note).includes(query))continue;
          seen.add(key);
          picks.push({genre,section,style,name});
        }
      }
    }
  }
  return picks;
}
function pickSurpriseArtist(picks,history,random=Math.random){
  if(!picks.length)return null;
  const recent=new Set(history);
  const fresh=picks.filter(p=>!recent.has(norm(p.name)));
  const options=fresh.length?fresh:picks;
  const fraction=Number(random());
  const index=Math.min(options.length-1,Math.max(0,Math.floor((Number.isFinite(fraction)?fraction:0)*options.length)));
  return options[index];
}
function surpriseArtist(){
  const query=norm($('genreFilter').value.trim());
  const picks=discoverableArtists(MUSIC_GENRES,query);
  const pick=pickSurpriseArtist(picks,discoveryHistory);
  if(!pick){
    $('genreFilterCount').textContent='No matching artists. Try another genre or clear the filter.';
    return;
  }
  const key=norm(pick.name);
  discoveryHistory.push(key);
  if(discoveryHistory.length>8)discoveryHistory.shift();
  // Existing discovery performs the same normal artist search as clicking a genre.
  chooseCatalogArtist(pick.genre,pick.section,pick.style,pick.name);
}
function renderGenreTree(){
  const tree=$('genreTree');tree.replaceChildren();
  const query=norm($('genreFilter').value.trim());
  const visible=MUSIC_GENRES.filter(genre=>genreSearchMatches(genre,query));
  $('genreFilterClear').hidden=!query;
  $('genreFilterCount').textContent=query
    ?visible.length+' matching genre'+(visible.length===1?'':'s')
    :MUSIC_GENRES.length+' genres · explore styles and artists';
  let lastGroup='';
  for(const [index,genre] of visible.entries()){
    const groupKey=genre.training?'performance':index<4&&MUSIC_GENRES.indexOf(genre)<4?'heritage':'everyday';
    if(!query&&groupKey!==lastGroup){
      if(groupKey!=='heritage'){
        const heading=document.createElement('div');heading.className='genre-category-heading';
        heading.textContent=groupKey==='performance'?'DANCE & PERFORMANCE':'MORE TO EXPLORE';
        tree.append(heading);
      }
      lastGroup=groupKey;
    }
    const group=document.createElement('div');group.className='genre-node';
    const open=Boolean(query)||expandedGenre.name===genre.name;
    const button=document.createElement('button');button.type='button';button.className='genre-top-button';
    button.textContent=genre.icon+'  '+genre.name;
    button.setAttribute('aria-expanded',String(open));
    button.onclick=()=>toggleBrowseGenre(genre);
    group.append(button);
    if(open){
      const sections=document.createElement('div');sections.className='genre-era-list';
      for(const section of genre.sections){
        const matchedEras=matchingGenreEras(genre,section,query);
        if(query&&!matchedEras.length)continue;
        const sectionOpen=Boolean(query)||genre.flat||expandedGenre.section===section.name;
        const container=document.createElement('div');container.className='genre-style-group';
        if(!genre.flat){
          const style=document.createElement('button');style.type='button';style.className='genre-style-button';
          style.textContent=section.name+'  ▾';style.setAttribute('aria-expanded',String(sectionOpen));
          style.onclick=()=>toggleBrowseSection(genre,section);
          container.append(style);
        }
        if(sectionOpen){
          for(const [era,artists] of matchedEras){
            const eraGroup=document.createElement('div');eraGroup.className='genre-era-group';
            const active=expandedGenre.era===era&&expandedGenre.section===section.name;
            const toggle=document.createElement('button');toggle.type='button';toggle.className='genre-era-button';
            toggle.textContent=era+'  ›';toggle.setAttribute('aria-expanded',String(active));
            toggle.classList.toggle('active',active);toggle.onclick=()=>showBrowseEra(genre,section,era);
            eraGroup.append(toggle);
            if(active){
              const list=document.createElement('div');list.className='genre-sidebar-artists';
              list.setAttribute('aria-label','Artists: '+browsePath(genre,section,era));
              for(const [name] of artists){
                const artist=document.createElement('button');artist.type='button';artist.className='genre-sidebar-artist';
                artist.textContent=name;artist.onclick=()=>chooseCatalogArtist(genre,section,era,name);
                list.append(artist);
              }
              eraGroup.append(list);
            }
            container.append(eraGroup);
          }
        }
        sections.append(container);
      }
      group.append(sections);
    }
    tree.append(group);
  }
  if(!visible.length){
    const message=document.createElement('p');message.className='genre-no-results';
    message.textContent='No matching genres. Try a style, artist, or broader term.';
    tree.append(message);
  }
}

let artworkEditor=null;
function openArtworkEditor(detail){
  artworkEditor=detail;
  $('artDialogArtist').textContent=detail.label;
  $('artDialogError').textContent='';
  $('artUrl').value=(pinnedArt[detail.key]||'').startsWith('https://')?pinnedArt[detail.key]:'';
  if(typeof $('artDialog').showModal==='function')$('artDialog').showModal();
  else $('artDialog').setAttribute('open','');
}
function closeArtworkEditor(){
  if(typeof $('artDialog').close==='function')$('artDialog').close();
  else $('artDialog').removeAttribute('open');
}
function applyArtwork(url){
  if(!artworkEditor)return;
  const key=artworkEditor.key;const previous=pinnedArt[key];
  pinnedArt[key]=url;
  try{localStorage.setItem(ART_KEY,JSON.stringify(pinnedArt))}
  catch{
    if(previous===undefined)delete pinnedArt[key];else pinnedArt[key]=previous;
    $('artDialogError').textContent='Could not save. Try using an image URL or a smaller image file.';
    return;
  }
  // Replace every match card sharing this artist/recording ID.
  document.querySelectorAll('.match-art').forEach(art=>{
    if(art.dataset.artKey!==key)return;
    art.querySelector('img')?.remove();
    const placeholder=art.querySelector('.match-art-fallback');
    const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';
    img.onload=()=>{if(placeholder)placeholder.hidden=true};
    img.onerror=()=>{img.remove();if(placeholder)placeholder.hidden=false};
    img.src=url;art.append(img);
  });
  closeArtworkEditor();
}
$('artSaveUrl').addEventListener('click',async()=>{
  const url=$('artUrl').value.trim();
  if(!/^https:\/\//i.test(url)){$('artDialogError').textContent='Please use a direct HTTPS image URL.';return}
  $('artDialogError').textContent='Checking image…';
  if(!(await imageValid(url))){$('artDialogError').textContent='This URL could not be loaded as an image.';return}
  applyArtwork(url);
});
$('artUpload').addEventListener('change',event=>{
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  if(!file.type.startsWith('image/')){$('artDialogError').textContent='Choose an image file.';return}
  // Shrink the chosen image to keep it small enough for browser localStorage.
  const reader=new FileReader();reader.onload=()=>{
    const source=new Image();source.onload=()=>{
      const scale=Math.min(1,480/Math.max(source.naturalWidth,source.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
      const context=canvas.getContext('2d');
      if(!context){$('artDialogError').textContent='Image processing is unavailable.';return}
      context.drawImage(source,0,0,canvas.width,canvas.height);
      applyArtwork(canvas.toDataURL('image/jpeg',.7));
    };
    source.onerror=()=>{$('artDialogError').textContent='The selected file is not a valid image.'};
    source.src=reader.result;
  };reader.readAsDataURL(file);
});
$('artReset').addEventListener('click',()=>{
  if(!artworkEditor)return;
  delete pinnedArt[artworkEditor.key];
  try{localStorage.setItem(ART_KEY,JSON.stringify(pinnedArt))}catch{}
  closeArtworkEditor();
  // Refresh the current artist choices to restore automatically selected imagery.
  const term=$('artistInput').value.trim();
  if(term)searchMatches(term);
});
$('genreFilter').addEventListener('input',renderGenreTree);
$('genreFilterClear').addEventListener('click',()=>{
  $('genreFilter').value='';
  renderGenreTree();
  $('genreFilter').focus();
});
$('surpriseArtist').addEventListener('click',surpriseArtist);
renderGenreTree();

// Google account data applies only after the user explicitly signs in.
window.addEventListener('artistwave:cloud-load',event=>{
  const detail=event.detail||{};
  if(!Array.isArray(detail.favorites))return;
  S.favorites=dedupeTracks(detail.favorites.filter(t=>t.source!=='LOCAL'&&/^https:\/\//.test(t.url||'')));
  if(Array.isArray(detail.recent))S.recent=dedupeRecent(detail.recent);
  const prefs=detail.preferences||{};
  if(['both','local','online'].includes(prefs.sourceMode))$('sourceMode').value=prefs.sourceMode;
  if(typeof prefs.includeLive==='boolean')$('includeLive').checked=prefs.includeLive;
  if(typeof prefs.showUnavailable==='boolean')$('showUnavailable').checked=prefs.showUnavailable;
  for(const provider of ['archive','audius','jamendo']){
    const key=onlineProviderIds[provider];
    if(typeof prefs.providers?.[provider]==='boolean')$(key).checked=prefs.providers[provider];
  }
  clearAlbumQueue();
  rebuildPlaylist();
  if(S.artist&&!S.archiveItemView&&sourceMode()!=='local')loadOnlineProviders(S.artist,S.matchRequest);
  if($('showUnavailable').checked&&sourceMode()!=='local')loadUnavailable();
});
window.ArtistWaveCloud?.init({getFavorites:()=>S.favorites,getRecent:()=>safeRecentTracks(S.recent)});
window.ArtistWaveStudioHost={
  tracks:()=>[...S.tracks,...S.favorites,...S.recent,...S.local],
  pauseMain:()=>audio.pause(),
  render:()=>{render();updatePlayer()}
};
restoreFolderHandle();

window.ArtistWaveLibrary={
  getSongs:()=>S.view==='favorites'?dedupeTracks(S.favorites):S.view==='recent'?dedupeTracks(S.recent):S.tracks,
  getCurrent:()=>current(),
  getQueue:()=>S.tracks.map((t,i)=>({title:t.title,artist:t.artist,index:i})),
  getSelectedIndex:()=>S.selected,
  getSmartQueue:()=>S.smartQueue.map((t,index)=>({title:t.title,artist:t.artist,index})),
  queueMove:moveSmartQueue,
  queuePlay:playQueuedAt,
  queueRemove:index=>{if(!Number.isInteger(index)||index<0||index>=S.smartQueue.length)return false;S.smartQueue.splice(index,1);renderSmartQueue();return true},
  playIndex:index=>playAt(index),
  getAvailable:()=>[...S.local,...S.tracks,...S.favorites,...S.recent],
  playPlaylist:(tracks,index=0)=>{
    const previous=S.tracks[S.selected];
    clearAlbumQueue();
    // Invalidate any in-flight artist or catalog searches so their async
    // results cannot replace the user-selected saved playlist.
    S.requestId++;S.matchRequest++;S.catalogRequest++;
    S.loading=false;S.catalogLoading=false;
    S.onlineTracks=[];S.unavailable=[];S.archiveItemView=false;
    S.tracks=tracks.slice();
    S.view='discover';
    S.selected=-1;
    S.artist='';
    $('playlistHeading').textContent='Now playing · My Playlists';
    playAt(index);
    return previous;
  }
};
$('playlistSaveCurrent').addEventListener('click',()=>{
  const track=current();if(track)window.ArtistWavePlaylists?.addTrack(track);
});
renderSmartQueue();
render();updatePlayer();