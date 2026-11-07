'use strict';
/* ArtistWave appearance: a browser-local preference, shared by main and mini windows. */
(function(){
  const KEY='artistwave:appearance';
  const choices=new Set(['day','night']);
  function savedTheme(){
    try{
      const value=localStorage.getItem(KEY);
      return choices.has(value)?value:'night';
    }catch{return 'night'}
  }
  function applyTheme(value,persist=false){
    const mode=choices.has(value)?value:'night';
    document.documentElement.dataset.theme=mode;
    document.documentElement.style.colorScheme=mode==='day'?'light':'dark';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',mode==='day'?'#f6f8f0':'#0b1015');
    const button=document.getElementById('themeToggle');
    if(button){
      const isDay=mode==='day';
      button.textContent=isDay?'☾ Night':'☀ Day';
      button.setAttribute('aria-label',isDay?'Switch to Night theme':'Switch to Day theme');
      button.setAttribute('aria-pressed',String(isDay));
      button.title=isDay?'Use night colors':'Use daylight colors';
    }
    if(persist){
      try{localStorage.setItem(KEY,mode)}catch{}
      const iframe=document.getElementById('miniPlayerFallbackFrame');
      try{
        iframe?.contentWindow?.dispatchEvent(new CustomEvent('artistwave:theme',{detail:{theme:mode}}));
      }catch{}
    }
    return mode;
  }
  const toggle=()=>applyTheme(document.documentElement.dataset.theme==='day'?'night':'day',true);
  applyTheme(savedTheme());
  document.getElementById('themeToggle')?.addEventListener('click',toggle);
  window.addEventListener('storage',event=>{
    if(event.key===KEY)applyTheme(choices.has(event.newValue)?event.newValue:'night');
  });
  // Mini Player fallback is an iframe; storage events are not guaranteed to fire
  // in the same tab, so keep its visual theme in step with the host.
  window.addEventListener('artistwave:theme',event=>{
    if(choices.has(event.detail?.theme))applyTheme(event.detail.theme);
  });
  window.ArtistWaveTheme={applyTheme,toggle,savedTheme};
})();
