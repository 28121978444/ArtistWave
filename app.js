'use strict';
const $=id=>document.getElementById(id),audio=$('audio');
const S={artist:'',tracks:[],local:[],favorites:[],selected:-1,matches:[],view:'discover',shuffle:false,repeat:0,page:0,loading:false,artistMbid:null,unavailable:[],catalogLoading:false,catalogResolved:false,catalogRequest:0};
try{S.favorites=JSON.parse(localStorage.getItem('artistwave:favorites')||'[]')}catch{}if(!Array.isArray(S.favorites))S.favorites=[];
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const time=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const show=(msg,error=false)=>{$('statusMessage').textContent=msg;$('statusMessage').classList.toggle('error',error)};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const creatorMatches=(value,name)=>{let list=Array.isArray(value)?value:[value];return list.some(v=>String(v||'').split(/\s*(?:;|\||,|\bfeat\.?\b|\bfeaturing\b)\s*/i).some(a=>norm(a)===norm(name)))};
const current=()=>S.tracks[S.selected];
function updatePlayer(){const t=current();$('nowTitle').textContent=t?.title||'Nothing playing yet';$('nowArtist').textContent=t?.artist||'Find your next favorite';$('playingSource').textContent=t?.source||'READY';$('playButton').textContent=audio.paused?'▶':'Ⅱ';$('favoriteCurrent').disabled=!t;$('favoriteCurrent').textContent=t&&S.favorites.some(x=>x.id===t.id)?'♥':'♡'}
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
    el.append(play,info,collection,source,fav);list.append(el);
  });
  for(const t of unplayable){
    const el=document.createElement('div');el.className='track-row unavailable-row';
    const symbol=document.createElement('span');symbol.className='unavailable-mark';symbol.textContent='—';symbol.title='No playable audio in ArtistWave';
    const info=document.createElement('div');info.className='track-info';
    const title=document.createElement('strong');title.textContent=t.title;
    const artist=document.createElement('small');artist.textContent=t.artist;info.append(title,artist);
    const status=document.createElement('span');status.className='recording-name';status.textContent='No playable audio found';
    const badge=document.createElement('span');badge.className='track-source';badge.textContent='LYRICS';
    const link=document.createElement('a');link.className='lyrics-link';
    link.href='https://genius.com/search?q='+encodeURIComponent(t.artist+' '+t.title);
    link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='Find lyrics ↗';link.title='Search for this song on Genius (results not guaranteed)';
    el.append(symbol,info,status,badge,link);list.append(el);
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
async function searchMatches(term){S.unavailable=[];S.catalogRequest++;S.catalogResolved=false;S.artistMbid=null;S.artist=term;S.page=0;S.tracks=[];S.selected=-1;S.view='discover';audio.pause();audio.removeAttribute('src');$('matchPanel').hidden=false;$('matchHeading').textContent='Matches for “'+term+'”';$('matchSummary').textContent='Choose the artist or recording you meant';$('matchList').replaceChildren();show('Finding artists and other matching recordings…');render();let list=$('matchList');let count=0;
try{const data=await getJSON('https://musicbrainz.org/ws/2/artist/?query='+encodeURIComponent('artist:"'+term+'"')+'&fmt=json&limit=15');for(const artist of (data.artists||[])){const name=artist.name||'';let detail=[artist.type,artist.country,artist.disambiguation].filter(Boolean).join(' · ')||'MusicBrainz artist';list.append(sourceChoice(name,detail,()=>chooseArtist(name,artist.id),'artist',artist.id));count++}}catch(e){show('MusicBrainz artist lookup was unavailable; showing Archive matches where possible.',true)}
try{const query='mediatype:audio AND ('+'title:('+term+') OR creator:('+term+'))';const url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(query)+'&fl[]=identifier&fl[]=title&fl[]=creator&rows=12&page=1&output=json';const data=await getJSON(url);for(const d of data.response?.docs||[]){const name=Array.isArray(d.title)?d.title[0]:d.title;const creator=Array.isArray(d.creator)?d.creator.join(', '):d.creator||'Unknown creator';list.append(sourceChoice(name||d.identifier,'Internet Archive recording · '+creator,()=>chooseArchiveItem(d),'item',d.identifier));count++}}catch(e){if(!count)show('The online search services are unavailable. You can still add local audio files.',true)}
if(!count){list.append(sourceChoice('Search Internet Archive for '+term,'Try an exact creator search',()=>chooseArtist(term,null)))}else show('Choose a matching artist or recording above to build your playlist.')}
async function chooseArtist(name,mbid){S.artist=name;S.artistMbid=mbid||null;S.unavailable=[];S.catalogResolved=false;S.catalogRequest++;S.page=0;S.tracks=[];S.selected=-1;S.view='discover';$('matchList').querySelectorAll('button').forEach(x=>x.classList.remove('selected'));$('playlistHeading').textContent=name;$('externalSearch').hidden=false;$('externalSearch').href='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' music');$('externalSearch').textContent='Search '+name+' on YouTube ↗';show('Searching publicly available recordings attributed to '+name+'…');render();await loadMore();if($('showUnavailable').checked)await loadUnavailable()}
async function chooseArchiveItem(d){S.catalogRequest++;S.catalogResolved=false;S.unavailable=[];S.artistMbid=null;const name=Array.isArray(d.title)?d.title[0]:d.title||d.identifier;S.artist=Array.isArray(d.creator)?d.creator[0]:d.creator||name;S.page=0;S.selected=-1;S.tracks=[];$('playlistHeading').textContent=name;$('externalSearch').hidden=true;show('Loading recording: '+name);try{const tracks=await tracksFromItem(d.identifier,S.artist);S.tracks=tracks;show(tracks.length+' playable files found in this item.');render()}catch(e){show('Unable to load the selected recording: '+e.message,true)}$('loadMore').hidden=true}
async function tracksFromItem(id,artist){let m=await getJSON('https://archive.org/metadata/'+encodeURIComponent(id));let files=(m.files||[]).filter(f=>/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i.test(f.name||'')&&!/(_meta|__ia_thumb|spectrogram)/i.test(f.name||''));return files.slice(0,70).map(f=>({id:id+'/'+f.name,title:(f.title||f.name.split('/').pop()).replace(/\.(mp3|ogg|oga|m4a|aac|wav|flac|opus)$/i,'').replace(/^\d+[-._ ]+/,'').replace(/_/g,' '),artist,collection:m.metadata?.title||id,source:'ARCHIVE',url:'https://archive.org/download/'+encodeURIComponent(id)+'/'+f.name.split('/').map(encodeURIComponent).join('/')}))}
async function loadMore(){if(S.loading||!S.artist)return;S.loading=true;$('loadMore').hidden=true;const page=++S.page;try{let q='mediatype:audio AND creator:("'+S.artist.replace(/"/g,'')+'")';if(!$('includeLive').checked)q+=' AND NOT collection:etree';let url='https://archive.org/advancedsearch.php?q='+encodeURIComponent(q)+'&fl[]=identifier&fl[]=title&fl[]=creator&rows=30&page='+page+'&output=json';const result=await getJSON(url);const docs=(result.response?.docs||[]).filter(d=>creatorMatches(d.creator,S.artist));let found=[];for(const d of docs.slice(0,15)){try{found.push(...await tracksFromItem(d.identifier,S.artist))}catch{}}const seen=new Set(S.tracks.map(t=>t.id));S.tracks.push(...found.filter(t=>{if(seen.has(t.id))return false;seen.add(t.id);return true}));$('loadMore').hidden=page*30>=(result.response?.numFound||0);show(S.tracks.length?S.tracks.length+' playable recordings found for '+S.artist+'.':'No playable Archive recordings found yet for '+S.artist+'. Try another result or local files.');render()}catch(e){show('Online search failed: '+e.message,true)}finally{S.loading=false}}

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
$('clearList').onclick=()=>{if(S.view==='favorites'){S.favorites=[];localStorage.setItem('artistwave:favorites','[]')}else{S.tracks=[];S.unavailable=[];S.catalogResolved=false;S.catalogRequest++;S.selected=-1;audio.pause();audio.removeAttribute('src')}render();updatePlayer()};
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
let chosenRapEra=null;
function renderGenreTree(){
  const tree=$('genreTree');tree.replaceChildren();
  const genre=document.createElement('details');genre.className='genre-node';genre.open=true;
  const summary=document.createElement('summary');summary.textContent='🎤 Rap';genre.append(summary);
  const years=document.createElement('div');years.className='genre-era-list';
  for(const decade of Object.keys(RAP_ERAS)){
    const btn=document.createElement('button');btn.type='button';btn.className='genre-era-button';
    btn.textContent=decade;btn.setAttribute('aria-pressed',String(decade===chosenRapEra));
    btn.onclick=()=>showRapEra(decade);
    years.append(btn);
  }
  genre.append(years);tree.append(genre);
}
function showRapEra(decade){
  chosenRapEra=decade;renderGenreTree();
  const panel=$('genreResults');panel.hidden=false;
  $('genreResultsHeading').textContent='Rap → '+decade;
  $('genreResultsCount').textContent=RAP_ERAS[decade].length+' ARTISTS';
  $('genreResultsDescription').textContent='Featured names first, then more artists active in this era. Click any name to build an artist-only playlist.';
  const list=$('genreArtistList');list.replaceChildren();
  for(const [name,description] of RAP_ERAS[decade]){
    const button=document.createElement('button');button.className='genre-artist-card';button.type='button';
    const title=document.createElement('strong');title.textContent=name;
    const detail=document.createElement('small');detail.textContent=description;
    const arrow=document.createElement('span');arrow.textContent='↗';
    button.append(title,detail,arrow);
    button.onclick=()=>{
      $('artistInput').value=name;
      $('locationName').textContent='Rap / '+decade+' / '+name;
      // Curated artist selection opens their playlist directly.
      $('matchPanel').hidden=true;
      chooseArtist(name,null);
      $('playlistSection').scrollIntoView({behavior:'smooth',block:'start'});
    };
    list.append(button);
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
renderGenreTree();

render();updatePlayer();