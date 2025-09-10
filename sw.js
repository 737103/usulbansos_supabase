const CACHE_NAME = 'bansos-app-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/style.css?v=4',
  '/assets/js/script.js?v=3',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap'
];

// Install event
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', function(event) {
  // Skip API requests - let them go to network directly
  if (event.request.url.includes('/api/')) {
    return;
  }
  // Bypass caching for uploads to avoid stale images or 404 caching
  if (event.request.url.includes('/uploads/')) {
    return;
  }
  
  const url = new URL(event.request.url);
  const isHTML = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isCSS = url.pathname.endsWith('.css') || url.search.includes('style.css');
  const isJS = url.pathname.endsWith('.js');

  if (isHTML || isCSS || isJS) {
    // Network-first for HTML/CSS/JS to avoid stale UI
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Default cache-first for other assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
      );
    })
  );
});

// Activate event
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
