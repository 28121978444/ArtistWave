'use strict';
/* ArtistWave cloud accounts: no app server or database, only per-user Drive appDataFolder.
   The browser holds short-lived OAuth access tokens in memory, never localStorage. */
(function(){
  const $=id=>document.getElementById(id);
  const S={token:'',expires:0,subject:'',email:'',fileId:'',signed:false,busy:false,
    dirty:false,timer:null,tokenClient:null,clientId:'',accountSnapshot:null,guestSnapshot:null};
  const CLOUD_FILE='artistwave-library-v1.json';
  const SCOPE='openid email profile https://www.googleapis.com/auth/drive.appdata';
  const BASE='https://www.googleapis.com/drive/v3/files';
  const validClient=id=>/^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(id);
  const safeRead=(key,fallback)=>{try{const v=localStorage.getItem(key);return v===null?fallback:JSON.parse(v)}catch{return fallback}};
  const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const status=(message,error=false)=>{const el=$('cloudStatus');if(el){el.textContent=message;el.classList.toggle('error',error)}};
  const providerKeys=['archive','audius','jamendo'];
  const preferenceSnapshot=()=>({
    sourceMode:$('sourceMode').value,
    showUnavailable:$('showUnavailable').checked,
    includeLive:$('includeLive').checked,
    providers:Object.fromEntries(providerKeys.map(k=>[k,$('provider'+(k==='archive'?'Archive':k==='audius'?'Audius':'Jamendo')).checked]))
  });
  const cleanPrefs=value=>{
    const p=value&&typeof value==='object'?value:{};
    return {sourceMode:['both','local','online'].includes(p.sourceMode)?p.sourceMode:'both',
      showUnavailable:Boolean(p.showUnavailable),includeLive:p.includeLive!==false,
      providers:Object.fromEntries(providerKeys.map(k=>[k,p.providers?.[k]===undefined?(k!=='jamendo'):Boolean(p.providers[k])]))};
  };
  // Favorites may keep multiple playback URLs for the same song. Never sync
  // device-local blob URLs, even when they appear only as alternate sources.
  const cleanOnlineTrack=t=>{
    if(!t||typeof t!=='object'||typeof t.id!=='string'||
      typeof t.title!=='string'||typeof t.artist!=='string'||
      typeof t.url!=='string'||!/^https:\/\//.test(t.url)||t.source==='LOCAL')return null;
    return {
      id:t.id.slice(0,250),title:t.title.slice(0,250),artist:t.artist.slice(0,250),
      collection:String(t.collection||'').slice(0,250),
      albumKind:t.albumKind==='album'?'album':t.albumKind==='collection'?'collection':'single',
      year:String(t.year||'').slice(0,4),
      ...(typeof t.artwork==='string'&&/^https:\/\//.test(t.artwork)?{artwork:t.artwork.slice(0,1800)}:{}),
      source:String(t.source||'ARCHIVE').slice(0,30),url:t.url.slice(0,1800),
      ...(typeof t.sourceUrl==='string'&&/^https:\/\//.test(t.sourceUrl)?{sourceUrl:t.sourceUrl.slice(0,1800)}:{})
    };
  };
  const cleanFavorites=value=>Array.isArray(value)?value
    .map(t=>{
      const cleaned=cleanOnlineTrack(t);
      if(!cleaned)return null;
      const variants=Array.isArray(t.alternates)?t.alternates:[];
      const links=variants.map(cleanOnlineTrack).filter(v=>v&&v.url!==cleaned.url).slice(0,10);
      if(links.length)cleaned.alternates=[...new Map(links.map(v=>[v.url,v])).values()];
      return cleaned;
    }).filter(Boolean).slice(0,2000):[];
  const dedupeFavorites=tracks=>{
    const map=new Map();
    for(const t of cleanFavorites(tracks)){
      const key=t.artist.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+'|'+t.title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      if(!map.has(key))map.set(key,t);
    }
    return [...map.values()];
  };
  const cleanRecent=value=>cleanFavorites(value).slice(0,30);
  const payload=(favorites,prefs,recent=[])=>({
    schema:1,updatedAt:new Date().toISOString(),favorites:dedupeFavorites(favorites),
    preferences:cleanPrefs(prefs),recent:cleanRecent(recent),
    customPlaylists:[] // Reserved for a future playlist editor; no audio blobs are uploaded.
  });
  function accountKey(){return 'artistwave:cloud-account:'+S.subject}
  function saveAccountSnapshot(data){S.accountSnapshot=data;safeWrite(accountKey(),data)}
  const updateUI=()=>{
    $('cloudSignIn').hidden=S.signed;
    $('cloudAccountActions').hidden=!S.signed;
    $('cloudAccountName').textContent=S.signed?(S.email||'Google account')+' · Drive sync':'Guest · saved on this device';
    $('cloudSignIn').disabled=S.busy;
    $('cloudSyncNow').disabled=S.busy||!S.signed;
    $('cloudImportGuest').disabled=S.busy||!S.signed;
  };
  function applyPrefs(p){
    const prefs=cleanPrefs(p);
    $('sourceMode').value=prefs.sourceMode;
    $('includeLive').checked=prefs.includeLive;
    $('showUnavailable').checked=prefs.showUnavailable;
    for(const k of providerKeys){
      $('provider'+(k==='archive'?'Archive':k==='audius'?'Audius':'Jamendo')).checked=prefs.providers[k];
    }
  }
  function mergeGuestIntoCurrent(){
    const guest=cleanFavorites(S.guestSnapshot?.favorites);
    const existing=new Set((S.accountSnapshot?.favorites||[]).map(t=>t.id));
    const additions=guest.filter(t=>!existing.has(t.id));
    const merged=dedupeFavorites([...(S.accountSnapshot?.favorites||[]),...additions]);
    return merged;
  }
  function emitApply(favorites,prefs,recent=[]){
    window.dispatchEvent(new CustomEvent('artistwave:cloud-load',{detail:{
      favorites:dedupeFavorites(favorites),preferences:cleanPrefs(prefs),recent:cleanRecent(recent)
    }}));
  }
  async function driveRequest(path,options={}){
    if(!S.token||Date.now()>=S.expires-45000)throw Error('Google session expired. Sign in again to sync.');
    const headers=new Headers(options.headers||{});
    headers.set('Authorization','Bearer '+S.token);
    const response=await fetch(path.startsWith('https://')?path:BASE+path,{...options,headers});
    if(!response.ok){
      if(response.status===401){S.token='';S.expires=0}
      const message=await response.text().catch(()=>String(response.status));
      throw Error('Google Drive '+response.status+': '+message.slice(0,180));
    }
    if(response.status===204)return null;
    const type=response.headers.get('content-type')||'';
    return type.includes('json')?response.json():response.text();
  }
  async function findCloudFile(){
    const query=new URLSearchParams({spaces:'appDataFolder',fields:'nextPageToken,files(id,name,mimeType,modifiedTime)',pageSize:'100'});
    const list=await driveRequest('?'+query);
    const files=(list.files||[]).filter(f=>f.name===CLOUD_FILE);
    return files.sort((a,b)=>String(b.modifiedTime||'').localeCompare(String(a.modifiedTime||'')))[0]?.id||'';
  }
  async function readCloud(){
    S.fileId=await findCloudFile();
    if(!S.fileId)return null;
    const document=await driveRequest('/'+encodeURIComponent(S.fileId)+'?alt=media');
    const value=typeof document==='string'?JSON.parse(document):document;
    if(!value||value.schema!==1||!Array.isArray(value.favorites))throw Error('Unsupported cloud backup format');
    return {schema:1,updatedAt:value.updatedAt||'',favorites:dedupeFavorites(value.favorites),preferences:cleanPrefs(value.preferences),recent:cleanRecent(value.recent)};
  }
  async function writeCloud(data){
    const body=JSON.stringify(data);
    if(S.fileId){
      await driveRequest('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(S.fileId)+'?uploadType=media',{
        method:'PATCH',headers:{'Content-Type':'application/json'},body
      });
    }else{
      const boundary='artistwave'+Date.now();
      const mime='multipart/related; boundary='+boundary;
      const metadata=JSON.stringify({name:CLOUD_FILE,mimeType:'application/json',parents:['appDataFolder']});
      const upload='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata+
        '\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+body+'\r\n--'+boundary+'--';
      const result=await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
        method:'POST',headers:{'Content-Type':mime},body:upload
      });
      S.fileId=result.id;
      if(!S.fileId)throw Error('Drive did not return a file ID');
    }
    saveAccountSnapshot(data);
  }
  async function syncNow(){
    if(!S.signed||S.busy)return;
    S.busy=true;updateUI();status('Syncing favorites and settings…');
    try{
      // Always re-read current cloud state and use timestamps to avoid silent overwrites.
      const remote=await readCloud();
      const local=S.accountSnapshot||payload([],preferenceSnapshot());
      const current=payload(window.ArtistWaveCloud.getFavorites(),preferenceSnapshot(),window.ArtistWaveCloud.getRecent());
      const remoteDate=Date.parse(remote?.updatedAt||0)||0;
      const localDate=Date.parse(local?.updatedAt||0)||0;
      if(remote&&remoteDate>localDate&&S.dirty){
        status('Another device has newer data. Reload from cloud or merge guest favorites; changes were not overwritten.',true);
        return;
      }
      if(remote&&remoteDate>localDate&&!S.dirty){
        saveAccountSnapshot(remote);
        emitApply(remote.favorites,remote.preferences,remote.recent);
        status('Loaded newer library from Google Drive.');
      }else{
        await writeCloud(current);S.dirty=false;
        status('Synced to private Google Drive storage · '+new Date().toLocaleTimeString());
      }
    }catch(e){status('Sync failed: '+e.message,true)}
    finally{S.busy=false;updateUI()}
  }
  function queueSync(){
    if(!S.signed)return;
    S.dirty=true;
    if(S.timer)clearTimeout(S.timer);
    S.timer=setTimeout(()=>{S.timer=null;syncNow()},1800);
    status('Changes saved locally · cloud sync pending');
  }
  function restoreGuest(){
    const data=S.guestSnapshot||{favorites:[],preferences:cleanPrefs({})};
    emitApply(data.favorites,data.preferences,data.recent);
  }
  function logout(){
    if(S.timer){clearTimeout(S.timer);S.timer=null}
    if(S.dirty){status('There are unsynced account changes. Select Sync now before signing out.',true);return}
    if(S.token&&window.google?.accounts?.oauth2?.revoke)window.google.accounts.oauth2.revoke(S.token,()=>{});
    S.token='';S.expires=0;S.subject='';S.email='';S.fileId='';S.signed=false;S.dirty=false;
    restoreGuest();updateUI();status('Signed out · guest library restored');
  }
  function loadGoogle(){
    if(window.google?.accounts?.oauth2?.initTokenClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';
      script.async=true;script.onload=resolve;script.onerror=()=>reject(Error('Google sign-in library could not load'));
      document.head.append(script);
    });
  }
  async function connect(tokenResponse){
    if(tokenResponse.error||!tokenResponse.access_token)throw Error(tokenResponse.error||'Google did not grant access');
    const token=tokenResponse.access_token;
    const expiry=Date.now()+Math.max(60,Number(tokenResponse.expires_in||3600))*1000;
    const identityResponse=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+token}});
    if(!identityResponse.ok)throw Error('Could not confirm Google account identity');
    const identity=await identityResponse.json();
    if(!identity.sub)throw Error('Account identifier missing');
    // Preserve guest state before applying account-specific data.
    S.guestSnapshot={favorites:window.ArtistWaveCloud.getFavorites(),preferences:preferenceSnapshot(),recent:window.ArtistWaveCloud.getRecent()};
    S.token=token;S.expires=expiry;S.subject=String(identity.sub);S.email=String(identity.email||'Google account');S.fileId='';
    let remote;
    try{remote=await readCloud()}
    catch(e){S.token='';S.expires=0;S.subject='';S.email='';S.fileId='';throw e}
    const cache=safeRead(accountKey(),null);
    let account=remote||cache;
    if(!account){
      account=payload(S.guestSnapshot.favorites,S.guestSnapshot.preferences,S.guestSnapshot.recent);
      await writeCloud(account);
    }
    S.signed=true;S.dirty=false;
    saveAccountSnapshot(account);
    emitApply(account.favorites,account.preferences,account.recent);
    updateUI();status('Connected · private Google Drive library loaded');
  }
  function beginSignIn(){
    if(S.busy)return;
    S.clientId=($('googleClientId').value||'').trim();
    if(!validClient(S.clientId)){
      $('cloudSetup').open=true;
      status('Google OAuth is not configured. The site owner must create a Web application client ID.',true);
      return;
    }
    // Google popup must be launched directly from the user's click. An async
    // script download / await here can lose browser user activation.
    if(!window.google?.accounts?.oauth2?.initTokenClient){
      status('Google Identity Services is still loading or blocked. Reload the page and try again.',true);
      return;
    }
    S.busy=true;updateUI();status('Opening Google account consent…');
    try{
      S.tokenClient=window.google.accounts.oauth2.initTokenClient({
        client_id:S.clientId,scope:SCOPE,callback:async response=>{
          try{await connect(response)}
          catch(error){status('Sign-in failed: '+error.message,true)}
          finally{S.busy=false;updateUI()}
        },error_callback:error=>{
          S.busy=false;updateUI();
          status('Google sign-in cancelled or blocked: '+(error.type||'unknown'),true)
        }
      });
      S.tokenClient.requestAccessToken({prompt:'consent'});
    }catch(e){
      S.busy=false;updateUI();
      status('Could not start Google sign-in: '+e.message,true);
    }
  }
  function saveClient(){
    const id=$('googleClientId').value.trim();
    if(!validClient(id)){status('Invalid Google OAuth web client ID.',true);return}
    S.clientId=id;
    try{localStorage.setItem('artistwave:google-client-id',id)}catch{}
    status('OAuth client ID saved on this device. Select Sign in with Google.');
  }
  function init({getFavorites,getRecent=()=>[]}){
    window.ArtistWaveCloud.getFavorites=getFavorites;
    window.ArtistWaveCloud.getRecent=getRecent;
    const meta=document.querySelector('meta[name="google-oauth-client-id"]')?.content?.trim();
    S.clientId=meta||localStorage.getItem('artistwave:google-client-id')||'';
    $('googleClientId').value=S.clientId;
    $('cloudSaveClient').onclick=saveClient;
    $('cloudSignIn').onclick=beginSignIn;
    $('cloudSignOut').onclick=logout;
    $('cloudSyncNow').onclick=syncNow;
    $('cloudImportGuest').onclick=()=>{
      if(!S.signed)return;
      const current=window.ArtistWaveCloud.getFavorites();
      const additional=dedupeFavorites([...current,...cleanFavorites(S.guestSnapshot?.favorites)]);
      emitApply(additional,preferenceSnapshot(),window.ArtistWaveCloud.getRecent());queueSync();
      status('Guest favorites imported. Syncing…');
    };
    updateUI();
  }
  window.ArtistWaveCloud={init,changed:queueSync,isSignedIn:()=>S.signed,
    persistGuestFavorites:favs=>{if(!S.signed)safeWrite('artistwave:favorites',favs)},
    persistGuestRecent:recent=>{if(!S.signed)safeWrite('artistwave:recent',cleanRecent(recent))},
    persistGuestSetting:(key,value)=>{if(!S.signed){try{localStorage.setItem(key,value)}catch{}}},
    cleanFavorites,cleanPrefs,payload};
})();
