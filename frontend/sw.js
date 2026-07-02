// This app no longer registers a service worker (see index.html) -- this
// file exists only to clean up browsers that already installed the old one.
// The browser checks this URL for changes on every navigation and installs
// whatever it finds, so this replaces the old caching worker with one that
// deletes its caches, unregisters itself, and reloads any open tabs once.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => caches.delete(name))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  );
});
