'use strict';

const CACHE_PREFIX = 'market-diary-';
const CACHE = CACHE_PREFIX + 'shell-v7';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=20260903-2',
  './app.js?v=20260903-2',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest',
  './data/events.json'
];

self.addEventListener('install', event => {
  const shellRequests = SHELL.map(path => new Request(path, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(shellRequests)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const network = fetch(request, { cache: request.mode === 'navigate' ? 'reload' : 'no-cache' });
  event.waitUntil(
    network.then(response => {
      if (!response.ok) return undefined;
      return caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    }).catch(() => {})
  );
  event.respondWith(
    network.catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return caches.match('./index.html');
      throw new Error('offline and not cached');
    })
  );
});
