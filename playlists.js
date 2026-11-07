'use strict';
/* My Playlists: user-created collections. All UI is DOM-based and text-safe.
 * Only sanitized references can persist or sync. Local media never leaves
 * the device; saved local entries reattach when their folder is reopened. */
(function(){
  const $=id=>document.getElementById(id);
  const STORE='artistwave:custom-playlists';
  const norm=x=>String(x||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const identity=t=>norm(t.artist)+'|'+norm(t.title);
  const cleanTrack=t=>{
    if(!t||typeof t!=='object'||!t.title||!t.artist)return null;
    const source=String(t.source||'LOCAL').slice(0,30);
    const local=source==='LOCAL';
    const url=!local&&/^https:\/\//.test(t.url||'')?String(t.url).slice(0,1800):'';
    if(!local&&!url)return null;
    return {
      id:local?'':String(t.id||'').slice(0,250),
      title:String(t.title).slice(0,250),artist:String(t.artist).slice(0,250),
      collection:String(t.collection||'').slice(0,250),
      albumKind:t.albumKind==='album'?'album':t.albumKind==='collection'?'collection':'single',
      source,url,
      ...(typeof t.artwork==='string'&&/^https:\/\//.test(t.artwork)?{artwork:t.artwork.slice(0,1800)}:{}),
      ...(typeof t.sourceUrl==='string'&&/^https:\/\//.test(t.sourceUrl)?{sourceUrl:t.sourceUrl.slice(0,1800)}:{})
    };
  };
  const cleanPlaylists=value=>Array.isArray(value)?value.slice(0,80).filter(p=>p&&typeof p==='object').map((p,i)=>({
    id:String(p.id||'playlist-'+i).slice(0,110),
    name:String(p.name||'Untitled playlist').trim().slice(0,80)||'Untitled playlist',
    createdAt:String(p.createdAt||'').slice(0,35),
    tracks:(Array.isArray(p.tracks)?p.tracks:[]).slice(0,350).map(cleanTrack).filter(Boolean)
  })):[];
  const load=()=>{try{return cleanPlaylists(JSON.parse(localStorage.getItem(STORE)||'[]'))}catch{return []}};
  let playlists=load(),selected='',pendingTrack=null,dialogMode='create',renaming='';
  const current=()=>playlists.find(p=>p.id===selected)||null;
  const createId=()=>('playlist-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  const newNode=(tag,cls,text)=>{
    const node=document.createElement(tag);if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;return node;
  };
  function notify(message){
    const live=$('myPlaylistsNotice');
    if(live)live.textContent=message;
  }
  function save(){
    playlists=cleanPlaylists(playlists);
    if(!window.ArtistWaveCloud?.isSignedIn?.()){
      try{localStorage.setItem(STORE,JSON.stringify(playlists))}catch{notify('Your device storage is full; changes may not persist.')}
    }else window.ArtistWaveCloud?.changed?.();
    render();
  }
  function updateNav(){
    $('myPlaylistsCount').textContent=String(playlists.length);
    const active=document.body.dataset.libraryView==='playlists';
    $('myPlaylistsNav').classList.toggle('active',active);
    for(const id of ['discoverNav','favoritesNav','recentNav'])if(active)$(id).classList.remove('active');
    $('myPlaylistsWorkspace').hidden=!active;
  }
  function showLibrary(){
    if(document.body.dataset.mode!=='audio')window.ArtistWaveNavigation?.setMode('audio');
    document.body.dataset.libraryView='playlists';
    updateNav();
    render();
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  function showAudio(event){
    if(document.body.dataset.libraryView!=='playlists')return;
    document.body.dataset.libraryView='browse';
    updateNav();
    const chosen=event?.currentTarget?.id;
    const active=['discoverNav','favoritesNav','recentNav'].includes(chosen)?chosen:'discoverNav';
    $(active).classList.add('active');
  }
  function openEditor(mode,playlist){
    dialogMode=mode;
    renaming=playlist?.id||'';
    $('playlistDialogTitle').textContent=mode==='rename'?'Rename playlist':'Create a playlist';
    $('playlistDialogHint').textContent=mode==='rename'?'Choose a name for this collection.':'Every great soundtrack starts with a name.';
    $('playlistDialogSave').textContent=mode==='rename'?'Save name':'Create playlist';
    $('playlistName').value=mode==='rename'?playlist.name:'';
    $('playlistDialog').showModal();
    $('playlistName').focus();
  }
  function createPlaylist(name){
    if(playlists.length>=80){notify('Playlist limit reached (80).');return null}
    const p={id:createId(),name,createdAt:new Date().toISOString(),tracks:[]};
    playlists.unshift(p);selected=p.id;save();
    // save() normalizes to fresh objects; always return the live collection.
    return current();
  }
  function addTrackTo(playlist,track){
    const cleaned=cleanTrack(track);
    if(!cleaned){notify('This track has no supported playable source.');return false}
    if(playlist.tracks.some(t=>identity(t)===identity(cleaned))){
      notify('Already in '+playlist.name+'.');return false;
    }
    if(playlist.tracks.length>=350){notify('Playlist has reached 350 tracks.');return false}
    playlist.tracks.push(cleaned);
    selected=playlist.id;save();
    notify('Added '+cleaned.title+' to '+playlist.name+'.');
    return true;
  }
  function addTrack(track){
    pendingTrack=cleanTrack(track);
    if(!pendingTrack){notify('This track cannot be added.');return}
    $('playlistPickerTrack').textContent=pendingTrack.title+' · '+pendingTrack.artist;
    renderChoices();
    $('playlistPickerDialog').showModal();
  }
  function renderChoices(){
    const list=$('playlistPickerChoices');list.replaceChildren();
    if(!playlists.length){
      list.append(newNode('p','playlist-picker-empty','No playlists yet. Create one to save this track.'));
      return;
    }
    for(const p of playlists){
      const button=newNode('button','playlist-picker-choice');
      button.type='button';
      const name=newNode('strong','',p.name);
      const count=newNode('span','',p.tracks.length+' tracks');
      const arrow=newNode('span','','＋');
      button.append(name,count,arrow);
      button.onclick=()=>{
        if(pendingTrack)addTrackTo(p,pendingTrack);
        $('playlistPickerDialog').close();pendingTrack=null;
      };
      list.append(button);
    }
  }
  function resolveTrack(track){
    if(track.source!=='LOCAL')return /^https:\/\//.test(track.url||'')?track:null;
    const candidates=window.ArtistWaveLibrary?.getAvailable?.()||[];
    const found=candidates.find(t=>t.source==='LOCAL'&&t.url&&identity(t)===identity(track));
    return found||null;
  }
  function playPlaylist(shuffle=false,startIndex=0){
    const p=current();if(!p||!p.tracks.length)return;
    const playable=p.tracks.map(resolveTrack).filter(Boolean);
    if(!playable.length){notify('No playable tracks available. Reopen your local folder if needed.');return}
    if(shuffle){for(let i=playable.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[playable[i],playable[j]]=[playable[j],playable[i]]}}
    const index=shuffle?0:Math.min(Math.max(0,startIndex),playable.length-1);
    window.ArtistWaveLibrary?.playPlaylist(playable,index);
    notify('Playing '+p.name+' · '+playable.length+' available tracks');
  }
  function moveTrack(index,direction){
    const p=current();if(!p)return;
    const target=index+direction;if(target<0||target>=p.tracks.length)return;
    [p.tracks[index],p.tracks[target]]=[p.tracks[target],p.tracks[index]];
    save();
  }
  function render(){
    updateNav();
    $('myPlaylistsTotal').textContent=playlists.length+' playlist'+(playlists.length===1?'':'s');
    if(!current()&&playlists.length)selected=playlists[0].id;
    const cards=$('myPlaylistsCards');cards.replaceChildren();
    if(!playlists.length){
      const empty=newNode('div','my-playlists-cards-empty');
      empty.append(newNode('span','my-playlists-empty-icon','♫'),newNode('strong','', 'Your first collection starts here.'),newNode('p','','Create a playlist, then save songs while you discover music.'));
      cards.append(empty);
    }
    const colors=['mint','lavender','sunset','blue','gold'];
    for(let i=0;i<playlists.length;i++){
      const p=playlists[i],card=newNode('button','my-playlists-card'+(selected===p.id?' selected':''));
      card.type='button';card.setAttribute('aria-pressed',String(selected===p.id));
      const cover=newNode('span','my-playlists-card-cover '+colors[i%colors.length],'♫');
      const copy=newNode('span','my-playlists-card-copy');
      copy.append(newNode('strong','',p.name),newNode('small','',p.tracks.length+' track'+(p.tracks.length===1?'':'s')));
      card.append(cover,copy,newNode('span','my-playlists-card-arrow','›'));
      card.onclick=()=>{selected=p.id;render()};
      cards.append(card);
    }
    const p=current();
    $('myPlaylistsDetailEmpty').hidden=!!p;
    $('myPlaylistsDetailContent').hidden=!p;
    if(!p)return;
    $('myPlaylistsDetailName').textContent=p.name;
    const available=p.tracks.filter(t=>resolveTrack(t)).length;
    $('myPlaylistsDetailInfo').textContent=p.tracks.length+' saved tracks · '+available+' available now';
    $('myPlaylistsPlay').disabled=!available;
    $('myPlaylistsShuffle').disabled=!available;
    const tracks=$('myPlaylistsTracks');tracks.replaceChildren();
    if(!p.tracks.length){
      const box=newNode('div','my-playlists-tracks-empty');
      box.append(newNode('span','','♫'),newNode('strong','','No tracks yet'),newNode('p','','Click ＋ on a song in Discover or Favorites to add it here.'));
      tracks.append(box);return;
    }
    for(let i=0;i<p.tracks.length;i++){
      const t=p.tracks[i],ready=Boolean(resolveTrack(t));
      const row=newNode('div','my-playlists-track'+(!ready?' missing':''));
      const number=newNode('span','my-playlists-track-number',String(i+1).padStart(2,'0'));
      const details=newNode('div','my-playlists-track-info');
      details.append(newNode('strong','',t.title),newNode('small','',t.artist));
      const badge=newNode('span','my-playlists-track-badge',ready?t.source:'RELINK');
      if(!ready)badge.title='Local audio unavailable on this device. Reopen your music folder.';
      const controls=newNode('div','my-playlists-track-controls');
      const play=newNode('button','','▶');play.type='button';play.title='Play from this track';play.setAttribute('aria-label','Play '+t.title);play.disabled=!ready;
      play.onclick=()=>{const playableBefore=p.tracks.slice(0,i).filter(resolveTrack).length;playPlaylist(false,playableBefore)};
      const up=newNode('button','','↑');up.type='button';up.disabled=i===0;up.title='Move up';up.setAttribute('aria-label','Move '+t.title+' up');up.onclick=()=>moveTrack(i,-1);
      const down=newNode('button','','↓');down.type='button';down.disabled=i===p.tracks.length-1;down.title='Move down';down.setAttribute('aria-label','Move '+t.title+' down');down.onclick=()=>moveTrack(i,1);
      const remove=newNode('button','my-playlists-remove','×');remove.type='button';remove.title='Remove track';remove.setAttribute('aria-label','Remove '+t.title);remove.onclick=()=>{p.tracks.splice(i,1);save()};
      controls.append(play,up,down,remove);
      row.append(number,details,badge,controls);tracks.append(row);
    }
  }
  function init(){
    $('myPlaylistsNav').addEventListener('click',showLibrary);
    for(const id of ['discoverNav','favoritesNav','recentNav']){
      $(id).addEventListener('click',showAudio);
    }
    for(const id of ['modeAudio','studioNav','modeYoutube']){
      $(id).addEventListener('click',showAudio);
    }
    $('myPlaylistsCreate').addEventListener('click',()=>openEditor('create'));
    $('myPlaylistsRename').addEventListener('click',()=>{if(current())openEditor('rename',current())});
    $('myPlaylistsDelete').addEventListener('click',()=>{
      const p=current();
      if(!p||!window.confirm('Delete "'+p.name+'"? This cannot be undone.'))return;
      playlists=playlists.filter(x=>x.id!==p.id);selected=playlists[0]?.id||'';save();
    });
    $('myPlaylistsPlay').addEventListener('click',()=>playPlaylist(false));
    $('myPlaylistsShuffle').addEventListener('click',()=>playPlaylist(true));
    $('playlistDialogCancel').addEventListener('click',()=>$('playlistDialog').close());
    $('playlistDialogForm').addEventListener('submit',event=>{
      event.preventDefault();
      const name=$('playlistName').value.trim().slice(0,80);
      if(!name)return;
      if(dialogMode==='rename'){
        const p=playlists.find(p=>p.id===renaming);
        if(p){p.name=name;save()}
      }else{
        const p=createPlaylist(name);
        if(p&&pendingTrack){
          addTrackTo(p,pendingTrack);
          $('playlistPickerDialog').close();
          pendingTrack=null;
        }
      }
      $('playlistDialog').close();
      if(dialogMode==='create'&&!document.body.dataset.libraryView?.includes('playlists'))showLibrary();
    });
    $('playlistPickerCancel').addEventListener('click',()=>{pendingTrack=null;$('playlistPickerDialog').close()});
    $('playlistPickerCreate').addEventListener('click',()=>openEditor('create'));
    window.addEventListener('artistwave:cloud-load',event=>{
      if(!Array.isArray(event.detail?.customPlaylists))return;
      playlists=cleanPlaylists(event.detail.customPlaylists);selected=playlists[0]?.id||'';render();
    });
    window.ArtistWaveCloud.getPlaylists=()=>cleanPlaylists(playlists);
    render();
  }
  window.ArtistWavePlaylists={addTrack,showLibrary,showAudio,cleanTrack,cleanPlaylists};
  init();
})();
