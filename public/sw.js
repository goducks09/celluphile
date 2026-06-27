// ============================================================
// Cache Names — separate caches per strategy so versioning
// one doesn't invalidate the others.
// ============================================================
const CACHES = {
    shell: 'celluphile-shell-v1',
    tmdbImages: 'celluphile-tmdb-images-v1',
    tmdbApi: 'celluphile-tmdb-api-v1',
    static: 'celluphile-static-v1',
    rscData: 'celluphile-rsc-data-v1',
};

// TMDB API responses older than this are treated as expired.
const TMDB_API_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Background Sync tag used to replay offline mutations.
const SYNC_TAG = 'offline-sync';

// ============================================================
// Install — cache the app shell immediately.
// ============================================================
self.addEventListener('install', (event) => {
    // Use Promise.allSettled so that a redirect (e.g. '/' → '/dashboard'
    // for authenticated users) or a transient network error on any single
    // shell asset does not abort the entire install with "Failed to fetch".
    // '/' is intentionally excluded — auth middleware always redirects
    // authenticated users away from it (307), so cache.add('/') would
    // fail on every install. Navigation fallback is handled by the
    // Network-First strategy in the fetch handler instead.
    event.waitUntil(
        caches.open(CACHES.shell).then(async (cache) => {
            // Cache static shell assets
            const staticAssets = [
                '/manifest.webmanifest',
                '/icon-192x192.png',
                '/icon-512x512.png',
            ];
            await Promise.allSettled(
                staticAssets.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[SW] Failed to pre-cache:', url, err);
                    })
                )
            );

            // Fetch and cache the offline page plus its JS/CSS dependencies
            try {
                const offlineResponse = await fetch('/offline');
                if (offlineResponse.ok) {
                    const clone = offlineResponse.clone();
                    const html = await offlineResponse.text();
                    // Store the offline HTML response (preserving original headers)
                    await cache.put(new Request('/offline'), clone);
                    // Extract and cache referenced /_next/static/ assets only
                    const assetUrls = [...html.matchAll(/\/_next\/static\/[^"'\s)]+/g)]
                        .map((m) => m[0]);
                    const uniqueAssets = [...new Set(assetUrls)];
                    await Promise.allSettled(
                        uniqueAssets.map((url) =>
                            cache.add(url).catch((err) => {
                                console.warn('[SW] Failed to pre-cache asset:', url, err);
                            })
                        )
                    );
                }
            } catch (err) {
                console.warn('[SW] Failed to pre-cache offline page:', err);
            }
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
    // Movie details rarely change — serve cached data instantly
    // while refreshing in the background.
    // ----------------------------------------------------------
    if (url.pathname.startsWith('/api/tmdb/')) {
        event.respondWith(
            caches.open(CACHES.tmdbApi).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse?.status === 200) {
                                // Store with a timestamp header so we can
                                // check freshness on future reads.
                                const cloned = networkResponse.clone();
                                const headers = new Headers(cloned.headers);
                                headers.set('sw-cached-at', Date.now().toString());
                                cloned.blob().then((body) => {
                                    cache.put(
                                        event.request,
                                        new Response(body, {
                                            status: cloned.status,
                                            statusText: cloned.statusText,
                                            headers,
                                        })
                                    );
                                });
                            }
                            return networkResponse;
                        })
                        .catch((err) => {
                            console.warn('[SW] TMDB API revalidation failed:', err);
                            // If revalidation fails and we have a cached version,
                            // the stale response was already returned below.
                            return undefined;
                        });

                    // Return cached response immediately if available.
                    // The fetch runs in the background to update the cache.
                    if (cachedResponse) {
                        // Fire-and-forget: update in background
                        event.waitUntil(fetchPromise);
                        return cachedResponse;
                    }

                    // No cache — wait for the network.
                    return fetchPromise.then((res) => res || new Response('Offline', { status: 503 }));
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
                    // Only cache actual HTML pages, not redirect responses.
                    // Caching 302/307 auth redirects would serve stale redirects
                    // to logged-in users and cause redirect loops offline.
                    if (response.status === 200) {
                        caches.open(CACHES.shell).then((cache) =>
                            cache.put(event.request, response.clone())
                        );
                    }
                    return response;
                })
                .catch(() =>
                    // Offline: try the specific route, then fall back to the
                    // dedicated offline page.
                    caches.match(event.request)
                        .then((r) => r || caches.match('/offline'))
                )
        );
        return;
    }

    // ----------------------------------------------------------
    // Strategy 4: Network-First for RSC data requests.
    // Next.js client-side navigations fetch RSC payloads as GET
    // requests with the RSC header or _rsc query param. These
    // contain user-specific, mutable data (library contents, etc.)
    // so we always prefer fresh data from the network. The cache
    // is only used as an offline fallback so previously-visited
    // pages remain accessible without connectivity.
    // ----------------------------------------------------------
    if (
        event.request.headers.get('RSC') === '1' ||
        url.searchParams.has('_rsc')
    ) {
        event.respondWith(
            caches.open(CACHES.rscData).then((cache) => {
                // Use just the pathname as the cache key so the volatile
                // _rsc query param (which changes every request) doesn't
                // cause cache misses.
                const cacheKey = new Request(url.pathname, {
                    headers: event.request.headers,
                });

                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse?.status === 200) {
                            cache.put(cacheKey, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() =>
                        // Offline: serve the last-known RSC payload for this route.
                        cache.match(cacheKey).then((cached) =>
                            cached || new Response('Offline', { status: 503 })
                        )
                    );
            })
        );
        return;
    }

    // ----------------------------------------------------------
    // Strategy 5: Cache-First for Next.js static assets.
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
// Background Sync — process queued offline mutations when
// connectivity is restored, even if no app tabs are open.
// ============================================================
self.addEventListener('sync', (event) => {
    if (event.tag !== SYNC_TAG) return;

    event.waitUntil(processOfflineSyncQueue());
});

