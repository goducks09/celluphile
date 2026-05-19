'use client';

import { usePathname } from 'next/navigation';
import { usePushNotifications } from '../lib/hooks/use-push-notifications';

/**
 * Global subscribe-only banner shown at the top of every page (except settings).
 * Once the user subscribes, this component renders nothing — unsubscribe
 * is only available on the settings page via PushNotificationManager.
 */
export default function PushNotificationBanner() {
    const pathname = usePathname();
    const { isSupported, subscription, subscribeToPush } = usePushNotifications();

    // Don't render on pages that have their own push-notification controls.
    if (pathname.startsWith('/dashboard/settings')) return null;

    // Not supported or already subscribed → nothing to show.
    if (!isSupported || subscription) return null;

    return (
        <div
            className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 py-3 px-4 text-sm font-medium"
            style={{
                background: 'var(--background-card)',
                color: 'var(--foreground)',
                borderBottom: '1px solid var(--border)',
            }}
        >
            <p className="text-center md:text-left">
                You are not subscribed to push notifications.
            </p>
            <button
                onClick={subscribeToPush}
                className="bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm mt-2 md:mt-0"
            >
                Subscribe to push notifications
            </button>
        </div>
    );
}
