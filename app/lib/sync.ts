/**
 * Registers a Background Sync so the service worker can replay
 * queued IndexedDB operations even after the tab is closed.
 *
 * Falls back silently if the browser doesn't support Background
 * Sync (e.g. Firefox, Safari) — the app-level OfflineManager
 * still handles sync when a tab is open.
 */
export async function registerBackgroundSync(): Promise<void> {
    if (typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        // Background Sync API is behind the SyncManager interface
        if ('sync' in registration) {
            await (registration as any).sync.register('offline-sync');
        }
    } catch (err) {
        // Silent fallback — sync will happen via OfflineManager when
        // the user opens the app and goes online.
        console.warn('[registerBackgroundSync] Failed:', err);
    }
}
