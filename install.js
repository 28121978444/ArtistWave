'use strict';
/* Progressive enhancement. The install prompt is controlled by the browser. */
(function(){
  const button=document.getElementById('installAppButton');
  const status=document.getElementById('installAppStatus');
  let deferredPrompt=null;
  const installed=()=>window.matchMedia?.('(display-mode: standalone)').matches||
    window.navigator?.standalone===true;
  function message(value){
    if(!status)return;
    status.textContent=value;
    status.hidden=false;
  }
  function update(){
    if(!button)return;
    if(installed()){
      button.textContent='✓ App';
      button.disabled=true;
      button.setAttribute('aria-label','ArtistWave is running as an installed app');
    }else{
      button.disabled=false;
      button.textContent='⬇ Install';
    }
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    update();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;update();
    message('ArtistWave installed. Use its desktop or app launcher shortcut.');
  });
  button?.addEventListener('click',async()=>{
    if(installed())return;
    if(deferredPrompt){
      const prompt=deferredPrompt;deferredPrompt=null;
      try{
        await prompt.prompt();
        const choice=await prompt.userChoice;
        message(choice?.outcome==='accepted'?'Install requested. Check your app launcher.':'Install cancelled. You can try again using your browser menu.');
      }catch{
        message('Installation was not available. Use your browser menu: Install app.');
      }
    }else{
      message('To install: open the Chrome or Edge menu (⋮) and choose Install ArtistWave / Install this site as an app. On Safari use Add to Dock or Add to Home Screen. Browser support varies.');
    }
  });
  if('serviceWorker' in navigator&&window.isSecureContext!==false){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{
        // Installation may still work without an offline shell.
      });
    });
  }
  update();
})();
