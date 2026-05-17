const CACHE = 'health-tracker-v4';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('/index.html', copy));
        return res;
      }).catch(() => caches.match('/index.html').then(cached => cached || caches.match('/')))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

/* True background push — fired by Vercel cron via web-push */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data.json(); } catch {}
  const title = data.title || "Log your day";
  const body  = data.body  || "Tap to record tonight's distance, sleep and workout.";
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag:  'daily-reminder',
      icon: '/icon-192.png',
      badge:'/icon-192.png',
      requireInteraction: false
    })
  );
});

/* Fallback SW timer — fires when app was recently opened */
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE') {
    const ms = e.data.ms;
    if (ms > 0 && ms < 86400000) {
      setTimeout(() => {
        self.registration.showNotification("Log your day", {
          body: e.data.body || "Tap to record tonight's log.",
          tag:  'daily-reminder',
          icon: '/icon-192.png',
          badge:'/icon-192.png',
          requireInteraction: false
        });
      }, ms);
    }
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});
