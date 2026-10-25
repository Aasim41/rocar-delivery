// AutoDrop Service Worker for Background Push & Periodic Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification event listener (triggered from server / backend)
self.addEventListener('push', (event) => {
  let data = { title: '🤖 AutoDrop Fleet Online', body: 'Cart standing by for your next campus delivery.' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open', title: 'Open AutoDrop' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message listener from web app to schedule future notifications in SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { delayMs, title, body, data } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title || 'AutoDrop Update', {
        body: body || 'Your delivery cart is ready.',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: data || { url: '/' }
      });
    }, delayMs || 1000);
  }
});
