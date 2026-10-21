const CACHE='kanban-oficial-unificado-20261021-1';
const HOME=new URL('./index.html',self.registration.scope).toString();
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.add(HOME)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kanban-oficial-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;const isApp=u.pathname.endsWith('/index.html')||u.pathname===new URL(self.registration.scope).pathname;e.respondWith(fetch(e.request).then(r=>{if(r.ok&&isApp){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(HOME,copy)))}return r}).catch(()=>isApp?caches.match(HOME):caches.match(e.request)))});
