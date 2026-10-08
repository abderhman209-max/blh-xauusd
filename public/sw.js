self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil((async()=>{
  // Retire cached assets from earlier interfaces, without touching account data.
  for(const key of await caches.keys())if(key.startsWith('pipvoria')||key.startsWith('blh'))await caches.delete(key);
  await self.clients.claim();
})()));
