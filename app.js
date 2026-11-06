'use strict';
const $=id=>document.getElementById(id),audio=$('audio');
const S={artist:'',tracks:[],local:[],favorites:[],selected:-1,matches:[],view:'discover',shuffle:false,repeat:0,page:0,loading:false,artistMbid:null,unavailable:[],catalogLoading:false,catalogResolved:false,catalogRequest:0,requestId:0,matchRequest:0};
try{S.favorites=JSON.parse(localStorage.getItem('artistwave:favorites')||'[]')}catch{}if(!Array.isArray(S.favorites))S.favorites=[];
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const time=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const show=(msg,error=false)=>{$('statusMessage').textContent=msg;$('statusMessage').classList.toggle('error',error)};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const creatorMatches=(value,name)=>{let list=Array.isArray(value)?value:[value];return list.some(v=>String(v||'').split(/\s*(?:;|\||,|\bfeat\.?\b|\bfeaturing\b)\s*/i).some(a=>norm(a)===norm(name)))};
const current=()=>S.tracks[S.selected];
function updatePlayer(){const t=current();$('nowTitle').textContent=t?.title||'Nothing playing yet';$('nowArtist').textContent=t?.artist||'Find your next favorite';$('playingSource').textContent=t?.source||'READY';$('playButton').textContent=audio.paused?'▶':'Ⅱ';$('favoriteCurrent').disabled=!t;$('favoriteCurrent').textContent=t&&S.favorites.some(x=>x.id===t.id)?'♥':'♡'}
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
function render(){
  const list=$('trackList');list.replaceChildren();
  $('favoriteCount').textContent=S.favorites.length;
  const songs=S.view==='favorites'?S.favorites:S.tracks;
  const unplayable=S.view==='discover'&&$('showUnavailable').checked?S.unavailable.filter(t=>!S.tracks.some(p=>norm(p.title)===norm(t.title))):[];
  $('shuffleAll').disabled=!songs.length;
  $('clearList').disabled=!songs.length&&!unplayable.length;
  if(!songs.length&&!unplayable.length){
    const el=document.createElement('div');el.className='empty-state';
    el.textContent=S.catalogLoading?'Looking up song titles…':S.view==='favorites'?'No favorites yet.':S.artist?'No playable recordings found in the selected sources. Enable “Show titles without audio” to browse catalog entries.':'No playable recordings yet. Search for an artist or add local tracks.';
    list.append(el);return;
  }
  songs.forEach((t,i)=>{
    const el=document.createElement('div');el.className='track-row'+(S.view!=='favorites'&&i===S.selected?' active':'');
    const play=document.createElement('button');play.className='track-play';play.textContent='▶';play.setAttribute('aria-label','Play '+t.title);
    play.onclick=()=>{if(S.view==='favorites'){S.tracks=[...S.favorites];S.view='discover'}playAt(i)};
    const info=document.createElement('div');info.className='track-info';const title=document.createElement('strong');title.textContent=t.title;
    const artist=document.createElement('small');artist.textContent=t.artist;info.append(title,artist);
    const collection=document.createElement('span');collection.className='recording-name';collection.textContent=t.collection||'Audio';
    const source=document.createElement('span');source.className='track-source';source.textContent=t.source;
    const fav=document.createElement('button');fav.className='heart-button';fav.textContent=S.favorites.some(x=>x.id===t.id)?'♥':'♡';
    fav.setAttribute('aria-label','Toggle favorite');fav.onclick=()=>favorite(t);
    const controls=document.createElement('div');controls.className='track-actions';controls.append(fav,makeLyricsActions(t));
    el.append(play,info,collection,source,controls);list.append(el);
  });
  for(const t of unplayable){
    const el=document.createElement('div');el.className='track-row unavailable-row';
    const symbol=document.createElement('span');symbol.className='unavailable-mark';symbol.textContent='—';symbol.title='No playable audio in ArtistWave';
    const info=document.createElement('div');info.className='track-info';
    const title=document.createElement('strong');title.textContent=t.title;
    const artist=document.createElement('small');artist.textContent=t.artist;info.append(title,artist);
    const status=document.createElement('span');status.className='recording-name';status.textContent='No playable audio found';
    const badge=document.createElement('span');badge.className='track-source';badge.textContent='LYRICS';
    el.append(symbol,info,status,badge,makeLyricsActions(t));list.append(el);
  }
}
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
  art.title='Change this artist image';
  art.setAttribute('role','button');
  art.setAttribute('tabindex','0');
  art.setAttribute('aria-label','Change image for '+label);

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
  art.dataset.artKey=key;
  const changeImage=e=>{e.stopPropagation();e.preventDefault();openArtworkEditor({key,label,kind,id,showImage})};
  art.addEventListener('click',changeImage);
  art.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){changeImage(e)}});
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
async function searchMatches(term){const matchRequest=++S.matchRequest;S.requestId++;S.loading=false;S.unavailable=[];S.catalogRequest++;S.catalogResolved=false;S.catalogLoading=false;S.artistMbid=null;S.artist=term;S.page=0;S.tracks=[];S.selected=-1;S.view='discover';audio.pause();audio.removeAttribute('src');$('matchPanel').hidden=false;$('matchHeading').textContent='Matches for “'+term+'”';$('matchSummary').textContent='Choose the artist or recording you meant';$('matchList').replaceChildren();show('Finding artists and other matching recordings…');render();let list=$('matchList');let count=0;
try{const data=await getJSON('https://musicbrainz.org/ws/2/artist/?query='+encodeURIComponent('artist:"'+term+'"')+'&fmt=json&limit=15');if(matchRequest!==S.matchRequest)return;for(const artist of (data.artists||[])){const name=artist.name||'';let detail=[artist.type,artist.country,artist.disambiguation].filter(Boolean).join(' · ')||'MusicBrainz artist';list.append(sourceChoice(name,detail,()=>chooseArtist(name,artist.id),'artist',artist.id));count++}}catch(e){if(matchRequest!==S.matchRequest)return;show('MusicBrainz artist lookup was unavailable; showing Archive matches where possible.',true)}
try{const query='mediatype:audio AND ('+'title:('+term+') OR creator:('+term+'))';const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(query)+'&fl[]=identifier&fl[]=title&fl[]=creator&rows=12&page=1&output=json';const data=await getJSON(url);if(matchRequest!==S.matchRequest)return;for(const d of data.response?.docs||[]){const name=Array.isArray(d.title)?d.title[0]:d.title;const creator=Array.isArray(d.creator)?d.creator.join(', '):d.creator||'Unknown creator';list.append(sourceChoice(name||d.identifier,'Internet Archive recording · '+creator,()=>chooseArchiveItem(d),'item',d.identifier));count++}}catch(e){if(matchRequest!==S.matchRequest)return;if(!count)show('The online search services are unavailable. You can still add local audio files.',true)}
if(!count){list.append(sourceChoice('Search Internet Archive for '+term,'Try an exact creator search',()=>chooseArtist(term,null)))}else show('Choose a matching artist or recording above to build your playlist.')}
async function chooseArtist(name,mbid){const selection=++S.matchRequest;S.requestId++;S.loading=false;audio.pause();audio.removeAttribute('src');S.artist=name;S.artistMbid=mbid||null;S.unavailable=[];S.catalogResolved=false;S.catalogLoading=false;S.catalogRequest++;S.page=0;S.tracks=[];S.selected=-1;S.view='discover';$('matchList').querySelectorAll('button').forEach(x=>x.classList.remove('selected'));$('playlistHeading').textContent=name;$('externalSearch').hidden=false;$('externalSearch').href='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' music');$('externalSearch').textContent='Search '+name+' on YouTube ↗';show('Searching publicly available recordings attributed to '+name+'…');render();updatePlayer();await loadMore();if(selection===S.matchRequest&&$('showUnavailable').checked)await loadUnavailable()}
async function chooseArchiveItem(d){S.matchRequest++;const request=++S.requestId;S.loading=false;audio.pause();audio.removeAttribute('src');S.catalogRequest++;S.catalogResolved=false;S.catalogLoading=false;S.unavailable=[];S.artistMbid=null;const name=Array.isArray(d.title)?d.title[0]:d.title||d.identifier;S.artist=Array.isArray(d.creator)?d.creator[0]:d.creator||name;S.page=0;S.selected=-1;S.tracks=[];updatePlayer();$('playlistHeading').textContent=name;$('externalSearch').hidden=true;show('Loading recording: '+name);try{const tracks=await tracksFromItem(d.identifier,S.artist);if(request!==S.requestId)return;S.tracks=tracks;show(tracks.length+' playable files found in this item.');render()}catch(e){if(request===S.requestId)show('Unable to load the selected recording: '+e.message,true)}if(request===S.requestId)$('loadMore').hidden=true}
async function tracksFromItem(id,artist){let m=await getJSON('https://archive.org/metadata/'+encodeURIComponent(id));let files=(m.files||[]).filter(f=>/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i.test(f.name||'')&&!/(_meta|__ia_thumb|spectrogram)/i.test(f.name||''));return files.slice(0,70).map(f=>({id:id+'/'+f.name,title:(f.title||f.name.split('/').pop()).replace(/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i,'').replace(/^\d+[-._ ]+/,'').replace(/_/g,' '),artist,collection:m.metadata?.title||id,source:'ARCHIVE',url:'https://archive.org/download/'+encodeURIComponent(id)+'/'+f.name.split('/').map(encodeURIComponent).join('/')}))}
async function loadMore(){
  if(S.loading||!S.artist)return;
  const request=++S.requestId,artist=S.artist;
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
    const seen=new Set(S.tracks.map(t=>t.id));
    S.tracks.push(...found.filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true}));
    $('loadMore').hidden=page*30>=(result.response?.numFound||0);
    show(S.tracks.length?S.tracks.length+' playable recordings found for '+artist+'.':'No playable Archive recordings found yet for '+artist+'. Try another result or local files.');
    render();
  }catch(e){if(request===S.requestId)show('Online search failed: '+e.message,true)}
  finally{if(request===S.requestId)S.loading=false}
}

