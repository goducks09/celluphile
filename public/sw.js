// ============================================================
// Cache Names — separate caches per strategy so versioning
// one doesn't invalidate the others.
// ============================================================
const CACHES = {
    shell: 'celluphile-shell-v1',
    tmdbImages: 'celluphile-tmdb-images-v1',
    tmdbApi: 'celluphile-tmdb-api-v1',
    static: 'celluphile-static-v1',
};

// TMDB API responses older than this are treated as expired.
const TMDB_API_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================
// Install — cache the app shell immediately.
// ============================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHES.shell).then((cache) => {
            return cache.addAll([
                '/',
                '/offline',
                '/manifest.json',
                '/icon-192x192.png',
                '/icon-512x512.png',
            ]);
        })
    );
    self.skipWaiting();
});

// ============================================================
// Activate — delete any caches not in the current CACHES map,
// claim clients, then notify them a new SW is active so the
// app can prompt the user to reload.
// ============================================================
self.addEventListener('activate', (event) => {
    const validCacheNames = Object.values(CACHES);

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => !validCacheNames.includes(name))
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
            .then(() => {
                // Notify open tabs so the app can show a "reload for update" toast.
                return self.clients.matchAll({ type: 'window' }).then((clients) => {
                    clients.forEach((client) =>
                        client.postMessage({ type: 'SW_UPDATED' })
                    );
                });
            })
    );
});

// ============================================================
// Fetch
// ============================================================
self.addEventListener('fetch', (event) => {
    // Only handle GET requests.
    if (event.request.method !== 'GET') return;

    // Never cache Next.js Server Actions — they are mutations.
    if (event.request.headers.get('Next-Action')) return;

    const url = new URL(event.request.url);

    // ----------------------------------------------------------
    // Strategy 1: Cache-First for TMDB images.
    // Images are content-addressed so they never go stale.
    // ----------------------------------------------------------
    if (url.hostname === 'image.tmdb.org') {
        event.respondWith(
            caches.open(CACHES.tmdbImages).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;

                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse?.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // ----------------------------------------------------------
    // Strategy 2: Stale-While-Revalidate for TMDB API responses.
    // Serve cached data immediately, update in the background,
    // but treat entries older than TMDB_API_MAX_AGE_MS as expired.
    // ----------------------------------------------------------
    if (url.hostname === 'api.themoviedb.org') {
        event.respondWith(
            caches.open(CACHES.tmdbApi).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchAndCache = fetch(event.request).then((networkResponse) => {
                        if (networkResponse?.status === 200) {
                            // Store response alongside a timestamp header so we can
                            // check freshness on the next read.
                            const headers = new Headers(networkResponse.headers);
                            headers.append('sw-cached-at', Date.now().toString());
                            const timestampedResponse = new Response(
                                networkResponse.clone().body,
                                { status: networkResponse.status, headers }
                            );
                            cache.put(event.request, timestampedResponse);
                        }
                        return networkResponse;
                    });

                    if (cachedResponse) {
                        const cachedAt = cachedResponse.headers.get('sw-cached-at');
                        const isExpired =
                            !cachedAt ||
                            Date.now() - parseInt(cachedAt, 10) > TMDB_API_MAX_AGE_MS;

                        // If expired, wait for the network; otherwise return the
                        // stale response and revalidate in the background.
                        return isExpired ? fetchAndCache : cachedResponse;
                    }

                    return fetchAndCache;
                });
            })
        );
        return;
    }

    // ----------------------------------------------------------
    // Strategy 3: Network-First for HTML navigations.
    // Cache-First would serve stale HTML after a deployment,
    // breaking the hashed chunk references Next.js generates.
    // ----------------------------------------------------------
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    caches.open(CACHES.shell).then((cache) =>
                        cache.put(event.request, response.clone())
                    );
                    return response;
                })
                .catch(() =>
                    // Offline: try the specific route, then fall back to the
                    // app shell root, then the dedicated offline page.
                    caches.match(event.request)
                        .then((r) => r || caches.match('/'))
                        .then((r) => r || caches.match('/offline'))
                )
        );
        return;
    }

    // ----------------------------------------------------------
    // Strategy 4: Cache-First for Next.js static assets.
    // These are immutable — filenames include a build hash.
    // NOTE: /api/ routes are intentionally excluded here.
    // Authenticated API responses must not be cached; offline
    // data is handled by Dexie in the app layer instead.
    // ----------------------------------------------------------
    if (
        url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/icons/') ||
        /\.(png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname)
    ) {
        event.respondWith(
            caches.open(CACHES.static).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;

                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse?.status === 200) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }
});

// ============================================================
// Push Notifications
// ============================================================
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || '/icon-192x192.png',
            badge: '/icon-192x192.png',
            vibrate: [100, 50, 100],
            // Encode the target URL in data so notificationclick
            // can navigate to the right place per notification type.
            data: {
                url: data.url || '/dashboard',
                dateOfArrival: Date.now(),
            },
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    } catch (err) {
        console.error('[SW] Error parsing push payload:', err);
    }
});

// ============================================================
// Notification Click — navigate to the URL encoded in the
// notification's data payload rather than a hardcoded route.
// ============================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a tab is already open on the target URL, focus it.
                for (const client of clientList) {
                    if (client.url === targetUrl && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open a new tab.
                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl);
                }
            })
    );
});
