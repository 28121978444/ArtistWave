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
  function updateYouTubeAccount(){
    // Google Drive OAuth does not create a youtube.com sign-in cookie.
    // YouTube's own embedded player can use an existing browser session
    // where privacy settings permit it; ArtistWave cannot verify that state.
    const connected=Boolean(window.ArtistWaveCloud?.isSignedIn?.());
    $('youtubeAccountHeading').textContent=connected?'Google connected to ArtistWave':'YouTube account';
    $('youtubeAccountStatus').textContent=connected
      ?'ArtistWave is signed into Google. The YouTube player will attempt to use your existing YouTube browser session, if available. If it asks you to sign in, open YouTube in a new tab.'
      :'YouTube uses a separate browser session. Sign into YouTube in a new tab if you want your account there.';
    $('youtubeSignInLink').textContent=connected?'Continue with YouTube ↗':'Open YouTube / Sign in ↗';
  }
  window.addEventListener('artistwave:account-status',updateYouTubeAccount);
  function stopVideo(){
    frame.removeAttribute('src');
    $('youtubePlayerRegion').hidden=true;
  }
  function setMode(target){
    if(!tabs[target])return;
    // A single handler owns workspace visibility. Never rely on the previous
    // mode: an account action, sidebar link or a direct Studio close may have
    // altered visibility without changing the navigation's previous mode.
    if(target==='studio'){
      window.ArtistWaveStudio?.open();
    }else{
      window.ArtistWaveStudio?.close();
    }
    if(target!=='youtube')stopVideo();
    if(target!=='audio')window.ArtistWaveStudioHost?.pauseMain?.();
    if(target==='youtube')window.ArtistWaveStudio?.stop?.();
    mode=target;
    document.body.dataset.mode=target;
    $('studioWorkspace').hidden=target!=='studio';
    $('youtubeWorkspace').hidden=target!=='youtube';
    const entertainment=target==='audio';
    for(const id of ['discoverSection','playlistSection','artistWaveHero']){
      $(id).hidden=!entertainment;
    }
    if(entertainment){
      window.ArtistWaveStudioHost?.render?.();
    }
    for(const [name,tab] of Object.entries(tabs)){
      tab.classList.toggle('active',name===target);
      if(name===target)tab.setAttribute('aria-current','page');
      else tab.removeAttribute('aria-current');
    }
    if(target==='youtube'){updateYouTubeAccount();$('locationName').textContent='YouTube';}
    else if(target==='audio')$('locationName').textContent='Discover';
    else $('locationName').textContent='Showdance Studio';
    // Switching workspaces must never inherit scroll position from another
    // workspace. Keep the mode tabs and the new content at the top.
    window.scrollTo({top:0,left:0,behavior:'instant'});
  }
  tabs.audio.addEventListener('click',()=>setMode('audio'));
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
  updateYouTubeAccount();
})();
