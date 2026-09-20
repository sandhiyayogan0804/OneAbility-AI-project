/**
 * OneAbility AI - PWA Service Worker (Offline Accessibility Cache)
 * Caches static shell, styles, scripts, and local assets so the application
 * launches 100% offline after the initial visit.
 * 
 * Safety Rule: NEVER cache live API endpoints (/api/) or future real payment credentials.
 */

const CACHE_NAME = 'oneability-pay-v1.8';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/design-system.css',
  './css/accessibility-modes.css',
  './css/components.css',
  './js/vendor/zxing.min.js',
  './js/vendor/jsQR.js',
  './js/haptic-sound.js',
  './js/i18n.js',
  './js/tts-voice.js',
  './js/stt-listener.js',
  './js/accessibility-engine.js',
  './js/pay-simulator.js',
  './js/screen-inspector.js',
  './js/app.js',
  './oneability_platform_mockup_1789718782369.jpg'
];

// Install Event: Pre-cache app shell and core accessibility assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static app shell');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clear older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Serve static shell from cache, network-only for API calls
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. SAFETY: Never cache API requests (/api/) or external live endpoints
  if (requestUrl.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        console.warn('[Service Worker] Backend offline, allowing frontend fallback:', err.message);
        return new Response(JSON.stringify({
          success: false,
          offline: true,
          message: 'Backend server is unreachable. Offline fallback active.'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Static Assets: Stale-While-Revalidate / Cache-First strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to update cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Offline: silent catch
        });
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // If navigating to an HTML page and offline, serve cached index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
