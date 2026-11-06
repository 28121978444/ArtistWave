'use strict';
/* Three separate listening workspaces. The YouTube view uses only YouTube's
 * official visible embedded player; never fetches or extracts audio streams. */
(function(){
  const $=id=>document.getElementById(id);
  const tabs={audio:$('modeAudio'),studio:$('studioNav'),youtube:$('modeYoutube')};
  const frame=$('youtubeFrame');
  let mode='audio';
  function parseYouTubeUrl(value){
    let url;
    try{url=new URL(String(value||'').trim())}catch{return null}
    if(url.protocol!=='https:')return null;
    const host=url.hostname.toLowerCase();
    const full=['www.youtube.com','youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'];
    const short=['youtu.be','www.youtu.be'];
    const videoId=host.endsWith('.youtube.com')||full.includes(host) ? (
      url.pathname==='/watch'?url.searchParams.get('v'):
      /^\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.test(url.pathname)?url.pathname.split('/')[2]:null
    ):short.includes(host)?url.pathname.split('/')[1]:null;
    const safeId=/^[A-Za-z0-9_-]{11}$/.test(videoId||'')?videoId:null;
    const listId=full.includes(host)&&/^[A-Za-z0-9_-]{12,80}$/.test(url.searchParams.get('list')||'')?url.searchParams.get('list'):null;
    if(!safeId&&!listId)return null;
    const base='https://www.youtube.com/embed/';
    if(safeId)return base+safeId+(listId?'?list='+encodeURIComponent(listId):'');
    return base+'videoseries?list='+encodeURIComponent(listId);
  }
  function stopVideo(){
    frame.removeAttribute('src');
    $('youtubePlayerRegion').hidden=true;
  }
  function setMode(target){
    if(!tabs[target])return;
    if(target!=='studio'&&mode==='studio')window.ArtistWaveStudio?.close();
    if(target==='studio'&&mode!=='studio')window.ArtistWaveStudio?.open();
    if(target!=='youtube')stopVideo();
    if(target==='youtube'){
      window.ArtistWaveStudioHost?.pauseMain?.();
      window.ArtistWaveStudio?.stop?.();
    }
    mode=target;
    document.body.dataset.mode=target;
    for(const [name,tab] of Object.entries(tabs)){
      tab.classList.toggle('active',name===target);
      if(name===target)tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
    if(target==='youtube')$('locationName').textContent='YouTube';
    else if(target==='audio')$('locationName').textContent='Discover';
    $('youtubeWorkspace').hidden=target!=='youtube';
    if(target==='audio')window.ArtistWaveStudioHost?.render?.();
  }
  tabs.audio.addEventListener('click',()=>setMode('audio'));
  // studioNav already has the Studio open handler, attached by studio.js.
  tabs.studio.addEventListener('click',()=>setMode('studio'));
  tabs.youtube.addEventListener('click',()=>setMode('youtube'));
  $('studioClose').addEventListener('click',()=>setMode('audio'));
  for(const id of ['discoverNav','favoritesNav','recentNav']){
    $(id).addEventListener('click',()=>setMode('audio'));
  }
  $('youtubeLinkForm').addEventListener('submit',event=>{
    event.preventDefault();
    const embed=parseYouTubeUrl($('youtubeUrl').value);
    if(!embed){
      $('youtubeMessage').textContent='Paste a valid YouTube video or playlist HTTPS link.';
      $('youtubeMessage').classList.add('error');
      stopVideo();
      return;
    }
    window.ArtistWaveStudioHost?.pauseMain?.();
    $('youtubeMessage').classList.remove('error');
    $('youtubeMessage').textContent='Video loaded in the official YouTube player. Some videos do not allow embedding.';
    frame.src=embed;
    $('youtubePlayerRegion').hidden=false;
  });
  $('youtubeSearchForm').addEventListener('submit',event=>{
    if(!$('youtubeSearch').value.trim())event.preventDefault();
  });
  window.ArtistWaveNavigation={setMode,parseYouTubeUrl};
  document.body.dataset.mode='audio';
})();
