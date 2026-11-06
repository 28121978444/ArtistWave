'use strict';
const $=id=>document.getElementById(id),audio=$('audio');
const S={artist:'',tracks:[],local:[],favorites:[],selected:-1,matches:[],view:'discover',shuffle:false,repeat:0,page:0,loading:false};
try{S.favorites=JSON.parse(localStorage.getItem('artistwave:favorites')||'[]')}catch{}if(!Array.isArray(S.favorites))S.favorites=[];
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const time=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const show=(msg,error=false)=>{$('statusMessage').textContent=msg;$('statusMessage').classList.toggle('error',error)};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const creatorMatches=(value,name)=>{let list=Array.isArray(value)?value:[value];return list.some(v=>String(v||'').split(/\s*(?:;|\||,|\bfeat\.?\b|\bfeaturing\b)\s*/i).some(a=>norm(a)===norm(name)))};
const current=()=>S.tracks[S.selected];
function updatePlayer(){const t=current();$('nowTitle').textContent=t?.title||'Nothing playing yet';$('nowArtist').textContent=t?.artist||'Find your next favorite';$('playingSource').textContent=t?.source||'READY';$('playButton').textContent=audio.paused?'▶':'Ⅱ';$('favoriteCurrent').disabled=!t;$('favoriteCurrent').textContent=t&&S.favorites.some(x=>x.id===t.id)?'♥':'♡'}
function render(){const list=$('trackList');list.replaceChildren();$('favoriteCount').textContent=S.favorites.length;let songs=S.view==='favorites'?S.favorites:S.tracks;$('shuffleAll').disabled=!songs.length;$('clearList').disabled=!songs.length;if(!songs.length){let el=document.createElement('div');el.className='empty-state';el.textContent=S.view==='favorites'?'No favorites yet.':'No playable recordings yet. Search for an artist or add local tracks.';list.append(el);return}
songs.forEach((t,i)=>{const el=document.createElement('div');el.className='track-row'+(S.view!=='favorites'&&i===S.selected?' active':'');const play=document.createElement('button');play.className='track-play';play.textContent='▶';play.setAttribute('aria-label','Play '+t.title);play.onclick=()=>{if(S.view==='favorites'){S.tracks=[...S.favorites];S.view='discover'}playAt(i)};const info=document.createElement('div');info.className='track-info';const title=document.createElement('strong');title.textContent=t.title;const artist=document.createElement('small');artist.textContent=t.artist;info.append(title,artist);const collection=document.createElement('span');collection.className='recording-name';collection.textContent=t.collection||'Audio';const source=document.createElement('span');source.className='track-source';source.textContent=t.source;const fav=document.createElement('button');fav.className='heart-button';fav.textContent=S.favorites.some(x=>x.id===t.id)?'♥':'♡';fav.setAttribute('aria-label','Toggle favorite');fav.onclick=()=>favorite(t);el.append(play,info,collection,source,fav);list.append(el)})}
function favorite(t){if(!t)return;if(t.source==='LOCAL'){show('Local files cannot be saved as persistent favorites.');return}S.favorites=S.favorites.some(x=>x.id===t.id)?S.favorites.filter(x=>x.id!==t.id):[...S.favorites,t];localStorage.setItem('artistwave:favorites',JSON.stringify(S.favorites));render();updatePlayer()}
function playAt(i){if(i<0||i>=S.tracks.length)return;S.selected=i;const t=current();audio.src=t.url;audio.play().catch(()=>show('Unable to play this recording. Try another track.',true));render();updatePlayer()}
function next(direction=1){if(!S.tracks.length)return;let i=S.shuffle?Math.floor(Math.random()*S.tracks.length):(S.selected+direction+S.tracks.length)%S.tracks.length;playAt(i)}
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
  const b=document.createElement('button');b.type='button';b.className='match-card';
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
    if(!b.isConnected)return;
    const img=document.createElement('img');
    img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.src=url;
    img.onerror=()=>{img.remove();placeholder.hidden=false};
    img.onload=()=>{if(img.naturalWidth>1){placeholder.hidden=true;art.classList.add('has-image')}else{img.remove()}};
    art.querySelector('img')?.remove();art.append(img);
  };
  if(pinnedArt[key])showImage(pinnedArt[key]);
  else if(kind==='item'&&id){
    const url='https://archive.org/services/img/'+encodeURIComponent(id);
    imageValid(url).then(ok=>{if(ok){pinArt(key,url);showImage(url)}});
  }else if(kind==='artist'&&id&&/^[0-9a-f-]{36}$/i.test(id)){
    queueArtistArt(key,id,showImage);
  }
  b.onclick=onClick;
  return b;
}
async function searchMatches(term){S.artist=term;S.page=0;S.tracks=[];S.selected=-1;S.view='discover';audio.pause();audio.removeAttribute('src');$('matchPanel').hidden=false;$('matchHeading').textContent='Matches for “'+term+'”';$('matchSummary').textContent='Choose the artist or recording you meant';$('matchList').replaceChildren();show('Finding artists and other matching recordings…');render();let list=$('matchList');let count=0;
try{const data=await getJSON('https://musicbrainz.org/ws/2/artist/?query='+encodeURIComponent('artist:"'+term+'"')+'&fmt=json&limit=15');for(const artist of (data.artists||[])){const name=artist.name||'';let detail=[artist.type,artist.country,artist.disambiguation].filter(Boolean).join(' · ')||'MusicBrainz artist';list.append(sourceChoice(name,detail,()=>chooseArtist(name,artist.id),'artist',artist.id));count++}}catch(e){show('MusicBrainz artist lookup was unavailable; showing Archive matches where possible.',true)}
try{const query='mediatype:audio AND ('+'title:('+term+') OR creator:('+term+'))';const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(query)+'&fl[]=identifier&fl[]=title&fl[]=creator&rows=12&page=1&output=json';const data=await getJSON(url);for(const d of data.response?.docs||[]){const name=Array.isArray(d.title)?d.title[0]:d.title;const creator=Array.isArray(d.creator)?d.creator.join(', '):d.creator||'Unknown creator';list.append(sourceChoice(name||d.identifier,'Internet Archive recording · '+creator,()=>chooseArchiveItem(d),'item',d.identifier));count++}}catch(e){if(!count)show('The online search services are unavailable. You can still add local audio files.',true)}
if(!count){list.append(sourceChoice('Search Internet Archive for '+term,'Try an exact creator search',()=>chooseArtist(term,null)))}else show('Choose a matching artist or recording above to build your playlist.')}
async function chooseArtist(name,mbid){S.artist=name;S.page=0;S.tracks=[];S.selected=-1;S.view='discover';$('matchList').querySelectorAll('button').forEach(x=>x.classList.remove('selected'));$('playlistHeading').textContent=name;$('externalSearch').hidden=false;$('externalSearch').href='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' music');$('externalSearch').textContent='Search '+name+' on YouTube ↗';show('Searching publicly available recordings attributed to '+name+'…');render();await loadMore()}
async function chooseArchiveItem(d){const name=Array.isArray(d.title)?d.title[0]:d.title||d.identifier;S.artist=Array.isArray(d.creator)?d.creator[0]:d.creator||name;S.page=0;S.selected=-1;S.tracks=[];$('playlistHeading').textContent=name;$('externalSearch').hidden=true;show('Loading recording: '+name);try{const tracks=await tracksFromItem(d.identifier,S.artist);S.tracks=tracks;show(tracks.length+' playable files found in this item.');render()}catch(e){show('Unable to load the selected recording: '+e.message,true)}$('loadMore').hidden=true}
async function tracksFromItem(id,artist){let m=await getJSON('https://archive.org/metadata/'+encodeURIComponent(id));let files=(m.files||[]).filter(f=>/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i.test(f.name||'')&&!/(_meta|__ia_thumb|spectrogram)/i.test(f.name||''));return files.slice(0,70).map(f=>({id:id+'/'+f.name,title:(f.title||f.name.split('/').pop()).replace(/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i,'').replace(/^\d+[-._ ]+/,'').replace(/_/g,' '),artist,collection:m.metadata?.title||id,source:'ARCHIVE',url:'https://archive.org/download/'+encodeURIComponent(id)+'/'+f.name.split('/').map(encodeURIComponent).join('/')}))}
async function loadMore(){if(S.loading||!S.artist)return;S.loading=true;$('loadMore').hidden=true;const page=++S.page;try{let q='mediatype:audio AND creator:("'+S.artist.replace(/"/g,'')+'")';if(!$('includeLive').checked)q+=' AND NOT collection:etree';let url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(q)+'&fl[]=identifier&fl[]=title&fl[]=creator&rows=30&page='+page+'&output=json';const result=await getJSON(url);const docs=(result.response?.docs||[]).filter(d=>creatorMatches(d.creator,S.artist));let found=[];for(const d of docs.slice(0,15)){try{found.push(...await tracksFromItem(d.identifier,S.artist))}catch{}}const seen=new Set(S.tracks.map(t=>t.id));S.tracks.push(...found.filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true}));$('loadMore').hidden=page*30>=(result.response?.numFound||0);show(S.tracks.length?S.tracks.length+' playable recordings found for '+S.artist+'.':'No playable Archive recordings found yet for '+S.artist+'. Try another result or local files.');render()}catch(e){show('Online search failed: '+e.message,true)}finally{S.loading=false}}
$('searchForm').addEventListener('submit',e=>{e.preventDefault();const term=$('artistInput').value.trim();if(term)searchMatches(term)});
$('loadMore').onclick=loadMore;
$('playButton').onclick=()=>{if(!audio.src&&S.tracks.length){playAt(0);return}audio.paused?audio.play().catch(()=>{}):audio.pause()};
$('nextButton').onclick=()=>next(1);$('previousButton').onclick=()=>next(-1);
$('shuffleButton').onclick=()=>{S.shuffle=!S.shuffle;$('shuffleButton').classList.toggle('active',S.shuffle)};
$('shuffleAll').onclick=()=>{S.shuffle=true;$('shuffleButton').classList.add('active');next(1)};
$('repeatButton').onclick=()=>{S.repeat=(S.repeat+1)%3;$('repeatButton').title=['Repeat: off','Repeat: all','Repeat: one'][S.repeat];$('repeatButton').classList.toggle('active',S.repeat>0)};
$('favoriteCurrent').onclick=()=>favorite(current());
$('volumeBar').oninput=e=>audio.volume=Number(e.target.value)/100;audio.volume=.75;
$('seekBar').oninput=e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(e.target.value)/1000};
audio.ontimeupdate=()=>{$('currentTime').textContent=time(audio.currentTime);$('duration').textContent=time(audio.duration);$('seekBar').value=Number.isFinite(audio.duration)&&audio.duration?Math.round(audio.currentTime/audio.duration*1000):0};
audio.onplay=audio.onpause=updatePlayer;audio.onended=()=>{if(S.repeat===2){audio.currentTime=0;audio.play().catch(()=>{})}else if(S.repeat===1||S.selected<S.tracks.length-1)next(1);else updatePlayer()};
$('discoverNav').onclick=()=>{S.view='discover';$('locationName').textContent='Discover';render()};
$('favoritesNav').onclick=()=>{S.view='favorites';$('locationName').textContent='Favorites';$('playlistHeading').textContent='Your favorites';render()};
$('clearList').onclick=()=>{if(S.view==='favorites'){S.favorites=[];localStorage.setItem('artistwave:favorites','[]')}else{S.tracks=[];S.selected=-1;audio.pause();audio.removeAttribute('src')}render();updatePlayer()};
$('fileDrop').onclick=()=>$('fileInput').click();$('fileDrop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}};
$('fileDrop').ondragover=e=>{e.preventDefault();$('fileDrop').classList.add('dragover')};$('fileDrop').ondragleave=()=>$('fileDrop').classList.remove('dragover');
$('fileDrop').ondrop=e=>{e.preventDefault();$('fileDrop').classList.remove('dragover');addFiles(e.dataTransfer.files)};
$('fileInput').onchange=e=>addFiles(e.target.files);
function addFiles(files){let count=0;for(const file of files){if(!file.type.startsWith('audio/')&&!/\.(mp3|flac|wav|ogg|m4a|opus)$/i.test(file.name))continue;let base=file.name.replace(/\.[^.]+$/,'');let parts=base.split(/\s+-\s+/);let artist=parts.length>1?parts.shift():S.artist||'Local file';let title=parts.length?parts.join(' - '):base;if(S.artist&&norm(artist)!==norm(S.artist)&&parts.length)continue;let url=URL.createObjectURL(file);S.tracks.push({id:'local:'+url,title,artist,collection:'Your device',source:'LOCAL',url});count++}S.view='discover';render();show(count+' local audio files added. Files stay on your device.')}
render();updatePlayer();