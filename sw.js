// Troque o sufixo a cada publicação para invalidar o cache anterior.
const CACHE='kanban-oficial-unificado-20261028-v92-rascunho';
const SCOPE=new URL(self.registration.scope);
const HOME=new URL('./index.html',SCOPE).toString();
const ASSETS=['./index.html','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png','./icon-maskable-512.png'].map(p=>new URL(p,SCOPE).toString());
const NETWORK_TIMEOUT_MS=4000;
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
// Remove caches antigos deste app (prefixos kanban-), preservando o atual.
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kanban-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Rede primeiro com tempo-limite: sinal fraco no campo não trava a abertura; usa o cache após 4 s.
function networkFirst(request,cacheKey){
  return new Promise(resolve=>{
    let settled=false;
    const fallback=()=>caches.match(cacheKey).then(r=>r||caches.match(request)).then(r=>r||new Response('Offline e sem cópia em cache.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}));
    // Só desiste da rede se houver cópia em cache; sem cópia, continua esperando a rede.
    const timer=setTimeout(()=>{caches.match(cacheKey).then(r=>{if(r&&!settled){settled=true;resolve(r)}})},NETWORK_TIMEOUT_MS);
    fetch(request).then(r=>{
      if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(cacheKey,copy))}
      if(!settled){settled=true;clearTimeout(timer);resolve(r)}
    }).catch(()=>{if(!settled){clearTimeout(timer);fallback().then(r=>{settled=true;resolve(r)})}});
  });
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return;
  const isApp=e.request.mode==='navigate'||u.pathname.endsWith('/index.html')||u.pathname===SCOPE.pathname;
  e.respondWith(networkFirst(e.request,isApp?HOME:e.request.url));
});
