'use client';

import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db-client';
import { addMovieToLibrary, removeMovieFromLibrary, updateMovieInLibrary } from '../lib/actions';

const MAX_RETRY_COUNT = 3;

export default function OfflineManager() {
    // Always initialise as false to match the server render and avoid
    // hydration mismatches. The real online/offline state is synced in
    // the useEffect below once the component mounts on the client.
    const [isOffline, setIsOffline] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Ref-based guard so the sync lock doesn't need to live in the
    // useEffect dependency array (which would cause listener teardown
    // and re-registration on every state change).
    const isSyncingRef = useRef(false);

    // Live query — re-renders automatically when the queue changes,
    // including changes triggered by other tabs.
    const pendingCount = useLiveQuery(() => db.syncQueue.count(), []);

    useEffect(() => {
        const processSyncQueue = async () => {
            if (isSyncingRef.current) return;

            const pendingOps = await db.syncQueue.orderBy('timestamp').toArray();
            if (pendingOps.length === 0) return;

            isSyncingRef.current = true;
            setIsSyncing(true);

            try {
                for (const op of pendingOps) {
                    // Discard permanently failing operations so they don't
                    // block the rest of the queue indefinitely.
                    if ((op.retryCount ?? 0) >= MAX_RETRY_COUNT) {
                        console.error('[OfflineManager] Discarding op after max retries:', op);
                        await db.syncQueue.delete(op.id!);
                        continue;
                    }

                    try {
                        if (op.action === 'add') {
                            await addMovieToLibrary(op.payload);
                        } else if (op.action === 'remove') {
                            await removeMovieFromLibrary(op.payload.tmdbId);
                        } else if (op.action === 'update') {
                            await updateMovieInLibrary(op.payload.tmdbId, op.payload.updateData);
                        }
                        // Remove from queue on success.
                        await db.syncQueue.delete(op.id!);
                    } catch (err) {
                        console.error('[OfflineManager] Failed to sync operation:', op, err);
                        // Increment retry count, then break to preserve
                        // ordering — later ops may depend on this one.
                        await db.syncQueue.update(op.id!, {
                            retryCount: (op.retryCount ?? 0) + 1,
                        });
                        break;
                    }
                }
            } finally {
                isSyncingRef.current = false;
                setIsSyncing(false);
            }
        };

        const handleOnline = () => {
            setIsOffline(false);
            processSyncQueue();
        };
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Sync the real online/offline state now that we're on the client.
        setIsOffline(!navigator.onLine);

        // Attempt to drain the queue on mount in case operations were
        // queued in a previous session. Auth errors here are non-fatal —
        // the op stays in the queue and retries on the next online event.
        if (navigator.onLine) {
            processSyncQueue();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []); // Stable — no state in deps; sync lock is managed via ref.

    if (!isOffline && !isSyncing) return null;

    return (
        <div className="fixed top-4 left-0 right-0 z-50 pointer-events-none flex flex-col items-center gap-2">
            {isOffline && (
                <div className="bg-yellow-500 text-black text-center py-2 px-6 rounded-full shadow-lg text-sm font-medium">
                    You are offline. Changes will save locally and sync upon reconnect.
                </div>
            )}
            {isSyncing && !isOffline && (
                <div className="bg-indigo-600 text-white text-center py-2 px-6 rounded-full shadow-lg text-sm font-medium animate-pulse">
                    {pendingCount != null && pendingCount > 0
                        ? `Syncing ${pendingCount} offline change${pendingCount === 1 ? '' : 's'}...`
                        : 'Syncing offline library changes...'}
                </div>
            )}
        </div>
    );
}
