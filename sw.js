'use strict';
/* ArtistWave application shell only. Never cache music, cloud-account APIs,
   remote artwork, Google OAuth, or other provider responses. */
const CACHE='artistwave-shell-v1';
const SCOPE=new URL(self.registration.scope);
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./cloud-sync.js',
  './studio.js','./navigation.js','./playlists.js','./mini-player-host.js',
  './mini-player.html','./mini-player.css','./mini-player.js','./theme.js',
  './install.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'
];
const paths=new Set(ASSETS.map(path=>new URL(path,SCOPE).pathname));
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('artistwave-shell-')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
  if(!paths.has(url.pathname))return;
  // Network first to avoid keeping old code or styles after deployment.
  event.respondWith(fetch(request).then(response=>{
    if(response.ok&&response.type==='basic'){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
    }
    return response;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(request,{ignoreSearch:true})||Response.error();
  }));
});
