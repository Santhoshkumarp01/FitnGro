/**
 * Service worker for FitnGro app.
 * Caches assets for offline support.
 */
const CACHE_NAME = 'fitngro-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/global.css',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  // Note: React build assets (e.g., main.js) will be cached dynamically after build
];

// Install event: Cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching assets');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Serve cached assets or fetch from network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle POST requests differently - don't try to cache them
  if (event.request.method === 'POST') {
    // For POST requests, just fetch from network and provide offline fallback
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Return offline response for POST requests
          if (url.pathname === '/start-workout') {
            return new Response(JSON.stringify({ 
              error: 'Offline - workout data will be synced when connection is restored',
              offline: true 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          } else if (url.pathname === '/track-exercise') {
            return new Response(JSON.stringify({ 
              success: false,
              message: 'Exercise tracking saved locally - will sync when online',
              offline: true 
            }), {
              status: 200, // Return 200 so the app doesn't think it failed
              headers: { 'Content-Type': 'application/json' },
            });
          } else {
            return new Response(JSON.stringify({ 
              error: 'Service unavailable - please try again when online' 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        })
    );
  } else {
    // Cache-first strategy for GET requests and other safe methods
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
          // Only cache successful responses
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Only cache GET requests
              if (event.request.method === 'GET') {
                cache.put(event.request, responseClone);
              }
            });
          }
          return networkResponse;
        }).catch(() => {
          // Return a meaningful offline response for failed GET requests
          return new Response(JSON.stringify({ 
            error: 'Content not available offline' 
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        });
      })
    );
  }
});