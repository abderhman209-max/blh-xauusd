self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil((async()=>{
  // Retire cached assets from earlier interfaces, without touching account data.
  for(const key of await caches.keys())if(key.startsWith('pipvoria')||key.startsWith('blh'))await caches.delete(key);
  await self.clients.claim();
})()));
// AI plan notifications sent by the server; only same-site links are opened.
self.addEventListener("push", event => {
  let data={};try{data=event.data?.json()||{};}catch{}
  const url=typeof data.url==='string'&&data.url.startsWith('/')&&!data.url.startsWith('//')?data.url:'/';
  event.waitUntil(self.registration.showNotification(String(data.title||'Pipvoria').slice(0,120),
    {body:String(data.body||'').slice(0,240),tag:data.tag?String(data.tag).slice(0,80):undefined,icon:'/pipvoria-icon.svg',badge:'/pipvoria-icon.svg',data:{url}}));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();const url=event.notification.data?.url||'/';
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true}),open=windows.find(w=>new URL(w.url).origin===self.location.origin);
    if(open){await open.focus();if(open.navigate)await open.navigate(url).catch(()=>{});}else await self.clients.openWindow(url);
  })());
});
