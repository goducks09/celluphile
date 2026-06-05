'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { subscribeUser, unsubscribeUser } from '../actions';
import urlBase64ToUint8Array from '../helpers';

const PUSH_CHANGE_EVENT = 'push-subscription-change';

/**
 * Re-reads the current push subscription from the service worker.
 * Used to sync state across multiple hook instances after a change.
 */
async function readCurrentSubscription(): Promise<PushSubscription | null> {
    try {
        const registration = await navigator.serviceWorker.ready;
        return await registration.pushManager.getSubscription();
    } catch {
        return null;
    }
}

/**
 * Shared hook that encapsulates push-notification state and actions.
 * Used by both the global banner and the settings-page manager.
 *
 * Multiple instances stay in sync via a custom DOM event dispatched
 * whenever the subscription changes — each listener re-reads the
 * actual browser state so they converge on the same value.
 */
export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            registerServiceWorker();
        }
    }, []);

    // Listen for subscription changes from other hook instances.
    useEffect(() => {
        function handleChange() {
            readCurrentSubscription().then(setSubscription);
        }
        window.addEventListener(PUSH_CHANGE_EVENT, handleChange);
        return () => window.removeEventListener(PUSH_CHANGE_EVENT, handleChange);
    }, []);

    async function registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none',
            });
            const sub = await registration.pushManager.getSubscription();
            setSubscription(sub);
        } catch (error) {
            toast.error('Push notifications registration failed.');
            console.error('Error registering service worker:', error);
        }
    }

    const subscribeToPush = useCallback(async () => {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
            console.error('Push notifications are not configured: NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.');
            toast.error('Push notifications are not available right now. Please try again later.');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
            setSubscription(sub);
            const serializedSub = JSON.parse(JSON.stringify(sub));
            await subscribeUser(serializedSub);
            toast.success('Subscribed to push notifications.');
            // Notify other hook instances so they pick up the new state.
            window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));
        } catch (error) {
            toast.error('Push notifications subscription failed.');
            console.error('Error subscribing to push notifications:', error);
        }
    }, []);

    const unsubscribeFromPush = useCallback(async () => {
        try {
            const endpoint = subscription?.endpoint;
            await subscription?.unsubscribe();
            setSubscription(null);
            if (endpoint) {
                await unsubscribeUser(endpoint);
            }
            toast.success('Unsubscribed from push notifications.');
            // Notify other hook instances so they pick up the new state.
            window.dispatchEvent(new Event(PUSH_CHANGE_EVENT));
        } catch (error) {
            toast.error('Push notifications unsubscription failed.');
            console.error('Error unsubscribing from push notifications:', error);
        }
    }, [subscription]);

    return { isSupported, subscription, subscribeToPush, unsubscribeFromPush };
}
