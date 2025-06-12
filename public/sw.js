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
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js',
  // Note: React build assets (e.g., main.js) will be cached dynamically after build
];

// Install event: Cache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching assets');
      return cache.addAll(urlsToCache).catch(error => {
        console.error('Failed to cache some assets:', error);
      });
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
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
  
  // Skip requests to browser extensions and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

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
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // Clone the response before caching
          const responseClone = networkResponse.clone();
          
          // Cache the response for future use
          caches.open(CACHE_NAME).then((cache) => {
            // Only cache GET requests
            if (event.request.method === 'GET') {
              cache.put(event.request, responseClone);
            }
          });

          return networkResponse;
        }).catch(() => {
          // Return a meaningful offline response for failed GET requests
          if (url.pathname.includes('/api/') || url.hostname !== location.hostname) {
            return new Response(JSON.stringify({ 
              error: 'Content not available offline',
              offline: true 
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          // For HTML requests, you might want to return a cached offline page
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/') || new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            });
          }
          
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        });
      })
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for workout data (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'workout-sync') {
    event.waitUntil(syncWorkoutData());
  }
});

// Function to sync workout data when back online
async function syncWorkoutData() {
  try {
    // This would sync any stored workout data
    // Implementation would depend on your IndexedDB structure
    console.log('Syncing workout data...');
    
    // Example: Get stored workout data and sync to server
    // const workouts = await getStoredWorkouts();
    // for (const workout of workouts) {
    //   await fetch('/track-exercise', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(workout)
    //   });
    // }
  } catch (error) {
    console.error('Error syncing workout data:', error);
  }
}

// Push notification handling (if you implement push notifications)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New workout reminder!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'workout-reminder',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('FitnGro', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
});