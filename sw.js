self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const title = data.title || 'New Message';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
