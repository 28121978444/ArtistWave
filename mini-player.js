'use strict';
/* Pop-out UI: reads and controls the one playback engine in the main window. */
(function(){
  const $=id=>document.getElementById(id);
  const embedded=new URLSearchParams(location.search).get('embedded')==='1';
  let host=null,lastQueue='',lastCover='',draggingSeek=false,draggingVolume=false;
  function connect(){
    try{
      const origin=embedded?window.parent:window.opener;
      if(!origin||origin===window||origin.closed)return null;
      // Same-origin access only. A disconnected / navigated-away opener is safe.
      return origin.ArtistWaveMiniHost||null;
    }catch{return null}
  }
  function send(action,value){
    const target=connect();
    if(!target)return refresh();
    try{target.command(action,value)}catch{}
    refresh();
  }
  const clock=x=>{
    const n=Number(x);
    if(!Number.isFinite(n)||n<0)return '0:00';
    return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
  };
  function updateQueue(queue,selected){
    const signature=JSON.stringify([queue.map(t=>[t.title,t.artist,t.index]),selected]);
    if(signature===lastQueue)return;
    lastQueue=signature;
    const list=$('miniQueueList');list.replaceChildren();
    $('miniQueueCount').textContent=queue.length+' track'+(queue.length===1?'':'s');
    if(!queue.length){
      const p=document.createElement('p');p.className='queue-empty';
      p.textContent='Find music in the main ArtistWave window to start listening.';
      list.append(p);return;
    }
    for(const track of queue.slice(0,150)){
      const button=document.createElement('button');button.type='button';
      button.className='queue-song'+(track.index===selected?' active':'');
      button.setAttribute('aria-label','Play '+track.title+' by '+track.artist);
      const number=document.createElement('span');number.textContent=track.index===selected?'♫':String(track.index+1).padStart(2,'0');
      const copy=document.createElement('span');copy.className='song-info';
      const title=document.createElement('strong');title.textContent=track.title;
      const artist=document.createElement('small');artist.textContent=track.artist;
      copy.append(title,artist);
      const arrow=document.createElement('span');arrow.textContent=track.index===selected?'●':'▶';
      button.append(number,copy,arrow);
      button.onclick=()=>send('track',track.index);
      list.append(button);
    }
  }
  function refresh(){
    host=connect();
    if(!host){
      document.body.classList.add('disconnected');
      $('miniConnection').textContent='Main player disconnected';
      $('miniPlaybackLabel').textContent='RECONNECT ARTISTWAVE';
      for(const id of ['miniPlay','miniNext','miniPrevious','miniSeek','miniShuffle','miniRepeat','miniVolume','miniFavorite','miniSave'])
        $(id).disabled=true;
      return;
    }
    let state;
    try{state=host.state()}catch{return}
    document.body.classList.remove('disconnected');
    $('miniConnection').textContent='Connected to ArtistWave';
    $('miniPlaybackLabel').textContent=state.playing?'NOW PLAYING':'PAUSED / READY';
    $('miniTitle').textContent=state.title;
    $('miniArtist').textContent=state.artist;
    $('miniSource').textContent=state.source;
    $('miniPlay').textContent=state.playing?'Ⅱ':'▶';
    $('miniPlay').setAttribute('aria-label',state.playing?'Pause':'Play');
    $('miniFavorite').classList.toggle('selected',state.favorite);
    $('miniFavorite').firstChild.textContent=state.favorite?'♥ ':'♡ ';
    $('miniShuffle').classList.toggle('active',state.shuffle);
    $('miniRepeat').classList.toggle('active',state.repeat!=='Repeat: off');
    $('miniRepeat').title=state.repeat;
    $('miniCurrent').textContent=clock(state.currentTime);
    $('miniDuration').textContent=clock(state.duration);
    $('miniSeek').disabled=!state.duration;
    if(!draggingSeek)$('miniSeek').value=state.duration?String(Math.round(state.currentTime/state.duration*1000)):'0';
    if(!draggingVolume)$('miniVolume').value=String(Math.round(state.volume*100));
    $('miniVolumeValue').textContent=Math.round(state.volume*100)+'%';
    for(const id of ['miniPlay','miniNext','miniPrevious','miniShuffle','miniRepeat','miniVolume'])
      $(id).disabled=false;
    $('miniFavorite').disabled=!state.hasTrack;
    $('miniSave').disabled=!state.hasTrack;
    if(lastCover!==state.cover){
      lastCover=state.cover;
      const img=$('miniCoverImage');
      if(state.cover){
        img.hidden=false;
        img.onerror=()=>{img.hidden=true;$('miniArtPlaceholder').hidden=false};
        img.onload=()=>{$('miniArtPlaceholder').hidden=true};
        img.src=state.cover;
      }else{
        img.hidden=true;
        img.removeAttribute('src');
        $('miniArtPlaceholder').hidden=false;
      }
    }
    updateQueue(state.queue||[],state.selected);
  }
  const bind=(id,action)=>$(id).addEventListener('click',()=>send(action));
  bind('miniPlay','play');bind('miniPrevious','previous');bind('miniNext','next');
  bind('miniShuffle','shuffle');bind('miniRepeat','repeat');
  bind('miniFavorite','favorite');bind('miniSave','save');
  $('miniSeek').addEventListener('input',event=>{draggingSeek=true;send('seek',Number(event.target.value)/1000)});
  $('miniSeek').addEventListener('change',()=>{draggingSeek=false;refresh()});
  $('miniVolume').addEventListener('input',event=>{draggingVolume=true;send('volume',event.target.value)});
  $('miniVolume').addEventListener('change',()=>{draggingVolume=false;refresh()});
  $('miniClose').addEventListener('click',()=>{
    if(embedded)try{window.parent.ArtistWaveMiniHost?.closeFallback()}catch{}
    else window.close();
  });
  $('miniOpenMain').addEventListener('click',()=>{
    try{
      const main=embedded?window.parent:window.opener;
      if(main&&!main.closed){main.focus();if(embedded)main.ArtistWaveMiniHost?.closeFallback();return}
    }catch{}
    if(!embedded)window.open('./','_blank');
  });
  refresh();
  setInterval(refresh,500);
})();
