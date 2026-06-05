'use client';

import { usePushNotifications } from '../lib/hooks/use-push-notifications';

/**
 * Full push-notification manager for the settings page.
 * Shows subscribe when not subscribed, unsubscribe when subscribed.
 */
export default function PushNotificationManager() {
    const { isSupported, subscription, subscribeToPush, unsubscribeFromPush } = usePushNotifications();

    if (!isSupported) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">Push notifications are not supported by this browser.</p>;
    }

    return (
        <div className="flex items-center gap-3">
            {subscription ? (
                <button
                    onClick={unsubscribeFromPush}
                    className="text-sm text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors whitespace-nowrap"
                >
                    Unsubscribe from push notifications
                </button>
            ) : (
                <>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        You are not subscribed to push notifications.
                    </p>
                    <button
                        onClick={subscribeToPush}
                        className="bg-indigo-600 text-white rounded px-4 py-1.5 text-sm hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm"
                    >
                        Subscribe
                    </button>
                </>
            )}
        </div>
    );
}