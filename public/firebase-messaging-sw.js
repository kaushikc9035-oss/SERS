// Firebase Messaging Service Worker for Background Push Notifications
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB4juMktTk5FOwfzvoNdXDBW0Qn4Fi4Lzo",
  projectId: "gen-lang-client-0091455757",
  authDomain: "gen-lang-client-0091455757.firebaseapp.com",
  messagingSenderId: "552192308744",
  appId: "1:552192308744:web:7fc382161b1779151f83bd"
});

const messaging = firebase.messaging();

// Background Push Notification Handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  const title = payload.notification?.title || payload.data?.title || '🚨 Emergency Green Corridor Alert';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'Approaching emergency vehicle requires traffic preemption.',
    icon: payload.notification?.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.data?.tag || `signal-${payload.data?.signalId || 'alert'}`,
    data: payload.data || {},
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200]
  };

  self.registration.showNotification(title, options);
});

// Handle notification tap / click by focusing or opening the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
