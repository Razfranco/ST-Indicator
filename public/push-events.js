/* Private meeting details are shown only after login. */
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{}}catch{/* Always display a visible notification. */}
 const safe=typeof data.url==='string' && /^\/(mentoring|business)\//.test(data.url)?data.url:'/mentoring/notifications';
 event.waitUntil(self.registration.showNotification('Shark Trade',{body:typeof data.body==='string'?data.body:'יש עדכון בפלטפורמת הליווי',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:typeof data.tag==='string'?data.tag:'mentoring',data:{url:safe}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const path=event.notification.data?.url;
 const url=new URL(typeof path==='string' && /^\/(mentoring|business)\//.test(path)?path:'/mentoring/notifications',self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{for(const client of clients){if(new URL(client.url).origin===self.location.origin){await client.navigate(url);return client.focus()}}return self.clients.openWindow(url)}));
});