/**
 * Reads pending operations from the CelluphileDB IndexedDB
 * `syncQueue` store and POSTs them in batch to the server.
 * Successfully synced operations are deleted from the queue.
 */
async function processOfflineSyncQueue() {
    let db;
    try {
        db = await openIndexedDB('CelluphileDB', 1);
    } catch (err) {
        console.warn('[SW Sync] Could not open IndexedDB:', err);
        return;
    }

    let pendingOps;
    try {
        pendingOps = await getAllFromStore(db, 'syncQueue');
    } catch (err) {
        console.warn('[SW Sync] Could not read syncQueue:', err);
        return;
    }

    if (!pendingOps || pendingOps.length === 0) return;

    // Sort by timestamp to preserve operation ordering
    pendingOps.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Map to the API payload format (strip IDB metadata)
    const operations = pendingOps.map((op) => ({
        action: op.action,
        payload: op.payload,
    }));

    try {
        const response = await fetch('/api/library/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operations }),
        });

        if (response.status === 401) {
            // Session expired — keep the queue and retry later.
            console.warn('[SW Sync] Unauthorized — will retry on next sync.');
            return;
        }

        if (!response.ok) {
            console.error('[SW Sync] Server error:', response.status);
            // Throw to signal the Background Sync API to retry later.
            throw new Error(`Sync failed: ${response.status}`);
        }

        const { results } = await response.json();

        // Delete successfully synced operations from IDB
        const tx = db.transaction('syncQueue', 'readwrite');
        const store = tx.objectStore('syncQueue');
        for (const result of results) {
            if (result.success) {
                const opToDelete = pendingOps[result.index];
                if (opToDelete?.id != null) {
                    store.delete(opToDelete.id);
                }
            }
        }

        // If any operation failed, throw to trigger a retry via
        // the Background Sync API's built-in retry mechanism.
        const firstFailure = results.find((r) => !r.success);
        if (firstFailure) {
            console.warn('[SW Sync] Partial failure at index', firstFailure.index, firstFailure.message);
            throw new Error('Partial sync failure — will retry.');
        }

        // Notify any open tabs to refresh their data
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => {
            client.postMessage({ type: 'SYNC_COMPLETED' });
        });
    } catch (err) {
        console.error('[SW Sync] Error during sync:', err);
        throw err; // Re-throw so Background Sync API retries
    }
}

// ============================================================
// IndexedDB helpers — lightweight wrappers for raw IDB access
// since Dexie is not available in the service worker context.
// ============================================================

function openIndexedDB(name, version) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        // If the DB hasn't been created by the app yet, abort.
        request.onupgradeneeded = () => {
            request.transaction.abort();
            reject(new Error('DB does not exist yet'));
        };
    });
}

function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

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
            requireInteraction: data.requireInteraction || false,
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
    const targetFullUrl = new URL(targetUrl, self.location.origin).href;

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If a tab is already open on the target URL, focus it.
                for (const client of clientList) {
                    if (client.url.startsWith(targetFullUrl) && 'focus' in client) {
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