// Browse the MusicBrainz recording catalog only when requested. These are title
// references, NOT audio files, and cannot establish absence from every service.
async function loadUnavailable(){
  if(!$('showUnavailable').checked||!S.artist||S.catalogLoading||S.catalogResolved||S.view==='favorites')return;
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
      return !S.tracks.some(p=>norm(p.title)===key);
    });
    S.catalogResolved=true;
    show(S.tracks.length+' playable file(s) found; '+S.unavailable.length+' additional catalog title(s) without a matching playable file. Lyrics links open external search results.');
  }catch(err){
    if(request===S.catalogRequest)show('Could not load catalog-only titles: '+err.message,true);
  }finally{if(request===S.catalogRequest){S.catalogLoading=false;render()}}
}
$('showUnavailable').addEventListener('change',()=>{
  if($('showUnavailable').checked)loadUnavailable();else{S.catalogRequest++;S.catalogLoading=false;render();}
});

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
$('clearList').onclick=()=>{if(S.view==='favorites'){S.favorites=[];localStorage.setItem('artistwave:favorites','[]')}else{S.tracks=[];S.unavailable=[];S.catalogResolved=false;S.catalogLoading=false;S.catalogRequest++;S.selected=-1;audio.pause();audio.removeAttribute('src')}render();updatePlayer()};
$('fileDrop').onclick=()=>$('fileInput').click();$('fileDrop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('fileInput').click()}};
$('fileDrop').ondragover=e=>{e.preventDefault();$('fileDrop').classList.add('dragover')};$('fileDrop').ondragleave=()=>$('fileDrop').classList.remove('dragover');
$('fileDrop').ondrop=e=>{e.preventDefault();$('fileDrop').classList.remove('dragover');addFiles(e.dataTransfer.files)};
$('fileInput').onchange=e=>addFiles(e.target.files);
function addFiles(files){let count=0;for(const file of files){if(!file.type.startsWith('audio/')&&!/\.(mp3|flac|wav|ogg|m4a|opus)$/i.test(file.name))continue;let base=file.name.replace(/\.[^.]+$/,'');let parts=base.split(/\s+-\s+/);let artist=parts.length>1?parts.shift():S.artist||'Local file';let title=parts.length?parts.join(' - '):base;if(S.artist&&norm(artist)!==norm(S.artist)&&parts.length)continue;let url=URL.createObjectURL(file);S.tracks.push({id:'local:'+url,title,artist,collection:'Your device',source:'LOCAL',url});count++}S.view='discover';render();show(count+' local audio files added. Files stay on your device.')}

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
const expandedGenre={name:'Rap',section:null,era:null};
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
function renderGenreTree(){
  const tree=$('genreTree');tree.replaceChildren();
  MUSIC_GENRES.forEach((genre,index)=>{
    if(index===4){
      const heading=document.createElement('div');heading.className='genre-category-heading';
      heading.textContent='SHOWDANCE & TRAINING';tree.append(heading);
    }
    const group=document.createElement('div');group.className='genre-node';
    const open=expandedGenre.name===genre.name;
    const button=document.createElement('button');button.type='button';button.className='genre-top-button';
    button.textContent=genre.icon+'  '+genre.name;
    button.setAttribute('aria-expanded',String(open));
    button.onclick=()=>toggleBrowseGenre(genre);
    group.append(button);
    if(open){
      const sections=document.createElement('div');sections.className='genre-era-list';
      for(const section of genre.sections){
        const sectionOpen=genre.flat||expandedGenre.section===section.name;
        const container=document.createElement('div');container.className='genre-style-group';
        if(!genre.flat){
          const style=document.createElement('button');style.type='button';style.className='genre-style-button';
          style.textContent=section.name+'  ▾';style.setAttribute('aria-expanded',String(sectionOpen));
          style.onclick=()=>toggleBrowseSection(genre,section);
          container.append(style);
        }
        if(sectionOpen){
          for(const [era,artists] of Object.entries(section.eras)){
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
  });
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
renderGenreTree();

render();updatePlayer();