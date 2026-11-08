'use strict';
/* Same-origin controller: one audio engine remains in the main ArtistWave tab.
 * The pop-out never creates another audio stream. */
(function(){
  const $=id=>document.getElementById(id);
  let popup=null;
  function state(){
    const audio=$('audio'),track=window.ArtistWaveLibrary?.getCurrent?.()||null;
    const duration=Number.isFinite(audio.duration)?audio.duration:0;
    return {
      ready:true,title:track?.title||'Nothing playing yet',
      artist:track?.artist||'Find a song in ArtistWave',
      cover:typeof track?.artwork==='string'&&/^https:\/\//i.test(track.artwork)?track.artwork:'',
      source:$('playingSource')?.textContent||'READY',
      playing:!audio.paused&&!!audio.src,
      currentTime:Number.isFinite(audio.currentTime)?audio.currentTime:0,
      duration,
      volume:audio.volume,
      favorite:!!track&&$('favoriteCurrent').textContent==='♥',
      hasTrack:!!track,
      queue:window.ArtistWaveLibrary?.getQueue?.()||[],
      smartQueue:window.ArtistWaveLibrary?.getSmartQueue?.()||[],
      selected:window.ArtistWaveLibrary?.getSelectedIndex?.()??-1,
      shuffle:$('shuffleButton').classList.contains('active'),
      repeat:$('repeatButton').title||'Repeat: off'
    };
  }
  function command(action,value){
    const audio=$('audio');
    if(action==='play')$('playButton').click();
    else if(action==='next')$('nextButton').click();
    else if(action==='previous')$('previousButton').click();
    else if(action==='favorite'&&!$('favoriteCurrent').disabled)$('favoriteCurrent').click();
    else if(action==='save'&&!$('playlistSaveCurrent').disabled){
      $('playlistSaveCurrent').click();
      // The playlist picker belongs to the main page; bring it to the front.
      window.focus();
    }
    else if(action==='queuePlay'&&Number.isInteger(Number(value)))window.ArtistWaveLibrary?.queuePlay?.(Number(value));
    else if(action==='queueRemove'&&Number.isInteger(Number(value)))window.ArtistWaveLibrary?.queueRemove?.(Number(value));
    else if(action==='queueMove'&&Number.isInteger(Number(value?.index))&&Number.isInteger(Number(value?.direction)))
      window.ArtistWaveLibrary?.queueMove?.(Number(value.index),Number(value.direction));
    else if(action==='shuffle')$('shuffleButton').click();
    else if(action==='repeat')$('repeatButton').click();
    else if(action==='volume'){
      const v=Math.min(100,Math.max(0,Number(value)||0));
      $('volumeBar').value=String(v);
      $('volumeBar').dispatchEvent(new Event('input',{bubbles:true}));
    }else if(action==='seek'&&Number.isFinite(audio.duration)&&audio.duration>0){
      const proportion=Math.min(1,Math.max(0,Number(value)||0));
      $('seekBar').value=String(Math.round(proportion*1000));
      $('seekBar').dispatchEvent(new Event('input',{bubbles:true}));
    }else if(action==='track'){
      const i=Number(value);
      if(Number.isInteger(i))window.ArtistWaveLibrary?.playIndex?.(i);
    }
    return state();
  }
  function closeFallback(){
    const wrapper=$('miniPlayerFallback'),frame=$('miniPlayerFallbackFrame');
    wrapper.hidden=true;
    frame.removeAttribute('src');
    document.body.classList.remove('mini-player-active');
    if(new URLSearchParams(window.location.search).get('mini')==='1'){
      const url=new URL(window.location.href);
      url.searchParams.delete('mini');
      window.history?.replaceState?.({},'',url.pathname+url.search+url.hash);
      document.body.classList.remove('mini-direct-route');
    }
  }
  function showFallback(){
    const wrapper=$('miniPlayerFallback');
    $('miniPlayerFallbackFrame').src='mini-player.html?embedded=1';
    wrapper.hidden=false;
    document.body.classList.add('mini-player-active');
  }
  function open(){
    if(popup&&!popup.closed){popup.focus();return}
    // Browsers control actual window sizing; 380px is a request, not a guarantee.
    const height=Math.max(540,Math.round(window.screen?.availHeight||window.innerHeight||780));
    const width=380;
    const left=Math.max(0,Math.round((window.screen?.availWidth||1000)-width-26));
    popup=window.open('mini-player.html','artistwave-mini-player',
      'popup=yes,width='+width+',height='+height+',left='+left+',top=0,resizable=yes,scrollbars=yes');
    if(popup){closeFallback();popup.focus()}
    else showFallback();
  }
  $('openMiniPlayer').addEventListener('click',open);
  window.ArtistWaveMiniHost={state,command,open,closeFallback};
  // Direct bookmark: a fully functioning compact view in this tab/window.
  // The main audio engine runs in this page, so no opener is required.
  if(new URLSearchParams(window.location.search).get('mini')==='1'){
    document.body.classList.add('mini-direct-route');
    window.ArtistWaveLibrary?.prepareMiniLibrary?.();
    showFallback();
  }
})();
